# AI DLC 파일 가이드 (팀원용)

> AI DLC가 처음인 팀원을 위한 전체 파일 구조 및 용도 설명서입니다.
> 각 파일이 무엇이고, 언제 읽히고, 수정해야 하는지를 설명합니다.

---

## 한눈에 보는 구조

```
workspace/
├── .kiro/                              ← Kiro CLI가 읽는 설정 폴더
│   ├── steering/                       ← AI 에이전트에게 주는 "규칙서" (자동 로드)
│   │   └── aws-aidlc-rules/           ← 공식 AI DLC 규칙 (수정 금지)
│   ├── aws-aidlc-rule-details/        ← 공식 AI DLC 상세 규칙 (수정 금지)
│   ├── agents/                        ← AI 에이전트 설정 파일
│   └── skills/                        ← AI가 참조하는 스킬 파일
├── requirements/                       ← 프로젝트 요구사항 (자동 로드 ❌, 수동 참조)
├── aidlc-docs/                         ← AI DLC 산출물 (작업하면서 채워짐)
├── src/                                ← 실제 코드 (Construction에서 생성)
├── .vscode/mcp.json                   ← Figma MCP 설정
├── .env                               ← 환경변수 (토큰)
└── PROJECT_GUIDE.md                   ← 프로젝트 전체 가이드
```

---

## 1. `.kiro/steering/` — AI에게 주는 규칙서

> **개념**: steering 파일은 AI 에이전트가 세션 시작 시 자동으로 읽는 "행동 규칙"입니다.
> 사람으로 치면 "업무 매뉴얼"에 해당합니다.

### `aws-aidlc-rules/core-workflow.md` ⚠️ 수정 금지

| 항목 | 설명 |
|------|------|
| **무엇?** | AI DLC 워크플로우의 핵심 규칙. Inception → Construction → Operations 전체 흐름을 정의 |
| **언제 읽힘?** | Kiro CLI로 에이전트 시작할 때 자동으로 |
| **수정해야 함?** | ❌ 절대 수정하지 마세요. 공식 규칙입니다 |
| **핵심 내용** | 각 Phase에서 어떤 단계를 실행하고, 어떤 조건에서 스킵하고, 사용자 승인을 언제 받는지 |

### ⚠️ 참고: `requirements/` 폴더는 프로젝트 루트에 위치

`requirements/` 폴더는 `.kiro/steering/` 밖에 있으므로 **에이전트 시작 시 자동 로드되지 않습니다.**
작업 시 에이전트에게 직접 파일 경로를 알려주거나, 내용을 전달해야 합니다.

---

## 1-1. `requirements/` — 프로젝트 요구사항 & 도구 설명

> **개념**: 프로젝트의 비전, 기술 스택, 워크플로우 규칙, 용어집 등
> 프로젝트를 이해하기 위한 문서들을 모아둔 폴더입니다.
> AI가 자동으로 읽지 않으므로, 필요할 때 에이전트에게 참조를 요청하세요.

### `requirements/vision.md` ✏️ 수정 가능

| 항목 | 설명 |
|------|------|
| **무엇?** | 프로젝트 비전. 무엇을 왜 만드는가, MVP 범위, 리스크 |
| **언제 읽힘?** | 자동 로드 ❌ — Inception 시작 시 에이전트에게 전달 |
| **수정해야 함?** | ✅ 요구사항 변경 시 |
| **핵심 내용** | 문제 정의, 대상 사용자, MVP IN/OUT, 성공 지표 |

### `requirements/tech-env.md` ✏️ 수정 가능

| 항목 | 설명 |
|------|------|
| **무엇?** | 기술 환경. 어떤 기술 스택과 패턴을 사용하는가 |
| **언제 읽힘?** | 자동 로드 ❌ — Construction 시작 시 에이전트에게 전달 |
| **수정해야 함?** | ✅ 기술 스택 변경 시 |
| **핵심 내용** | 언어, 프레임워크, 금지 라이브러리, 코드 패턴 예시 |

### `requirements/i18n-workflow.md` ✏️ 수정 가능

| 항목 | 설명 |
|------|------|
| **무엇?** | 우리 프로젝트만의 DLC 규칙. Figma → 텍스트 추출 → key 생성 → 번역 → 코드 생성 플로우 |
| **언제 읽힘?** | 자동 로드 ❌ — 작업 시 에이전트에게 참조 요청 |
| **수정해야 함?** | ✅ 프로젝트 진행하면서 규칙 추가/수정 |
| **핵심 내용** | i18n key 네이밍 규칙, 지원 언어, 출력 구조, 품질 체크리스트 |

### `requirements/domain-glossary.md` ✏️ 수정 가능

| 항목 | 설명 |
|------|------|
| **무엇?** | 도메인 용어집. "Player = 재생 장치" 같은 번역 규칙 |
| **언제 읽힘?** | 자동 로드 ❌ — 번역 작업 시 에이전트에게 참조 요청 |
| **수정해야 함?** | ✅ 새 용어 발견 시 계속 추가 |
| **핵심 내용** | 영어-한국어-일본어-중국어 용어 매핑 테이블 |

### 💡 에이전트에게 requirements를 전달하는 방법

```
"requirements/vision.md 파일을 읽고 Inception을 시작해줘"
"requirements/domain-glossary.md를 참조해서 번역해줘"
```

---

## 2. `.kiro/aws-aidlc-rule-details/` — AI DLC 상세 규칙 ⚠️ 수정 금지

> **개념**: core-workflow.md가 "목차"라면, 이 폴더는 "각 챕터의 상세 내용"입니다.
> AI가 각 단계를 실행할 때 필요한 상세 규칙을 여기서 로드합니다.

### `common/` — 모든 Phase에서 공통으로 참조

| 파일 | 용도 |
|------|------|
| `process-overview.md` | AI DLC 전체 프로세스 개요 |
| `session-continuity.md` | 세션 중단 후 이어서 작업하는 방법 |
| `content-validation.md` | 문서 작성 시 콘텐츠 검증 규칙 |
| `question-format-guide.md` | AI가 질문할 때의 형식 (객관식 등) |
| `welcome-message.md` | 워크플로우 시작 시 표시되는 환영 메시지 |
| `depth-levels.md` | 작업 깊이 수준 (minimal/standard/comprehensive) |
| `error-handling.md` | 에러 발생 시 대응 규칙 |
| `overconfidence-prevention.md` | AI가 과신하지 않도록 하는 규칙 |
| `terminology.md` | AI DLC 전용 용어 정의 |
| `ascii-diagram-standards.md` | 다이어그램 작성 표준 |
| `workflow-changes.md` | 워크플로우 변경 시 처리 방법 |

### `inception/` — Inception Phase 상세 규칙

| 파일 | 용도 | 우리 프로젝트에서의 역할 |
|------|------|------------------------|
| `workspace-detection.md` | 프로젝트 유형 감지 (신규/기존) | Greenfield로 감지됨 |
| `requirements-analysis.md` | 요구사항 분석 방법 | Figma i18n 요구사항 정리 |
| `user-stories.md` | 사용자 스토리 생성 방법 | "개발자가 번역 자동화를 원한다" |
| `workflow-planning.md` | 실행 계획 수립 방법 | 어떤 단계를 실행/스킵할지 결정 |
| `application-design.md` | 앱 설계 방법 | 컴포넌트 구조 설계 |
| `units-generation.md` | 작업 단위 분해 방법 | i18n 파이프라인을 유닛으로 분할 |
| `reverse-engineering.md` | 기존 코드 분석 (Brownfield용) | 우리는 Greenfield라 스킵 |

### `construction/` — Construction Phase 상세 규칙

| 파일 | 용도 | 우리 프로젝트에서의 역할 |
|------|------|------------------------|
| `functional-design.md` | 기능 상세 설계 방법 | 번역 로직 설계 |
| `nfr-requirements.md` | 비기능 요구사항 정의 | 번역 정확도, 응답 시간 |
| `nfr-design.md` | 비기능 요구사항 설계 | 성능/품질 패턴 |
| `infrastructure-design.md` | 인프라 설계 | (해커톤에서는 스킵 가능) |
| `code-generation.md` | 코드 생성 규칙 | React 컴포넌트 + i18n JSON 생성 |
| `build-and-test.md` | 빌드/테스트 방법 | 번역 검증 + 빌드 확인 |

### `operations/` — Operations Phase 상세 규칙

| 파일 | 용도 |
|------|------|
| `operations.md` | 배포/운영 (현재 placeholder) |

### `extensions/` — 선택적 확장 규칙

| 폴더 | 파일 | 용도 |
|------|------|------|
| `security/baseline/` | `security-baseline.md` | 보안 규칙 (opt-in) |
| | `security-baseline.opt-in.md` | 보안 규칙 활성화 프롬프트 |
| `resiliency/baseline/` | `resiliency-baseline.md` | 복원력 규칙 (opt-in) |
| | `resiliency-baseline.opt-in.md` | 복원력 규칙 활성화 프롬프트 |
| `testing/property-based/` | `property-based-testing.md` | 속성 기반 테스트 (opt-in) |
| | `property-based-testing.opt-in.md` | 테스트 규칙 활성화 프롬프트 |

> **opt-in 의미**: AI가 Inception 중에 "이 확장을 사용할까요?" 라고 물어봅니다.
> 해커톤에서는 대부분 "아니오"로 스킵해도 됩니다.

---

## 3. `.kiro/agents/` — AI 에이전트 설정

> **개념**: 각 에이전트는 특정 역할에 최적화된 AI입니다.
> 사람으로 치면 "직무기술서(JD)"에 해당합니다.

| 파일 | 에이전트 | 단축키 | 역할 |
|------|---------|--------|------|
| `i18n-agent.json` | i18n-agent | `Ctrl+Shift+I` | Figma 텍스트 추출 + 문맥 분석 + 번역 |
| `review-agent.json` | review-agent | `Ctrl+Shift+R` | 번역 품질 검증 (6가지 기준) |
| `code-gen-agent.json` | code-gen-agent | `Ctrl+Shift+C` | i18n JSON → React 컴포넌트 생성 |
| `glossary-agent.json` | glossary-agent | `Ctrl+Shift+G` | 도메인 용어 관리/제안 |

### 에이전트 파일 구성 요소

```json
{
  "name": "에이전트 이름",
  "description": "설명",
  "prompt": "AI에게 주는 역할 지시문",
  "tools": ["사용 가능한 도구"],
  "allowedTools": ["자동 승인 도구"],
  "resources": ["자동 로드할 파일"],
  "mcpServers": { "외부 서비스 연결": {} },
  "keyboardShortcut": "단축키",
  "welcomeMessage": "시작 메시지"
}
```

---

## 4. `.kiro/skills/` — AI 스킬 파일

> **개념**: 에이전트가 "필요할 때 참조하는 매뉴얼"입니다.
> steering은 항상 로드되지만, skill은 필요할 때만 로드됩니다.

| 파일 | 용도 |
|------|------|
| `figma-i18n/SKILL.md` | Figma에서 텍스트 추출 → i18n 변환하는 절차 정의 |

---

## 5. `aidlc-docs/` — AI DLC 산출물

> **개념**: AI DLC 워크플로우를 진행하면서 생성되는 문서들이 여기 쌓입니다.
> 코드가 아닌 "설계 문서, 계획, 로그"가 저장됩니다.

| 파일/폴더 | 용도 | 언제 생성? |
|-----------|------|-----------|
| `aidlc-state.md` | 현재 진행 상태 (체크박스) | 처음부터 존재, 계속 업데이트 |
| `audit.md` | 모든 대화/결정의 감사 로그 | 처음부터 존재, 계속 추가 |
| `inception/requirements/` | 요구사항 문서 | Inception Phase |
| `inception/user-stories/` | 사용자 스토리 | Inception Phase |
| `inception/application-design/` | 애플리케이션 설계 | Inception Phase |
| `inception/plans/` | 실행 계획 | Inception Phase |
| `construction/plans/` | 코드 생성 계획 | Construction Phase |
| `construction/build-and-test/` | 빌드/테스트 결과 | Construction Phase |
| `operations/` | 운영 문서 | Operations Phase |

### 중요 규칙

- ❌ `aidlc-docs/`에 코드를 넣지 마세요 → 코드는 `src/`에
- ✅ AI가 자동으로 문서를 생성합니다
- ✅ 사람이 승인해야 다음 단계로 넘어갑니다

---

## 6. 기타 파일

| 파일 | 용도 | 수정 가능? |
|------|------|-----------|
| `.vscode/mcp.json` | VS Code에서 Figma MCP 서버 연결 설정 | ✅ |
| `.env` | Figma API 토큰 저장 | ✅ (토큰 값 변경) |
| `.gitignore` | git 추적 제외 파일 목록 | ✅ |
| `PROJECT_GUIDE.md` | 팀 프로젝트 가이드 (역할 분담, 일정) | ✅ |

---

## 실제 워크플로우 요약

### 1단계: 에이전트 시작

```bash
kiro-cli chat --agent i18n-agent
```

### 2단계: AI가 core-workflow.md를 읽고 Inception 시작

AI가 자동으로:
1. 환영 메시지 표시
2. Workspace Detection 수행 (Greenfield 확인)
3. 요구사항 분석 질문 → **당신이 답변**
4. 계획 수립 → **당신이 승인**

### 3단계: 승인 후 다음 단계로

각 단계 끝에 AI가 물어봅니다:
```
A) 변경 요청
B) 다음 단계로 진행
```
**반드시 선택해야 다음으로 넘어갑니다.** (사용자 통제 원칙)

### 4단계: Construction에서 실제 코드 생성

locale JSON, React 컴포넌트 등이 `src/`에 생성됩니다.

---

## FAQ

**Q: 파일을 잘못 수정했어요. 어떻게 복구하나요?**
- `aws-aidlc-rules/` 또는 `aws-aidlc-rule-details/`: git에서 복구하거나 원본 레포에서 다시 복사
- `requirements/`: 팀과 상의하여 수정

**Q: aidlc-state.md는 직접 수정해도 되나요?**
- AI가 자동으로 업데이트하므로 직접 수정은 권장하지 않습니다.
- 단, 상태가 꼬였을 때는 수동 수정 가능합니다.

**Q: 에이전트가 이상하게 동작하면?**
- steering 파일이 제대로 로드됐는지 확인: `/context show` 명령
- 에이전트 재시작: 세션 종료 후 다시 시작

**Q: 어떤 에이전트를 써야 하나요?**
- 처음 시작: `i18n-agent`
- 번역 결과 확인: `review-agent`
- 용어 추가: `glossary-agent`
- 코드 만들기: `code-gen-agent`

---

## 수정 권한 요약

| 구분 | 수정 가능? | 비고 |
|------|-----------|------|
| `.kiro/steering/aws-aidlc-rules/` | ❌ | 공식 규칙 |
| `.kiro/aws-aidlc-rule-details/` | ❌ | 공식 상세 규칙 |
| `requirements/` | ✅ | 프로젝트 요구사항 (자동 로드 안 됨) |
| `.kiro/agents/` | ✅ | 에이전트 설정 |
| `.kiro/skills/` | ✅ | 스킬 정의 |
| `aidlc-docs/` | ⚠️ | AI가 관리 (비상시만 수동) |
| `src/` | ✅ | 애플리케이션 코드 |
| `PROJECT_GUIDE.md` | ✅ | 팀 가이드 |
