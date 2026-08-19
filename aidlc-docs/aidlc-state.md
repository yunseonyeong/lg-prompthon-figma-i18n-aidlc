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
- [ ] US-2.1 번역 품질 자동 검증
- [ ] US-2.2 도메인 용어 자동 발견
- [ ] US-2.3 번역 메모리 (Vectra)
- [ ] US-2.4 리뷰 피드백 루프

#### Unit 3: Demo App (Dev-C)
- [ ] US-3.1 React 프로젝트 초기화
- [ ] US-3.2 컴포넌트 자동 생성
- [ ] US-3.3 언어 전환 데모 UI
- [ ] US-3.4 Figma ↔ 코드 비교

#### 공통
- [ ] Build and Test

### Operations Phase
- [ ] Operations

## Decisions (ADR)
- ADR-001: Vector DB → Vectra (Accepted, 2026-08-19)

## Extension Configuration
| Extension | Enabled | Notes |
|-----------|---------|-------|
| Security Baseline | TBD | |
| Resiliency Baseline | TBD | |
| Property-Based Testing | TBD | |
