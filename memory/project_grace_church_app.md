---
name: Grace Church App project context
description: Sunlight Grace Church Orlando — Expo RN + Supabase church community app; currently addressing Apple App Store Guideline 1.2 UGC rejection (Aug 2026).
type: project
---

**App:** Sunlight Grace Church Orlando (`com.graceorlandochurch.app`)
**Stack:** Expo managed RN 0.81, TS strict, React Nav 7, @supabase/supabase-js 2.103, custom LanguageContext (ko/en/es).
**Supabase project:** `https://epgwwsixhgdagavnurog.supabase.co`
**Repo root:** `/Users/jay/develop/GraceApp/grace-church-app/` (single-app repo, no monorepo; git remote `Jun-yeong-Park/GraceApp`)

**Current initiative (2026-08-19):** Fixing Apple Guideline 1.2 (UGC) rejection.
Why: Community tab (`Comm.` — posts, photos, comments, chat) requires UGC moderation infra Apple mandates. Existing app had EULA screen + report + block + client-side profanity filter, but was missing: (1) existing-user EULA re-prompt, (2) developer email alerts on report/block, (3) server-side profanity check, (4) unblock UI, (5) admin moderation dashboard, (6) user ban enforcement.
How to apply: All UGC-adjacent code changes must consider Apple 1.2 compliance. When touching auth, community, or admin screens, keep the ban check and EULA-accept check paths intact.

**2026-09-08 — SECOND 1.2 REJECTION (submission b07f6a90, reviewed 2026-08-14, v1.0 build 10).**
Apple re-rejected on the same guideline. Root cause was discoverability + a gap the
2026-08-19 pass missed, not the moderation backend:
  1. Post detail screen had no report affordance at all (only the feed card did).
  2. Chat moderation was long-press-only — invisible to a reviewer.
  3. Community content was browsable while signed out, so a signed-out reviewer saw
     UGC with no EULA and no working report/block.
  4. `APPLE_1_2_SUBMISSION.md` Part 4 claimed every prayer request had a report menu;
     prayer requests are actually admin-only and never shown to members.
Fixed 2026-09-08 (tsc clean): community tab is now sign-in gated (`CommunityScreen`
renders a gate when `!user`, routing to MoreScreen's login modal via the new
`MoreMain: { openLogin?: boolean }` param); report "…" added to the post detail header
and to each incoming chat bubble; terms notice added to the Sign In tab; volunteer
applicant name now runs through `checkContentFilter`. Submission doc updated to match.

**Backend status as of 2026-08-19: CODE COMPLETE, DEPLOYMENT PENDING.**
All app code + SQL + Edge Functions written and `npx tsc --noEmit` passes clean. User has NOT yet run the deploy steps. When user returns to this initiative, do NOT re-implement — walk them through `APPLE_1_2_SUBMISSION.md` "Part 1 — Deployment" sections 1–7 in order. Steps 1 & 6 require the Supabase Dashboard (they cannot be automated from CLI without secrets user must paste). Steps 2, 4, 5 require Supabase CLI which may not be installed yet.

Deployment checklist (all pending):
1. Run `supabase_apple_1_2_compliance.sql` in Supabase SQL Editor
2. Sign up at resend.com using junyeongpark96@gmail.com, get API key
3. Install Supabase CLI (`brew install supabase/tap/supabase`) + `supabase login` + `supabase link --project-ref epgwwsixhgdagavnurog`
4. `supabase secrets set RESEND_API_KEY=re_...`
5. `supabase functions deploy notify-report --no-verify-jwt` and same for `notify-block`
6. Create 2 Database Webhooks in Dashboard (content_reports→notify-report URL, blocked_users→notify-block URL, both INSERT-only)
7. Smoke test: post → report → verify email at junyeongpark96@gmail.com within ~10s
Then: record the 3 videos described in APPLE_1_2_SUBMISSION.md Part 3, use the reply template in Part 4.

Key files created this session (do NOT recreate — verify existence first):
- `supabase_apple_1_2_compliance.sql` (root)
- `supabase/functions/{notify-report,notify-block}/index.ts` + `_shared/send-email.ts`
- `src/components/UgcComplianceGate.tsx` (mounted in App.tsx)
- `src/screens/BlockedUsersScreen.tsx` (routed in MoreTabNavigator)
- `APPLE_1_2_SUBMISSION.md` (deployment doc — ALWAYS start by reading this before advising)

Key files modified this session:
- `App.tsx` (mounts UgcComplianceGate), `src/context/AuthContext.tsx` (exposes needsEulaAccept/isBanned/acceptEula/CURRENT_EULA_VERSION=1), `src/utils/moderation.ts` (adds unblockUser, fetchBlockedUsersDetailed, admin RPCs), `src/screens/MoreScreen.tsx` (adds "차단한 사용자 관리" row in Account section), `src/screens/AdminScreen.tsx` (adds 🛡️ Moderation tab as first tab with pending-count badge), `src/navigation/MoreTabNavigator.tsx`, `src/types/index.ts`, `tsconfig.json` (excludes supabase/functions since it's Deno not RN).

**Church community structure:** 7 hardcoded communities: kosovo, albania, dagestan, kissimmee, bridge, hope, community7. Not user-created.

**Admin role:** `profiles.role='pastor'` OR `profiles.is_admin=true` → `isPastor`/`isAdmin` in AuthContext. Church has 2 pastors seeded in staff list (Pastor Joshua = senior, Pastor Kang = associate).

**Key architectural notes:**
- Auth = React Context only (no Redux/Zustand)
- Existing moderation utilities live in `src/utils/moderation.ts`
- UGC tables: `community_posts`, `community_photos`, `community_messages`, `post_comments`
- Moderation tables: `content_reports`, `blocked_users`
- All SQL lives in root-level `supabase_*.sql` files (not `/supabase/migrations/`)
