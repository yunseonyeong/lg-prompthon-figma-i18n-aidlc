# i18n 검증 리포트 (Round 2)

생성일시: 2026-08-20T07:52:30.986Z

## 계층별 요약

| 계층 | FAIL | WARN | INFO | 상태 |
|------|------|------|------|------|
| Layer 0: 사전 차단 (축적된 피드백) | 0 | 0 | 0 | PASS |
| Layer 1: 구조적 결함 | 0 | 0 | 0 | PASS |
| Layer 2: 용어집 위반 | 0 | 19 | 0 | WARN |
| Layer 3: 문맥 오역 | 0 | 0 | 4 | PASS |
| Layer 4: 번역 제외 대상 | 12 | 0 | 0 | FAIL |

## 상세

### Layer 2: 용어집 위반

- **[WARN]** [zh-CN] `console.setting.group.label.content`
  - 용어 불일치: "Content" → 기대 "多媒体"
  - 담당: Dev-A / Dev-B / 규칙: glossary §1
- **[WARN]** [ko] `console.setting.group.label.device`
  - 용어 불일치: "Device" → 기대 "디바이스"
  - 담당: Dev-A / Dev-B / 규칙: glossary §1
- **[WARN]** [ko] `console.setting.group.label.verticalType`
  - 용어 불일치: "Vertical Type" → 기대 "버티컬 타입"
  - 담당: Dev-A / Dev-B / 규칙: glossary §1
- **[WARN]** [ko] `console.setting.group.label.systemIntegrator`
  - 용어 불일치: "System Integrator" → 기대 "시스템 통합 업체"
  - 담당: Dev-A / Dev-B / 규칙: glossary §1
- **[WARN]** [ko] `console.setting.group.label.businessType`
  - 용어 불일치: "Business Type" → 기대 "비즈니스 타입"
  - 담당: Dev-A / Dev-B / 규칙: glossary §1
- **[WARN]** [zh-CN] `console.setting.group.label.setSingleSignOn`
  - 용어 불일치: "Single Sign-On" → 기대 "单点登录"
  - 담당: Dev-A / Dev-B / 규칙: glossary §1
- **[WARN]** [ko] `console.setting.group.label.deviceCount`
  - 용어 불일치: "Device" → 기대 "디바이스"
  - 담당: Dev-A / Dev-B / 규칙: glossary §1
- **[WARN]** [ko] `console.setting.group.label.licensedProduct`
  - 용어 불일치: "Licensed Product" → 기대 "라이선스 솔루션"
  - 담당: Dev-A / Dev-B / 규칙: glossary §1
- **[WARN]** [zh-CN] `console.setting.group.label.dashboard`
  - 용어 불일치: "Dashboard" → 기대 "管理控制台"
  - 담당: Dev-A / Dev-B / 규칙: glossary §1
- **[WARN]** [ko] `console.setting.group.label.space`
  - 용어 불일치: "Space" → 기대 "스페이스"
  - 담당: Dev-A / Dev-B / 규칙: glossary §1
- **[WARN]** [zh-CN] `console.setting.group.label.contentSchedule`
  - 용어 불일치: "Content" → 기대 "多媒体"
  - 담당: Dev-A / Dev-B / 규칙: glossary §1
- **[WARN]** [zh-CN] `console.setting.group.label.contentSchedule`
  - 용어 불일치: "Schedule" → 기대 "日程"
  - 담당: Dev-A / Dev-B / 규칙: glossary §1
- **[WARN]** [zh-CN] `console.setting.group.label.contentSchedule`
  - 용어 불일치: "Content Schedule" → 기대 "多媒体日程"
  - 담당: Dev-A / Dev-B / 규칙: glossary §1
- **[WARN]** [ko] `console.setting.group.title.automaticDeviceApproval`
  - 용어 불일치: "Device" → 기대 "디바이스"
  - 담당: Dev-A / Dev-B / 규칙: glossary §1
- **[WARN]** [ko] `console.setting.group.button.assignDevice`
  - 용어 불일치: "Device" → 기대 "디바이스"
  - 담당: Dev-A / Dev-B / 규칙: glossary §1
- **[WARN]** [ko] `console.setting.group.button.assignDevice`
  - 용어 불일치: "Assign" → 기대 "할당"
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

### Layer 4: 번역 제외 대상

- **[FAIL]** [en] `console.setting.group.label.businessA`
  - 번역 제외 대상이 추출됨 (번역은 안 됨): "Business A" — key 자체를 제거해야 함
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [en] `console.setting.group.label.workspaceA1`
  - 번역 제외 대상이 추출됨 (번역은 안 됨): "Workspace A1" — key 자체를 제거해야 함
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [en] `console.setting.group.label.supportingText`
  - 번역 제외 대상이 추출됨 (번역은 안 됨): "supporting text" — key 자체를 제거해야 함
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [en] `console.setting.group.label.label`
  - 번역 제외 대상이 추출됨 (번역은 안 됨): "Label" — key 자체를 제거해야 함
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [en] `console.setting.group.label.filenameSample00123Jpg`
  - 번역 제외 대상이 추출됨 (번역은 안 됨): "FileName_sample_00123.jpg" — key 자체를 제거해야 함
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [en] `console.setting.group.label.magokjungang10RoGangseoGu`
  - 번역 제외 대상이 추출됨 (번역은 안 됨): "MagokJungang 10-ro, Gangseo-gu, Seoul" — key 자체를 제거해야 함
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [en] `console.setting.group.label.30A101Bldg`
  - 번역 제외 대상이 추출됨 (번역은 안 됨): "30, A101 bldg." — key 자체를 제거해야 함
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [en] `console.setting.group.label.deviceN`
  - 번역 제외 대상이 추출됨 (번역은 안 됨): "Device N" — key 자체를 제거해야 함
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [en] `console.setting.group.label.userN`
  - 번역 제외 대상이 추출됨 (번역은 안 됨): "User N" — key 자체를 제거해야 함
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [en] `console.setting.group.button.button`
  - 번역 제외 대상이 추출됨 (번역은 안 됨): "Button" — key 자체를 제거해야 함
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [en] `console.doc.title.status.modified`
  - 번역 제외 대상이 추출됨 (번역은 안 됨): "Modified" — key 자체를 제거해야 함
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [en] `console.doc.title.label.descriptionDescriptionDescriptionDescription`
  - 번역 제외 대상이 추출됨 (번역은 안 됨): "Description Description 
Description Description" — key 자체를 제거해야 함
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
