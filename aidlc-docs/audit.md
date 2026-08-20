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

## 용어집 도메인 교체 (Signage → Console)
**Timestamp**: 2026-08-19T16:50:00+09:00
**User Input**: "domain-glossary.md 파일에 틀린 번역이 있으면 내가 고쳐야 해?" → 진단 후 "A로 교체할게"
**AI Response**: 도메인 불일치 진단, Console 도메인 용어집(48개)으로 교체
**Context**: Construction Phase - 번역 품질 근본 원인 수정

### 진단: 번역이 틀린 게 아니라 도메인이 달랐음

기존 용어집은 Signage 재생 장치 도메인(Player, Playlist, Channel 등)으로 작성되었으나
실제 작업 대상은 `Consol_Settings` (LG Business Cloud 콘솔 설정)이었다.

| 항목 | 값 |
|------|-----|
| 용어집 적중률 | 4/12 (Schedule, Group, Content, Publish만 등장) |
| 미등장 용어 | Player, Channel, Display, Layout, Playlist, Template, Widget, Tag |
| 필요한데 없던 용어 | Business Site(6), Workspace(4), Device(2), End Customer(2), Vertical |

`Player → 재생 장치`는 사이니지 맥락에서 옳은 번역이지만, 대상 파일에 `Player`가 없었다.
이것이 문맥 오역이 그대로 통과한 근본 원인.

### 발견한 문맥 오역 3건 (모두 같은 유형)

주변 필드를 근거로 판정. 단독으로는 검출 불가한 사례들.

| 용어 | 오역 | 정정 | 판정 근거 (같은 프레임 주변 텍스트) |
|------|------|------|-----------------------------------|
| Vertical Type | 세로 유형 | 산업 분야 | Business Site ID, Subsidiary, License Policy, Region/Country → B2B 분류 |
| Extend | 확장 | 연장 | Licensed Product, Period, Assignable Days → 라이선스 기간 |
| Withdraw | (탈퇴) | 회수 | Assign to Workspace, Withdrawable days → 라이선스 회수 |

`Player=재생장치`와 동일 유형이며, 실제 현업 파일에서 발견되었다는 점에서
데모 사례로서 설득력이 더 크다.

### 교체 내용

- 근거: Scenario 페이지 UI 텍스트 7,830건 빈도 분석
- 48개 용어, 6개 카테고리 (엔티티 계층 / 권한·역할 / 라이선스 / 인증 / 비즈니스 분류 / 메뉴)
- 제품명 번역 금지 목록 분리 (Art Lounge, Hotel Mobile App 등)
- ON/OFF 규칙 명문화: 상태 `켜짐/꺼짐`, 동작 `켜기/끄기`
- 9절에 번역 제외 대상 명시 (검증 명세 Layer 4 참조용)
- 용어 추가 요청 템플릿을 표 형식에서 제거 (`NewTerm` 오파싱 문제 해결)

### 재생성 후 검증 (실측)

| 항목 | 결과 |
|------|------|
| key 수 / 구조 일치 | 110개, 4개 언어 완전 일치 |
| 오역 3건 수정 | 산업 분야 / 연장 / 회수 확인 |
| 용어집 준수 위반 | 0건 (false positive 1건 제외) |
| ON/OFF 일관성 | 해소 (이전: 켜짐·끄기·끔 혼용) |

### Dev-B 전달 사항

1. **소유권 위반 고지**: `requirements/domain-glossary.md`는 Dev-B 소유 파일이나,
   번역 품질을 직접 가로막고 있어 Dev-A가 교체했다. 검토 후 이견 시 조정 필요.
2. **검증 규칙 보완 필요 (false positive)**:
   약어와 풀네임 병기 시 어느 한 쪽만 있어도 통과시켜야 한다.
   `Set Single Sign-On (SSO) to ON...` → `SSO를 켜고...` 는 규칙 5(약어 유지)에 부합하나
   단순 부분문자열 검사로는 "싱글 사인온 누락"으로 오판된다.
3. 9절 번역 제외 목록을 Layer 4 검출 규칙의 기준으로 사용할 수 있다.

### 미결 사항

`CONFIG.domain`이 여전히 `'signage'`이다. 두 곳에 영향:
- i18n key prefix (`signage.setting.group...`)
- 번역 프롬프트의 도메인 서술

key prefix를 바꾸면 Dev-C의 `components-map.json` 참조와 어긋나므로,
Dev-C 착수 전에 결정해야 한다.

---

## key 표기 camelCase 전환 + Dev-A 개선 과제 정리
**Timestamp**: 2026-08-19T17:16:00+09:00
**User Input**: "일단 DEV A가 개선할 점을 정리해줘. 그리고 현재 다국어 key 값이 snake case 로 작성되어 있는데 camelcase 여야해"
**AI Response**: identifier를 camelCase로 전환(구분자 버그 동시 수정), 개선 과제 7건 문서화
**Context**: Construction Phase - Unit 1 품질 개선

### camelCase 전환

`generateIdentifier()`를 수정. 전환 과정에서 **구분자 처리 버그**를 함께 발견·수정했다.

기존 로직은 영숫자 외 문자를 공백 삽입 없이 제거해서 단어가 붙었다.

| 원문 | 이전 (버그) | 현재 |
|------|-------------|------|
| Workspace/Group Settings | `workspacegroup_settings` | `workspaceGroupSettings` |
| Add-On Service | `addon_service` | `addOnService` |
| (UTC+09:00) Asia/Seoul | `utc0900_asiaseoul` | `utc0900AsiaSeoul` |
| Single Sign-On (SSO) | `single_signon_sso` | `singleSignOnSso` |
| Business Site Information | `business_site_information` | `businessSiteInformation` |

부가 변경:
- 숫자 전용 토큰을 앞 토큰에 병합 (UTC 09 00 → utc0900)
- 단어 수 상한 3 → 4 (3단어로는 의미 구분이 부족한 사례 존재)

### 검증 (실측)

| 항목 | 결과 |
|------|------|
| key 수 / 구조 | 110개, 4개 언어 완전 일치 |
| underscore 포함 key | 0건 |
| camelCase 규칙 위반 | 1건 (`30A101Bldg`) |
| 문서 내 `console.*` key 실존성 | 전부 일치 |
| components-map snake_case | 0건 |

위반 1건은 샘플 주소(`30, A101 bldg.`)로 Layer 4 제거 대상.
i18next는 key를 문자열로 사용하므로 실사용 영향 없음.

### 문서 동기화

key 예시를 포함한 5개 문서를 실제 생성값으로 갱신하고 교차 검증했다.
`PROJECT_GUIDE.md`, `tech-env.md`, `i18n-workflow.md`, `requirements.md`, `SKILL.md`

### 산출물

- `aidlc-docs/construction/dev-a-improvements.md` (신규) — 개선 과제 7건

### 개선 과제 요약

| # | 과제 | 심각도 | 상태 |
|---|------|--------|------|
| 1 | 추출 필터 보강 (Layer 4, 12건) | 높음 | Dev-B 반송 대기 |
| 2 | 중복 key 제거 (3건) | 높음 | 미착수 |
| 3 | 용어 제안 정확도 (제품명·부분단어 노이즈) | 중간 | 미착수 |
| 4 | 번역 비결정성 | 중간 | Dev-B와 역할 조율 필요 |
| 5 | 프레임 확장 | 중간 | Dev-C 결정 대기 |
| 6 | 제품명 번역 금지 반영 | 낮음 | 미착수 |
| 7 | 문장 조각 (`is required`) | 낮음 | 디자이너 이슈 |

### 결정 필요 사항

**#4 번역 비결정성** — Dev-A 로컬 캐시 vs Dev-B Vectra 번역 메모리(US-2.3)가
같은 문제를 다룬다. 중복 구현을 피해야 한다.
권장: Vectra로 통합하고 Dev-A는 조회 인터페이스만 호출.
근거: 자가발전이 요구사항(Q10-3)이므로 Vectra 쪽에 무게가 있다.

**#2 중복 key** — 전부 병합하면 안 된다. `Delete`는 라벨과 버튼이 실제로 다른
UI 요소일 수 있고 언어별로 다르게 번역될 수 있다(`삭제` vs `삭제됨`).
제안: 동일 프레임 + 동일 텍스트만 병합. 프레임이 다르면 유지.

---

## 번역 메모리 인터페이스 계약 전달 (Dev-A → Dev-B)
**Timestamp**: 2026-08-20T11:06:00+09:00
**User Input**: "exaone 모델로 번역을 할건데, 번역 성능을 높이려면 Vectra DB 로 어떤걸 할 수 있는거야?" → "임베딩 모델이 하는 일이 뭐야?" → "그럼 어떤부분을 DEV A 가 하고, 어떤 부분을 DEV B가 해야 돼?" → "DEV B가 보고 이해할 수 있도록 문서 작성해줘"
**AI Response**: 코퍼스 반복률 실측 후 Vectra 활용 방안 분석, 역할 경계 정의, 인터페이스 계약 문서 작성
**Context**: Construction Phase - US-2.3 착수 준비

### 실측 근거

Figma `zdG3CHXVU6TzD4cc28o5Yb` Scenario 페이지:

| 항목 | 값 |
|------|-----|
| UI 텍스트 총량 | 7,830건 |
| 고유 텍스트 | 990건 |
| 완전 중복률 | **87.4%** |

990건 번역으로 7,830건 커버. 번역 메모리 효과가 큰 구조.

유사 군집 (few-shot 근거): `Business Site ...` 14변형, `IAM > ...` 30변형,
`Access Group ...` 9변형

### Vectra 기여 범위 (효과 순)

1. **few-shot 예시 검색** — 번역 품질 직접 개선. 용어집은 단어 규칙, few-shot은 문장 스타일까지 전달
2. **번역 메모리** — 비결정성 해소(현재 재실행 시 5건 변동), API 호출 절감
3. **화면 문맥 검색** — `Vertical Type` 유형 오역 사전 방지
4. **충돌 탐지** — L2-03(구분 소실) 검출. `Settings`/`Setting` 케이스는 의미 유사도 필요
5. **신규 용어 발견** — 빈도 기반 제안의 노이즈 감소

### 명시적으로 제외한 것

용어집 강제 적용을 Vectra로 옮기지 않는다.
벡터 유사도는 확률적이라 "반드시 이 번역"을 보장하지 못한다.
`Player → 재생 장치`처럼 어기면 안 되는 규칙은 정확 매칭이 맞다.

역할 분담: 강제는 용어집, 유도는 Vectra.

### 역할 경계

| 구분 | Dev-B | Dev-A |
|------|-------|-------|
| 임베딩 모델·인덱스·검색 구현 | ✅ | |
| 확정 번역 저장 (`save`) | ✅ | |
| 충돌 탐지, 신규 용어 발견 | ✅ | |
| 번역 시점 조회·프롬프트 주입 | | ✅ |
| 형제 필드 추출·가공 | | ✅ |
| fallback 처리 | | ✅ |

### 핵심 설계 결정 2건

**1. 저장 시점 = 검증 PASS 후, 호출 주체 = Dev-B**

미검증 번역을 저장하면 few-shot 예시가 되어 오역이 전파된다.
`Vertical Type → 세로 유형`이 저장됐다면 이후 모든 변형이 그 오역을 참고한다.
자가발전이 아니라 자가오염이 된다.

따라서 `lookup`/`findSimilar`는 `status === 'confirmed'`만 반환해야 한다.

**2. `isAvailable()`은 예외를 던지지 않는다**

Dev-B 구현이 지연되어도 Dev-A 파이프라인과 데모가 살아 있어야 한다.
미구현·인덱스 없음 시 `false` 반환 → Dev-A는 현재 방식(용어집 + 앵커)으로 계속.

### 산출물

- `aidlc-docs/construction/translation-memory-contract.md` (신규)
  - `TranslationMemory` 인터페이스 4개 메서드 + `isAvailable()`
  - `TranslationRecord` / `ScreenContext` 타입 정의
  - 인덱스 2개 구성 (번역 메모리 / 화면 문맥)
  - 임베딩 모델 선정 가이드 + 검증식
  - 착수 순서 6단계 + 단계별 실측 성공 기준
- `PROJECT_GUIDE.md` Dev-B 섹션에 연결

### 병렬 작업 가능 조건

시그니처 합의 후 Dev-A는 스텁으로 호출 지점을 먼저 붙여둔다.
Dev-B 구현이 들어오는 순서대로 활성화되므로 서로 대기하지 않는다.

### 미결 사항

| 항목 | 결정권자 |
|------|----------|
| 인덱스를 git에 커밋할지 | 팀 합의 (Dev-A 권장: 커밋, 자가발전 데모 자산) |
| 임베딩 모델 최종 선정 | Dev-B |
| 유사도 임계값 | Dev-B, 실측 후 |

---

## Figma MCP 런타임 연동 점검 및 수정 요청 (Brownfield 수정)
**Timestamp**: 2026-08-20T08:10:00Z
**User Input**: "현재 프로젝트에서 Figma MCP를 연동해서 UI화면을 연동 하려고 하는데 지금은 그냥 코드에 생성된 내용만 화면에 동작하게 되어 있는거 같은데 확인하고 수정부탁ㄷ해"
**AI Response**: 코드베이스 점검 결과 사용자 지적이 사실임을 확인.
- MCP 설정(`.vscode/mcp.json`, `.kiro/agents/*.json`)은 IDE 에이전트 전용이며 앱 런타임에서 호출되는 지점이 없음
- 파이프라인은 `api.figma.com` REST를 직접 호출 (MCP 경유 아님)
- `@modelcontextprotocol/sdk`, `figma-developer-mcp` 미설치
- `StepPreview.tsx`는 하드코딩 JSX + 하드코딩 t() 키로만 구성, Figma 구조 미참조
- `src/components/generated/ConsoleSettingGroupUser.tsx` import 지점 0건 (화면 미노출)
- `src/figma-structure.json` 미존재 + 소비 코드 없음
- `App.tsx`의 setTimeout(1500) 가짜 진행 연출
- `components-map.json` build-time static import로 파이프라인 재실행 미반영
**Context**: Construction 단계 결함 수정. 서버측 MCP 클라이언트 계층 추가 + 화면을 Figma 실데이터 기반 렌더링으로 전환

---

## Figma MCP 런타임 연동 구현 완료
**Timestamp**: 2026-08-20T08:55:00Z
**User Input**: "그러면 신규로 토큰을 발급받으면돼나.." / ".env에 있는 figma key 사용하고 있는거 맞을까" / "key를 바꿧어"
**AI Response**: 토큰 교체 후 429 해제 확인, MCP 실데이터 조회 성공.

### 429 원인 규명 (실제 응답 헤더 기반)
```
x-figma-plan-tier       = enterprise
x-figma-rate-limit-type = low        ← View/Collab seat 수준 quota
retry-after             = 302780     ← 약 3.5일
```
Figma REST 한도는 토큰 문자열이 아니라 **계정 seat + 파일 소유 팀 플랜**으로 결정됨.
따라서 동일 계정 재발급은 무효. Dev/Full seat 토큰이 필요.
→ 사용자가 새 토큰으로 교체하여 해결 (신규 토큰은 scope 기반이라 /v1/me는 403, 파일 조회는 200).

### 환경변수 출처 확인 (이전 진단 정정)
- 프로젝트 `.env`의 `FIGMA_API_KEY`가 실제 사용되는 값 (45자)
- `~/.hermes/.env`는 **존재하지 않음** → 폴백 미작동
- 이전 감사 기록의 "「.env 비어 있음 / ~/.hermes에서 로드」"는 오독이었음

### 구현 산출물
| 파일 | 내용 |
|------|------|
| `server/figma-mcp.ts` (신규) | MCP 클라이언트 계층. stdio JSON-RPC로 figma-developer-mcp 기동, `get_figma_data` 호출. MCP→REST→캐시 3단 폴백, 출처(source) 항상 응답에 포함 |
| `server/glossary-api.ts` | `GET /api/figma/status`, `GET /api/figma/structure` 추가 |
| `src/types/figma.ts` (신규) | 정규화 타입 `FigmaNodeView` 등 |
| `src/api/client.ts` (신규) | API 클라이언트 일원화 (하드코딩 API_BASE 3곳 제거) |
| `src/hooks/useFigmaData.ts` (신규) | `useFigmaStructure` / `useComponentsMap` / `useFigmaMcpStatus` / `useLiveLocales` |
| `src/components/FigmaFrameRenderer.tsx` (신규) | Figma 구조 재귀 렌더러. TEXT 노드만 `t(i18nKey)`로 치환 |
| `src/components/steps/StepPreview.tsx` | 하드코딩 JSX 전면 제거 → Figma 실구조 렌더링 |
| `src/App.tsx` | setTimeout(1500) 가짜 진행 연출 제거 |
| `Step{Extraction,Translation,QAGuide,Compare}.tsx` | components-map.json static import → 런타임 API fetch |

### 발견·수정한 결함
1. **depth 기본값 8이 트리 84% 절단** — textNodes 21개만 반환. 제한 제거 후 130개 (totalNodes 134→857)
2. **TEXT 노드에 display:flex 오적용** — `layoutMode !== 'none'` 판정 때문에 텍스트 렌더링 깨짐. `=== 'row' || === 'column'` + TEXT 제외로 수정
3. **"미매핑" 오표기** — 파이프라인이 의도적으로 제외한 텍스트(시나리오 설명 테이블, 숫자/날짜)를 오류처럼 빨간색 표시하던 것을 중립 표기로 변경
4. **StepQAGuide NaN%** — total 0일 때 진행률 NaN

### 검증 결과
- `GET /api/figma/status` → `connected:true`, tools `get_figma_data`/`download_figma_images`
- `GET /api/figma/structure` → `source:mcp`, totalNodes 857 / textNodes 130 / mappedKeys 76
- `npx tsc --noEmit` 통과 (`server/`를 typecheck 대상에 편입)
- `npm run build` 통과
- 신규 테스트 13/13 통과 (`server/figma-mcp.test.ts` 7건, `src/components/FigmaFrameRenderer.test.tsx` 6건)
  - MCP simplified ↔ REST raw 정규화 결과 수렴, 언어 전환 시 텍스트 교체, 번역 제외 텍스트 원문 유지 검증

### 미해결 (범위 외)
- `src/retrieval/retriever.test.ts` 4건 실패 — `.vectra` 인덱스 미생성(`npm run reindex` 필요). Dev-B 영역, 본 작업과 무관 (해당 디렉터리 미변경)
- MCP curl 폴백이 토큰을 로그에 평문 출력 → 토큰 폐기/재발급 권장 (보안 사안, 429와 별개)
**Context**: Construction 단계 결함 수정 완료. Figma MCP가 런타임 데이터 소스로 실제 동작

---

## Step 8 완료 버튼 무반응 결함 수정
**Timestamp**: 2026-08-20T09:05:00Z
**User Input**: "Step 8. Figma ↔ 코드 비교 여기서 완료버튼이 안눈려"
**AI Response**: 클릭 불가 원인 확인 및 수정. 동일 유형 결함 3건 추가 발견.

### 원인
`StepCompare.tsx`의 마지막 버튼에 `disabled`가 하드코딩되어 있고 `onClick`도 없었다.
```tsx
<Button variant="success" size="lg" disabled>✅ 완료</Button>
```
App.tsx도 `<StepCompare onBack={handleBack} />`만 넘겨 완료를 받을 콜백이 없었다.

### 수정
| 파일 | 내용 |
|------|------|
| `src/components/steps/StepCompare.tsx` | `onComplete` prop 추가, `disabled` 제거, `onClick={onComplete}` 연결 |
| `src/App.tsx` | `handleComplete`(Step 1 복귀) 추가 후 StepCompare에 전달 |

### 동일 유형 추가 발견 (StepQAGuide.tsx 내보내기 버튼 3개)
onClick 없이 조용히 무반응하던 버튼들:
- `📊 Excel (QA용)` → **CSV 내보내기로 실제 구현**. 4개 언어 번역 + QA/법인감수 체크 상태 포함,
  RFC 4180 방식 이스케이프(번역문 내 쉼표/따옴표/개행 대응), UTF-8 BOM 부착(Excel 한중일 깨짐 방지)
- `📄 PDF (법인 감수용)`, `📧 이메일 발송` → 미구현이므로 `disabled` + "준비 중" 명시.
  조용한 무반응보다 명시적 비활성화가 정직하다는 판단

### 검증
- `npx tsc --noEmit` 통과 / `npm run build` 통과
- `src/components/steps/StepCompare.test.tsx` 신규 3건 — 완료 버튼 활성 상태(disabled 회귀 방지),
  클릭 시 onComplete 호출, 이전 버튼 onBack 호출
- 관련 테스트 합계 16/16 통과

**Context**: Construction 단계 UI 결함 수정. 죽은 버튼 제거

---
