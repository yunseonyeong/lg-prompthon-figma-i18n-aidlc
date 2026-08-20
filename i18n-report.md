# i18n 검증 리포트 (Round 1)

생성일시: 2026-08-20T07:11:40.727Z

## 계층별 요약

| 계층 | FAIL | WARN | INFO | 상태 |
|------|------|------|------|------|
| Layer 0: 사전 차단 (축적된 피드백) | 0 | 0 | 0 | PASS |
| Layer 1: 구조적 결함 | 0 | 0 | 0 | PASS |
| Layer 2: 용어집 위반 | 6 | 22 | 0 | FAIL |
| Layer 3: 문맥 오역 | 0 | 0 | 4 | PASS |
| Layer 4: 번역 제외 대상 | 34 | 0 | 0 | FAIL |

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
- **[WARN]** [ja] `console.setting.group.label.setSingleSignOn`
  - 용어 불일치: "Single Sign-On" → 기대 "シングルサインオン"
  - 담당: Dev-A / Dev-B / 규칙: glossary §1
- **[WARN]** [ko] `console.setting.group.label.setSingleSignOn`
  - 용어 불일치: "Single Sign-On" → 기대 "Single Sign-On"
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
  - 용어 불일치: "Content Schedule" → 기대 "多媒体日程"
  - 담당: Dev-A / Dev-B / 규칙: glossary §1
- **[FAIL]** [ja] `console.setting.group.label.artLounge`
  - 제품명 번역 금지 위반: "Art Lounge" → "アートラウンジ"
  - 담당: Dev-A / 규칙: glossary §7
- **[FAIL]** [ko] `console.setting.group.label.artLounge`
  - 제품명 번역 금지 위반: "Art Lounge" → "아트 라운지"
  - 담당: Dev-A / 규칙: glossary §7
- **[FAIL]** [zh-CN] `console.setting.group.label.artLounge`
  - 제품명 번역 금지 위반: "Art Lounge" → "艺术休息室"
  - 담당: Dev-A / 규칙: glossary §7
- **[FAIL]** [ja] `console.setting.group.label.hotelMobileApp`
  - 제품명 번역 금지 위반: "Hotel Mobile App" → "ホテルモバイルアプリ"
  - 담당: Dev-A / 규칙: glossary §7
- **[FAIL]** [ko] `console.setting.group.label.hotelMobileApp`
  - 제품명 번역 금지 위반: "Hotel Mobile App" → "호텔 모바일 앱"
  - 담당: Dev-A / 규칙: glossary §7
- **[FAIL]** [zh-CN] `console.setting.group.label.hotelMobileApp`
  - 제품명 번역 금지 위반: "Hotel Mobile App" → "酒店移动应用"
  - 담당: Dev-A / 규칙: glossary §7
- **[WARN]** [ko] `console.setting.group.title.automaticDeviceApproval`
  - 용어 불일치: "Device" → 기대 "디바이스"
  - 담당: Dev-A / Dev-B / 규칙: glossary §1
- **[WARN]** [ko] `console.setting.group.title.singleSignOnSso`
  - 용어 불일치: "Single Sign-On" → 기대 "Single Sign-On"
  - 담당: Dev-A / Dev-B / 규칙: glossary §1
- **[WARN]** [ko] `console.setting.group.button.assignDevice`
  - 용어 불일치: "Device" → 기대 "디바이스"
  - 담당: Dev-A / Dev-B / 규칙: glossary §1
- **[WARN]** [ja] `console.setting.group.label.settings`
  - 동일 번역 중복: 서로 다른 원문 "Settings", "Setting" 이 모두 "設定" 으로 번역됨
  - 담당: Dev-A / Dev-B / 규칙: L2-03 (검증 명세)
- **[WARN]** [ja] `console.setting.group.button.turnOff`
  - 동일 번역 중복: 서로 다른 원문 "Turn Off", "Off" 이 모두 "オフ" 으로 번역됨
  - 담당: Dev-A / Dev-B / 규칙: L2-03 (검증 명세)
- **[WARN]** [ko] `console.setting.group.label.settings`
  - 동일 번역 중복: 서로 다른 원문 "Settings", "Setting" 이 모두 "설정" 으로 번역됨
  - 담당: Dev-A / Dev-B / 규칙: L2-03 (검증 명세)
- **[WARN]** [zh-CN] `console.setting.group.label.settings`
  - 동일 번역 중복: 서로 다른 원문 "Settings", "Setting" 이 모두 "设置" 으로 번역됨
  - 담당: Dev-A / Dev-B / 규칙: L2-03 (검증 명세)
- **[WARN]** [ko] `console.setting.group.button.off`
  - ON/OFF 표기 위반: 버튼은 "끄기", 상태는 "꺼짐"
  - 담당: Dev-B / 규칙: glossary §6

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

- **[FAIL]** [ja] `console.setting.group.label.businessA`
  - 번역 제외 대상이 번역됨: "Business A" → "ビジネスA"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ko] `console.setting.group.label.businessA`
  - 번역 제외 대상이 번역됨: "Business A" → "비즈니스 A"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [zh-CN] `console.setting.group.label.businessA`
  - 번역 제외 대상이 번역됨: "Business A" → "业务A"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ja] `console.setting.group.label.workspaceA1`
  - 번역 제외 대상이 번역됨: "Workspace A1" → "ワークスペースA1"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ko] `console.setting.group.label.workspaceA1`
  - 번역 제외 대상이 번역됨: "Workspace A1" → "워크스페이스 A1"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [zh-CN] `console.setting.group.label.workspaceA1`
  - 번역 제외 대상이 번역됨: "Workspace A1" → "工作区A1"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ja] `console.setting.group.label.supportingText`
  - 번역 제외 대상이 번역됨: "supporting text" → "補助テキスト"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ko] `console.setting.group.label.supportingText`
  - 번역 제외 대상이 번역됨: "supporting text" → "보조 텍스트"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [zh-CN] `console.setting.group.label.supportingText`
  - 번역 제외 대상이 번역됨: "supporting text" → "辅助文本"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ja] `console.setting.group.label.label`
  - 번역 제외 대상이 번역됨: "Label" → "ラベル"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ko] `console.setting.group.label.label`
  - 번역 제외 대상이 번역됨: "Label" → "레이블"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [zh-CN] `console.setting.group.label.label`
  - 번역 제외 대상이 번역됨: "Label" → "标签"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [en] `console.setting.group.label.filenameSample00123Jpg`
  - 번역 제외 대상이 추출됨 (번역은 안 됨): "FileName_sample_00123.jpg" — key 자체를 제거해야 함
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ja] `console.setting.group.label.magokjungang10RoGangseoGu`
  - 번역 제외 대상이 번역됨: "MagokJungang 10-ro, Gangseo-gu, Seoul" → "マゴクチュンアン10ロ、カンソグ、ソウル"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ko] `console.setting.group.label.magokjungang10RoGangseoGu`
  - 번역 제외 대상이 번역됨: "MagokJungang 10-ro, Gangseo-gu, Seoul" → "마곡중앙10로, 강서구, 서울"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [zh-CN] `console.setting.group.label.magokjungang10RoGangseoGu`
  - 번역 제외 대상이 번역됨: "MagokJungang 10-ro, Gangseo-gu, Seoul" → "马谷中央10路，江西区，首尔"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ja] `console.setting.group.label.30A101Bldg`
  - 번역 제외 대상이 번역됨: "30, A101 bldg." → "30, A101棟"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ko] `console.setting.group.label.30A101Bldg`
  - 번역 제외 대상이 번역됨: "30, A101 bldg." → "30, A101동"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [zh-CN] `console.setting.group.label.30A101Bldg`
  - 번역 제외 대상이 번역됨: "30, A101 bldg." → "30, A101栋"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ja] `console.setting.group.label.deviceN`
  - 번역 제외 대상이 번역됨: "Device N" → "デバイス N"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ko] `console.setting.group.label.deviceN`
  - 번역 제외 대상이 번역됨: "Device N" → "장치 N"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [zh-CN] `console.setting.group.label.deviceN`
  - 번역 제외 대상이 번역됨: "Device N" → "设备 N"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ja] `console.setting.group.label.userN`
  - 번역 제외 대상이 번역됨: "User N" → "ユーザー N"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ko] `console.setting.group.label.userN`
  - 번역 제외 대상이 번역됨: "User N" → "사용자 N"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [zh-CN] `console.setting.group.label.userN`
  - 번역 제외 대상이 번역됨: "User N" → "用户 N"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ja] `console.setting.group.button.button`
  - 번역 제외 대상이 번역됨: "Button" → "ボタン"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ko] `console.setting.group.button.button`
  - 번역 제외 대상이 번역됨: "Button" → "버튼"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [zh-CN] `console.setting.group.button.button`
  - 번역 제외 대상이 번역됨: "Button" → "按钮"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ja] `console.doc.title.status.modified`
  - 번역 제외 대상이 번역됨: "Modified" → "修正済み"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ko] `console.doc.title.status.modified`
  - 번역 제외 대상이 번역됨: "Modified" → "수정됨"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [zh-CN] `console.doc.title.status.modified`
  - 번역 제외 대상이 번역됨: "Modified" → "已修改"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ja] `console.doc.title.label.descriptionDescriptionDescriptionDescription`
  - 번역 제외 대상이 번역됨: "Description Description 
Description Description" → "説明 説明 説明"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ko] `console.doc.title.label.descriptionDescriptionDescriptionDescription`
  - 번역 제외 대상이 번역됨: "Description Description 
Description Description" → "설명 설명 설명"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [zh-CN] `console.doc.title.label.descriptionDescriptionDescriptionDescription`
  - 번역 제외 대상이 번역됨: "Description Description 
Description Description" → "描述 描述 描述"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
