# User Stories

## Personas

| Persona | 역할 | 설명 |
|---------|------|------|
| **Dev-A** (FE 개발자) | Figma i18n 파이프라인 | Figma에서 텍스트를 추출하고 번역하여 locale 파일을 생성하는 핵심 파이프라인을 구축 |
| **Dev-B** (QA/용어 담당) | 품질 검증 + 용어집 | 번역 품질을 검증하고 도메인 용어를 관리하며 자가발전 시스템을 구축 |
| **Dev-C** (FE/데모 담당) | 코드 생성 + 데모 | i18n 결과를 React 컴포넌트로 변환하고 데모 웹앱을 구축 |

---

## Epic 1: Figma 텍스트 추출 및 번역 파이프라인 (담당: Dev-A)

### US-1.1: Figma 텍스트 추출
**As a** FE 개발자  
**I want to** Figma 파일에서 모든 텍스트 노드를 자동 추출하고 싶다  
**So that** 수동으로 텍스트를 복사하는 반복 작업을 제거할 수 있다

**Acceptance Criteria:**
- [ ] Figma MCP로 파일 내 텍스트 노드를 추출할 수 있다
- [ ] 프레임 계층/순서 정보가 함께 추출된다
- [ ] Placeholder 텍스트, 숫자만 있는 텍스트는 제외된다
- [ ] 추출 결과가 구조화된 JSON으로 출력된다

### US-1.2: UX 흐름 문맥 분석
**As a** FE 개발자  
**I want to** UX 시나리오의 흐름에서 도메인/문맥을 자동으로 파악하고 싶다  
**So that** 동일 단어도 문맥에 맞게 번역될 수 있다

**Acceptance Criteria:**
- [ ] 프레임 순서에서 시나리오 흐름을 추론한다
- [ ] 프레임 이름/계층에서 기능 영역을 파악한다
- [ ] "Player"가 Signage 문맥에서 "재생 장치"로 식별된다

### US-1.3: i18n Key 자동 생성
**As a** FE 개발자  
**I want to** 추출된 텍스트에 대해 i18n key를 자동으로 네이밍하고 싶다  
**So that** key 네이밍에 시간을 쓰지 않아도 된다

**Acceptance Criteria:**
- [ ] `{domain}.{feature}.{role}.{identifier}` 규칙으로 key가 생성된다
- [ ] role이 자동 분류된다 (title, button, label 등)
- [ ] 중복 key가 없다

### US-1.4: EXAONE 문맥 기반 번역
**As a** FE 개발자  
**I want to** EXAONE 모델로 문맥을 반영한 다국어 번역을 수행하고 싶다  
**So that** 도메인에 맞는 정확한 번역을 얻을 수 있다

**Acceptance Criteria:**
- [ ] Hermes Agent Friendly API(HTTPS)로 EXAONE을 호출한다
- [ ] 문맥 정보(도메인, UX 흐름)를 프롬프트에 포함한다
- [ ] 용어집을 참조하여 등록된 용어는 용어집 번역을 우선 사용한다
- [ ] en, ko, ja, zh-CN 4개 언어로 번역한다

### US-1.5: Locale JSON 출력
**As a** FE 개발자  
**I want to** 번역 결과를 locale JSON 파일로 출력하고 싶다  
**So that** FE 코드에서 바로 사용할 수 있다

**Acceptance Criteria:**
- [ ] `src/locales/en.json`, `ko.json`, `ja.json`, `zh-CN.json` 생성
- [ ] 계층적 JSON 구조로 출력
- [ ] 모든 locale 파일의 key 구조가 동일

---

## Epic 2: 품질 검증 + 용어집 + 자가발전 (담당: Dev-B)

### US-2.1: 번역 품질 자동 검증
**As a** QA 담당자  
**I want to** 번역 결과를 자동으로 검증하고 싶다  
**So that** 오역이나 누락 없이 품질을 보장할 수 있다

**Acceptance Criteria:**
- [ ] 용어집 준수 여부 체크 (등록 용어와 다르면 FAIL)
- [ ] 모든 locale 파일 key 구조 일치 체크
- [ ] placeholder/변수 포맷 보존 체크 ({0}, {{name}})
- [ ] 문맥 적합성 검증 (EXAONE으로 번역이 문맥에 맞는지 재검증)
- [ ] PASS/FAIL 판정 + 상세 리포트(`i18n-report.md`) 생성

### US-2.2: 도메인 용어 자동 발견 및 제안
**As a** QA 담당자  
**I want to** 텍스트에서 도메인 용어를 자동으로 발견하고 등록을 제안하고 싶다  
**So that** 용어집이 지속적으로 확장되어 번역 품질이 향상된다

**Acceptance Criteria:**
- [ ] 새로운 도메인 용어를 자동 감지한다
- [ ] 4개 언어 번역과 함께 등록을 제안한다
- [ ] 기존 용어와 충돌 시 알림을 제공한다
- [ ] 사람이 승인해야만 용어집에 등록된다

### US-2.3: 번역 메모리 (Vector DB)
**As a** QA 담당자  
**I want to** 이전 번역 이력을 저장하고 유사 문맥을 검색하고 싶다  
**So that** 사용할수록 번역 품질이 자가발전한다

**Acceptance Criteria:**
- [ ] Vectra에 번역 이력(원문, 문맥, 번역결과)을 임베딩으로 저장
- [ ] 새 번역 시 유사 문맥의 이전 번역을 검색하여 참고
- [ ] 리뷰 승인된 번역은 확정 데이터로 마킹
- [ ] 확정 데이터가 향후 번역 시 우선 참조됨

### US-2.4: 리뷰 피드백 루프
**As a** QA 담당자  
**I want to** 검증 실패 시 자동으로 재번역을 요청하고 싶다  
**So that** 수동 개입 없이 품질 기준을 충족할 수 있다

**Acceptance Criteria:**
- [ ] FAIL 항목에 대해 구체적 사유를 i18n-agent에 전달
- [ ] i18n-agent가 피드백을 반영하여 재번역 수행
- [ ] 최대 3회 재시도 후에도 FAIL이면 사람에게 에스컬레이션

---

## Epic 3: FE 코드 생성 + 데모 웹앱 (담당: Dev-C)

### US-3.1: React 프로젝트 초기화
**As a** FE 개발자  
**I want to** React + TypeScript + react-i18next 프로젝트를 초기화하고 싶다  
**So that** 생성된 코드를 바로 실행할 수 있는 환경이 준비된다

**Acceptance Criteria:**
- [ ] Vite + React + TypeScript 프로젝트 생성
- [ ] react-i18next 설정 완료 (4개 언어, fallback)
- [ ] `npm run dev`로 로컬 실행 가능

### US-3.2: 컴포넌트 자동 생성
**As a** FE 개발자  
**I want to** locale JSON과 Figma 구조를 기반으로 React 컴포넌트를 자동 생성하고 싶다  
**So that** 수동으로 컴포넌트를 작성하는 시간을 절약할 수 있다

**Acceptance Criteria:**
- [ ] Figma 프레임 → React 컴포넌트 매핑
- [ ] useTranslation() hook 적용
- [ ] TypeScript 타입 정의 포함
- [ ] barrel export (index.ts) 생성

### US-3.3: 언어 전환 데모 UI
**As a** 데모 시연자  
**I want to** 드롭박스로 언어를 선택하면 해당 언어로 UI가 전환되는 데모를 보여주고 싶다  
**So that** 다국어 자동화의 결과를 직관적으로 확인할 수 있다

**Acceptance Criteria:**
- [ ] 언어 선택 드롭박스 (en, ko, ja, zh-CN)
- [ ] 선택 시 실시간 언어 전환
- [ ] 생성된 모든 컴포넌트가 정상 렌더링
- [ ] 로컬 웹서버에서 데모 실행 가능

### US-3.4: Figma ↔ 코드 비교 화면
**As a** 데모 시연자  
**I want to** Figma 원본과 생성된 UI를 나란히 비교하고 싶다  
**So that** 자동 생성의 정확도를 시각적으로 증명할 수 있다

**Acceptance Criteria:**
- [ ] 분할 화면 (좌: Figma 스크린샷, 우: 생성된 컴포넌트)
- [ ] 언어별 비교 가능

---

## 팀원별 작업 요약

| 팀원 | Epic | User Stories | 핵심 산출물 |
|------|------|-------------|------------|
| **Dev-A** | Epic 1 | US-1.1 ~ US-1.5 | locale JSON 4개, i18n 파이프라인 |
| **Dev-B** | Epic 2 | US-2.1 ~ US-2.4 | review 시스템, 용어집, Vectra 연동 |
| **Dev-C** | Epic 3 | US-3.1 ~ US-3.4 | React 앱, 데모 웹서버, 발표 |

---

## 의존 관계

```
[Dev-A] US-1.5 (locale JSON 출력)
    ↓
[Dev-B] US-2.1 (품질 검증) ←→ US-2.2 (용어 제안)
    ↓ (PASS)
[Dev-C] US-3.2 (컴포넌트 생성)
    ↓
[Dev-C] US-3.3 (데모 UI)
```

**병렬 작업 가능:**
- Dev-A: 파이프라인 구축 (독립 작업)
- Dev-B: Vectra 세팅 + 검증 로직 구현 (독립 작업)
- Dev-C: React 프로젝트 초기화 + 데모 UI 틀 (독립 작업)

**합류 시점:**
- Dev-A가 locale JSON을 처음 출력하면 → Dev-B 검증 시작, Dev-C 컴포넌트 생성 시작
