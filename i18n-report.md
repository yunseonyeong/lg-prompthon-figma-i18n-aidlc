# i18n 검증 리포트 (Round 1)

생성일시: 2026-08-20T05:47:32.062Z

## 계층별 요약

| 계층 | FAIL | WARN | INFO | 상태 |
|------|------|------|------|------|
| Layer 0: 사전 차단 (축적된 피드백) | 0 | 0 | 0 | PASS |
| Layer 1: 구조적 결함 | 0 | 0 | 0 | PASS |
| Layer 2: 용어집 위반 | 6 | 8 | 0 | FAIL |
| Layer 3: 문맥 오역 | 0 | 0 | 4 | PASS |
| Layer 4: 번역 제외 대상 | 34 | 0 | 0 | FAIL |

## 상세

### Layer 2: 용어집 위반

- **[WARN]** [ja] `console.setting.group.label.set_single_signon`
  - 용어 불일치: "Single Sign-On" → 기대 "シングルサインオン"
  - 담당: Dev-A / Dev-B / 규칙: glossary §1
- **[WARN]** [ko] `console.setting.group.label.set_single_signon`
  - 용어 불일치: "Single Sign-On" → 기대 "싱글 사인온"
  - 담당: Dev-A / Dev-B / 규칙: glossary §1
- **[WARN]** [zh-CN] `console.setting.group.label.set_single_signon`
  - 용어 불일치: "Single Sign-On" → 기대 "单点登录"
  - 담당: Dev-A / Dev-B / 규칙: glossary §1
- **[FAIL]** [ja] `console.setting.group.label.art_lounge`
  - 제품명 번역 금지 위반: "Art Lounge" → "アートラウンジ"
  - 담당: Dev-A / 규칙: glossary §7
- **[FAIL]** [ko] `console.setting.group.label.art_lounge`
  - 제품명 번역 금지 위반: "Art Lounge" → "아트 라운지"
  - 담당: Dev-A / 규칙: glossary §7
- **[FAIL]** [zh-CN] `console.setting.group.label.art_lounge`
  - 제품명 번역 금지 위반: "Art Lounge" → "艺术休息室"
  - 담당: Dev-A / 규칙: glossary §7
- **[FAIL]** [ja] `console.setting.group.label.hotel_mobile_app`
  - 제품명 번역 금지 위반: "Hotel Mobile App" → "ホテルモバイルアプリ"
  - 담당: Dev-A / 규칙: glossary §7
- **[FAIL]** [ko] `console.setting.group.label.hotel_mobile_app`
  - 제품명 번역 금지 위반: "Hotel Mobile App" → "호텔 모바일 앱"
  - 담당: Dev-A / 규칙: glossary §7
- **[FAIL]** [zh-CN] `console.setting.group.label.hotel_mobile_app`
  - 제품명 번역 금지 위반: "Hotel Mobile App" → "酒店移动应用"
  - 담당: Dev-A / 규칙: glossary §7
- **[WARN]** [ja] `console.setting.group.label.settings`
  - 동일 번역 중복: 서로 다른 원문 "Settings", "Setting" 이 모두 "設定" 으로 번역됨
  - 담당: Dev-A / Dev-B / 규칙: L2-03 (검증 명세)
- **[WARN]** [ja] `console.setting.group.button.turn_off`
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

- **[INFO]** [en] `console.setting.group.label.is_required`
  - 문장 조각: "is required" — 주어가 없는 조각. "{field} is required" 형태의 placeholder 필요
  - 담당: 디자이너 / 규칙: 원문 품질
- **[INFO]** [en] `console.setting.group.label.thema_03`
  - 원문 오타: "thema" → "theme"
  - 담당: 디자이너 / 규칙: 원문 품질
- **[INFO]** [en] `console.setting.group.label.thema_04`
  - 원문 오타: "thema" → "theme"
  - 담당: 디자이너 / 규칙: 원문 품질
- **[INFO]** [en] `console.setting.group.label.set_single_signon`
  - 원문 오타: "detailes" → "details"
  - 담당: 디자이너 / 규칙: 원문 품질

### Layer 4: 번역 제외 대상

- **[FAIL]** [ja] `console.setting.group.label.business_a`
  - 번역 제외 대상이 번역됨: "Business A" → "ビジネスA"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ko] `console.setting.group.label.business_a`
  - 번역 제외 대상이 번역됨: "Business A" → "비즈니스 A"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [zh-CN] `console.setting.group.label.business_a`
  - 번역 제외 대상이 번역됨: "Business A" → "业务A"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ja] `console.setting.group.label.workspace_a1`
  - 번역 제외 대상이 번역됨: "Workspace A1" → "ワークスペースA1"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ko] `console.setting.group.label.workspace_a1`
  - 번역 제외 대상이 번역됨: "Workspace A1" → "워크스페이스 A1"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [zh-CN] `console.setting.group.label.workspace_a1`
  - 번역 제외 대상이 번역됨: "Workspace A1" → "工作区A1"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ja] `console.setting.group.label.supporting_text`
  - 번역 제외 대상이 번역됨: "supporting text" → "補助テキスト"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ko] `console.setting.group.label.supporting_text`
  - 번역 제외 대상이 번역됨: "supporting text" → "보조 텍스트"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [zh-CN] `console.setting.group.label.supporting_text`
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
- **[FAIL]** [en] `console.setting.group.label.filenamesample00123jpg`
  - 번역 제외 대상이 추출됨 (번역은 안 됨): "FileName_sample_00123.jpg" — key 자체를 제거해야 함
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ja] `console.setting.group.label.magokjungang_10ro_gangseogu`
  - 번역 제외 대상이 번역됨: "MagokJungang 10-ro, Gangseo-gu, Seoul" → "マゴクチュンアン10ロ、カンソグ、ソウル"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ko] `console.setting.group.label.magokjungang_10ro_gangseogu`
  - 번역 제외 대상이 번역됨: "MagokJungang 10-ro, Gangseo-gu, Seoul" → "마곡중앙10로, 강서구, 서울"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [zh-CN] `console.setting.group.label.magokjungang_10ro_gangseogu`
  - 번역 제외 대상이 번역됨: "MagokJungang 10-ro, Gangseo-gu, Seoul" → "麻谷中央10路，江西区，首尔"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ja] `console.setting.group.label.30_a101_bldg`
  - 번역 제외 대상이 번역됨: "30, A101 bldg." → "30, A101棟"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ko] `console.setting.group.label.30_a101_bldg`
  - 번역 제외 대상이 번역됨: "30, A101 bldg." → "30, A101동"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [zh-CN] `console.setting.group.label.30_a101_bldg`
  - 번역 제외 대상이 번역됨: "30, A101 bldg." → "30, A101栋"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ja] `console.setting.group.label.device_n`
  - 번역 제외 대상이 번역됨: "Device N" → "デバイス N"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ko] `console.setting.group.label.device_n`
  - 번역 제외 대상이 번역됨: "Device N" → "장치 N"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [zh-CN] `console.setting.group.label.device_n`
  - 번역 제외 대상이 번역됨: "Device N" → "设备 N"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ja] `console.setting.group.label.user_n`
  - 번역 제외 대상이 번역됨: "User N" → "ユーザー N"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ko] `console.setting.group.label.user_n`
  - 번역 제외 대상이 번역됨: "User N" → "사용자 N"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [zh-CN] `console.setting.group.label.user_n`
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
- **[FAIL]** [ja] `console.doc.title.label.description_description_description`
  - 번역 제외 대상이 번역됨: "Description Description 
Description Description" → "説明 説明 説明"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [ko] `console.doc.title.label.description_description_description`
  - 번역 제외 대상이 번역됨: "Description Description 
Description Description" → "설명 설명 설명"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
- **[FAIL]** [zh-CN] `console.doc.title.label.description_description_description`
  - 번역 제외 대상이 번역됨: "Description Description 
Description Description" → "描述 描述 描述"
  - 담당: Dev-A (추출 필터) / 규칙: glossary §9
