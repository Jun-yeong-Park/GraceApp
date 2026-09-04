# Apple Guideline 1.2 (UGC) Compliance — Deployment & Submission Guide

Grace Church App / `com.graceorlandochurch.app`
Prepared 2026-08-19 — implements EULA re-consent, content filtering, report, block, ban, admin moderation dashboard, and developer email alerts.

---

## Part 1 — Deployment (do this once, in order)

### Step 1. Run the DB migration

1. Open [Supabase Dashboard → SQL Editor](https://supabase.com/dashboard/project/epgwwsixhgdagavnurog/sql/new)
2. Copy the entire contents of `supabase_apple_1_2_compliance.sql`
3. Paste and click **Run**
4. Verify:
   - `profiles` table now has `is_banned`, `banned_at`, `banned_reason`, `eula_version` columns
   - `content_reports` has `admin_notes`, `reviewed_by`, `reviewed_at`
   - View `v_pending_reports` exists

### Step 2. Create a Resend account & API key

1. Sign up at https://resend.com (free tier — 100 emails/day, plenty for this)
2. Sign up using **junyeongpark96@gmail.com** — the sandbox sender `onboarding@resend.dev` can only deliver to the account owner's email, and that's the address the Edge Functions send to.
3. Dashboard → **API Keys** → **Create API Key** → name it "Grace Church Moderation" → copy the key (starts with `re_...`)

### Step 3. Install Supabase CLI (if you haven't)

```bash
brew install supabase/tap/supabase
supabase login
cd /Users/jay/GraceApp/grace-church-app
supabase link --project-ref epgwwsixhgdagavnurog
```

### Step 4. Set the Resend secret in Supabase

```bash
supabase secrets set RESEND_API_KEY=re_your_key_here
```

### Step 5. Deploy the two Edge Functions

```bash
supabase functions deploy notify-report --no-verify-jwt
supabase functions deploy notify-block  --no-verify-jwt
```

Copy the two function URLs from the output — they look like:
`https://epgwwsixhgdagavnurog.supabase.co/functions/v1/notify-report`

### Step 6. Wire the Database Webhooks

For **notify-report**:
1. Dashboard → **Database → Webhooks** → **Create a new hook**
2. Name: `notify-report`
3. Table: `content_reports`
4. Events: check only **Insert**
5. Type: **HTTP Request**
6. Method: **POST**
7. URL: paste the `notify-report` function URL from Step 5
8. HTTP Headers: leave default (`Content-Type: application/json`)
9. Click **Create webhook**

Repeat for **notify-block**:
- Name: `notify-block`
- Table: `blocked_users`
- Events: **Insert**
- URL: `notify-block` function URL

### Step 7. Smoke test (before submitting to Apple)

1. In the app, sign in with the reviewer demo account
2. Post a test comment, then report it via the "…" menu on someone else's post
3. Within ~10 seconds, check **junyeongpark96@gmail.com** — you should have a `🚨 [Grace Church] New comment report` email
4. Block a test user → you should get a `🚫 [Grace Church] User block event` email
5. Sign in as `reviewer@gracechurch.app` (pastor) → **Admin → 신고관리** tab should show the pending report; try "검토완료", "콘텐츠 삭제", "유저정지"

If a step fails, check **Dashboard → Edge Functions → Logs** and **Database → Webhooks → recent deliveries**.

---

## Part 2 — Pre-submission testing checklist

Before creating a build, walk through these in the actual app on a real device:

- [ ] **New signup flow**: Signup modal → EULA checkbox is required → button disabled without check → after signup, `profiles.eula_version = 1` and `eula_accepted_at` set (verify in SQL editor)
- [ ] **Existing user re-consent**: Manually run `UPDATE profiles SET eula_version = 0 WHERE email='member@gracechurch.app';` then sign in — a non-dismissible EULA modal appears with the zero-tolerance summary + Agree/Do-not-agree buttons. Clicking Agree updates `eula_version` back to 1 and closes the modal.
- [ ] **Client-side profanity filter**: try posting "fuck test" → blocked with alert.
- [ ] **Server-side profanity filter**: bypass the client (or edit the client filter list) and try inserting the same text → Supabase returns `BLOCKED_CONTENT` error, post is rejected.
- [ ] **Report flow**: "…" on someone else's post → 🚨 Report → choose a reason → success alert → email arrives at junyeongpark96@gmail.com within ~10s → row appears in `content_reports` with `status='pending'`.
- [ ] **Block flow**: "…" on someone else's post → 🚫 Block user → confirm → user's posts/comments/chat disappear from your feed **immediately** without app restart → email arrives → row in `blocked_users`.
- [ ] **Unblock**: More → 계정 → 차단한 사용자 관리 → Unblock → user's content reappears.
- [ ] **Admin moderation**: sign in as pastor → Admin → 신고관리 → shows pending count badge in tab bar → tap "콘텐츠 삭제" → content is gone from feed → tap "유저정지" → user cannot post anymore.
- [ ] **Ban enforcement**: banned user signs in → sees "Account Suspended" alert → is signed out → cannot re-enter feed to post.

---

## Part 3 — App Store Screen Recording Scenarios

Record **three separate short videos** (30–60 sec each). Upload with your reply to Apple.

### Video A — EULA at signup (Apple requirement: agreement before UGC access)

1. Open the app fresh (or sign out first)
2. Tap **More** tab → **Sign In / Sign Up**
3. Switch to **Sign Up** tab
4. Fill Name, Email, Password, Confirm
5. **Show the EULA checkbox** with the zero-tolerance clause visible
6. **Tap the "Terms of Use" link** — the full EULA screen opens with Section 2 "Zero Tolerance for Objectionable Content" visible → go back
7. Show that the **Sign Up button is disabled** until the checkbox is ticked
8. Tick the checkbox → tap Sign Up → success

### Video B — Report flow

1. Signed in as demo member, open the **Comm.** tab
2. Open any community → open a post authored by someone else
3. Tap the **"…" menu** on a post/comment
4. Show the sheet with **🚨 신고하기 / Report** and **🚫 사용자 차단 / Block user** options
5. Tap Report → show the 6 reason choices → pick one
6. Show the success alert: "신고가 접수되었습니다. 24시간 내에 검토 후 조치됩니다."

### Video C — Block flow (Apple requirement: content must disappear immediately)

1. Same starting screen — post feed with content from user X visible
2. Tap "…" on user X's post → 🚫 사용자 차단 → confirm
3. **The post disappears from the feed immediately, without reloading.** Pan the feed to show X's other posts/comments/chat messages are also gone.
4. Navigate to **More → 계정 → 차단한 사용자 관리** → user X appears in the list with "차단 해제" button
5. Tap 차단 해제 → confirm → the user's posts are visible again in the feed

---

## Part 4 — Reply-to-Review template

Copy-paste this into App Store Connect → Resolution Center reply. Update the video links.

```
Dear App Review Team,

Thank you for the feedback on Guideline 1.2. We have implemented all four required
user-generated content mechanisms and are re-submitting for review.

1. EULA / Terms of Use with zero-tolerance for objectionable content
   - New users must agree to the EULA before signup completes. The Agree button is
     disabled until the checkbox is ticked (see Video A).
   - The EULA (Section 2) explicitly states: "The App applies a strict Zero
     Tolerance policy toward objectionable content and abusive behavior..."
   - Existing users are shown a non-dismissible re-consent modal on next launch.
   - Acceptance is recorded per-user with a timestamp and version in the
     `profiles.eula_accepted_at` and `profiles.eula_version` columns.

2. Content filtering
   - Client-side profanity/hate-speech filter runs before any post, photo,
     comment, or chat message is sent (English + Korean + Spanish word lists).
   - Server-side Postgres trigger re-validates every insert as a defense-in-depth
     measure (`reject_blocked_content` trigger on 5 UGC tables).

3. Reporting mechanism (see Video B)
   - Every post, photo, comment, chat message, and prayer request has a "…" menu
     with a 🚨 Report option (6 categorized reasons).
   - Reports are stored in the `content_reports` table and trigger an immediate
     email to the developer via a Supabase Edge Function.
   - The in-app UI promises action within 24 hours per Apple's requirement.

4. Blocking mechanism (see Video C)
   - Every user's content has a "…" menu with 🚫 Block user.
   - Blocking is immediate: the user's posts, photos, comments, and chat messages
     disappear from the blocker's feed without app restart.
   - Per Apple's requirement, blocking also generates an automatic report and
     sends a notification email to the developer.
   - Users can review and revoke their blocks via More → 차단한 사용자 관리.

5. Admin moderation
   - Pastors have an in-app moderation dashboard (Admin → 신고관리) to review
     pending reports, delete offending content, and ban users.
   - Banned users are immediately signed out on next auth check and are blocked
     from inserting new posts/comments/messages by both application logic and
     Supabase RLS policies.

Demo account: reviewer@gracechurch.app / GraceReview2026!  (pastor / admin role)
Member account: member@gracechurch.app / GraceMember2026!

Screen recordings:
   Video A (EULA): <upload link>
   Video B (Report): <upload link>
   Video C (Block): <upload link>

Please let us know if you need anything else.

Sincerely,
Grace Church App team
```

---

## Files created / changed in this pass

**New:**
- `supabase_apple_1_2_compliance.sql`
- `supabase/functions/_shared/send-email.ts`
- `supabase/functions/notify-report/index.ts`
- `supabase/functions/notify-block/index.ts`
- `src/components/UgcComplianceGate.tsx`
- `src/screens/BlockedUsersScreen.tsx`

**Modified:**
- `App.tsx` — mounts `<UgcComplianceGate />` as root sibling
- `src/context/AuthContext.tsx` — adds `needsEulaAccept`, `isBanned`, `acceptEula()`
- `src/utils/moderation.ts` — adds `unblockUser`, `fetchBlockedUsersDetailed`, admin RPCs
- `src/screens/MoreScreen.tsx` — adds "차단한 사용자 관리" row in Account section
- `src/screens/AdminScreen.tsx` — adds 🛡️ Moderation tab (first tab, with pending badge)
- `src/navigation/MoreTabNavigator.tsx` — registers `BlockedUsers` route
- `src/types/index.ts` — adds `BlockedUsers` to `MoreTabParamList`
- `tsconfig.json` — excludes `supabase/functions/` (Deno runtime, not RN)
