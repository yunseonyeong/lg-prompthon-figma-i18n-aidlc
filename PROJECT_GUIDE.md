# AI DLC (Design → Localization → Code) 프로젝트 가이드

## 프로젝트 개요

Figma UX 시나리오에서 텍스트를 추출하고, 문맥 기반 다국어 번역을 자동화하여 FE 코드까지 생성하는 해커톤 프로젝트입니다.

**AI DLC 워크플로우(Inception → Construction → Operations)** 를 따릅니다.

### 기술 스택 (확정)

| 항목 | 기술 |
|------|------|
| AI 모델 | LG EXAONE 2.0 (Hermes Agent Friendly API, HTTPS) |
| AI 도구 | Kiro CLI (steering, agents, skills) + AI DLC Workflow |
| 디자인 연동 | Figma MCP Server |
| FE | React 18 + TypeScript 5 + react-i18next 14 |
| 번들러 | Vite 5 |
| Vector DB | Vectra (로컬 파일 기반) |
| 언어 | en, ko, ja, zh-CN |

---

## 팀원별 역할 및 User Stories

### 👤 Dev-A: Figma i18n 파이프라인

> Epic 1: Figma 텍스트 추출 → 문맥 분석 → Key 생성 → 번역 → JSON 출력

#### 담당 User Stories

| ID | 제목 | 설명 |
|----|------|------|
| US-1.1 | Figma 텍스트 추출 | MCP로 텍스트 노드 + 프레임 구조 추출 |
| US-1.2 | UX 흐름 문맥 분석 | 프레임 순서/계층에서 도메인 추론 |
| US-1.3 | i18n Key 자동 생성 | `{domain}.{feature}.{role}.{identifier}` 규칙 |
| US-1.4 | EXAONE 문맥 기반 번역 | Hermes API로 4개 언어 번역 |
| US-1.5 | Locale JSON 출력 | en/ko/ja/zh-CN JSON 생성 |

#### 에이전트

```bash
kiro-cli chat --agent i18n-agent    # Ctrl+Shift+I
```

#### 산출물

- `src/locales/en.json`, `ko.json`, `ja.json`, `zh-CN.json`
- EXAONE 프롬프트 템플릿

---

### 👤 Dev-B: 품질 검증 + 용어집 + 자가발전

> Epic 2: 번역 검증 → 용어 관리 → 번역 메모리 → 피드백 루프

#### 담당 User Stories

| ID | 제목 | 설명 |
|----|------|------|
| US-2.1 | 번역 품질 자동 검증 | 용어집/key일치/포맷/문맥 4개 기준 |
| US-2.2 | 도메인 용어 자동 발견 | 새 용어 감지 + 4개 언어 번역 제안 |
| US-2.3 | 번역 메모리 (Vectra) | 이력 저장 + 유사 문맥 검색 |
| US-2.4 | 리뷰 피드백 루프 | FAIL 시 자동 재번역 (최대 3회) |

#### 에이전트

```bash
kiro-cli chat --agent review-agent     # Ctrl+Shift+R
kiro-cli chat --agent glossary-agent   # Ctrl+Shift+G
```

#### 산출물

- 확장된 `requirements/domain-glossary.md`
- `i18n-report.md` (검증 리포트)
- `data/translation-memory/` (Vectra 인덱스)
- `data/glossary-index/` (Vectra 인덱스)

---

### 👤 Dev-C: FE 코드 생성 + 데모 웹앱

> Epic 3: React 초기화 → 컴포넌트 생성 → 데모 UI → 발표

#### 담당 User Stories

| ID | 제목 | 설명 |
|----|------|------|
| US-3.1 | React 프로젝트 초기화 | Vite + React + TS + i18next 세팅 |
| US-3.2 | 컴포넌트 자동 생성 | locale JSON → React 컴포넌트 변환 |
| US-3.3 | 언어 전환 데모 UI | 드롭박스로 언어 변경 시 실시간 전환 |
| US-3.4 | Figma ↔ 코드 비교 | 원본 vs 생성 UI 나란히 비교 |

#### 에이전트

```bash
kiro-cli chat --agent code-gen-agent   # Ctrl+Shift+C
```

#### 산출물

- `src/` (React 앱 전체)
- 데모 웹서버 (`npm run dev`)
- 발표 자료

---

## 의존 관계 & 병렬 작업

```
                    [병렬 작업 구간]
    ┌─────────────────────────────────────────┐
    │ Dev-A: 파이프라인 구축                     │
    │ Dev-B: Vectra 세팅 + 검증 로직             │
    │ Dev-C: React 초기화 + 데모 UI 틀           │
    └────────────────────┬────────────────────┘
                         ↓ (Dev-A가 locale JSON 첫 출력)
    ┌─────────────────────────────────────────┐
    │ Dev-B: 품질 검증 시작                      │
    │ Dev-C: 컴포넌트 생성 시작                   │
    └────────────────────┬────────────────────┘
                         ↓ (검증 PASS)
    ┌─────────────────────────────────────────┐
    │ 전원: 통합 테스트 + 데모 리허설             │
    └─────────────────────────────────────────┘
```

---

## 브랜치 전략

```
main
├── feat/figma-i18n-pipeline    (Dev-A)
├── feat/review-glossary-vectra (Dev-B)
└── feat/code-gen-demo          (Dev-C)
```

---

## i18n Key 네이밍 규칙 (확정)

```
{domain}.{feature}.{role}.{identifier}
```

| Role | 용도 | 예시 |
|------|------|------|
| `title` | 제목 | `signage.player.title.management` |
| `status` | 상태 | `signage.player.status.offline` |
| `button` | 버튼 | `signage.player.button.restart` |
| `label` | 라벨 | `signage.channel.label.name` |
| `description` | 설명 | `signage.schedule.description.set` |
| `placeholder` | 힌트 | `signage.player.placeholder.search` |
| `message` | 알림/에러 | `signage.player.message.error` |

---

## 일정 (해커톤 당일, 10시간 기준)

| 시간 | Phase | Dev-A | Dev-B | Dev-C |
|------|-------|-------|-------|-------|
| 0~1h | Inception | Figma MCP 연동 확인 | Vectra 설치 + 세팅 | React 프로젝트 초기화 |
| 1~2h | Inception | EXAONE 프롬프트 설계 | 검증 기준 구현 | i18next 설정 + 데모 UI 틀 |
| 2~4h | Construction | 추출→번역 파이프라인 | 용어집 자동 발견 | code-gen 테스트 |
| 4~6h | Construction | 전체 파이프라인 완성 | 리뷰 루프 + Vectra 연동 | 컴포넌트 생성 + 렌더링 |
| 6~8h | Construction | 통합 연결 | 통합 검증 | 언어 전환 UI 완성 |
| 8~9h | Operations | 통합 테스트 | 자가발전 데모 | 비교 화면 + 발표 자료 |
| 9~10h | Operations | 리허설 | 리허설 | 리허설 |

---

## 각자 PC에서 시작하기

### 공통 (전원)

```bash
# 1. 프로젝트 클론
git clone https://github.com/yunseonyeong/lg-prompthon-figma-i18n-aidlc.git
cd lg-prompthon-figma-i18n-aidlc

# 2. 환경변수 설정
cp .env.example .env
# .env에 FIGMA_API_KEY 입력

# 3. 본인 브랜치 생성
git checkout -b feat/<본인-브랜치명>
```

### Dev-A

```bash
kiro-cli chat --agent i18n-agent
# "requirements/vision.md와 requirements/questions.md를 읽고 US-1.1부터 진행해줘"
```

### Dev-B

```bash
npm install vectra
kiro-cli chat --agent review-agent
# "requirements/domain-glossary.md를 읽고 US-2.1 검증 로직부터 구현해줘"
```

### Dev-C

```bash
npm create vite@latest . -- --template react-ts
npm install react-i18next i18next
kiro-cli chat --agent code-gen-agent
# "requirements/tech-env.md를 읽고 US-3.1 프로젝트 초기화를 진행해줘"
```

---

## 소통 포인트

| 시점 | 누가→누구 | 내용 |
|------|-----------|------|
| locale JSON 첫 생성 | A→B, A→C | "locale JSON 올렸어, 검증/코드생성 시작해" |
| 검증 FAIL | B→A | "Player가 플레이어로 번역됨, 재번역 필요" |
| 검증 PASS | B→C | "검증 통과, 최종 JSON이야" |
| 새 용어 발견 | B→전원 | "Schedule을 '스케줄'로 등록할까요?" |
| 컴포넌트 완성 | C→전원 | "데모 서버 올렸어, 확인해줘" |

---

## 참고 문서

| 문서 | 위치 | 용도 |
|------|------|------|
| 파일 가이드 | `AI_DLC_FILE_GUIDE.md` | 각 파일 용도 설명 |
| 요구사항 | `aidlc-docs/inception/requirements/requirements.md` | 확정된 요구사항 |
| User Stories | `aidlc-docs/inception/user-stories/stories.md` | 상세 스토리 |
| ADR | `aidlc-docs/inception/decisions/` | 기술 결정 기록 |
| 진행 상태 | `aidlc-docs/aidlc-state.md` | 현재 단계 확인 |
