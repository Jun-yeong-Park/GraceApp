-- ============================================================================
-- Grace Church App — community access control (2026-09-15)
-- Run in Supabase SQL Editor. Idempotent.
--
-- Each member belongs to ONE community (profiles.community_id). Members can
-- only read and write content in their own community; pastors see everything.
-- Enforced here in RLS, not just in the app, so a modified client can't peek.
-- ============================================================================

alter table public.profiles
  add column if not exists community_id text
  check (community_id in ('kosovo','albania','dagestan','kissimmee','bridge','hope','community7'));

-- Current user's community (NULL for pastors / unassigned). SECURITY DEFINER so
-- it can be used inside policies without recursing into profiles' own RLS.
create or replace function public.my_community_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select community_id from public.profiles where id = auth.uid();
$$;
grant execute on function public.my_community_id() to anon, authenticated;

-- ── community_posts ────────────────────────────────────────────────────────
drop policy if exists "cposts_read_all" on public.community_posts;
create policy "cposts_read_all" on public.community_posts
  for select using (public.is_pastor() or community_id = public.my_community_id());

drop policy if exists "cposts_insert_authed" on public.community_posts;
create policy "cposts_insert_authed" on public.community_posts
  for insert with check (
    public.is_current_user_active()
    and (public.is_pastor() or community_id = public.my_community_id())
  );

-- ── community_photos ───────────────────────────────────────────────────────
drop policy if exists "cphotos_read_all" on public.community_photos;
create policy "cphotos_read_all" on public.community_photos
  for select using (public.is_pastor() or community_id = public.my_community_id());

drop policy if exists "cphotos_insert_authed" on public.community_photos;
create policy "cphotos_insert_authed" on public.community_photos
  for insert with check (
    public.is_current_user_active()
    and (public.is_pastor() or community_id = public.my_community_id())
  );

-- ── community_messages (chat) ──────────────────────────────────────────────
drop policy if exists "cmsg_read_all" on public.community_messages;
create policy "cmsg_read_all" on public.community_messages
  for select using (public.is_pastor() or community_id = public.my_community_id());

drop policy if exists "cmsg_insert_authed" on public.community_messages;
create policy "cmsg_insert_authed" on public.community_messages
  for insert with check (
    public.is_current_user_active()
    and auth.uid() = author_id
    and (public.is_pastor() or community_id = public.my_community_id())
  );

-- ── post_comments (follow the parent post's community) ─────────────────────
drop policy if exists "comments_read_all" on public.post_comments;
create policy "comments_read_all" on public.post_comments
  for select using (
    exists (
      select 1 from public.community_posts p
       where p.id = post_id
         and (public.is_pastor() or p.community_id = public.my_community_id())
    )
  );

drop policy if exists "comments_insert_authed" on public.post_comments;
create policy "comments_insert_authed" on public.post_comments
  for insert with check (
    public.is_current_user_active()
    and exists (
      select 1 from public.community_posts p
       where p.id = post_id
         and (public.is_pastor() or p.community_id = public.my_community_id())
    )
  );

-- ── demo member → kosovo so App Review still sees the seeded content ───────
update public.profiles
   set community_id = 'kosovo'
 where id = (select id from auth.users where email = 'member@gracechurch.app')
   and community_id is null;
