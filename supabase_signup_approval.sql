-- ============================================================================
-- Grace Church App — sign-up approval by email (2026-09-15)
-- Run in Supabase SQL Editor AFTER supabase_functional_fixes.sql. Idempotent.
--
-- Every new sign-up gets a one-time approval token. A trigger POSTs it to the
-- notify-signup Edge Function, which emails the approvers with Approve/Reject
-- links. Clicking a link hits approve-signup, which confirms (or deletes) the
-- auth user. The in-app Admin → Approvals tab keeps working alongside this.
-- ============================================================================

create table if not exists public.signup_approvals (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  token       uuid not null unique default gen_random_uuid(),
  email       text,
  full_name   text,
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  decision    text check (decision in ('approved','rejected')),
  decided_by  text                      -- 'email' | 'app'
);
alter table public.signup_approvals enable row level security;
-- No client policies on purpose: only SECURITY DEFINER functions and the
-- service-role Edge Function touch this table. Tokens must never be readable.

-- ── 1) new auth user → approval row ────────────────────────────────────────
create or replace function public.handle_new_user_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Users that arrive already confirmed (e.g. created by an admin) need no approval.
  if new.email_confirmed_at is null then
    insert into public.signup_approvals (user_id, email, full_name)
    values (new.id, new.email, new.raw_user_meta_data->>'full_name')
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_approval on auth.users;
create trigger on_auth_user_created_approval
  after insert on auth.users
  for each row execute function public.handle_new_user_approval();

-- ── 2) approval row → email the approvers ─────────────────────────────────
create extension if not exists pg_net;

create or replace function public.notify_signup_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, net, extensions
as $$
begin
  perform net.http_post(
    url     := 'https://epgwwsixhgdagavnurog.supabase.co/functions/v1/notify-signup',
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

drop trigger if exists notify_signup_on_insert on public.signup_approvals;
create trigger notify_signup_on_insert
  after insert on public.signup_approvals
  for each row execute function public.notify_signup_webhook();

-- ── 3) in-app approve/reject also close the approval row ──────────────────
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
  update public.signup_approvals
     set decided_at = now(), decision = 'approved', decided_by = 'app'
   where user_id = target_id and decided_at is null;
end;
$$;

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
  -- Row in signup_approvals goes away via ON DELETE CASCADE.
  delete from auth.users
   where id = target_id
     and email_confirmed_at is null;
end;
$$;

-- ── 4) backfill: anyone currently waiting gets a token (and an email) ──────
insert into public.signup_approvals (user_id, email, full_name)
select u.id, u.email, u.raw_user_meta_data->>'full_name'
  from auth.users u
 where u.email_confirmed_at is null
   and u.deleted_at is null
on conflict (user_id) do nothing;
