-- ============================================================================
-- FIX: Infinite recursion in RLS policy for profiles
-- Run this ENTIRE file in Supabase SQL Editor. Safe to re-run.
-- Root cause: policies referenced `profiles` table inside profiles' own RLS,
-- causing recursion. Fix: use a SECURITY DEFINER helper that bypasses RLS.
-- ============================================================================

-- 1) Create a helper that checks admin status WITHOUT triggering RLS
CREATE OR REPLACE FUNCTION public.is_pastor()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (role = 'pastor' OR is_admin = TRUE)
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_pastor() TO anon, authenticated;

-- 2) Rewrite ALL policies that previously did the recursive subquery.
--    Drop old ones first (safe if they don't exist), then recreate.

-- ── profiles ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_admin_all"    ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_select"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_update"  ON public.profiles;

CREATE POLICY "profiles_self_select" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL USING (public.is_pastor());

-- ── announcements ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ann_admin_all" ON public.announcements;
CREATE POLICY "ann_admin_all" ON public.announcements FOR ALL USING (public.is_pastor());

-- ── app_settings ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "settings_admin_all" ON public.app_settings;
CREATE POLICY "settings_admin_all" ON public.app_settings FOR ALL USING (public.is_pastor());

-- ── events ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "events_admin_all" ON public.events;
CREATE POLICY "events_admin_all" ON public.events FOR ALL USING (public.is_pastor());

-- ── prayer_requests ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "prayer_admin_all" ON public.prayer_requests;
CREATE POLICY "prayer_admin_all" ON public.prayer_requests FOR ALL USING (public.is_pastor());

-- ── visit_requests ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "visit_admin_all" ON public.visit_requests;
CREATE POLICY "visit_admin_all" ON public.visit_requests FOR ALL USING (public.is_pastor());

-- ── bulletins ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "bulletins_admin_all" ON public.bulletins;
CREATE POLICY "bulletins_admin_all" ON public.bulletins FOR ALL USING (public.is_pastor());

-- ── sermon_summaries ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "sermon_read_public" ON public.sermon_summaries;
DROP POLICY IF EXISTS "sermon_admin_all"   ON public.sermon_summaries;
CREATE POLICY "sermon_read_public" ON public.sermon_summaries FOR SELECT
  USING (is_published = TRUE OR public.is_pastor());
CREATE POLICY "sermon_admin_all" ON public.sermon_summaries FOR ALL USING (public.is_pastor());

-- ── members ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "members_admin_all" ON public.members;
CREATE POLICY "members_admin_all" ON public.members FOR ALL USING (public.is_pastor());

-- ── volunteer_posts ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "volunteer_admin_all" ON public.volunteer_posts;
CREATE POLICY "volunteer_admin_all" ON public.volunteer_posts FOR ALL USING (public.is_pastor());

-- ── community_posts ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cposts_admin_all" ON public.community_posts;
CREATE POLICY "cposts_admin_all" ON public.community_posts FOR ALL USING (public.is_pastor());

-- ── community_photos ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cphotos_admin_all" ON public.community_photos;
CREATE POLICY "cphotos_admin_all" ON public.community_photos FOR ALL USING (public.is_pastor());

-- ── community_messages ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cmsg_admin_all" ON public.community_messages;
CREATE POLICY "cmsg_admin_all" ON public.community_messages FOR ALL USING (public.is_pastor());

-- ── post_comments ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "comments_admin_all" ON public.post_comments;
CREATE POLICY "comments_admin_all" ON public.post_comments FOR ALL USING (public.is_pastor());

-- ── receipts ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "receipts_admin_all" ON public.receipts;
CREATE POLICY "receipts_admin_all" ON public.receipts FOR ALL USING (public.is_pastor());

-- ── content_reports ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "report_admin_all" ON public.content_reports;
CREATE POLICY "report_admin_all" ON public.content_reports FOR ALL USING (public.is_pastor());

-- Done!
