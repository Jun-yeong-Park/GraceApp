-- ============================================================================
-- Grace Church App — demo UGC for App Review (Apple Guideline 1.2)
-- Run in Supabase SQL Editor. Idempotent: safe to re-run.
--
-- Why: the report/block "…" only renders on content the signed-in user did NOT
-- author (own content shows ✕ delete instead). Every existing community post is
-- authored by reviewer@gracechurch.app, so a reviewer signing in with that
-- account sees no "…" anywhere. This seeds content from both demo accounts so
-- the report and block controls are visible whichever account the reviewer uses,
-- and adds the comments / chat messages the walkthrough needs.
-- ============================================================================

do $$
declare
  pastor_id uuid := (select id from auth.users where email = 'reviewer@gracechurch.app');
  member_id uuid := (select id from auth.users where email = 'member@gracechurch.app');
  pastor_nm text;
  member_nm text;
  host_post uuid;
begin
  if pastor_id is null then raise exception 'reviewer@gracechurch.app not found in auth.users'; end if;
  if member_id is null then raise exception 'member@gracechurch.app not found in auth.users'; end if;

  pastor_nm := coalesce((select full_name from public.profiles where id = pastor_id), 'Pastor Reviewer');
  member_nm := coalesce((select full_name from public.profiles where id = member_id), 'Grace Member');

  -- 1) Posts authored by the MEMBER → the pastor account now sees "…" too.
  insert into public.community_posts (community_id, title, location, event_date, description, author_id, author_name)
  select 'kosovo', 'Saturday Prayer Walk', 'Church Lawn', current_date + 3,
         'Meet at the lawn and we will walk and pray together.', member_id, member_nm
  where not exists (select 1 from public.community_posts where title = 'Saturday Prayer Walk');

  insert into public.community_posts (community_id, title, location, event_date, description, author_id, author_name)
  select 'kosovo', 'Youth Group Movie Night', 'Fellowship Hall', current_date + 6,
         'Snacks provided. Bring a friend!', member_id, member_nm
  where not exists (select 1 from public.community_posts where title = 'Youth Group Movie Night');

  -- 2) A comment authored by the PASTOR → the member account can report a comment.
  select id into host_post
    from public.community_posts
   where community_id = 'kosovo' and author_id = pastor_id
   order by created_at desc
   limit 1;

  if host_post is not null then
    insert into public.post_comments (post_id, author_id, author_name, content)
    select host_post, pastor_id, pastor_nm, 'Looking forward to seeing everyone there.'
    where not exists (
      select 1 from public.post_comments
       where post_id = host_post and content = 'Looking forward to seeing everyone there.'
    );
  end if;

  -- 3) Chat from both sides → "…" is visible on an incoming message either way.
  insert into public.community_messages (community_id, author_id, author_name, content)
  select 'kosovo', pastor_id, pastor_nm, 'Good morning, everyone. Blessings on your week.'
  where not exists (
    select 1 from public.community_messages
     where content = 'Good morning, everyone. Blessings on your week.'
  );

  insert into public.community_messages (community_id, author_id, author_name, content)
  select 'kosovo', member_id, member_nm, 'Thank you, Pastor. See you on Sunday!'
  where not exists (
    select 1 from public.community_messages
     where content = 'Thank you, Pastor. See you on Sunday!'
  );
end $$;
