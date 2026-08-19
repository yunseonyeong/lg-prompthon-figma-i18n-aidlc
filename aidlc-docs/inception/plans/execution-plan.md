# Execution Plan: Figma i18n DLC

## Overview

본 프로젝트는 Greenfield + 해커톤(10시간+) 환경입니다.
3명이 각자 PC에서 병렬로 작업하며, 합류 시점에서 통합합니다.

---

## Phase 실행 계획

### INCEPTION Phase ✅ (완료)

| 단계 | 실행 여부 | 이유 |
|------|----------|------|
| Workspace Detection | ✅ 실행 | 항상 실행 |
| Reverse Engineering | ⏭️ 스킵 | Greenfield |
| Requirements Analysis | ✅ 실행 | 요구사항 구체화 필요 |
| User Stories | ✅ 실행 | 3명 분업에 필수 |
| Workflow Planning | ✅ 실행 (현재) | 항상 실행 |
| Application Design | ✅ 실행 | 컴포넌트 설계 필요 |
| Units Generation | ✅ 실행 | 3명 병렬 작업 단위 정의 |

### CONSTRUCTION Phase (예정)

| 단계 | 실행 여부 | 이유 | 담당 |
|------|----------|------|------|
| Functional Design | ✅ 실행 | 번역 파이프라인 로직 설계 | Dev-A |
| NFR Requirements | ⏭️ 스킵 | 해커톤 규모에서 불필요 | - |
| NFR Design | ⏭️ 스킵 | 해커톤 규모에서 불필요 | - |
| Infrastructure Design | ⏭️ 스킵 | 로컬 실행, 인프라 없음 | - |
| Code Generation | ✅ 실행 | 핵심 구현 | 전원 |
| Build and Test | ✅ 실행 | 품질 검증 필수 | Dev-B |

### OPERATIONS Phase (예정)

| 단계 | 실행 여부 | 이유 |
|------|----------|------|
| Operations | ⚠️ 최소 실행 | 데모 웹서버 배포 + 자가발전 시연만 |

---

## Units of Work (병렬 작업 단위)

```
┌─────────────────────────────────────────────────────────────┐
│                    Unit 1: i18n Pipeline                      │
│                    (Dev-A, 독립 작업)                          │
│                                                              │
│  Figma MCP → 텍스트 추출 → 문맥 분석 → Key 생성              │
│  → EXAONE 번역 → locale JSON 출력                            │
├─────────────────────────────────────────────────────────────┤
│                    Unit 2: Quality System                     │
│                    (Dev-B, 독립 작업)                          │
│                                                              │
│  Vectra 세팅 → 검증 로직 → 용어집 자동 발견                   │
│  → 번역 메모리 → 피드백 루프                                  │
├─────────────────────────────────────────────────────────────┤
│                    Unit 3: Demo App                           │
│                    (Dev-C, 독립 작업)                          │
│                                                              │
│  React 초기화 → i18next 설정 → 컴포넌트 생성                  │
│  → 언어 전환 UI → 비교 화면 → 데모 서버                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 타임라인 (Gantt 형태)

```
시간  0h    1h    2h    3h    4h    5h    6h    7h    8h    9h    10h
      |─────|─────|─────|─────|─────|─────|─────|─────|─────|─────|
Dev-A |█ Inception ██|████████ Construction ████████████|█ Ops █|
      | MCP연동|프롬프트|  추출→번역 파이프라인  | 통합연결 |리허설 |
      |─────|─────|─────|─────|─────|─────|─────|─────|─────|─────|
Dev-B |█ Inception ██|████████ Construction ████████████|█ Ops █|
      |Vectra설치|검증설계| 검증자동화 | 용어+Vectra |통합검증|리허설|
      |─────|─────|─────|─────|─────|─────|─────|─────|─────|─────|
Dev-C |█ Inception ██|████████ Construction ████████████|█ Ops █|
      |React초기화|i18n설정| code-gen  | 데모UI완성  | 발표  |리허설|
      |─────|─────|─────|─────|─────|─────|─────|─────|─────|─────|
                                ↑
                         합류 시점 (4h 부근)
                    Dev-A locale JSON 첫 출력
```

---

## 합류 시점 & 통합 전략

### Checkpoint 1: ~4시간 (locale JSON 첫 출력)

| 이벤트 | 액션 |
|--------|------|
| Dev-A가 locale JSON 생성 | git push → main에 PR |
| Dev-B가 검증 시작 | Dev-A 출력물에 review-agent 실행 |
| Dev-C가 컴포넌트 생성 시작 | locale JSON 기반 code-gen 실행 |

### Checkpoint 2: ~7시간 (통합 테스트)

| 이벤트 | 액션 |
|--------|------|
| 3개 브랜치 통합 | main에 머지 |
| 전체 파이프라인 테스트 | Figma → 번역 → 검증 → 코드 → 데모 |
| 자가발전 시연 준비 | Vectra 데이터 확인 |

### Checkpoint 3: ~9시간 (리허설)

| 이벤트 | 액션 |
|--------|------|
| 데모 시나리오 확정 | 전원 리허설 |
| 발표 자료 최종 검토 | Dev-C 주도 |

---

## 리스크 & 대응

| 리스크 | 영향 | 대응 | 담당 |
|--------|------|------|------|
| EXAONE API 응답 지연 | 파이프라인 느림 | 캐싱 + 사전 생성 JSON 준비 | Dev-A |
| Figma 구조 파싱 실패 | 텍스트 추출 불가 | 수동 JSON fallback 준비 | Dev-A |
| Vectra 임베딩 모델 문제 | 자가발전 불가 | 로컬 sentence-transformers fallback | Dev-B |
| 컴포넌트 생성 품질 낮음 | 데모 설득력 저하 | 수동 수정 + 데모 범위 축소 | Dev-C |
| 시간 부족 | 기능 미완성 | MVP: locale JSON + 언어전환 데모만 | 전원 |

### MVP Fallback (시간 부족 시)

최소 데모 가능 범위:
1. ✅ Figma → locale JSON 4개 언어 생성 (필수)
2. ✅ 언어 전환 데모 UI (필수)
3. ⚠️ 자동 검증 리포트 (가능하면)
4. ⚠️ 자가발전 시연 (가능하면)

---

## Construction Phase 진입 조건

- [x] Requirements 확정
- [x] User Stories 작성
- [x] Workflow Planning 완료
- [ ] Application Design 완료
- [ ] Units Generation 완료

---

## 다음 단계

1. **Application Design** — 컴포넌트 구조, 서비스 레이어 설계
2. **Units Generation** — 3개 Unit의 상세 작업 분해
3. **Construction 진입** — 각자 브랜치에서 코드 생성 시작
