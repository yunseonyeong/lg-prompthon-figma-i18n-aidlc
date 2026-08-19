# AI-DLC Audit Log

---

## Workspace Detection
**Timestamp**: 2026-08-19T10:44:00+09:00
**User Input**: "AI DLC 워크플로우 대로 진행하려고 하는데, inception -> construction -> operation 의 과정을 하려고 해"
**AI Response**: 프로젝트 워크스페이스 스캔 수행
**Context**: Inception Phase 시작

### Findings
- Project Type: Greenfield (기존 코드 없음)
- Existing Code: No
- Build System: None (planned: Vite)
- Workspace Root: /home/seonyeongyun/workspace
- Reverse Engineering: Not needed (Greenfield)

### Decision
- Next Phase: Requirements Analysis (Greenfield이므로 Reverse Engineering 스킵)

---

## Requirements Analysis
**Timestamp**: 2026-08-19T12:42:00+09:00
**User Input**: "이제 팀원들과 함께 요구사항을 좀 더 구체화하고 싶은데, ai dlc 로 너가 진행해줘"
**AI Response**: 요구사항 분석 질문지(requirements/questions.md) 생성 및 배포
**Context**: Inception Phase - Requirements Analysis

### 질문지 답변 요약 (2026-08-19T13:16:00+09:00)
**User Input**: "requirements/questions.md 작성 완료했어. 다음 단계 진행해줘"

| 항목 | 답변 |
|------|------|
| Q1: Figma 구조 | C) 1파일 1페이지, 프레임 나열 |
| Q2: 언어 | A) en, ko, ja, zh-CN |
| Q3: EXAONE 연동 | A) Hermes Agent Friendly API (HTTPS) |
| Q4: 데모 파일 | C) 기존 테스트 파일 확장 |
| Q5: 코드 범위 | B) locale JSON + React 컴포넌트 전체 |
| Q6: 용어집 관리 | A) AI 추출/제안 + 사람 승인 |
| Q7: key 네이밍 | D) 규칙 제안 요청 |
| Q8: 검증 기준 | A, B, D, E (용어집, key 일치, 포맷, 문맥) |
| Q9: 시간 | D) 10시간+ |
| Q10: 추가 요구사항 | 데모 웹서버, 리뷰 검수, 자가발전, Vector DB |

### 추가 요구사항 상세
1. 데모 웹서버: 언어 드롭박스 → 해당 언어 컴포넌트 렌더링
2. Review Agent: 도메인 지식 기반 검수 + 용어집 등록 제안
3. 자가발전: 사용할수록 용어집/데이터 적재, 품질 향상
4. Vector DB: Vectra 채택 (ADR-001)

### Key 네이밍 규칙 제안 → 승인 대기
- 형식: `{domain}.{feature}.{role}.{identifier}`
- 예: `signage.player.status.offline`

### Decision
- ADR-001: Vector DB → Vectra (Accepted)
- Key 네이밍 규칙: **승인 완료** (`{domain}.{feature}.{role}.{identifier}`)
- 요구사항 문서 확정: `aidlc-docs/inception/requirements/requirements.md`
- Next Phase: User Stories

**Timestamp**: 2026-08-19T13:33:00+09:00
**User Input**: "A" (Key 네이밍 규칙 승인 + 요구사항 확정 + 다음 단계 진행)
**AI Response**: requirements.md 생성, Requirements Analysis 단계 완료
**Context**: Requirements Analysis → Complete

---

## User Stories
**Timestamp**: 2026-08-19T13:34:00+09:00
**User Input**: "진행해줘. 근데 3명이서 해야되는데 각자 pc에서 진행할 수 있게 분장해줘. 그리고 변경점들에 대해서 PROJECT_GUIDE.md 파일 업데이트 해줘"
**AI Response**: User Stories 생성 (3 Epics, 13 Stories), PROJECT_GUIDE.md 업데이트
**Context**: Inception Phase - User Stories

### 산출물
- `aidlc-docs/inception/user-stories/stories.md`
- `PROJECT_GUIDE.md` (업데이트)

### 구조
- Epic 1 (Dev-A): Figma 텍스트 추출 및 번역 파이프라인 — US-1.1~1.5
- Epic 2 (Dev-B): 품질 검증 + 용어집 + 자가발전 — US-2.1~2.4
- Epic 3 (Dev-C): FE 코드 생성 + 데모 웹앱 — US-3.1~3.4

### Decision
- 3명 병렬 작업 후, locale JSON 첫 출력 시점에서 합류
- Next Phase: Workflow Planning

---

## Workflow Planning
**Timestamp**: 2026-08-19T13:59:00+09:00
**User Input**: "진행해줘"
**AI Response**: Execution Plan 생성 — Phase별 실행/스킵 결정, 타임라인, 합류 전략, 리스크 대응
**Context**: Inception Phase - Workflow Planning

### 산출물
- `aidlc-docs/inception/plans/execution-plan.md`

### Key Decisions
- Construction Phase: NFR Requirements, NFR Design, Infrastructure Design **스킵** (해커톤 규모)
- 3개 Unit 병렬 작업: Pipeline(A), Quality(B), Demo(C)
- 합류 시점: ~4시간 (locale JSON 첫 출력 시)
- MVP Fallback: locale JSON + 언어전환 데모만으로도 최소 시연 가능
- Next Phase: Application Design

---

## CONSTRUCTION - Unit 1: i18n Pipeline (Dev-A)
**Timestamp**: 2026-08-19T15:20:00+09:00
**User Input**: "바로 Construction 진행해줘. DEV A 역할 수행해줘"
**AI Response**: US-1.1 ~ US-1.5 구현 완료
**Context**: Construction Phase - Code Generation (Unit 1)

### 브랜치
`feat/figma-i18n-pipeline`

### 구현 내역

| US | 내용 | 결과 |
|----|------|------|
| US-1.1 | Figma 텍스트 추출 | 프레임 지정 추출, 시나리오 설명 테이블 제외 |
| US-1.2 | UX 흐름 문맥 분석 | inferFeature/inferRole/isTranslatableUIText |
| US-1.3 | i18n Key 자동 생성 | `{domain}.{feature}.{role}.{identifier}`, 중복 0 |
| US-1.4 | EXAONE 번역 | Friendli API, 앵커 용어 + 누적 용어집 |
| US-1.5 | Locale JSON 출력 | 4개 언어 + components-map + glossary-proposal |

### 검증 결과 (실측)
- 대상: Figma `zdG3CHXVU6TzD4cc28o5Yb`, Frame `15682:100905`
- 전체 텍스트 노드 13,822개 → 필터 후 번역 대상 139개 → 최종 110 key
- 4개 언어 key 구조 100% 일치 (en=ko=ja=zh-CN=110)
- 용어 일관성 위반 0건
- Placeholder 번역 0건

### 해결한 문제
1. **배치 간 용어 불일치** (구조적 문제)
   - 증상: Workspace가 "워크스페이스"/"작업 공간" 등 6가지로 번역
   - 원인: 10개씩 배치 번역 → 배치마다 독립 판단
   - 해결: 핵심 용어를 앵커로 먼저 번역 → 결과를 누적 용어집으로 다음 배치에 주입
   - 결과: Workspace 6가지 → 1가지, Business Site 7가지 → 1가지
2. **Placeholder 번역됨**
   - 증상: `{Company name}` → `{회사 이름}`
   - 해결: `{...}` 패턴 번역 대상 제외
3. **노이즈 텍스트** — 날짜/버전/파일크기/카운터/약어코드 필터 추가

### 산출물
- `src/pipeline/figma-i18n-pipeline.ts`
- `src/locales/{en,ko,ja,zh-CN}.json`
- `src/components-map.json` (→ Dev-C)
- `glossary-proposal.md` (→ Dev-B, 23개 용어 제안)

### Dev-B에게 전달할 이슈
- `requirements/domain-glossary.md`의 "용어 추가 요청 형식" 예시 행(`NewTerm`)이 실제 용어로 파싱됨 → 템플릿 행 제거 또는 주석 처리 필요
- 용어집 등록 제안 23건 검토 요청 (Business Site, Art Lounge, System Integrator, End Customer 우선)

### Dev-C에게 전달할 사항
- `src/components-map.json` 사용 가능
- 프레임 2개: `Console_Setting_Group@User`(136개 텍스트), `Doc Title`(3개)
- 각 항목에 `type`(role), `key`, `originalText` 포함
- Figma File Key / Frame ID는 `CONFIG.targetFrameIds`에서 교체 가능

### 실행 방법
```bash
export FIGMA_API_KEY=<figma token>
export FRIENDLI_API_KEY=<friendli key>   # ~/.hermes/.env 참조
export FIGMA_FILE_KEY=zdG3CHXVU6TzD4cc28o5Yb
node src/pipeline/figma-i18n-pipeline.ts
```

---

## 검증 체계 명세 전달 (Dev-A → Dev-B)
**Timestamp**: 2026-08-19T15:49:00+09:00
**User Input**: "근데 너가 번역한 부분에 대해서 devB가 어떻게 검증하면 되는거야? 제대로 안된 부분들이 많아." / "DEV B가 검증체계를 만들고 DEV B의 역할이 아닌건 DEV A 가 참고할 수 있도록 문서를 만드는 식으로 해줘"
**AI Response**: 번역 결과 자체 점검 후 4계층 검증 체계 명세 작성, 반송 프로토콜 정의
**Context**: Construction Phase - 품질 검증 체계 설계 (Unit 1 → Unit 2 인계)

### 자체 점검으로 확인된 결함 (18건)

| 계층 | 건수 | 내용 |
|------|------|------|
| Layer 1 | 0 | key 구조 일치 110개, 공백 0건, placeholder 보존 |
| Layer 2 | 1 | `Settings`/`Setting` 둘 다 "설정" (구분 소실) |
| Layer 3 | 1 | `Vertical Type` → "세로 유형" **오역** |
| Layer 4 | 12 | 샘플 주소 2, 파일명 1, 더미 텍스트 4, 샘플 데이터 5 |
| 원문 문제 | 4 | `Thema` 오타 2, `detailes` 오타 1, `is required` 문장 조각 1 |

### Layer 3 오역 상세 (프로젝트 핵심 사례)

```
en: Vertical Type *
ko: 세로 유형   ← 오역
```
같은 프레임 주변 필드: System Integrator, Business Type, End Customer
→ B2B 파트너 분류 화면이므로 Vertical = 산업 분야(vertical market)
→ 화면 방향이 아님. "Player=재생장치"와 동일 유형의 문맥 오역.
→ 단건 질의로는 검출 불가. 주변 필드를 함께 제공해야 판정 가능.

### 설계 핵심: 계층별 책임자 라우팅

문제 유형별로 고칠 사람이 다르다는 점을 명시했다.
특히 Layer 4는 번역 품질 문제가 아니라 **Dev-A의 추출 필터 결함**이므로
Dev-B가 번역을 수정해서 해결하면 근본 원인이 남는다.

### 산출물
- `aidlc-docs/construction/build-and-test/i18n-verification-spec.md` (신규)
  - Layer 1~4 규칙 정의 (규칙 ID 부여)
  - `i18n-report.md` / `extraction-issues.md` 출력 포맷 정의
  - 피드백 루프 및 재시도 상한(3회) 정의
  - 확인된 결함 18건을 검증 체계 테스트 케이스로 제공
- `PROJECT_GUIDE.md` 업데이트 (Dev-B 산출물, 계층 표, 소통 포인트 반송 흐름)

### 결정
- Layer 4 12건은 Dev-A가 선제 수정하지 않고, Dev-B 검증 체계를 통해
  `extraction-issues.md`로 정식 반송받는 흐름으로 진행 (사용자 지시)
- Layer 1/2/4는 API 없이 동작해야 함 (CI 실행 및 API 장애 대비)

### Dev-B 전달 사항
- `requirements/domain-glossary.md` 하단 "용어 추가 요청 형식" 예시 행이
  파서에서 실제 용어(`NewTerm`)로 읽힘 → 템플릿 행 분리 필요

---
