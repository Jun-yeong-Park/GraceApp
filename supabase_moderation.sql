-- ============================================================================
-- Moderation Tables for Apple App Store Guideline 1.2 Compliance
-- Run this in Supabase SQL editor before deploying the new app version.
-- ============================================================================

-- 1) Content reports ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('post','photo','comment','message','prayer')),
  content_id UUID NOT NULL,
  reported_user_id UUID,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_reports_status   ON public.content_reports(status);
CREATE INDEX IF NOT EXISTS idx_content_reports_reporter ON public.content_reports(reporter_id);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Reporters can insert / read their own reports
DROP POLICY IF EXISTS "report_insert_self" ON public.content_reports;
CREATE POLICY "report_insert_self" ON public.content_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "report_select_self" ON public.content_reports;
CREATE POLICY "report_select_self" ON public.content_reports
  FOR SELECT USING (auth.uid() = reporter_id);

-- Pastors / admins can read & update all reports
DROP POLICY IF EXISTS "report_admin_all" ON public.content_reports;
CREATE POLICY "report_admin_all" ON public.content_reports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (p.role = 'pastor' OR p.is_admin = TRUE)
    )
  );

-- 2) Blocked users -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON public.blocked_users(blocker_id);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "block_manage_self" ON public.blocked_users;
CREATE POLICY "block_manage_self" ON public.blocked_users
  FOR ALL USING (auth.uid() = blocker_id) WITH CHECK (auth.uid() = blocker_id);

-- 3) EULA acceptance tracking on profiles -----------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS eula_accepted_at TIMESTAMPTZ;
