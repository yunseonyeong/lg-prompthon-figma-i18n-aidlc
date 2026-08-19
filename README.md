# Figma i18n DLC

Figma UX 시나리오에서 텍스트를 추출하고, 문맥 기반 다국어 번역을 자동화하여 FE 코드까지 생성하는 프로젝트입니다.

**AI DLC 워크플로우 (Inception → Construction → Operations)** 를 따릅니다.

## 기술 스택

- **AI 모델**: LG EXAONE 2.0 (Hermes Agent)
- **AI 도구**: Kiro CLI + AI DLC Workflow
- **디자인 연동**: Figma MCP Server
- **FE**: React + TypeScript + react-i18next

## 시작하기

### 1. 프로젝트 클론

```bash
git clone <repo-url>
cd workspace
```

### 2. 환경변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열고 Figma Personal Access Token을 입력하세요.

> 토큰 발급: Figma → Settings → Personal access tokens → Generate new token

### 3. Kiro CLI 설치 확인

```bash
kiro-cli --version
```

설치가 안 되어 있다면 설치 후 진행하세요.

### 4. 에이전트 시작

```bash
# 메인 i18n 파이프라인
kiro-cli chat --agent i18n-agent

# 번역 품질 검증
kiro-cli chat --agent review-agent

# 용어집 관리
kiro-cli chat --agent glossary-agent

# FE 코드 생성
kiro-cli chat --agent code-gen-agent
```

## 프로젝트 구조

```
├── .kiro/                     # Kiro CLI 설정
│   ├── steering/              # AI 행동 규칙
│   ├── aws-aidlc-rule-details/# AI DLC 상세 규칙
│   ├── agents/                # AI 에이전트 (4개)
│   └── skills/                # AI 스킬
├── requirements/              # 프로젝트 요구사항
│   ├── vision.md              # 비전 문서
│   ├── tech-env.md            # 기술 환경
│   ├── i18n-workflow.md       # i18n DLC 플로우
│   └── domain-glossary.md     # 도메인 용어집
├── aidlc-docs/                # AI DLC 산출물
├── .vscode/mcp.json           # Figma MCP 설정
└── .env.example               # 환경변수 템플릿
```

## 팀원별 가이드

- 전체 가이드: [PROJECT_GUIDE.md](PROJECT_GUIDE.md)
- 파일 용도 설명: [AI_DLC_FILE_GUIDE.md](AI_DLC_FILE_GUIDE.md)

## 에이전트 단축키

| 단축키 | 에이전트 | 용도 |
|--------|---------|------|
| `Ctrl+Shift+I` | i18n-agent | Figma 추출 + 번역 |
| `Ctrl+Shift+R` | review-agent | 품질 검증 |
| `Ctrl+Shift+C` | code-gen-agent | FE 코드 생성 |
| `Ctrl+Shift+G` | glossary-agent | 용어집 관리 |
