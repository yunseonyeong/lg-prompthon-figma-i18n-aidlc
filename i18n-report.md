# i18n 검증 리포트 (Round 4)

생성일시: 2026-08-20T07:52:33.370Z

## 계층별 요약

| 계층 | FAIL | WARN | INFO | 상태 |
|------|------|------|------|------|
| Layer 0: 사전 차단 (축적된 피드백) | 0 | 0 | 0 | PASS |
| Layer 1: 구조적 결함 | 0 | 0 | 0 | PASS |
| Layer 2: 용어집 위반 | 0 | 4 | 0 | WARN |
| Layer 3: 문맥 오역 | 0 | 0 | 4 | PASS |
| Layer 4: 번역 제외 대상 | 0 | 0 | 0 | PASS |

## 상세

### Layer 2: 용어집 위반

- **[WARN]** [zh-CN] `console.setting.group.label.setSingleSignOn`
  - 용어 불일치: "Single Sign-On" → 기대 "单点登录"
  - 담당: Dev-A / Dev-B / 규칙: glossary §1
- **[WARN]** [ja] `console.setting.group.label.settings`
  - 동일 번역 중복: 서로 다른 원문 "Settings", "Setting" 이 모두 "設定" 으로 번역됨
  - 담당: Dev-A / Dev-B / 규칙: L2-03 (검증 명세)
- **[WARN]** [ko] `console.setting.group.label.settings`
  - 동일 번역 중복: 서로 다른 원문 "Settings", "Setting" 이 모두 "설정" 으로 번역됨
  - 담당: Dev-A / Dev-B / 규칙: L2-03 (검증 명세)
- **[WARN]** [zh-CN] `console.setting.group.label.settings`
  - 동일 번역 중복: 서로 다른 원문 "Settings", "Setting" 이 모두 "设置" 으로 번역됨
  - 담당: Dev-A / Dev-B / 규칙: L2-03 (검증 명세)

### Layer 3: 문맥 오역

- **[INFO]** [en] `console.setting.group.label.isRequired`
  - 문장 조각: "is required" — 주어가 없는 조각. "{field} is required" 형태의 placeholder 필요
  - 담당: 디자이너 / 규칙: 원문 품질
- **[INFO]** [en] `console.setting.group.label.thema03`
  - 원문 오타: "thema" → "theme"
  - 담당: 디자이너 / 규칙: 원문 품질
- **[INFO]** [en] `console.setting.group.label.thema04`
  - 원문 오타: "thema" → "theme"
  - 담당: 디자이너 / 규칙: 원문 품질
- **[INFO]** [en] `console.setting.group.label.setSingleSignOn`
  - 원문 오타: "detailes" → "details"
  - 담당: 디자이너 / 규칙: 원문 품질
