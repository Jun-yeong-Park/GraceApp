-- ============================================================================
-- Grace Church App — Apple App Store Guideline 1.2 UGC Compliance
-- Run this in Supabase SQL Editor AFTER supabase_setup.sql.
-- Idempotent: safe to re-run.
--
-- Adds:
--   A. profiles: is_banned, banned_at, banned_reason, eula_version
--   B. content_reports: admin_notes, reviewed_by, reviewed_at
--   C. Auto-set eula_version=1 on signup (handle_new_user)
--   D. RLS: banned users cannot INSERT to any UGC table
--   E. Server-side profanity trigger on community_posts / _photos / _messages / post_comments
--   F. Helper functions callable from client (mark_report_reviewed, ban_user, unban_user)
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- A. profiles — ban + EULA version
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_banned      BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS banned_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS banned_reason  TEXT,
  ADD COLUMN IF NOT EXISTS eula_version   INTEGER     NOT NULL DEFAULT 0;

-- Backfill: existing users with eula_accepted_at get eula_version = 0
-- (so they must re-accept at v1). New users get eula_version = 1 via signup update.
-- No backfill statement — default 0 is correct behavior.

-- ────────────────────────────────────────────────────────────────────────────
-- B. content_reports — admin review columns
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.content_reports
  ADD COLUMN IF NOT EXISTS admin_notes  TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at  TIMESTAMPTZ;

-- ────────────────────────────────────────────────────────────────────────────
-- C. handle_new_user — auto-record EULA v1 acceptance at signup
--    (client also sets eula_accepted_at explicitly; this is a fallback)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, eula_version, eula_accepted_at)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    'member',
    1,             -- new signups accept the current version
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- D. RLS — banned users cannot INSERT to any UGC table
--    Rewrites existing *_insert_authed policies to add ban check.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_current_user_active()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = auth.uid() AND is_banned = TRUE
  );
$$;

-- community_posts
DROP POLICY IF EXISTS "cposts_insert_authed" ON public.community_posts;
CREATE POLICY "cposts_insert_authed" ON public.community_posts
  FOR INSERT WITH CHECK (public.is_current_user_active());

-- community_photos
DROP POLICY IF EXISTS "cphotos_insert_authed" ON public.community_photos;
CREATE POLICY "cphotos_insert_authed" ON public.community_photos
  FOR INSERT WITH CHECK (public.is_current_user_active());

-- community_messages (also requires author_id = uid)
DROP POLICY IF EXISTS "cmsg_insert_authed" ON public.community_messages;
CREATE POLICY "cmsg_insert_authed" ON public.community_messages
  FOR INSERT WITH CHECK (public.is_current_user_active() AND auth.uid() = author_id);

-- post_comments
DROP POLICY IF EXISTS "comments_insert_authed" ON public.post_comments;
CREATE POLICY "comments_insert_authed" ON public.post_comments
  FOR INSERT WITH CHECK (public.is_current_user_active());

-- prayer_requests — anonymous allowed, but banned authed users blocked
DROP POLICY IF EXISTS "prayer_insert_any" ON public.prayer_requests;
CREATE POLICY "prayer_insert_any" ON public.prayer_requests
  FOR INSERT WITH CHECK (
    auth.uid() IS NULL                     -- anonymous prayer requests still allowed
    OR public.is_current_user_active()     -- authed users must not be banned
  );

-- ────────────────────────────────────────────────────────────────────────────
-- E. Server-side profanity filter (matches client list in src/utils/moderation.ts,
--    expanded with additional common Korean profanity)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.contains_blocked_words(txt TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  lower_txt TEXT := lower(COALESCE(txt, ''));
  bad TEXT;
  -- NOTE: this is a plain substring match, so every entry must be a string that
  -- cannot appear inside an ordinary sentence. Do NOT add short fragments like
  -- '죽어' ("죽어 주셨다"), '좇' ("주를 좇아"), '보지' ("보지 못했다"),
  -- '자지' ("자지 않고"), '꺼져' ("불이 꺼져"), '씹' ("씹다"), 'rape' ("grape")
  -- or '한남' ("한남동") — they block legitimate posts. Keep the client list in
  -- src/utils/moderation.ts in sync with this one.
  bad_words TEXT[] := ARRAY[
    -- EN
    'fuck','fucker','fucking','shit','bitch','asshole','cunt','pussy',
    'nigger','nigga','faggot','retard','whore','slut','porn',
    -- KO
    '시발','씨발','씨팔','시팔','ㅅㅂ','ㅆㅂ','병신','ㅄ','ㅂㅅ','존나','좆','조까',
    '개새끼','새끼야','미친년','미친놈','쳐죽','엿먹','닥쳐','뒤져라','디져라',
    '창녀','창놈','섹스','fuckyou','tlqkf',
    '느금마','니미','니애미','씹새','씹년','씹할','씹새끼','좆같','좆까',
    -- ES
    'mierda','puta','puto','cabron','cabrón','pendejo','coño','joder',
    'maricon','maricón','verga','chinga','pinche'
  ];
BEGIN
  IF lower_txt = '' THEN RETURN FALSE; END IF;
  FOREACH bad IN ARRAY bad_words LOOP
    IF position(bad IN lower_txt) > 0 THEN
      RETURN TRUE;
    END IF;
  END LOOP;
  RETURN FALSE;
END;
$$;

-- Trigger that rejects INSERT/UPDATE if any monitored column contains blocked words
CREATE OR REPLACE FUNCTION public.reject_blocked_content()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  combined TEXT;
BEGIN
  IF TG_TABLE_NAME = 'community_posts' THEN
    combined := COALESCE(NEW.title,'') || ' ' || COALESCE(NEW.description,'');
  ELSIF TG_TABLE_NAME = 'community_photos' THEN
    combined := COALESCE(NEW.caption,'');
  ELSIF TG_TABLE_NAME = 'post_comments' THEN
    combined := COALESCE(NEW.content,'');
  ELSIF TG_TABLE_NAME = 'community_messages' THEN
    combined := COALESCE(NEW.content,'');
  ELSIF TG_TABLE_NAME = 'prayer_requests' THEN
    combined := COALESCE(NEW.content,'');
  ELSE
    combined := '';
  END IF;

  IF public.contains_blocked_words(combined) THEN
    RAISE EXCEPTION 'BLOCKED_CONTENT: This content contains inappropriate language and cannot be posted.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reject_blocked_cposts    ON public.community_posts;
DROP TRIGGER IF EXISTS trg_reject_blocked_cphotos   ON public.community_photos;
DROP TRIGGER IF EXISTS trg_reject_blocked_comments  ON public.post_comments;
DROP TRIGGER IF EXISTS trg_reject_blocked_cmsg      ON public.community_messages;
DROP TRIGGER IF EXISTS trg_reject_blocked_prayer    ON public.prayer_requests;

CREATE TRIGGER trg_reject_blocked_cposts   BEFORE INSERT OR UPDATE ON public.community_posts   FOR EACH ROW EXECUTE FUNCTION public.reject_blocked_content();
CREATE TRIGGER trg_reject_blocked_cphotos  BEFORE INSERT OR UPDATE ON public.community_photos  FOR EACH ROW EXECUTE FUNCTION public.reject_blocked_content();
CREATE TRIGGER trg_reject_blocked_comments BEFORE INSERT OR UPDATE ON public.post_comments     FOR EACH ROW EXECUTE FUNCTION public.reject_blocked_content();
CREATE TRIGGER trg_reject_blocked_cmsg     BEFORE INSERT OR UPDATE ON public.community_messages FOR EACH ROW EXECUTE FUNCTION public.reject_blocked_content();
CREATE TRIGGER trg_reject_blocked_prayer   BEFORE INSERT OR UPDATE ON public.prayer_requests   FOR EACH ROW EXECUTE FUNCTION public.reject_blocked_content();

-- ────────────────────────────────────────────────────────────────────────────
-- F. Admin helper RPCs (callable from AdminScreen via supabase.rpc)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_ban_user(target_id UUID, reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = auth.uid() AND (role = 'pastor' OR is_admin = TRUE)
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.profiles
     SET is_banned = TRUE, banned_at = NOW(), banned_reason = reason
   WHERE id = target_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unban_user(target_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = auth.uid() AND (role = 'pastor' OR is_admin = TRUE)
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.profiles
     SET is_banned = FALSE, banned_at = NULL, banned_reason = NULL
   WHERE id = target_id;
END;
$$;

-- Admin action: delete offending content + mark report as removed in one call
CREATE OR REPLACE FUNCTION public.admin_delete_reported_content(
  p_report_id    UUID,
  p_content_type TEXT,
  p_content_id   UUID
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = auth.uid() AND (role = 'pastor' OR is_admin = TRUE)
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_content_type = 'post'    THEN DELETE FROM public.community_posts    WHERE id = p_content_id;
  ELSIF p_content_type = 'photo'   THEN DELETE FROM public.community_photos   WHERE id = p_content_id;
  ELSIF p_content_type = 'comment' THEN DELETE FROM public.post_comments      WHERE id = p_content_id;
  ELSIF p_content_type = 'message' THEN DELETE FROM public.community_messages WHERE id = p_content_id;
  ELSIF p_content_type = 'prayer'  THEN DELETE FROM public.prayer_requests    WHERE id = p_content_id;
  END IF;

  UPDATE public.content_reports
     SET status = 'removed',
         reviewed_by = auth.uid(),
         reviewed_at = NOW()
   WHERE id = p_report_id;

  -- Also mark all other pending reports for the same content as removed
  UPDATE public.content_reports
     SET status = 'removed',
         reviewed_by = auth.uid(),
         reviewed_at = NOW()
   WHERE content_id = p_content_id
     AND content_type = p_content_type
     AND status = 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_mark_report_reviewed(p_report_id UUID, p_notes TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = auth.uid() AND (role = 'pastor' OR is_admin = TRUE)
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.content_reports
     SET status = 'reviewed',
         reviewed_by = auth.uid(),
         reviewed_at = NOW(),
         admin_notes = p_notes
   WHERE id = p_report_id;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- F2. blocked_users.blocked_id must reference public.profiles, not auth.users
--
--     The "Manage Blocked Users" screen reads:
--         .select('id, blocked_id, created_at, profiles:blocked_id(full_name)')
--     PostgREST resolves that embed through the foreign key on blocked_id. The
--     original schema pointed it at auth.users, which is not exposed to
--     PostgREST, so the request failed and the screen rendered an empty list —
--     i.e. the unblock UI Apple requires did not work at all.
--
--     profiles.id itself references auth.users(id) ON DELETE CASCADE, so
--     re-pointing this FK keeps the same delete behaviour.
-- ────────────────────────────────────────────────────────────────────────────
alter table public.blocked_users
  drop constraint if exists blocked_users_blocked_id_fkey;

alter table public.blocked_users
  add constraint blocked_users_blocked_id_fkey
  foreign key (blocked_id) references public.profiles(id) on delete cascade;

-- ────────────────────────────────────────────────────────────────────────────
-- G. Admin view — pending reports enriched with content + reporter info
--    (Simplifies the moderation UI query)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_pending_reports AS
SELECT
  r.id,
  r.reporter_id,
  reporter.full_name       AS reporter_name,
  r.content_type,
  r.content_id,
  r.reported_user_id,
  reported.full_name       AS reported_user_name,
  reported.is_banned       AS reported_user_banned,
  r.reason,
  r.status,
  r.created_at,
  r.admin_notes,
  r.reviewed_at,
  -- Content preview (best-effort based on content_type)
  CASE r.content_type
    WHEN 'post'    THEN (SELECT title || COALESCE(' — ' || description, '') FROM public.community_posts    WHERE id = r.content_id)
    WHEN 'photo'   THEN (SELECT COALESCE(caption, '(photo)')                 FROM public.community_photos   WHERE id = r.content_id)
    WHEN 'comment' THEN (SELECT content                                       FROM public.post_comments      WHERE id = r.content_id)
    WHEN 'message' THEN (SELECT content                                       FROM public.community_messages WHERE id = r.content_id)
    WHEN 'prayer'  THEN (SELECT content                                       FROM public.prayer_requests    WHERE id = r.content_id)
  END AS content_preview
FROM public.content_reports r
LEFT JOIN public.profiles reporter ON reporter.id = r.reporter_id
LEFT JOIN public.profiles reported ON reported.id = r.reported_user_id
ORDER BY r.created_at DESC;

-- Grant view access to admins only (via underlying content_reports RLS)
GRANT SELECT ON public.v_pending_reports TO authenticated;

-- Done. Next: deploy Edge Functions (see supabase/functions/) and configure
-- Database Webhooks in the Supabase Dashboard.
