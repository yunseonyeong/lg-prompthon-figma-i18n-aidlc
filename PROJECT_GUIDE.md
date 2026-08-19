# AI DLC (Design → Localization → Code) 프로젝트 가이드

## 프로젝트 개요

Figma UX 시나리오에서 텍스트를 추출하고, 문맥 기반 다국어 번역을 자동화하여 FE 코드까지 생성하는 해커톤 프로젝트입니다.

**AI DLC 워크플로우(Inception → Construction → Operations)** 를 따릅니다.

### 기술 스택

- **AI 모델**: LG EXAONE 2.0 (Hermes Agent 연동)
- **AI 도구**: Kiro CLI (steering, agents, skills) + AI DLC Workflow
- **디자인 연동**: Figma MCP Server
- **FE**: React + TypeScript + react-i18next
- **언어**: en, ko, ja, zh-CN

---

## AI DLC 3-Phase 워크플로우

```
┌─────────────────────────────────────────────────────────────────┐
│  INCEPTION (무엇을, 왜 만드는가)                                   │
│  ─────────────────────────────────────────────                   │
│  Workspace Detection → Requirements Analysis → User Stories      │
│  → Workflow Planning → Application Design → Units Generation     │
└────────────────────────────────┬────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────┐
│  CONSTRUCTION (어떻게 만드는가)                                    │
│  ─────────────────────────────────────────────                   │
│  Functional Design → NFR Requirements → NFR Design               │
│  → Infrastructure Design → Code Generation → Build & Test        │
└────────────────────────────────┬────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────┐
│  OPERATIONS (어떻게 배포/운영하는가)                                │
│  ─────────────────────────────────────────────                   │
│  Deployment → Monitoring → Feedback Loop                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 프로젝트 디렉토리 구조

```
workspace/
├── .kiro/
│   ├── steering/
│   │   ├── aws-aidlc-rules/
│   │   │   └── core-workflow.md          # 공식 AI DLC 코어 워크플로우
│   │   ├── i18n-workflow.md              # 커스텀 i18n DLC 규칙
│   │   └── domain-glossary.md            # 도메인 용어집
│   ├── aws-aidlc-rule-details/
│   │   ├── common/                       # 공통 규칙 (11개)
│   │   ├── inception/                    # Inception 상세 규칙 (7개)
│   │   ├── construction/                 # Construction 상세 규칙 (6개)
│   │   ├── operations/                   # Operations 규칙 (1개)
│   │   └── extensions/                   # 확장 규칙 (보안, 복원력, 테스트)
│   ├── agents/
│   │   ├── i18n-agent.json               # 메인 DLC 에이전트
│   │   ├── review-agent.json             # 번역 품질 검증
│   │   ├── code-gen-agent.json           # FE 코드 생성
│   │   └── glossary-agent.json           # 용어집 관리
│   └── skills/
│       └── figma-i18n/
│           └── SKILL.md                  # Figma→i18n 변환 스킬
├── aidlc-docs/                           # AI DLC 산출물
│   ├── aidlc-state.md                    # 진행 상태 추적
│   ├── audit.md                          # 감사 로그
│   ├── inception/                        # Inception 산출물
│   │   ├── plans/
│   │   ├── requirements/
│   │   ├── user-stories/
│   │   └── application-design/
│   ├── construction/                     # Construction 산출물
│   │   ├── plans/
│   │   └── build-and-test/
│   └── operations/                       # Operations 산출물
├── src/                                  # 애플리케이션 코드 (Construction에서 생성)
│   ├── locales/
│   │   ├── en.json
│   │   ├── ko.json
│   │   ├── ja.json
│   │   └── zh-CN.json
│   ├── components/
│   ├── i18n.ts
│   └── App.tsx
├── .vscode/mcp.json
├── .env
├── .gitignore
└── package.json
```

---

## 팀원별 역할 분담

### 👤 A: Figma + i18n 핵심 파이프라인 담당

> Figma MCP 연동과 텍스트 추출 → 번역 핵심 로직

#### 담당 Phase

- **Inception**: 요구사항 분석, Figma 파일 구조 분석, 번역 스펙 정의
- **Construction**: i18n 파이프라인 구현 (추출 → 번역 → JSON 출력)

#### 작업 목록

**Inception Phase:**
1. [ ] Figma MCP로 실제 UX 시나리오 파일 텍스트 추출 테스트
2. [ ] 페이지/프레임 구조에서 UX 흐름 순서 파악 로직 정리
3. [ ] 요구사항 문서 작성 (`aidlc-docs/inception/requirements/`)
4. [ ] EXAONE에 전달할 프롬프트 템플릿 설계

**Construction Phase:**
5. [ ] i18n key 자동 네이밍 규칙 구현 (`{domain}.{page}.{component}.{element}`)
6. [ ] 문맥 인식 번역 로직 구현 (EXAONE + Hermes Agent)
7. [ ] 번역 결과를 locale JSON 파일로 출력하는 로직 구현
8. [ ] 동일 단어 / 다른 문맥 케이스 테스트 (예: Player, Channel)
9. [ ] `i18n-agent` 프롬프트 튜닝 및 steering 규칙 반영 확인

#### 에이전트 & 참고 파일

```bash
kiro-cli chat --agent i18n-agent
```

- `.kiro/agents/i18n-agent.json`
- `.kiro/steering/i18n-workflow.md`
- `.kiro/skills/figma-i18n/SKILL.md`
- `.kiro/aws-aidlc-rule-details/inception/requirements-analysis.md`

#### 산출물

- `aidlc-docs/inception/requirements/requirements.md`
- `src/locales/en.json`, `ko.json`, `ja.json`, `zh-CN.json`
- 추출 과정 데모 시나리오

---

### 👤 B: 번역 품질 검증 + 용어집 시스템 담당

> 번역 결과의 품질 보장과 도메인 용어 일관성 관리

#### 담당 Phase

- **Inception**: 용어집 정의, 검증 기준 설계
- **Construction**: 리뷰 자동화, 품질 검증 리포트
- **Operations**: 변경 감지, 용어 진화 관리

#### 작업 목록

**Inception Phase:**
1. [ ] 도메인 용어집 확장 (실제 Signage UX 용어 추가)
2. [ ] 검증 기준 정의 (어떤 기준으로 PASS/FAIL 판단할 것인가)
3. [ ] 용어 충돌 규칙 정의 (같은 영단어, 다른 번역이 존재하는 경우)

**Construction Phase:**
4. [ ] `review-agent` 검증 자동화 구현
   - key 구조 일관성 체크 (모든 locale 파일 간 비교)
   - 용어집 준수 여부 자동 검출
   - placeholder 포맷 보존 검증 (`{0}`, `{{name}}` 등)
   - 번역 길이 이상치 탐지
5. [ ] 품질 리포트 출력 포맷 설계 (`i18n-report.md`)
6. [ ] `glossary-agent`로 신규 용어 자동 발견 → 제안 플로우 구현
7. [ ] review → i18n-agent 피드백 루프 시나리오 작성

**Operations Phase:**
8. [ ] Figma 변경 감지 → 기존 번역과 diff 비교 로직
9. [ ] 최종 검증 체크리스트 자동화

#### 에이전트 & 참고 파일

```bash
kiro-cli chat --agent review-agent
kiro-cli chat --agent glossary-agent
```

- `.kiro/agents/review-agent.json`
- `.kiro/agents/glossary-agent.json`
- `.kiro/steering/domain-glossary.md`
- `.kiro/aws-aidlc-rule-details/construction/build-and-test.md`

#### 산출물

- 확장된 `.kiro/steering/domain-glossary.md`
- `i18n-report.md` (검증 리포트)
- `aidlc-docs/construction/build-and-test/` 내 검증 문서

---

### 👤 C: FE 코드 생성 + 데모/발표 담당

> i18n 결과물을 실제 FE 컴포넌트로 변환하고 데모 준비

#### 담당 Phase

- **Inception**: 기술 스택 결정, 애플리케이션 설계
- **Construction**: React 프로젝트 구현, 코드 생성
- **Operations**: 데모 앱 배포, 발표

#### 작업 목록

**Inception Phase:**
1. [ ] 기술 스택 확정 (React + TypeScript + react-i18next)
2. [ ] 애플리케이션 설계 문서 작성 (`aidlc-docs/inception/application-design/`)
3. [ ] 컴포넌트 구조 설계 (Figma 프레임 → 컴포넌트 매핑)

**Construction Phase:**
4. [ ] React + TypeScript + react-i18next 프로젝트 초기화
5. [ ] i18n 설정 (i18next init, 언어 감지, fallback)
6. [ ] `code-gen-agent`로 locale JSON → 컴포넌트 자동 생성 테스트
7. [ ] 생성된 컴포넌트 실제 렌더링 확인
8. [ ] 언어 전환 UI 구현 (데모용)

**Operations Phase:**
9. [ ] Figma 디자인 ↔ 생성된 UI 비교 화면 준비
10. [ ] 전체 DLC 플로우 데모 시나리오 작성
11. [ ] 발표 자료 준비
    - 문제 정의 (수동 작업의 Pain Point)
    - 솔루션 아키텍처 (Kiro AI DLC + EXAONE + Figma MCP)
    - 라이브 데모
    - 효과 측정 (시간 단축, 오역 감소)

#### 에이전트 & 참고 파일

```bash
kiro-cli chat --agent code-gen-agent
```

- `.kiro/agents/code-gen-agent.json`
- `.kiro/steering/i18n-workflow.md` (Output Structure 섹션)
- `.kiro/aws-aidlc-rule-details/construction/code-generation.md`

#### 산출물

- 동작하는 React 데모 앱 (`src/`)
- `aidlc-docs/inception/application-design/` 설계 문서
- `aidlc-docs/construction/plans/code-generation-plan.md`
- 발표 자료

---

## AI DLC Phase별 진행 가이드

### Phase 1: INCEPTION (해커톤 첫 2시간)

> "무엇을, 왜 만드는가"를 정의

```bash
# i18n-agent로 시작하면 core-workflow.md에 따라 Inception부터 안내됨
kiro-cli chat --agent i18n-agent
```

| 단계 | 담당 | 산출물 |
|------|------|--------|
| Workspace Detection | 전원 | 프로젝트 타입 확정 (Greenfield) |
| Requirements Analysis | A | `aidlc-docs/inception/requirements/requirements.md` |
| User Stories | A+B | `aidlc-docs/inception/user-stories/stories.md` |
| Workflow Planning | 전원 | `aidlc-docs/inception/plans/execution-plan.md` |
| Application Design | C | `aidlc-docs/inception/application-design/components.md` |
| Units Generation | 전원 | 작업 단위 분해 |

**Inception 완료 조건:**
- [ ] 요구사항 문서 승인됨
- [ ] 애플리케이션 설계 승인됨
- [ ] 실행 계획 승인됨
- [ ] `aidlc-state.md` Inception 체크박스 모두 완료

---

### Phase 2: CONSTRUCTION (해커톤 3~6시간)

> "어떻게 만드는가"를 실행

| 단계 | 담당 | 산출물 |
|------|------|--------|
| Functional Design | A | 번역 로직 상세 설계 |
| NFR Requirements | B | 품질 기준 (번역 정확도, 응답 시간) |
| Code Generation | A+C | i18n JSON + React 컴포넌트 |
| Build & Test | B | 검증 리포트, 테스트 결과 |

**Construction 완료 조건:**
- [ ] locale JSON 파일 4개 언어 생성됨
- [ ] React 컴포넌트 렌더링 정상
- [ ] 리뷰 에이전트 검증 PASS
- [ ] 빌드 성공

---

### Phase 3: OPERATIONS (해커톤 마지막 2시간)

> "어떻게 배포하고 운영하는가"

| 단계 | 담당 | 산출물 |
|------|------|--------|
| 데모 준비 | C | 라이브 데모 시나리오 |
| 변경 감지 테스트 | B | Figma 변경 → 자동 업데이트 데모 |
| 통합 리허설 | 전원 | 전체 플로우 시연 |
| 발표 | C | 발표 자료 + 데모 |

**Operations 완료 조건:**
- [ ] 전체 DLC 플로우 데모 성공
- [ ] 발표 자료 완성

---

## 에이전트 단축키

| 단축키 | 에이전트 | 용도 |
|--------|---------|------|
| `Ctrl+Shift+I` | i18n-agent | Figma 추출 + 번역 |
| `Ctrl+Shift+R` | review-agent | 품질 검증 |
| `Ctrl+Shift+C` | code-gen-agent | FE 코드 생성 |
| `Ctrl+Shift+G` | glossary-agent | 용어집 관리 |

---

## 공통 규칙

### AI DLC 핵심 원칙

1. **적응형 실행**: 필요한 단계만 실행 (단순 작업은 최소화)
2. **투명한 계획**: 실행 전 항상 계획을 보여주고 승인받기
3. **사용자 통제**: 각 단계 산출물을 사람이 승인한 뒤 다음 단계 진행
4. **진행 추적**: `aidlc-state.md`에 완료/스킵된 단계 기록
5. **감사 추적**: 모든 입출력을 `audit.md`에 기록

### 브랜치 전략

```
main
├── feat/figma-i18n-pipeline    (A)
├── feat/review-glossary        (B)
└── feat/code-gen-demo          (C)
```

### 커밋 컨벤션

```
feat: 새 기능 추가
fix: 버그 수정
docs: 문서 수정
refactor: 코드 리팩토링
chore: 기타 작업
```

### 소통 포인트

- **A→B**: locale JSON 생성 완료 시 B에게 전달 → 리뷰 시작
- **B→A**: 리뷰 실패 시 피드백 → A가 번역 수정
- **A→C**: 검증 통과된 locale JSON → C가 코드 생성
- **B→C**: 리포트 결과를 데모 자료에 포함

---

## 일정 (해커톤 당일 기준)

| 시간 | Phase | A | B | C |
|------|-------|---|---|---|
| 0~1h | Inception | 요구사항 분석 + Figma 연동 | 용어집 확장 + 검증 기준 | 기술 스택 + 앱 설계 |
| 1~2h | Inception | 프롬프트 설계 | 리뷰 규칙 정의 | 컴포넌트 구조 설계 |
| 2~4h | Construction | 번역 파이프라인 구현 | 검증 자동화 구현 | React 프로젝트 + i18n 설정 |
| 4~6h | Construction | 전체 파이프라인 연결 | 리뷰 루프 테스트 | code-gen + 컴포넌트 생성 |
| 6~7h | Operations | 통합 테스트 | 변경 감지 데모 | 데모 UI + 발표 자료 |
| 7~8h | Operations | 데모 리허설 | 데모 리허설 | 발표 리허설 |

---

## 시작하기

```bash
# 1. 환경변수 설정
# .env 파일에 Figma API 토큰이 설정되어 있는지 확인
cat .env

# 2. AI DLC 상태 확인
cat aidlc-docs/aidlc-state.md

# 3. Kiro CLI로 에이전트 시작 (Inception부터 자동 안내)
kiro-cli chat --agent i18n-agent

# 4. 또는 특정 에이전트로 시작
kiro-cli chat --agent review-agent     # B
kiro-cli chat --agent glossary-agent   # B
kiro-cli chat --agent code-gen-agent   # C
```

---

## 발표 스토리라인

> "개발자가 Figma UX 시나리오를 보고 수동으로 하던 작업 —
> 텍스트 추출, i18n key 네이밍, 문맥 기반 다국어 번역, FE 코드 적용 —
> 을 **Kiro AI DLC 워크플로우 + EXAONE + Figma MCP**로 자동화했습니다.
>
> 특히 'Player'를 '재생 장치'로 번역하는 것처럼,
> UX 시나리오의 흐름을 이해하는 **문맥 인식 번역**이 핵심입니다.
>
> Inception에서 요구사항을 정의하고,
> Construction에서 코드를 생성하며,
> Operations에서 변경 감지까지 — AI DLC의 전 과정을 시연합니다."
