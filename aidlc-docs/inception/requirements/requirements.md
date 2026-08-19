# Requirements Document: Figma i18n DLC

## 1. Functional Requirements

### FR-01: Figma 텍스트 추출
- Figma MCP를 통해 파일 내 모든 텍스트 노드를 추출한다.
- 파일 구조: 1파일 1페이지, 프레임이 나열된 형태를 지원한다.
- 프레임 계층/순서를 통해 UX 시나리오 흐름을 파악한다.
- Placeholder 텍스트(Lorem ipsum), 숫자만 있는 텍스트는 제외한다.

### FR-02: 문맥 인식 번역
- UX 흐름(프레임 순서, 계층)을 분석하여 도메인/문맥을 추론한다.
- EXAONE 2.0 모델(Hermes Agent Friendly API, HTTPS)을 사용하여 번역한다.
- 동일 영어 단어라도 문맥에 따라 다르게 번역한다.
- 도메인 용어집을 우선 참조하여 일관된 번역을 보장한다.

### FR-03: i18n Key 생성
- 네이밍 규칙: `{domain}.{feature}.{role}.{identifier}`
- role 종류: title, status, button, label, description, placeholder, message
- 영문 소문자 + dot 구분자만 사용
- 의미 기반 네이밍 (텍스트 내용이 아닌 역할 기반)

### FR-04: 다국어 Locale JSON 출력
- 지원 언어: en, ko, ja, zh-CN (4개)
- 출력 형식: 계층적 JSON 구조
- 모든 locale 파일의 key 구조가 동일해야 한다.

### FR-05: React 컴포넌트 코드 생성
- locale JSON 기반으로 React + TypeScript 컴포넌트를 생성한다.
- react-i18next useTranslation() hook을 사용한다.
- 텍스트 하드코딩 금지 — 모든 문자열은 i18n key 참조.
- Figma 프레임 계층에 맞는 컴포넌트 구조를 생성한다.

### FR-06: 품질 검증
- 검증 기준:
  - A) 용어집 준수 여부
  - B) 모든 locale 파일의 key 구조 일치
  - D) placeholder/변수 포맷 보존 ({0}, {{name}} 등)
  - E) 문맥 적합성 (문맥에 맞는 번역인지)
- PASS/FAIL 판정 + 상세 리포트 생성

### FR-07: 용어집 관리
- AI가 텍스트에서 도메인 용어를 자동 추출/제안한다.
- 사람이 승인한 용어만 용어집에 등록된다.
- 기존 용어와 충돌 시 알림을 제공한다.

### FR-08: 데모 웹서버
- 언어 선택 드롭박스 → 해당 언어로 컴포넌트 렌더링
- 실시간 언어 전환 데모 지원

### FR-09: 자가발전 시스템
- 번역 이력을 Vector DB(Vectra)에 저장한다.
- 유사 문맥 검색으로 이전 번역을 참조하여 품질을 향상시킨다.
- 리뷰 승인된 번역은 확정 데이터로 마킹하여 향후 참고한다.
- 사용할수록 용어집과 번역 메모리가 적재되어 자가발전한다.

---

## 2. Non-Functional Requirements

### NFR-01: 성능
- 100개 텍스트 기준 전체 파이프라인(추출→번역→출력) 10분 이내

### NFR-02: 정확도
- 문맥 오역률 3% 이하 (용어집 등록 용어 기준)

### NFR-03: 확장성
- 신규 언어 추가 시 코드 변경 최소화 (설정 기반)

---

## 3. Technical Constraints

| 항목 | 제약 |
|------|------|
| AI 모델 | EXAONE 2.0 (Hermes Agent Friendly API) |
| FE 프레임워크 | React 18.x + TypeScript 5.x |
| i18n 라이브러리 | react-i18next 14.x |
| 번들러 | Vite 5.x |
| Vector DB | Vectra (로컬 파일 기반) |
| 디자인 연동 | Figma MCP Server |

---

## 4. Key Naming Convention (확정)

### 규칙

```
{domain}.{feature}.{role}.{identifier}
```

### Role 정의

| Role | 용도 | 실제 생성 예시 |
|------|------|---------------|
| `title` | 화면/섹션 제목 | `console.setting.group.title.console` |
| `status` | 상태 텍스트 | `console.doc.title.status.modified` |
| `button` | 버튼 텍스트 | `console.setting.group.button.publish` |
| `label` | 입력 라벨 | `console.setting.group.label.business_site_information` |
| `placeholder` | 입력 힌트 | `console.setting.group.placeholder.lg_electronics` |
| `description` | 설명 텍스트 | 예약 (현재 프레임 미생성) |
| `message` | 알림/에러 메시지 | 예약 (현재 프레임 미생성) |

> `{domain}` 값은 `CONFIG.keyPrefix`로 제어한다.
> 초기 `signage`에서 `console`로 변경되었다 (대상 파일이 LG Business Cloud 콘솔).

### 규칙 세부

1. 모든 key는 영문 소문자 + dot 구분자
2. 중복 시 의미로 구분 (`button.saveAll`, `button.saveDraft`) — 숫자 접미사 금지
3. 약어 사용 금지 (btn ❌ → button ✅)

---

## 5. Open Questions (미해결)

- Hermes Agent Friendly API의 rate limit 확인 필요
- Figma 파일 복잡도(수백 프레임) 시 성능 테스트 필요
- Vectra 임베딩 모델 선정 (EXAONE Embedding vs sentence-transformers)
