# iOS App Launch Checklist

## 1. 패키지 / 번들 설정
- [ ] `app.json` → `expo.ios.bundleIdentifier` 설정 (예: `com.company.appname`)
- [ ] `app.json` → `expo.android.package` 동일하게 통일 권장
- [ ] `expo.version` 설정 (예: `1.0.0`) — App Store에 이미 승인된 버전보다 높아야 함
- [ ] `expo.name`, `expo.slug` 확인
- [ ] `expo.owner` (EAS 계정명) 확인

## 2. EAS 설정 (`eas.json`)
- [ ] `production` 프로필에 환경변수 (`env`) 모두 포함
- [ ] `autoIncrement: true` — 빌드번호 자동 증가
- [ ] `submit.production.ios.appleId` 설정
- [ ] `submit.production.ios.ascAppId` 설정 → **이거 있으면 Apple 로그인 자동 스킵**
  ```json
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@email.com",
        "ascAppId": "1234567890"
      }
    }
  }
  ```

## 3. App Store Connect 준비
- [ ] [appstoreconnect.apple.com](https://appstoreconnect.apple.com) 에서 새 앱 생성
- [ ] 번들 ID 등록 (Apple Developer → Identifiers)
- [ ] 앱 이름, 카테고리, 언어 설정
- [ ] 스크린샷 준비 (6.9" + 6.5" iPhone 필수)
- [ ] 앱 아이콘 (1024x1024 PNG, 투명 배경 없음)
- [ ] 개인정보처리방침 URL 필수

## 4. 빌드 & 제출
```bash
# 빌드
eas build --platform ios --profile production

# 제출 (터미널에서 직접 실행 — 백그라운드 X)
eas submit --platform ios --profile production --latest
```
> ⚠️ `eas submit`은 반드시 터미널에서 직접 실행 (Apple ID 로그인 프롬프트 필요)

## 5. 버전 규칙
- 이미 승인된 버전 `1.0.0`이 있으면 → `1.0.1` 또는 `1.1.0`으로 올려야 제출 가능
- 빌드번호(build number)는 `autoIncrement`로 자동 관리

## 6. 앱 심사 제출 전 체크
- [ ] Privacy Manifest 필요 여부 확인 (expo-updates 등 일부 패키지 요구)
- [ ] Apple Sign In 사용 시 → `expo-apple-authentication` + `app.json` 플러그인 추가
- [ ] 앱 내 계정 로그인 있으면 → App Store Connect에 테스트 계정 등록
- [ ] 앱 접근 제한 여부 선택 (로그인 필요 → "예" 선택 후 테스트 계정 입력)
- [ ] 광고 식별자(IDFA) 사용 여부 체크
- [ ] 암호화 사용 여부 (일반적으로 "예, 면제 해당" 선택)

## 7. expo-updates 설정 (OTA 업데이트 원할 때)
```json
// app.json
{
  "expo": {
    "runtimeVersion": { "policy": "appVersion" },
    "updates": {
      "url": "https://u.expo.dev/YOUR_PROJECT_ID"
    },
    "plugins": ["expo-updates"]
  }
}
```
- JS만 바뀐 경우 → `eas update --branch production` (심사 없이 즉시 배포)
- 네이티브 변경(새 패키지 추가 등) → 반드시 풀 빌드 + 재제출

## 8. 자주 겪는 오류
| 오류 | 원인 | 해결 |
|------|------|------|
| `version 1.0.0 is closed` | 이미 승인된 버전 | `app.json` version 올리고 재빌드 |
| `Invalid signing key` | 번들 ID 바꾸면 키스토어 새로 생성됨 | 새 앱으로 등록하거나 기존 키 사용 |
| `Apple ID prompt` | 백그라운드에서 submit 실행 | 터미널에서 직접 `eas submit` 실행 |
| `ascAppId not found` | eas.json에 ascAppId 없음 | App Store Connect에서 앱 ID 확인 후 추가 |
