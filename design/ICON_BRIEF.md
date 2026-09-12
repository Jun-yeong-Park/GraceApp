# Grace Church App — 커스텀 아이콘 제작 브리프

ChatGPT(이미지 생성)에 넘길 프롬프트입니다. 아래 **"PROMPT"** 블록만 복사해서 붙여넣고,
주은혜 웹사이트 부서 로고 샘플 이미지를 같은 메시지에 첨부하세요.

사용 순서:
1. **1차 메시지** = PROMPT 전체 + 샘플 로고 첨부 → 먼저 "스타일 시트" 1장을 받습니다 (아이콘 6개 정도).
2. 스타일이 마음에 들면 **"Approved. Continue with Set A."** → 세트별로 받습니다.
3. 세트 하나 받을 때마다 앞 세트 이미지를 다시 첨부하며 **"Match this exactly."** 라고 하면 일관성이 유지됩니다.
4. 파일명은 아래 표의 `file` 열 그대로 저장합니다 → 앱에 넣는 작업이 기계적으로 끝납니다.

---

## PROMPT

```
You are designing a complete custom icon set for a church community mobile app
("Sunlight Grace Church", Orlando). The app currently uses default emoji everywhere
and I want to replace every emoji with an original, cohesive icon set in the same
visual language as our church's department logos (reference images attached).

STYLE — derive it from the attached reference logos:
- Study the attached department logos first. Match their line weight, corner
  rounding, level of detail, and overall warmth. The new icons must look like they
  came from the same designer.
- Flat vector style. No gradients, no drop shadows, no 3D, no photorealism, no
  outlines around the whole icon, no text or letters inside icons.
- Clean geometric shapes, generous negative space. Each icon must stay readable
  when shrunk to 20 px, so keep 1–3 shapes per icon and avoid thin details.
- Consistent optical size: every icon should visually fill about 70% of its square
  canvas, centered, with the same padding on all sides.

BRAND PALETTE (use only these unless a community badge specifies its own color):
- Navy (primary):   #2B588A
- Gold (accent):    #FAC538
- Ink (dark text):  #1A1A1A
- Cloud (light bg): #F5F7FA
- White:            #FFFFFF

TWO SUB-STYLES:
(1) UI GLYPHS — Sets A, C, D, E, F below.
    Single solid color, Navy #2B588A, on a fully TRANSPARENT background.
    No second color. The app will tint and fade these programmatically, so they
    must work as a silhouette. Think of a premium monoline/solid icon family.
(2) COMMUNITY BADGES — Set B below.
    These are small-group "department logos" like the attached references.
    Full color allowed: each badge uses its own accent color (listed) plus Navy,
    Gold and White. Round-square badge composition, symbol centered, no text.

TECHNICAL:
- Deliver each icon as a separate PNG, 1024×1024 px, transparent background,
  symbol centered. One icon per image, no mockups, no grids, no captions.
- Before producing the full set, first produce ONE style sheet image showing
  these six icons side by side so I can approve the style:
  home, bible, community (handshake), prayer, calendar, and the Kosovo badge.
  Wait for my approval before continuing.
- After approval, produce icons one set at a time, in the order A → B → C → D →
  E → F. Keep every set consistent with the approved style sheet.

ICONS TO CREATE
(name → meaning → notes)

SET A — Bottom tab bar (5) · glyph style · must read at 20 px
  tab-home       → Home              → simple house
  tab-bible      → Bible             → open book
  tab-community  → Community/Comm.   → two hands or two figures joined
  tab-worship    → Worship           → church building with a small cross
  tab-more       → More              → three dots in a row

SET B — Community small-group badges (7) · badge style · full color
  community-kosovo     → Kosovo Community      → dove with olive branch     · accent #1B4F8A
  community-albania    → Albania Community     → eagle                      · accent #C41E3A
  community-dagestan   → Dagestan Community    → mountain peak              · accent #2D6A4F
  community-kissimmee  → Kissimmee (Nicaragua) → young leaf / sprout        · accent #2E7D32
  community-bridge     → Bridge Community      → arched bridge              · accent #1565C0
  community-hope       → Hope Community        → rising star / sparkle      · accent #6A0DAD
  community-general    → Community (general)   → handshake                  · accent #C5A84F

SET C — Home screen quick actions (4) · glyph style
  action-prayer      → Prayer request   → praying hands
  action-visit       → Home visit       → house with an open door or a heart
  action-volunteer   → Volunteer        → open giving hands
  action-sermon      → Sermon summary   → note page with a pen

SET D — "More" menu rows (14) · glyph style · must read at 18 px
  more-language      → Language          → globe
  more-notifications → Notifications     → bell
  more-privacy       → Privacy policy    → padlock
  more-terms         → Terms of use      → scroll / document with lines
  more-directory     → Church directory  → address book
  more-receipt       → Submit receipt    → receipt paper
  more-website       → Church website    → globe with a link or a browser window
  more-admin         → Admin dashboard   → gear
  more-edit-name     → Change name       → pencil
  more-blocked       → Blocked users     → person silhouette with a slash
  more-signout       → Sign out          → door with an arrow leaving
  more-delete        → Delete account    → trash can
  (Instagram and Facebook are NOT needed — I will use the official brand assets.)

SET E — Admin dashboard tabs (8) · glyph style
  admin-moderation   → Moderation        → shield with a check
  admin-prayer       → Prayer requests   → praying hands (reuse action-prayer)
  admin-visits       → Home visits       → house (reuse action-visit)
  admin-announce     → Announcements     → megaphone
  admin-bulletins    → Bulletins         → clipboard / list
  admin-events       → Events            → calendar
  admin-members      → Members           → two people
  admin-settings     → App settings      → gear (reuse more-admin)

SET F — Small inline glyphs (7) · glyph style · must read at 14 px
  ui-calendar        → date              → calendar
  ui-clock           → time              → clock
  ui-pin             → location          → map pin
  ui-phone           → phone             → handset
  ui-search          → search            → magnifier
  ui-play            → play video        → triangle in a circle
  ui-mail            → email             → envelope

Total: about 40 icons. Consistency across the whole set matters more than any
single icon being clever. When in doubt, simplify.
```

---

## 받은 파일 저장 위치

```
assets/icons/
  tab-home.png
  tab-bible.png
  ...
  community-kosovo.png
  ...
```

파일명은 위 표의 이름 그대로. 1024px PNG 하나씩만 두면 됩니다 (앱이 알아서 축소).
이 폴더가 채워지면 다음 단계는 코드에서 `<Text>🏠</Text>` 를 `<Image source={...} tintColor=... />` 로
바꾸는 작업이고, 그건 파일명이 맞으면 한 번에 처리할 수 있습니다.

## 팁

- ChatGPT는 한 이미지에 여러 아이콘을 그리려 하면 배치가 틀어집니다. **한 번에 한 세트**, 세트 안에서도 안 되면 **한 개씩** 요청하세요.
- 배경이 진짜 투명인지 확인: 다운로드한 PNG를 어두운 배경 위에 올려보세요. 회색 체커보드가 "그려져" 있는 경우가 있습니다.
- 글리프(Set A/C/D/E/F)는 반드시 **남색 단색**으로 받으세요. 색이 섞이면 앱에서 tint 처리가 안 됩니다.
- Instagram/Facebook 로고는 생성하지 마세요 — 상표라 그대로 쓰면 스토어 심사에 걸릴 수 있습니다. 공식 브랜드 리소스를 받아서 쓰겁니다.
