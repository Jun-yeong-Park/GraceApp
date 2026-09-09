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
cd /Users/jay/develop/GraceApp/grace-church-app
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

### Step 6. Wire the moderation webhooks

Run `supabase_moderation_webhooks.sql` in the SQL Editor. It enables `pg_net` and
adds two AFTER INSERT triggers (`notify_report_on_insert` on `content_reports`,
`notify_block_on_insert` on `blocked_users`) that POST to the Edge Functions.

Do **not** use Dashboard → Database → Webhooks for this. That UI writes to the
`supabase_functions` schema, which does not exist until webhooks have been enabled
from the Dashboard at least once — on this project it is absent, and the UI itself
404s under Integrations. The SQL file sends the identical payload shape and pins
the event to INSERT only.

Verify:

```sql
select tgname, tgrelid::regclass as table_name
from pg_trigger
where tgname in ('notify_report_on_insert','notify_block_on_insert');
```

Expect two rows: `content_reports` and `blocked_users`.

### Step 7. Smoke test (before submitting to Apple)

**7a — SQL-only test (fastest; no build needed).** In the SQL Editor:

```sql
-- profanity filter must not block ordinary sentences
select
  public.contains_blocked_words('예수님이 우리를 위해 죽어 주셨습니다') as must_be_false,
  public.contains_blocked_words('시발')                                as must_be_true;

-- fire the report webhook
insert into public.content_reports
  (reporter_id, content_type, content_id, reported_user_id, reason, status)
select id, 'post', gen_random_uuid(), id, 'smoke_test', 'pending'
from auth.users limit 1;

-- wait ~10s, then read what pg_net got back
select id, status_code, left(content, 400) as response_body, created
from net._http_response order by created desc limit 5;

-- clean up
delete from public.content_reports where reason = 'smoke_test';
```

`status_code = 200` means the Edge Function ran and Resend accepted the email.
`500 RESEND_API_KEY not set` → secret missing. `401/403` → stale Resend key.
`422` → Resend refused the recipient (the sandbox sender only delivers to the
address that owns the Resend account, i.e. junyeongpark96@gmail.com).

**7b — In-app test.**

1. In the app, sign in with the reviewer demo account
2. Post a test comment, then report it via the "…" menu on someone else's post
3. Within ~10 seconds, check **junyeongpark96@gmail.com** — you should have a `🚨 [Grace Church] New comment report` email
4. Block a test user → you should get a `🚫 [Grace Church] User block event` email
5. Sign in as `reviewer@gracechurch.app` (pastor) → **Admin → 신고관리** tab should show the pending report; try "검토완료", "콘텐츠 삭제", "유저정지"

If a step fails, check **Dashboard → Edge Functions → Logs** and the
`net._http_response` table above.

---

## Part 2 — Pre-submission testing checklist

Before creating a build, walk through these in the actual app on a real device:

- [ ] **Community sign-in gate**: signed out → tap **Comm.** tab → lock screen appears with the zero-tolerance summary, "Sign In / Sign Up" button, and "View Terms of Use" link. No user-generated content is reachable while signed out.
- [ ] **Report from post detail**: open a post authored by someone else → a **"…"** button is visible in the top-right of the header → tapping it opens Report / Block.
- [ ] **Report from chat**: each message from another member shows a visible **"…"** next to the timestamp (no long-press required).
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
2. Tap the **Comm.** tab → show the sign-in gate: community content is not
   viewable until the user signs in and accepts the terms. Tap **View Terms of
   Use** to show the full EULA, then go back.
3. Tap **Sign In / Sign Up** on that gate (or the **More** tab → **Sign In / Sign Up**)
4. On the **Sign In** tab, show the terms notice under the password field
   ("By signing in you agree to the Terms of Use and Privacy Policy…")
5. Switch to **Sign Up** tab
6. Fill Name, Email, Password, Confirm
7. **Show the EULA checkbox** with the zero-tolerance clause visible
8. **Tap the "Terms of Use" link** — the full EULA screen opens with Section 2 "Zero Tolerance for Objectionable Content" visible → go back
9. Show that the **Sign Up button is disabled** until the checkbox is ticked
10. Tick the checkbox → tap Sign Up → success

### Video B — Report flow

1. Signed in as demo member, open the **Comm.** tab
2. Open any community → open a post authored by someone else
3. Tap the **"…" button in the top-right of the post detail header**
   (also show the "…" on the post card in the feed and on a comment)
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

Thank you for the additional feedback on Guideline 1.2. All required precautions
are implemented. Because the controls were not located during the previous
review, we have made them more prominent and are listing exactly where each one
appears.

IMPORTANT — please sign in with the MEMBER account:

    member@gracechurch.app / gracemember2026

The app shows a delete control on content you wrote yourself and a report/block
control on content written by others. The pastor account authored most of the
community content, so the report and block controls are only visible from the
member account above. A pastor account is also provided at the end for the
moderation dashboard.

WHERE TO FIND EACH REQUIRED MECHANISM

1. EULA with a zero-tolerance clause, shown before registering or signing in
   - Launch the app signed out and tap the "Comm." tab. Community content is not
     viewable until you sign in; the screen states our zero-tolerance policy and
     links to the full Terms of Use.
   - Tap "View Terms of Use" to read the full EULA. Section 2 is titled
     "Zero Tolerance for Objectionable Content" and lists the prohibited
     categories.
   - On the Sign In tab, the terms notice appears directly under the password
     field. On the Sign Up tab, the Sign Up button stays disabled until the
     "I agree to the Terms of Use and Privacy Policy" checkbox is ticked.
   - Existing users are shown a non-dismissible re-consent modal on their next
     sign-in. Acceptance is stored per user with a timestamp and version.
   (Video A)

2. Filtering of objectionable content
   - A profanity and hate-speech filter (English, Korean, Spanish) runs in the
     app before any post, photo, comment, or chat message is submitted.
   - A Postgres trigger re-validates every insert on the server, so the filter
     cannot be bypassed by a modified client.

3. Flagging objectionable content
   Sign in as the member account, open "Comm." -> "Kosovo Community" and scroll
   to a post by "Pastor Reviewer". A "..." control appears in four places:
     a) top-right of each post card in the feed
     b) top-right of the navigation bar when the post is opened
     c) next to each comment
     d) next to each incoming message in the community chat (the speech-bubble
        icon in the community header)
   Tapping "..." opens Report and Block. Report offers six categorized reasons
   and confirms that we act within 24 hours. Each report is stored server-side
   and immediately emails our moderation address so it can be actioned within
   24 hours.
   (Video B)

4. Blocking abusive users
   - The same "..." menu contains "Block user".
   - Blocking takes effect immediately: that user's posts, photos, comments and
     chat messages disappear from your feed with no refresh or restart.
   - Blocking also files an automatic report and sends a notification email to
     the developer, as required.
   - Blocks can be reviewed and revoked at More -> scroll to the bottom ->
     ACCOUNT -> "Manage Blocked Users".
   (Video C)

5. Acting on reports within 24 hours
   - Every report and block sends an email to our moderation address the moment
     it is filed.
   - Signing in with the pastor account below and opening More -> Admin
     Dashboard -> "Moderation" shows pending reports with a count badge, and
     allows marking reviewed, deleting the reported content, and banning the
     author.
   - A banned user is signed out at the next auth check and is prevented from
     posting by database-level security policies, not only by app logic.

Screen recordings (captured on a physical iPhone):
   Video A - Terms of use before sign-in:  <upload link>
   Video B - Reporting objectionable content: <upload link>
   Video C - Blocking a user, content removed instantly: <upload link>

Accounts:
   Member (use this one for reporting and blocking):
       member@gracechurch.app / gracemember2026
   Pastor (moderation dashboard):
       reviewer@gracechurch.app / GraceReview2026!

Please let us know if anything is still unclear and we will provide whatever
additional detail you need.

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
