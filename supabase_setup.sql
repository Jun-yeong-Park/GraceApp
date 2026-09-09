-- ============================================================================
-- Grace Church App — Full Supabase Setup
-- Run this ENTIRE file in the new Supabase project's SQL Editor.
-- Order of operations:
--   1. Run this SQL (creates all tables, RLS, indexes)
--   2. In Dashboard → Storage: create two PUBLIC buckets: `community-photos`, `receipts`
--   3. In Dashboard → Authentication → Users: create the demo accounts (see bottom)
--   4. Come back here and run the "SEED DATA" section at the bottom
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. profiles (extends auth.users)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','deacon','pastor')),
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  full_name TEXT,
  email TEXT,
  eula_accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_self_select"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_update"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_all"    ON public.profiles;

CREATE POLICY "profiles_self_select" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND (p.role = 'pastor' OR p.is_admin = TRUE))
  );

-- Auto-create a profile row for every new auth user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    'member'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ────────────────────────────────────────────────────────────────────────────
-- 2. announcements (multilingual)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ko TEXT, title_en TEXT, title_es TEXT,
  body_ko  TEXT, body_en  TEXT, body_es  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ann_read_all"  ON public.announcements;
DROP POLICY IF EXISTS "ann_admin_all" ON public.announcements;
CREATE POLICY "ann_read_all" ON public.announcements FOR SELECT USING (TRUE);
CREATE POLICY "ann_admin_all" ON public.announcements FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
          AND (p.role='pastor' OR p.is_admin=TRUE))
);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. app_settings  (key/value config)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_settings (
  key   TEXT PRIMARY KEY,
  value JSONB
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings_read_all"  ON public.app_settings;
DROP POLICY IF EXISTS "settings_admin_all" ON public.app_settings;
CREATE POLICY "settings_read_all" ON public.app_settings FOR SELECT USING (TRUE);
CREATE POLICY "settings_admin_all" ON public.app_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
          AND (p.role='pastor' OR p.is_admin=TRUE))
);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. events (calendar)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  date        DATE NOT NULL,
  time        TEXT,
  location    TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(date);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "events_read_all"  ON public.events;
DROP POLICY IF EXISTS "events_admin_all" ON public.events;
CREATE POLICY "events_read_all" ON public.events FOR SELECT USING (TRUE);
CREATE POLICY "events_admin_all" ON public.events FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
          AND (p.role='pastor' OR p.is_admin=TRUE))
);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. prayer_requests
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.prayer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_name  TEXT NOT NULL,
  content      TEXT NOT NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prayer_created ON public.prayer_requests(created_at DESC);
ALTER TABLE public.prayer_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prayer_read_all"    ON public.prayer_requests;
DROP POLICY IF EXISTS "prayer_insert_any"  ON public.prayer_requests;
DROP POLICY IF EXISTS "prayer_admin_all"   ON public.prayer_requests;
CREATE POLICY "prayer_read_all"   ON public.prayer_requests FOR SELECT USING (TRUE);
CREATE POLICY "prayer_insert_any" ON public.prayer_requests FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "prayer_admin_all"  ON public.prayer_requests FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
          AND (p.role='pastor' OR p.is_admin=TRUE))
);

-- ────────────────────────────────────────────────────────────────────────────
-- 6. visit_requests
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.visit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  phone      TEXT,
  date       DATE,
  time       TEXT,
  note       TEXT,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.visit_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "visit_insert_any" ON public.visit_requests;
DROP POLICY IF EXISTS "visit_admin_all"  ON public.visit_requests;
CREATE POLICY "visit_insert_any" ON public.visit_requests FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "visit_admin_all"  ON public.visit_requests FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
          AND (p.role='pastor' OR p.is_admin=TRUE))
);

-- ────────────────────────────────────────────────────────────────────────────
-- 7. bulletins (worship program)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bulletins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  date            DATE NOT NULL,
  worship_order   JSONB,
  announcements   JSONB,
  prayer_requests TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bulletins_date ON public.bulletins(date DESC);
ALTER TABLE public.bulletins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bulletins_read_all"  ON public.bulletins;
DROP POLICY IF EXISTS "bulletins_admin_all" ON public.bulletins;
CREATE POLICY "bulletins_read_all" ON public.bulletins FOR SELECT USING (TRUE);
CREATE POLICY "bulletins_admin_all" ON public.bulletins FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
          AND (p.role='pastor' OR p.is_admin=TRUE))
);

-- ────────────────────────────────────────────────────────────────────────────
-- 8. sermon_summaries (multilingual)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sermon_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date         DATE NOT NULL,
  preacher     TEXT,
  scripture    TEXT,
  title_ko TEXT, title_en TEXT, title_es TEXT,
  body_ko  TEXT, body_en  TEXT, body_es  TEXT,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sermon_date ON public.sermon_summaries(date DESC);
ALTER TABLE public.sermon_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sermon_read_public" ON public.sermon_summaries;
DROP POLICY IF EXISTS "sermon_admin_all"   ON public.sermon_summaries;
CREATE POLICY "sermon_read_public" ON public.sermon_summaries FOR SELECT USING (
  is_published = TRUE OR EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
    AND (p.role='pastor' OR p.is_admin=TRUE)
  )
);
CREATE POLICY "sermon_admin_all" ON public.sermon_summaries FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
          AND (p.role='pastor' OR p.is_admin=TRUE))
);

-- ────────────────────────────────────────────────────────────────────────────
-- 9. members (directory)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.members (
  id UUID PRIMARY KEY,               -- matches auth.users.id (not FK-enforced for flexibility)
  name       TEXT NOT NULL,
  email      TEXT,
  phone      TEXT,
  birthday   DATE,
  photo_url  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_members_name ON public.members(name);
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members_read_authed" ON public.members;
DROP POLICY IF EXISTS "members_admin_all"   ON public.members;
CREATE POLICY "members_read_authed" ON public.members FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "members_admin_all"   ON public.members FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
          AND (p.role='pastor' OR p.is_admin=TRUE))
);

-- ────────────────────────────────────────────────────────────────────────────
-- 10. volunteer_posts
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.volunteer_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category    TEXT,
  title       TEXT NOT NULL,
  date        DATE,
  time        TEXT,
  location    TEXT,
  description TEXT,
  roles       JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.volunteer_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "volunteer_read_all"  ON public.volunteer_posts;
DROP POLICY IF EXISTS "volunteer_admin_all" ON public.volunteer_posts;
CREATE POLICY "volunteer_read_all" ON public.volunteer_posts FOR SELECT USING (TRUE);
CREATE POLICY "volunteer_admin_all" ON public.volunteer_posts FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
          AND (p.role='pastor' OR p.is_admin=TRUE))
);

-- ────────────────────────────────────────────────────────────────────────────
-- 11. community_posts
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id TEXT NOT NULL,        -- 'kosovo'|'albania'|'dagestan'|'kissimmee'|'bridge'|'hope'|'community7'
  title        TEXT NOT NULL,
  location     TEXT,
  event_date   DATE,
  description  TEXT,
  photo_urls   TEXT[],
  author_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_community_posts_cid ON public.community_posts(community_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_created ON public.community_posts(created_at DESC);
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cposts_read_all"        ON public.community_posts;
DROP POLICY IF EXISTS "cposts_insert_authed"   ON public.community_posts;
DROP POLICY IF EXISTS "cposts_delete_own"      ON public.community_posts;
DROP POLICY IF EXISTS "cposts_admin_all"       ON public.community_posts;
CREATE POLICY "cposts_read_all"      ON public.community_posts FOR SELECT USING (TRUE);
CREATE POLICY "cposts_insert_authed" ON public.community_posts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "cposts_delete_own"    ON public.community_posts FOR DELETE USING (auth.uid() = author_id);
CREATE POLICY "cposts_admin_all"     ON public.community_posts FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
          AND (p.role='pastor' OR p.is_admin=TRUE))
);

-- ────────────────────────────────────────────────────────────────────────────
-- 12. community_photos
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id TEXT NOT NULL,
  author_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name  TEXT,
  photo_url    TEXT NOT NULL,
  caption      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_community_photos_cid ON public.community_photos(community_id);
ALTER TABLE public.community_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cphotos_read_all"      ON public.community_photos;
DROP POLICY IF EXISTS "cphotos_insert_authed" ON public.community_photos;
DROP POLICY IF EXISTS "cphotos_delete_own"    ON public.community_photos;
DROP POLICY IF EXISTS "cphotos_admin_all"     ON public.community_photos;
CREATE POLICY "cphotos_read_all"      ON public.community_photos FOR SELECT USING (TRUE);
CREATE POLICY "cphotos_insert_authed" ON public.community_photos FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "cphotos_delete_own"    ON public.community_photos FOR DELETE USING (auth.uid() = author_id);
CREATE POLICY "cphotos_admin_all"     ON public.community_photos FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
          AND (p.role='pastor' OR p.is_admin=TRUE))
);

-- ────────────────────────────────────────────────────────────────────────────
-- 13. community_messages (chat)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id TEXT NOT NULL,
  author_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name  TEXT,
  content      TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_community_msg_cid_created
  ON public.community_messages(community_id, created_at);
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cmsg_read_all"      ON public.community_messages;
DROP POLICY IF EXISTS "cmsg_insert_authed" ON public.community_messages;
DROP POLICY IF EXISTS "cmsg_delete_own"    ON public.community_messages;
DROP POLICY IF EXISTS "cmsg_admin_all"     ON public.community_messages;
CREATE POLICY "cmsg_read_all"      ON public.community_messages FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "cmsg_insert_authed" ON public.community_messages FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "cmsg_delete_own"    ON public.community_messages FOR DELETE USING (auth.uid() = author_id);
CREATE POLICY "cmsg_admin_all"     ON public.community_messages FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
          AND (p.role='pastor' OR p.is_admin=TRUE))
);

-- ────────────────────────────────────────────────────────────────────────────
-- 14. post_comments
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON public.post_comments(post_id, created_at);
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comments_read_all"      ON public.post_comments;
DROP POLICY IF EXISTS "comments_insert_authed" ON public.post_comments;
DROP POLICY IF EXISTS "comments_delete_own"    ON public.post_comments;
DROP POLICY IF EXISTS "comments_admin_all"     ON public.post_comments;
CREATE POLICY "comments_read_all"      ON public.post_comments FOR SELECT USING (TRUE);
CREATE POLICY "comments_insert_authed" ON public.post_comments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "comments_delete_own"    ON public.post_comments FOR DELETE USING (auth.uid() = author_id);
CREATE POLICY "comments_admin_all"     ON public.post_comments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
          AND (p.role='pastor' OR p.is_admin=TRUE))
);

-- ────────────────────────────────────────────────────────────────────────────
-- 15. receipts (expense receipts, admin-only)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitter_name TEXT NOT NULL,
  expense_date   DATE,
  item           TEXT,
  department     TEXT,
  photo_url      TEXT,
  submitted_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "receipts_insert_authed" ON public.receipts;
DROP POLICY IF EXISTS "receipts_admin_all"     ON public.receipts;
CREATE POLICY "receipts_insert_authed" ON public.receipts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "receipts_admin_all"     ON public.receipts FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
          AND (p.role='pastor' OR p.is_admin=TRUE))
);

-- ────────────────────────────────────────────────────────────────────────────
-- 16. content_reports (App Store 1.2 moderation)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type      TEXT NOT NULL CHECK (content_type IN ('post','photo','comment','message','prayer')),
  content_id        UUID NOT NULL,
  reported_user_id  UUID,
  reason            TEXT,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','removed')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_content_reports_status   ON public.content_reports(status);
CREATE INDEX IF NOT EXISTS idx_content_reports_reporter ON public.content_reports(reporter_id);
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "report_insert_self" ON public.content_reports;
DROP POLICY IF EXISTS "report_select_self" ON public.content_reports;
DROP POLICY IF EXISTS "report_admin_all"   ON public.content_reports;
CREATE POLICY "report_insert_self" ON public.content_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "report_select_self" ON public.content_reports FOR SELECT USING (auth.uid() = reporter_id);
CREATE POLICY "report_admin_all"   ON public.content_reports FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
          AND (p.role='pastor' OR p.is_admin=TRUE))
);

-- ────────────────────────────────────────────────────────────────────────────
-- 17. blocked_users
-- ────────────────────────────────────────────────────────────────────────────
-- blocked_id references profiles (NOT auth.users) so PostgREST can embed the
-- blocked user's name in the "Manage Blocked Users" screen. See section F2 of
-- supabase_apple_1_2_compliance.sql.
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (blocker_id, blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON public.blocked_users(blocker_id);
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "block_manage_self" ON public.blocked_users;
CREATE POLICY "block_manage_self" ON public.blocked_users
  FOR ALL USING (auth.uid() = blocker_id) WITH CHECK (auth.uid() = blocker_id);

-- ────────────────────────────────────────────────────────────────────────────
-- STORAGE BUCKETS (create in Dashboard UI, or run these — either works)
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES
  ('community-photos', 'community-photos', TRUE),
  ('receipts',         'receipts',         TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

-- Storage policies: authenticated users can upload; anyone can read (public bucket)
DROP POLICY IF EXISTS "storage_read_public"      ON storage.objects;
DROP POLICY IF EXISTS "storage_upload_authed"    ON storage.objects;
DROP POLICY IF EXISTS "storage_delete_own"       ON storage.objects;

CREATE POLICY "storage_read_public" ON storage.objects
  FOR SELECT USING (bucket_id IN ('community-photos', 'receipts'));

CREATE POLICY "storage_upload_authed" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id IN ('community-photos', 'receipts') AND auth.uid() IS NOT NULL
  );

CREATE POLICY "storage_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id IN ('community-photos', 'receipts') AND auth.uid() = owner
  );


-- ============================================================================
-- ★★★ STOP HERE ★★★
-- Now go create the demo accounts in Authentication → Users → Add user:
--
--   Account 1 (Apple reviewer / demo pastor):
--     Email:    reviewer@gracechurch.app
--     Password: GraceReview2026!
--     Auto Confirm User: ✓
--
--   Account 2 (demo member):
--     Email:    member@gracechurch.app
--     Password: GraceMember2026!
--     Auto Confirm User: ✓
--
-- After creating them, come back and run the SEED DATA section below.
-- ============================================================================


-- ============================================================================
-- SEED DATA (run AFTER creating the two demo accounts above)
-- ============================================================================

-- Promote reviewer account to pastor role
UPDATE public.profiles
   SET role = 'pastor', is_admin = TRUE, full_name = 'Pastor Reviewer'
 WHERE email = 'reviewer@gracechurch.app';

UPDATE public.profiles
   SET full_name = 'Demo Member'
 WHERE email = 'member@gracechurch.app';

-- Weekly verse
INSERT INTO public.app_settings (key, value) VALUES
  ('weekly_verse', '{
    "ko":"예수께서 이르시되 나는 부활이요 생명이니 나를 믿는 자는 죽어도 살겠고",
    "en":"Jesus said, I am the resurrection and the life. He who believes in me will live, even though he dies.",
    "es":"Jesús dijo: Yo soy la resurrección y la vida. El que cree en mí, aunque esté muerto, vivirá.",
    "ref":"요한복음 11:25",
    "ref_en":"John 11:25",
    "ref_es":"Juan 11:25"
  }'::jsonb),
  ('offering_venmo',    '"@grace-church-orlando"'::jsonb),
  ('offering_cash_app', '"$gracechurchorlando"'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Announcements (multilingual, recent)
INSERT INTO public.announcements (title_ko, title_en, title_es, body_ko, body_en, body_es) VALUES
  ('부활절 연합 예배 안내',
   'Easter Joint Worship Service',
   'Servicio de Adoración Conjunta de Pascua',
   '오는 4월 12일(주일) 부활절을 기념하여 연합 예배를 드립니다.',
   'On April 12 (Sunday), we will hold a joint worship service to celebrate Easter.',
   'El 12 de abril (domingo) celebraremos un servicio de adoración conjunto por Pascua.'),
  ('성경공부 봄학기 모집',
   'Spring Bible Study Registration',
   'Inscripción de Estudio Bíblico de Primavera',
   '4월 19일부터 시작되는 봄학기 성경공부 참여자를 모집합니다.',
   'We are now accepting registrations for the spring Bible study starting April 19.',
   'Estamos aceptando inscripciones para el estudio bíblico de primavera que comienza el 19 de abril.'),
  ('교회 사진 촬영 안내',
   'Church Directory Photo Day',
   'Día de Fotos del Directorio de la Iglesia',
   '4월 26일 성도 요람 사진 촬영이 있습니다. 많은 참여 바랍니다.',
   'Directory photos will be taken on April 26. Please join us!',
   'Las fotos del directorio se tomarán el 26 de abril. ¡Únanse a nosotros!');

-- Events (calendar)
INSERT INTO public.events (title, date, time, location, description) VALUES
  ('Easter Sunday Service',        '2026-04-12', '10:00 AM', 'Main Sanctuary', 'Celebrating the resurrection of our Lord.'),
  ('Spring Bible Study Kickoff',   '2026-04-19', '7:00 PM',  'Fellowship Hall', 'First session of the spring Bible study.'),
  ('Directory Photo Day',          '2026-04-26', '11:00 AM', 'Main Lobby',      'Photos for the church directory.'),
  ('Wednesday Prayer Meeting',     '2026-04-15', '7:00 PM',  'Chapel',          'Weekly midweek prayer service.');

-- Sermon summaries (all published, multilingual)
INSERT INTO public.sermon_summaries (date, preacher, scripture, title_ko, title_en, title_es, body_ko, body_en, body_es, is_published) VALUES
  ('2026-04-05', 'Pastor Kim', 'John 11:25',
   '부활의 능력으로 살아가라', 'Living in the Power of the Resurrection', 'Vivir en el Poder de la Resurrección',
   '부활절을 맞이하여 부활의 주님이 우리에게 주시는 능력과 소망에 대해 살펴봅니다.',
   'As we approach Easter, we reflect on the power and hope that the risen Lord gives us.',
   'Al acercarnos a la Pascua, reflexionamos sobre el poder y la esperanza que el Señor resucitado nos da.',
   TRUE),
  ('2026-03-29', 'Pastor Kim', 'Matthew 21:1-11',
   '왕으로 오신 예수님', 'Jesus Came as King', 'Jesús Vino como Rey',
   '종려주일을 맞이하여 나귀를 타고 예루살렘에 입성하시는 예수님을 통해 진정한 왕의 의미를 봅니다.',
   'On Palm Sunday, we see the true meaning of kingship through Jesus entering Jerusalem on a donkey.',
   'En Domingo de Ramos, vemos el verdadero significado de la realeza a través de Jesús entrando a Jerusalén en un burro.',
   TRUE),
  ('2026-03-22', 'Pastor Kim', 'Psalm 23',
   '선하신 목자의 인도하심', 'Guidance of the Good Shepherd', 'La Guía del Buen Pastor',
   '시편 23편을 통해 선하신 목자이신 하나님의 인도하심과 보호하심을 묵상합니다.',
   'Through Psalm 23, we meditate on the guidance and protection of God our Good Shepherd.',
   'A través del Salmo 23, meditamos sobre la guía y protección de Dios, nuestro Buen Pastor.',
   TRUE);

-- Bulletins (worship program)
INSERT INTO public.bulletins (title, date, worship_order, announcements, prayer_requests) VALUES
  ('April 12, 2026 Bulletin', '2026-04-12',
   '[
     {"role":"Prelude","content":"Organ Prelude"},
     {"role":"Call to Worship","content":"Psalm 100"},
     {"role":"Hymn","content":"Christ the Lord Is Risen Today"},
     {"role":"Prayer","content":"Pastoral Prayer"},
     {"role":"Scripture","content":"John 11:25-26"},
     {"role":"Sermon","content":"Living in the Power of the Resurrection"},
     {"role":"Offering","content":"Response of Gratitude"},
     {"role":"Benediction","content":"Go in Peace"}
   ]'::jsonb,
   '["Easter joint service today at 10 AM.","Spring Bible study starts April 19.","Directory photo day on April 26."]'::jsonb,
   'Pray for those in need in our community.'),
  ('April 5, 2026 Bulletin', '2026-04-05',
   '[
     {"role":"Prelude","content":"Piano Prelude"},
     {"role":"Hymn","content":"Amazing Grace"},
     {"role":"Sermon","content":"Sunday Message"}
   ]'::jsonb,
   '["Fellowship lunch after service."]'::jsonb,
   'Pray for our church leaders.');

-- Prayer requests
INSERT INTO public.prayer_requests (author_name, content, is_anonymous) VALUES
  ('Sarah',    'Please pray for my mother who is undergoing surgery next week.',           FALSE),
  ('Anonymous','Pray for peace and strength during a difficult season.',                    TRUE),
  ('Michael',  'Thankful for God''s provision. Please pray for my new job opportunity.',    FALSE);

-- Community posts (populate several communities so the list shows counts)
INSERT INTO public.community_posts (community_id, title, location, event_date, description, author_name) VALUES
  ('kosovo',    'Weekly Bible Study',    'Fellowship Hall',   '2026-04-15', 'Join us for our weekly Bible study session.',           'Pastor Reviewer'),
  ('kosovo',    'Community Potluck',     'Church Lawn',       '2026-04-19', 'Bring a dish to share and enjoy fellowship.',           'Pastor Reviewer'),
  ('albania',   'Youth Gathering',       'Youth Room',        '2026-04-16', 'Middle and high school students welcome.',              'Pastor Reviewer'),
  ('bridge',    'Newcomers Welcome',     'Lobby',             '2026-04-12', 'New to the church? Come meet the team.',                'Pastor Reviewer'),
  ('hope',      'Prayer Circle',         'Chapel',            '2026-04-14', 'Weekly small-group prayer and worship.',                'Pastor Reviewer'),
  ('kissimmee', 'Sunday Fellowship',     'Main Sanctuary',    '2026-04-12', 'Post-service fellowship and coffee.',                   'Pastor Reviewer');

-- Members directory (need at least reviewer + member profiles synced here)
INSERT INTO public.members (id, name, email, phone)
  SELECT id, COALESCE(raw_user_meta_data->>'full_name', 'Member'), email, NULL
    FROM auth.users
   WHERE email IN ('reviewer@gracechurch.app', 'member@gracechurch.app')
  ON CONFLICT (id) DO NOTHING;

-- Volunteer posts
INSERT INTO public.volunteer_posts (category, title, date, time, location, description, roles) VALUES
  ('Worship', 'Sunday Worship Service',
   '2026-04-12', '10:00 AM', 'Main Sanctuary',
   'Volunteer for Sunday service — greeting, ushering, and offering.',
   '[
     {"id":"parking","name":"Parking","needed":2,"applicants":[]},
     {"id":"offering","name":"Offering Team","needed":3,"applicants":[]},
     {"id":"greeter","name":"Greeter","needed":2,"applicants":[]}
   ]'::jsonb),
  ('Education', 'Sunday School Teacher',
   '2026-04-12', '9:30 AM', 'Education Wing 2F',
   'Help teach children on Sunday mornings.',
   '[
     {"id":"toddler","name":"Toddler Class","needed":1,"applicants":[]},
     {"id":"elementary","name":"Elementary Class","needed":2,"applicants":[]}
   ]'::jsonb);

-- Sample visit request so admin dashboard has something to show
INSERT INTO public.visit_requests (name, phone, date, note, status) VALUES
  ('Jane Doe',      '407-555-0101', '2026-04-20', 'Requesting a home visit from the pastor.', 'pending'),
  ('Robert Smith',  '407-555-0102', '2026-04-18', 'New family, would love to meet the pastor.','confirmed');

-- Done!
