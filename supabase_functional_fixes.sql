-- ============================================================================
-- Grace Church App — functional fixes (2026-09-12)
-- Run in Supabase SQL Editor. Idempotent: safe to re-run.
--
--  A. visit_requests: members / anonymous users could not submit a home-visit
--     request (RLS 403). The insert policy exists in supabase_setup.sql but was
--     missing from the live database.
--  B. apply_volunteer(): volunteer sign-ups were only kept in app memory and
--     vanished on restart. Members have no UPDATE right on volunteer_posts, so
--     the write goes through a SECURITY DEFINER function that appends the name
--     to the chosen role atomically.
--  C. Pending-user approval from inside the app (pastor only). Email confirm
--     is ON, so new sign-ups sit unconfirmed until someone confirms them in the
--     Supabase dashboard. These RPCs let the Admin screen list / approve /
--     reject them instead.
--  D. delete_my_account(): "Delete Account" only signed the user out. Now it
--     deletes the auth user; profiles / blocked_users / reports cascade, UGC
--     author_id becomes NULL via ON DELETE SET NULL.
--  E. push_tokens + notify_push trigger: device tokens for Expo push, and a
--     pg_net trigger that calls the send-push Edge Function whenever an
--     announcement or event is inserted.
-- ============================================================================

-- ── A. visit_requests insert policy ─────────────────────────────────────────
drop policy if exists "visit_insert_any" on public.visit_requests;
create policy "visit_insert_any" on public.visit_requests
  for insert with check (true);

-- ── B. volunteer sign-up ───────────────────────────────────────────────────
create or replace function public.apply_volunteer(
  p_post_id uuid,
  p_role_id text,
  p_name    text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_roles   jsonb;
  v_role    jsonb;
  v_idx     int;
  v_needed  int;
  v_applied int;
  v_name    text := btrim(coalesce(p_name, ''));
begin
  if v_name = '' then
    raise exception 'NAME_REQUIRED';
  end if;
  if public.contains_blocked_words(v_name) then
    raise exception 'BLOCKED_CONTENT';
  end if;

  select roles into v_roles from public.volunteer_posts where id = p_post_id for update;
  if v_roles is null then
    raise exception 'POST_NOT_FOUND';
  end if;

  select ord - 1, elem into v_idx, v_role
    from jsonb_array_elements(v_roles) with ordinality as t(elem, ord)
   where elem->>'id' = p_role_id
   limit 1;
  if v_role is null then
    raise exception 'ROLE_NOT_FOUND';
  end if;

  v_needed  := coalesce((v_role->>'needed')::int, 0);
  v_applied := jsonb_array_length(coalesce(v_role->'applicants', '[]'::jsonb));
  if v_applied >= v_needed then
    raise exception 'ROLE_FULL';
  end if;
  if coalesce(v_role->'applicants', '[]'::jsonb) ? v_name then
    raise exception 'ALREADY_APPLIED';
  end if;

  v_role  := jsonb_set(v_role, '{applicants}', coalesce(v_role->'applicants', '[]'::jsonb) || to_jsonb(v_name));
  v_roles := jsonb_set(v_roles, array[v_idx::text], v_role);

  update public.volunteer_posts set roles = v_roles where id = p_post_id;
  return v_roles;
end;
$$;
grant execute on function public.apply_volunteer(uuid, text, text) to anon, authenticated;

-- ── C. pending-user approval (pastor only) ─────────────────────────────────
create or replace function public.admin_list_pending_users()
returns table (id uuid, email text, full_name text, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select u.id,
         u.email::text,
         coalesce(p.full_name, u.raw_user_meta_data->>'full_name') as full_name,
         u.created_at
    from auth.users u
    left join public.profiles p on p.id = u.id
   where public.is_pastor()
     and u.email_confirmed_at is null
     and u.deleted_at is null
   order by u.created_at desc;
$$;
grant execute on function public.admin_list_pending_users() to authenticated;

create or replace function public.admin_approve_user(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_pastor() then
    raise exception 'Not authorized';
  end if;
  update auth.users
     set email_confirmed_at = coalesce(email_confirmed_at, now()),
         updated_at = now()
   where id = target_id;
end;
$$;
grant execute on function public.admin_approve_user(uuid) to authenticated;

create or replace function public.admin_reject_user(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_pastor() then
    raise exception 'Not authorized';
  end if;
  -- Only ever removes accounts that were never confirmed.
  delete from auth.users
   where id = target_id
     and email_confirmed_at is null;
end;
$$;
grant execute on function public.admin_reject_user(uuid) to authenticated;

-- ── D. self-service account deletion ───────────────────────────────────────
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  delete from public.push_tokens where user_id = v_uid;
  delete from auth.users where id = v_uid;
end;
$$;
grant execute on function public.delete_my_account() to authenticated;

-- ── E. push notifications ──────────────────────────────────────────────────
create table if not exists public.push_tokens (
  token      text primary key,                      -- ExponentPushToken[...]
  user_id    uuid references auth.users(id) on delete cascade,
  platform   text,
  lang       text,
  updated_at timestamptz not null default now()
);
alter table public.push_tokens enable row level security;

drop policy if exists "push_upsert_any" on public.push_tokens;
drop policy if exists "push_update_any" on public.push_tokens;
drop policy if exists "push_delete_any" on public.push_tokens;
-- A device only ever knows its own token, and Expo tokens are unguessable, so
-- keying access on the token itself is sufficient. user_id is informational.
create policy "push_upsert_any" on public.push_tokens for insert with check (true);
create policy "push_update_any" on public.push_tokens for update using (true) with check (true);
create policy "push_delete_any" on public.push_tokens for delete using (true);

create extension if not exists pg_net;

create or replace function public.notify_push_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, net, extensions
as $$
begin
  perform net.http_post(
    url     := 'https://epgwwsixhgdagavnurog.supabase.co/functions/v1/send-push',
    body    := jsonb_build_object(
                 'type',   'INSERT',
                 'table',  tg_table_name,
                 'schema', tg_table_schema,
                 'record', to_jsonb(new)
               ),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return new;
end;
$$;

drop trigger if exists push_on_announcement on public.announcements;
create trigger push_on_announcement
  after insert on public.announcements
  for each row execute function public.notify_push_webhook();

drop trigger if exists push_on_event on public.events;
create trigger push_on_event
  after insert on public.events
  for each row execute function public.notify_push_webhook();
