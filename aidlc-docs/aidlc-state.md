# AI-DLC State Tracking

## Project Information
- **Project Name**: Figma i18n DLC
- **Project Type**: Greenfield
- **Start Date**: 2026-08-19T10:44:00+09:00
- **Current Stage**: CONSTRUCTION - Code Generation (Unit 1: i18n Pipeline)

## Workspace State
- **Existing Code**: No
- **Programming Languages**: TypeScript (planned)
- **Build System**: Vite (planned)
- **Project Structure**: Empty (Greenfield)
- **Workspace Root**: /home/seonyeongyun/workspace
- **Reverse Engineering Needed**: No

## Code Location Rules
- **Application Code**: Workspace root `/src/` (NEVER in aidlc-docs/)
- **Documentation**: aidlc-docs/ only
- **Structure patterns**: See code-generation.md Critical Rules

## Stage Progress

### Inception Phase
- [x] Workspace Detection
- [x] Requirements Analysis
- [x] User Stories
- [x] Workflow Planning
- [ ] Application Design (SKIPPED - User Stories/Execution Plan이 역할 대체)
- [ ] Units Generation (SKIPPED - Execution Plan에서 3 Unit 정의 완료)

### Construction Phase

#### Unit 1: i18n Pipeline (Dev-A)
- [x] US-1.1 Figma 텍스트 추출
- [x] US-1.2 UX 흐름 문맥 분석
- [x] US-1.3 i18n Key 자동 생성
- [x] US-1.4 EXAONE 문맥 기반 번역
- [x] US-1.5 Locale JSON 출력

#### Unit 2: Quality System (Dev-B)

**서브 항목의 출처**: 아래 서브 항목은 전부 `aidlc-docs/inception/user-stories/stories.md`의
Acceptance Criteria 원문입니다 (US-2.1 5개 / US-2.2 4개 / US-2.3 4개 / US-2.4 3개 = 16개, 1:1 대응).
제가 임의로 추가한 항목은 없습니다.

`aidlc-docs/construction/build-and-test/i18n-verification-spec.md`가 이를 계층별로
상세화하며, 검증해야 할 **알려진 결함 목록을 테스트 케이스로 지정**하고 있습니다
("검증 체계가 이를 검출하지 못하면 규칙이 부족한 것이다"). 대조 결과는 아래 별도 표에 있습니다.

수용 기준 단위로 대조했습니다. 미충족 항목은 근거를 남겼습니다.

- [x] **US-2.1 번역 품질 자동 검증** (4/5) — `src/validation/layers.ts`
  - [x] 용어집 준수 여부 체크 — `checkLayer2`. ⚠️ 등급이 기준과 다름: 명세는 "다르면 FAIL"이나 구현은 제품명 위반만 FAIL, 등록 용어 불일치는 WARN. 문장 안에서 약어(SSO)로 축약되는 정상 케이스를 FAIL로 잡으면 노이즈가 커서 낮췄음. 등급 정책 확정 필요
  - [x] 모든 locale key 구조 일치 체크 — `checkLayer1` (누락/초과 key)
  - [x] placeholder 포맷 보존 체크 — `checkLayer1` + `extractPlaceholders`
  - [ ] **문맥 적합성 EXAONE 재검증 — 미구현**. Layer 3는 규칙 기반 트랩(Extend/Withdraw/Vertical/Player)만 검사. EXAONE API 호출 없음. review-agent의 LLM 판단으로 부분 대체되나 자동 검증은 아님
  - [x] PASS/FAIL 판정 + `i18n-report.md` 생성
- [x] **US-2.2 도메인 용어 자동 발견** (4/4) — `src/validation/glossary-growth.ts`
  - [x] 새 도메인 용어 자동 감지 — `discoverTermCandidates` (2회 이상 반복 등장 기준)
  - [x] 4개 언어 번역과 함께 제안 — en/ko/ja/zh-CN 모두 포함 확인
  - [x] 기존 용어와 충돌 시 알림 — `findTermConflicts`. 등재됨/제품명/복합어 3종 구분, 등재 번역과 어긋나면 `mismatch`로 Dev-A 재번역 대상 표시
  - [x] 사람이 승인해야만 등록 — `npm run glossary:approve` 게이트. 자동 등재 경로 없음
- [x] **US-2.3 번역 메모리 (Vectra)** (4/4) — `src/retrieval/`
  - [x] Vectra에 번역 이력 임베딩 저장 — 330건 (원문+번역 결합 임베딩, key/domain을 문맥 메타로)
  - [x] 유사 문맥 검색 — `multilingual-e5-small` 384d, 임계값 0.84 (R@1 76%)
  - [x] 승인된 번역을 확정 데이터로 마킹 — `data/feedback/confirmed.json`
  - [x] 확정 데이터 우선 참조 — 리트리버가 `ctx.confirmed`로 제공. ⚠️ Dev-A 파이프라인 연동은 대기 중이라 E2E 미검증
- [ ] **US-2.4 리뷰 피드백 루프** (1/3) — 미완
  - [x] FAIL 사유를 구체적으로 전달 — `rejected.json` + 리트리버 `ctx.forbidden` + `i18n-report.md` / `extraction-issues.md`
  - [ ] **i18n-agent가 피드백 반영해 재번역 — 트리거 없음**. 파이프라인 실행 주체가 없어 Dev-A 협의 필요
  - [ ] **최대 3회 재시도 후 에스컬레이션 — 미구현**. `rejected[id].length`로 계산 가능하나 판정 코드 없음

**검증 명세의 알려진 결함 대조** (`i18n-verification-spec.md` 참고 절)

| 계층 | 명세 건수 | 검출 | 비고 |
|------|----------|------|------|
| Layer 2 (L2-03) `Settings`/`Setting` 둘 다 "설정" | 1 | ✅ | 동일 번역 중복 검출 규칙 신규 추가 |
| Layer 3 `Vertical Type` → "세로 유형" | 1 | ✅ | 규칙 보유. 현재 데이터는 이미 "산업 분야"로 수정된 상태 |
| Layer 4 | 12 | ✅ 12 key | 번역되지 않은 제외 대상도 검출하도록 규칙 수정 |
| 원문 문제 (`Thema` 2, `detailes` 1, `is required` 1) | 4 | ✅ 4 | `Thema` 오타·문장 조각 검출 신규 추가 |
| Layer 1 | 0 | ✅ 0 | 명세와 일치 |

**추가 구현 (문서에 정의되지 않은 자체 설계)**
아래는 문서에 정의되지 않았고 구현 중 필요하다고 판단해 추가한 것입니다.
출처를 구분해 둡니다.

- [x] **Layer 0 사전 차단** — 회귀/재발/제외미수정 검출. **문서에 없는 자체 설계.**
      근거: FR-09 "사용할수록 자가발전"을 만족하려면 확정 번역이 다음 라운드에
      유지되는지 확인해야 함. LLM 출력이 흔들려 통과했던 번역이 망가지면
      "개선"이 아니라 "요동"이 됨
- [x] **라운드 지표 + 추이 리포트** — `rounds.jsonl`, `npm run report:evolution`.
      **문서에 없음.** 근거: FR-09의 "자가발전"을 증명할 측정 수단이 없었음
- [x] **Dev-A용 리트리버 함수** — `src/retrieval/index.ts`.
      **문서에 없음. Dev-A 구두 요청** (2026-08-20). US-2.3의
      "확정 데이터가 향후 번역 시 우선 참조됨"을 실제로 달성하는 경로
- [x] **에이전트 설정 교정** — review-agent/glossary-agent.
      기존 설정이 존재하지 않는 `.kiro/steering/domain-glossary.md`를 참조해
      용어집 없이 리뷰하고 있었음. 결정론적 스크립트를 실행하도록 프롬프트/도구 수정

**검증**: 테스트 64건 통과 / `round:simulate` 5라운드 FAIL 39→0, 검증대상 330→4

#### Unit 3: Demo App (Dev-C)
- [x] US-3.1 React 프로젝트 초기화
- [x] US-3.2 컴포넌트 자동 생성
- [x] US-3.3 언어 전환 데모 UI
- [x] US-3.4 Figma ↔ 코드 비교
- [x] US-3.5 QA 검증 가이드 자동 생성

#### 공통
- [ ] Build and Test

### Operations Phase
- [ ] Operations

## Decisions (ADR)
- ADR-001: Vector DB → Vectra (Accepted, 2026-08-19)
- ADR-002: 임베딩 모델 → multilingual-e5-small 로컬 실행 (Accepted, 2026-08-20)
  - EXAONE/Friendli는 임베딩 엔드포인트 미지원으로 실측 확인 후 기각
  - ADR-001의 `embeddings: /* EXAONE or LocalEmbeddings */` 미결 항목 해소

## Open Items (Dev-B)

| 항목 | 근거 | 필요 조치 |
|------|------|-----------|
| US-2.1 문맥 적합성 EXAONE 재검증 | Layer 3가 규칙 기반 트랩만 검사, API 호출 없음 | EXAONE 호출 검증 단계 추가 여부 결정 |
| US-2.1 용어 불일치 등급 | 명세는 FAIL, 구현은 WARN (문장 내 약어 축약 오탐 회피) | 등급 정책 확정 |
| US-2.4 재번역 트리거 | 파이프라인 실행 주체 없음 | Dev-A 협의 |
| US-2.4 3회 에스컬레이션 | `rejected[id].length`로 계산 가능, 판정 코드 없음 | 구현 (약 60줄) |
| US-2.3 확정 데이터 우선 참조 | 리트리버가 제공하나 Dev-A 연동 대기 | Dev-A가 `ctx.confirmed` 반영 후 E2E 확인 |
| NFR-02 문맥 오역률 3% 이하 | 측정 코드 없음 | 정답 라벨셋 필요. 측정 방법 합의 |
| S5 인덱스 갱신 시점 | locale 변경 후 `reindex` 수동. 누락 시 리트리버가 낡은 유사 사례 제공 | `npm run qa` 체인 도입 (1줄) |

## Extension Configuration
| Extension | Enabled | Notes |
|-----------|---------|-------|
| Security Baseline | TBD | |
| Resiliency Baseline | TBD | |
| Property-Based Testing | TBD | |
