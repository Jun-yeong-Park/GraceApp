# CLAUDE.md — 주은혜교회 앱 (Sunlight Grace Church)

이 파일 하나로 새 세션이 바로 이어서 일할 수 있게 쓴 인계 문서다.
**작업 시작 전에 이 파일 전체 + `memory/project_grace_church_app.md` 를 읽을 것.**
마지막 갱신: 2026-10-03.

---

## 1. 프로젝트 개요

올랜도 주은혜교회(Sunlight Grace Church) 성도용 iOS 앱. Jay가 "주은혜 어플"이라 부른다.
App Store 출시됨 — **2026-09-11 승인** (v1.0.3 build 12). 현재 작업 중인 버전은 **1.1.0**.

| | |
|---|---|
| 리포 | `~/develop/GraceApp/grace-church-app` · git `Jun-yeong-Park/GraceApp` · **main 단일 브랜치** |
| 스택 | Expo SDK 54 (managed) / React Native 0.81 / TypeScript strict / React Navigation 7 |
| 백엔드 | Supabase `epgwwsixhgdagavnurog` (Postgres + Auth + Storage + Edge Functions) |
| 상태관리 | **React Context만** (Redux/Zustand 없음) — `AuthContext`, `LanguageContext` |
| 다국어 | 한/영/스 3개. **기본 `en`.** `src/i18n/translations.ts` + 화면별 로컬 `UI` 객체 혼용 |
| 번들 ID | `com.graceorlandochurch.app` · ASC App ID `6780975086` |
| EAS | owner `sundayproject` · projectId `6ba2320d-f618-45bd-859f-afd5c6c7b8cc` |

### 화면 구조 (하단 탭 5개)

```
🏠 Home     홈 → 기도요청 / 심방신청 / 봉사 / 설교요약 / 온라인헌금 / 교인명부 / 영수증 / 관리자
📖 Bible    책 목록 → 장 목록 → 본문 (번역본 8종, TTS 읽기, 북마크, 읽음 진행률)
🤝 Comm.    공동체 목록 → 상세(게시물/사진) → 게시물 상세(댓글) → 채팅
⛪ Worship  예배 안내 → 주보 상세 (최신 설교 YouTube)
··· More    설정/언어/알림/스태프/SNS/개인정보/약관/차단목록/관리자/계정
```

### 디렉터리

```
src/
  components/   Icon.tsx(아이콘 세트) CustomTabBar UgcComplianceGate
  context/      AuthContext(세션·역할·공동체·EULA·밴) LanguageContext
  screens/      21개 — AdminScreen 2000줄+ 이 가장 큼
  navigation/   TabNavigator + 탭별 Stack
  utils/        moderation.ts(신고·차단·욕설필터) push.ts colors.ts bibleRef.ts
  services/     supabase.ts
  i18n/         translations.ts (ko/en/es 3블록)
  data/         bibleBooks.ts
assets/icons/   자체 제작 아이콘 43개 (256px PNG, 투명)
supabase/functions/  Edge Function 6개 (Deno)
supabase_*.sql  DB 스키마·정책 (아래 §5 순서대로 적용)
memory/         프로젝트 상세 기록 — 반드시 읽을 것
design/         ICON_BRIEF.md (아이콘 생성 프롬프트)
APPLE_1_2_SUBMISSION.md  애플 심사 대응 문서 (계정·영상 대본·회신문)
*_flat.json     성경 번역본 8종 ≈34MB — 정적 번들. 건드리지 말 것
```

---

## 2. ⚠️ 이 머신 환경 — 코드만 봐서는 알 수 없는 것

**빌드 방식이 일반적인 Expo 프로젝트와 다르다. 반드시 읽을 것.**

- **CocoaPods 설치 불가** — 시스템 Ruby 2.6이라 `gem install cocoapods` 가 의존성 때문에 실패한다
  (ffi/drb/securerandom 이 Ruby ≥2.7 요구). 따라서 **`npx expo run:ios` / `expo prebuild` 로 로컬
  네이티브 빌드를 할 수 없다.** 시도하지 말 것 — `ios/` 를 만들었다가 지우는 삽질만 하게 된다.
- **Homebrew 없음.** Supabase CLI는 devDependency로 깔려 있다 → `npx supabase ...`
- **Xcode 26.6 있음**, 시뮬레이터 iPhone 17 사용 가능. 단 `sudo xcode-select -s
  /Applications/Xcode.app/Contents/Developer` 가 되어 있어야 시뮬레이터 도구가 붙는다
  (안 되어 있으면 Jay에게 이 명령을 요청 — sudo라 대신 실행 불가).
- **시뮬레이터 확인 방법:** EAS 클라우드로 시뮬레이터 빌드 → 다운로드 → `simctl install`.
  `eas.json` 의 `preview` 프로필이 `ios.simulator: true` 로 이 용도다.
- 시뮬레이터 키보드가 한글 모드면 영문 타이핑이 자모로 깨진다. **앱 버그 아님.**
- `expo-doctor` 는 패치 버전 차이만 경고한다(무시 가능).

### 계정

| 용도 | 계정 | 비고 |
|---|---|---|
| Expo/EAS | `sundayproject` | 브라우저 로그인 (`npx eas-cli login`) |
| Apple Developer | `apfnd161@naver.com` | 포털 로그인 됨. 푸시 권한 프로파일 발급 완료 |
| TestFlight 업로드 | 같은 Apple ID + **앱 암호** | 일반 비번 아님. appleid.apple.com에서 생성 |
| Supabase / Resend / 알림 수신 | `junyeongpark96@gmail.com` | |
| 교회 문의처 (앱 내 표기) | `joccjosh@gmail.com` | **앱 안 문구는 이걸 유지** (Jay 지시) |

---

## 3. 명령어

### 개발 · 검증

```bash
npx tsc --noEmit                 # 타입 검사 — 유일한 자동 검증 수단. 테스트 코드 없음
npx expo start                   # Metro (Expo Go). 네이티브 모듈 추가분은 반영 안 됨
```

**테스트 프레임워크가 없다.** 검증은 ① `tsc --noEmit` ② 아래 REST 호출로 서버 동작 확인
③ 시뮬레이터/실기기 눈으로 확인, 이 세 가지로 한다.

### 서버 동작 검증 (앱 없이 — 매우 유용)

데모 계정으로 REST를 직접 때려서 RLS·RPC가 실제로 되는지 본다.
anon key는 공개용(`sb_publishable_…`)이라 코드에 써도 된다.

```bash
python3 - <<'PY'
import json, urllib.request
URL="https://epgwwsixhgdagavnurog.supabase.co"
ANON="sb_publishable_0NMBHoV1ue7KwrhkeY2Jzw_O-J0i4fz"
def call(m,p,b=None,t=None,prefer=None):
    h={"apikey":ANON,"Content-Type":"application/json","Authorization":f"Bearer {t or ANON}"}
    if prefer: h["Prefer"]=prefer
    r=urllib.request.Request(URL+p,data=json.dumps(b).encode() if b is not None else None,headers=h,method=m)
    try:
        with urllib.request.urlopen(r,timeout=25) as x: s=x.read().decode(); return x.status,(json.loads(s) if s else None)
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:200]
P=call("POST","/auth/v1/token?grant_type=password",{"email":"reviewer@gracechurch.app","password":"GraceReview2026!"})[1]["access_token"]
M=call("POST","/auth/v1/token?grant_type=password",{"email":"member@gracechurch.app","password":"gracemember2026"})[1]["access_token"]
print(call("GET","/rest/v1/community_posts?select=community_id,title",t=M))
PY
```

**테스트로 만든 행은 반드시 지울 것.** 운영 DB다.

### 빌드

```bash
# 시뮬레이터용 (화면 확인)
npx eas-cli build --platform ios --profile preview --non-interactive --no-wait
npx eas-cli build:view <ID> --json      # 상태 폴링
# 받은 tar.gz 풀어서:
xcrun simctl install <UDID> SunlightGraceChurch.app
xcrun simctl launch  <UDID> com.graceorlandochurch.app

# 프로덕션 (TestFlight/App Store)
npx eas-cli build --platform ios --profile production      # 대화형: Apple 로그인 물어보면 답해야 함
npx eas-cli submit --platform ios --latest                 # 앱 암호 필요 → Jay가 직접
```

빌드 번호는 EAS 원격 관리(`appVersionSource: remote`, 현재 **15**), autoIncrement.
앱 버전(`app.json` 의 `version`)은 수동. **App Store에 이미 출시된 번호로는 재제출 불가**
(ITMS-90186/90062) — 그래서 1.0.3 → 1.1.0으로 올렸다.

### Supabase

```bash
npx supabase functions deploy <name> --no-verify-jwt
npx supabase functions list
npx supabase secrets list
```

SQL은 **대시보드 SQL Editor에 붙여넣어 실행**한다 (CLI 마이그레이션 안 씀).
`open "https://supabase.com/dashboard/project/epgwwsixhgdagavnurog/sql/new"`

---

## 4. 코딩 규칙 (Jay가 정한 것 + 이 리포의 관례)

### 소통

- **한국어로 답한다.** Jay는 한/영 섞어 쓰고 오타가 잦다("체크업", "심ㄹ레이터") — 의도로 읽을 것.
- **복붙 가능한 명령/SQL을 준다.** 추상적 설명 말고 실행할 수 있는 블록으로.
- Supabase Edge Function/Deno/DB 웹훅에 익숙하지 않다고 가정하고, 지시는 문자 그대로 따를 수 있게.
- **Jay가 비밀값(API 키 등)을 채팅에 붙이는 경향이 있다. 볼 때마다 폐기·교체를 경고할 것.**

### 코드

- 기존 스타일을 따른다. 화면 파일은 "import → 상수/UI 문구 객체 → 컴포넌트 → StyleSheet" 순.
- 다국어는 두 방식이 공존한다: 전역 `t('key')` 와 화면 로컬 `UI` 객체 + `lu()`.
  **새로 쓸 때는 그 화면이 이미 쓰는 쪽을 따른다.**
- 3개 언어를 항상 함께 채운다. 하나라도 빠지면 그 언어 사용자에게 빈칸이 보인다.
- 주석은 한국어. **"무엇"이 아니라 "왜"를 쓴다** — 특히 RLS 우회, 버전 고정 같은 비직관적 결정.
- 커밋 메시지도 한국어. 제목 한 줄 + 빈 줄 + 본문(원인·근거). 끝에:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- 변경 후 **반드시 `npx tsc --noEmit`** 으로 확인하고 커밋.

### 이 리포의 함정

- **이모지를 아이콘으로 쓰지 말 것.** `src/components/Icon.tsx` 에 43개 세트가 있다.
  `<Icon name="..." size={} tintColor={} />`. 글리프는 단색이라 tintColor로 색을 바꾸고,
  공동체 배지 7개(`community-*`)는 풀컬러라 tintColor를 주지 않는다.
  Metro가 동적 require를 못 하므로 **이름→require 매핑은 정적으로** 유지.
- **`Alert.alert('', msg)` 는 iOS 기본 버튼(확인/OK)이 폰 언어를 따른다.** 앱 언어와 달라 보인다.
  현재는 그대로 두기로 함.
- Realtime은 켜져 있지 않다. **저장 후 화면 갱신을 Realtime 구독에만 의존하면 안 된다** —
  insert 응답(`.select().single()`)으로 목록에 직접 추가하고 id로 중복 제거.
- 패키지 추가 시 **반드시 `npx expo install`** (npm install 아님). SDK 버전이 안 맞으면
  네이티브 모듈을 못 찾아 **앱이 실행 즉시 크래시**한다 (expo-asset 57.x 사건, §7 참조).

---

## 5. Supabase 구조

### SQL 적용 순서 (새 프로젝트를 세팅한다면)

```
1. supabase_setup.sql              전체 스키마 + RLS + 스토리지 버킷
2. supabase_moderation.sql         (setup에 포함됨 — 과거 분리본)
3. supabase_fix_rls_recursion.sql  is_pastor() 도입, 정책 재귀 제거
4. supabase_apple_1_2_compliance.sql  밴/EULA/욕설트리거/관리자RPC/v_pending_reports
5. supabase_moderation_webhooks.sql   pg_net 트리거 → notify-report/notify-block
6. supabase_functional_fixes.sql      심방정책/봉사RPC/가입승인RPC/계정삭제RPC/push_tokens
7. supabase_signup_approval.sql       가입 승인 메일 (❗아직 미적용 — §6)
8. supabase_community_access.sql      공동체별 접근 제한 (적용 완료)
   supabase_seed_review_demo.sql      심사용 데모 데이터 (재심사 시 필요하면)
```

### 핵심 테이블

`profiles`(role/is_admin/eula_version/is_banned/**community_id**) · `community_posts` ·
`community_photos` · `community_messages` · `post_comments` · `content_reports` ·
`blocked_users` · `push_tokens` · `signup_approvals` · `prayer_requests` · `visit_requests` ·
`announcements` · `events` · `bulletins` · `sermon_summaries` · `volunteer_posts` · `members` ·
`receipts` · `app_settings`(key-value)

### 권한 모델

- `is_pastor()` — `role='pastor' OR is_admin` . 모든 관리자 정책이 이걸 쓴다.
- `my_community_id()` — 내 소속 공동체. **회원은 자기 공동체 콘텐츠만** 읽고 쓴다(목사 예외).
  앱에서 숨기는 게 아니라 **RLS로 막는다** — 클라이언트를 고쳐도 못 본다.
- `is_current_user_active()` — 밴 당한 사용자의 INSERT 차단.

### RPC

`admin_ban_user` `admin_unban_user` `admin_delete_reported_content` `admin_mark_report_reviewed`
`admin_list_pending_users` `admin_approve_user` `admin_reject_user`
`apply_volunteer` `delete_my_account` `my_community_id`

### Edge Functions (Deno, `--no-verify-jwt`)

| 이름 | 트리거 | 하는 일 | 배포됨 |
|---|---|---|---|
| `notify-report` | content_reports INSERT | 신고 메일 | ✅ |
| `notify-block` | blocked_users INSERT | 차단 메일 | ✅ |
| `send-push` | announcements/events INSERT | 전체 기기 Expo 푸시 | ✅ |
| `latest-sermon` | 앱이 직접 호출 | 교회 유튜브 채널 최신 주일예배 | ❌ **미배포** |
| `notify-signup` | signup_approvals INSERT | 승인자 2명에게 승인/거절 버튼 메일 | ❌ **미배포** |
| `approve-signup` | 메일 버튼 GET | 토큰으로 승인/거절 처리 | ❌ **미배포** |

메일은 Resend(`RESEND_API_KEY` 시크릿). **샌드박스 발신자 `onboarding@resend.dev` 는
Resend 계정 주인(junyeongpark96) 주소로만 배달된다.** joccjosh에게도 보내려면 Resend에
교회 도메인 인증 후 `supabase/functions/_shared/send-email.ts` 의 `SENDER` 를 바꿔야 한다.

**대시보드 Database→Webhooks UI는 이 프로젝트에서 404** (`supabase_functions` 스키마가 없음).
그래서 웹훅을 전부 pg_net 트리거로 직접 만든다. UI를 쓰라고 안내하지 말 것.

---

## 6. 현재 상태와 다음 할 일

### 지금 어디까지 왔나

- `main` = `origin/main` 동기화됨, 워킹트리 깨끗. **커밋 안 된 변경 없음.**
- 마지막 TestFlight 빌드: **1.0.3 (15)** — 폰에 깔려 있는 건 이것.
- 그 이후 커밋 6개가 **아직 빌드에 안 들어갔다**:

| 커밋 | 내용 | 앱/서버 |
|---|---|---|
| `27e4809` | 알림 토글 실패 안내 조건 수정 | 앱 |
| `0413c73` | 버전 1.1.0 | 앱 |
| `892bcd8` | 예배 탭 최신 설교 자동 | 앱 + **Edge 미배포** |
| `5dc0805` | 가입 승인 메일 | **SQL 미적용 + Edge 미배포** |
| `51f0c0b` | 성경 목소리 선택 + 속도 | 앱 |
| `ffe7e7d` | 브릿지 로고 교체 | 앱 |
| `b77a7e0` | 공동체 접근 제한 | 앱 + **SQL 적용 완료 ✅** |

### 즉시 할 일 (Jay가 직접 — 권한 필요)

```bash
# ① 가입 승인 메일 — SQL 먼저
open -e supabase_signup_approval.sql
open "https://supabase.com/dashboard/project/epgwwsixhgdagavnurog/sql/new"

# ② Edge Function 3개 배포
npx supabase functions deploy latest-sermon  --no-verify-jwt
npx supabase functions deploy notify-signup  --no-verify-jwt
npx supabase functions deploy approve-signup --no-verify-jwt

# ③ 유튜브 자동 동작 확인
curl -s https://epgwwsixhgdagavnurog.supabase.co/functions/v1/latest-sermon | python3 -m json.tool
```

### 그다음

1. **1.1.0 build 16 빌드 → TestFlight**
2. **실기기에서만 확인 가능한 3가지** (시뮬레이터로 못 봄):
   - 성경 읽기 소리 — **무음 스위치 켠 상태**에서 나는지 (expo-audio로 고친 부분)
   - More → Notifications 토글 → 권한 팝업 → 켜진 채 유지
   - 목사 계정으로 일정 등록 → 폰에 푸시 도착
3. 공동체 배정 — **기존 회원 전원이 미배정 상태**다. Admin → Members에서 한 명씩 배정해야
   커뮤니티가 보인다. 그 전엔 안내 화면만 나온다.
4. App Store 1.1.0 제출 (ASC에서 **새 버전 레코드 1.1.0 생성** 후 빌드 연결)

### Jay가 제안받고 아직 고르지 않은 것 — 커뮤니티 강화

1. 가입 시 공동체 선택 (지금은 목사가 일일이 배정) · 2. 모임 참석 응답(갈게요/못가요) ·
3. 공동체 채팅 푸시 · 4. 공동체 리더 권한 · 5. 멤버 목록 · 6. 채팅 사진 · 7. 기도요청 공동체 공유
→ **1+2+3 조합을 추천했고 Jay의 답을 기다리는 중.**

---

## 7. 알려진 이슈 · 과거에 당한 함정

### 반드시 기억할 것

- **`npx expo install` 안 쓰면 크래시한다.** `expo-audio` 를 넣었더니 peerDep `expo-asset: *`
  때문에 npm이 SDK 54용이 아닌 expo-asset 57.x 를 최상위에 올렸고, JS는 57을 로드하는데
  네이티브가 없어 **실행 즉시 `Cannot find native module 'ExpoAsset'`** 로 죽었다.
  → `expo-asset ~12.0.13` 을 직접 의존성으로 박아 dedupe. 패키지 추가 후엔 **시뮬레이터로
  실행까지 확인**하고 프로덕션 빌드를 낼 것.
- **애플 1.2 리젝 2회의 진짜 원인**(기능 부재가 아니었다):
  ① 리뷰어가 목사 계정으로 들어가 전부 자기 글이라 신고 `⋯` 가 0개였고
  ② 게시물 `author_id` 가 NULL이라 "Block user" 버튼 자체가 안 떴고
  ③ `blocked_users` FK가 `auth.users` 를 가리켜 PostREST 임베드가 실패 → 차단 목록이 항상 빈 화면.
  → **심사 데이터는 "남이 쓴 글"이 반드시 있어야 하고, author_id가 채워져 있어야 한다.**
  회신문은 member 계정을 먼저 안내한다 (`APPLE_1_2_SUBMISSION.md` Part 4).
- **욕설 필터는 부분 문자열 매칭**이다. `죽어`("죽어 주셨다"), `좇`("주를 좇아"),
  `보지`("보지 못했다"), `자지`("자지 않고"), `rape`("grape") 같은 조각을 넣으면
  **정상적인 교회 게시물이 차단된다.** 단어를 추가할 땐 문장 안에 못 들어가는 것만.
  클라이언트(`src/utils/moderation.ts`)와 서버(`contains_blocked_words`) 목록을 같이 고칠 것.
- **floating 탭바가 하단 입력창을 가린다.** 입력창이 있는 화면은
  `CustomTabBar.tsx` 의 `HIDE_TAB_ROUTES` 에 추가해야 한다 (CommunityChat, CommunityPostDetail).
- **RN `Modal` 안의 `SafeAreaView` 는 상단 인셋을 못 받는다** → 헤더가 노치에 먹힌다.
  `useSafeAreaInsets()` 로 직접 paddingTop을 준다 (UgcComplianceGate 참고).
- **`push_tokens` 는 SELECT 정책이 없다** (토큰이 수집되면 제3자가 스팸 푸시를 보낼 수 있어서).
  그래서 `upsert` 를 못 쓴다 → delete 후 insert.
- 가로 `ScrollView` 를 탭바로 쓸 때 `flexGrow: 0` 을 주지 않으면 내용 적은 탭에서 세로로 늘어난다.

### 미해결 / 보류

- 노출됐던 Resend API 키 교체 여부 미확인 (Jay가 채팅에 붙인 적 있음).
- Instagram·Facebook 아이콘은 공식 브랜드 에셋이 필요해 이모지로 남겨둠.
- `SermonScreen.tsx`(499줄), `MoreStackNavigator.tsx`, `BulletinStackNavigator.tsx` 는
  어디서도 라우팅되지 않는 **미사용 파일**. 지우지 말고 두기로 함.
- 성경 JSON 8종 ≈34MB 정적 번들 → 앱 용량·초기 로딩이 무겁다. 경량화는 미착수.
- 데모 계정 `member@gracechurch.app` 의 role이 현재 `deacon` 이다(테스트 중 변경된 듯).
  심사 전에 `member` 로 되돌리는 게 맞다.

### 심사용 데이터 (지우면 안 됨)

더미데이터는 2026-09-12에 전부 정리했고, **심사용 최소 세트만** 남겼다:
Kosovo 게시물 2개(목사 1 + 회원 1) · 댓글 1 · 채팅 2 · 데모 계정 2개 · 주간 말씀.
업데이트마다 애플이 재심사하므로 이 세트는 유지한다.

| 계정 | 비번 | 역할 |
|---|---|---|
| `member@gracechurch.app` | `gracemember2026` | 심사 시 **이 계정을 먼저 안내** |
| `reviewer@gracechurch.app` | `GraceReview2026!` | pastor (관리자 화면용) |
| `junyeongpark96@gmail.com` | Jay 본인 | pastor |

---

## 8. 작업 방식 — 아래 4원칙을 지킬 것

### 8.1 생각하고 코딩하기

**추측하지 말 것. 혼란을 숨기지 말 것. 트레이드오프를 드러낼 것.**

- 가정은 명시한다. 불확실하면 묻는다.
- 해석이 여러 개면 전부 제시한다 — 말없이 하나를 고르지 않는다.
- 더 간단한 방법이 있으면 말한다. 근거가 있으면 반대 의견을 낸다.
- 불명확하면 멈춘다. 뭐가 헷갈리는지 이름 붙이고 묻는다.

### 8.2 단순함 우선

**문제를 푸는 최소한의 코드. 추측성 구현 금지.**

- 요청하지 않은 기능 추가 금지. 단발성 코드에 추상화 금지.
- 요청하지 않은 "유연성"·"설정 가능성" 금지. 불가능한 상황에 대한 에러 처리 금지.
- 200줄 썼는데 50줄로 되면 다시 쓴다.

### 8.3 외과적 변경

**건드려야 하는 것만 건드린다. 내가 만든 것만 치운다.**

- 주변 코드·주석·서식을 "개선"하지 않는다. 멀쩡한 걸 리팩터링하지 않는다.
- 기존 스타일에 맞춘다 — 내 취향과 달라도.
- 관련 없는 죽은 코드를 발견하면 **말만 하고 지우지 않는다.**
- 내 변경이 만든 미사용 import/변수/함수는 제거한다. 기존 죽은 코드는 요청 없이 손대지 않는다.

**기준:** 바뀐 모든 줄이 사용자 요청으로 직접 추적돼야 한다.

### 8.4 목표 기반 실행

**성공 기준을 정의하고, 검증될 때까지 반복한다.**

- "검증" = `npx tsc --noEmit` 통과 + (서버 변경이면) REST로 실제 호출 + (UI면) 시뮬레이터/실기기 확인.
- 여러 단계 작업은 짧은 계획을 먼저 말한다:

```
1. [단계] → 검증: [확인 방법]
2. [단계] → 검증: [확인 방법]
```
