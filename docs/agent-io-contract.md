# 에이전트 입출력 계약 (Dev-B)

`review-agent`와 `glossary-agent`가 각각 무엇을 읽고 무엇을 만드는지 정의합니다.

```bash
kiro-cli chat --agent review-agent      # Ctrl+Shift+R
kiro-cli chat --agent glossary-agent    # Ctrl+Shift+G
```

---

## 설계 원칙: 에이전트는 판단, 스크립트는 계산

두 에이전트 모두 **locale 파일을 눈으로 훑어 위반을 추측하지 않습니다.** 결정론적
검증기를 실행해 그 숫자를 보고합니다. LLM 판단은 스크립트가 할 수 없는 일에만 씁니다.

이유는 재현성입니다. 같은 입력에 같은 숫자가 나와야 라운드 간 비교가 성립하고,
"FAIL 39 → 12로 줄었다"는 주장이 의미를 갖습니다.

| 역할 | 담당 |
|------|------|
| 규칙 위반 검출, 카운트, 라우팅 대상 결정 | 스크립트 (결정론적) |
| 문맥 오역 판정, 용어 등재 타당성, 에스컬레이션 판단 | 에이전트 (LLM) |

---

## review-agent

### 입력

| 파일 | 필수 | 용도 |
|------|------|------|
| `src/locales/*.json` | ✓ | 검증 대상 (en 필수) |
| `requirements/domain-glossary.md` | ✓ | 검증 기준 (48 용어 + 제품명 8) |
| `data/feedback/*` | — | 누적 상태. 없으면 R1로 시작 |
| `data/translation-memory/` | — | 유사 번역 검색용. 없으면 해당 기능만 비활성 |
| `aidlc-docs/construction/build-and-test/i18n-verification-spec.md` | — | 4계층 명세 (참조) |

### 실행하는 명령어

| 명령어 | 용도 |
|--------|------|
| `npm run round:check` | 사전차단 + 4계층 + 판정 기록 + 지표 (권장) |
| `npm run round:check -- --dry-run` | 저장 없이 결과만 |
| `npm run validate:i18n` | 무상태 4계층 |
| `npm run glossary:audit` | Layer 2만 |
| `npm run report:evolution` | 라운드 추이 |
| `npm run memory:search -- "text"` | 유사 번역 조회 |

### 출력

| 파일 | 생성 시점 | 받는 사람 |
|------|-----------|-----------|
| `i18n-report.md` | 매 검증 | 전원 |
| `extraction-issues.md` | Layer 4 검출 시 | **Dev-A (추출 필터)** |
| `evolution-report.md` | `report:evolution -- --md` | 전원 (데모용) |
| `data/feedback/confirmed.json` | `round:check` | 리트리버 → Dev-A |
| `data/feedback/rejected.json` | `round:check` | 리트리버 → Dev-A |
| `data/feedback/exclusions.json` | `round:check` | 자체 (미수정 추적) |
| `data/feedback/rounds.jsonl` | `round:check` | 추이 리포트 |

### 하지 않는 것

`src/locales/*.json`을 직접 수정하지 않습니다. Dev-A의 산출물이고, 검증자가 대상을
고치면 검증의 의미가 없어집니다. 보고와 라우팅만 합니다.

### 라우팅 규칙

| Layer | 검출 | 담당 |
|-------|------|------|
| 0 | 회귀 / 재발 / 제외 미수정 | Dev-A |
| 1 | key 불일치, placeholder 손실 | Dev-A |
| 2 | 용어집 위반, 제품명 번역, ON/OFF | Dev-A / Dev-B |
| 3 | 문맥 오역 | Dev-B → Dev-A |
| 4 | 번역 대상 아닌 텍스트 | **Dev-A (추출 필터)** |
| 부가 | 원문 오타 | 디자이너 |

**Layer 4는 번역을 고쳐서 해결하면 안 됩니다.** 애초에 추출되면 안 됐던 항목이라
번역을 개선해도 다음 라운드에 또 나옵니다. `extraction-issues.md`로 반송합니다.

---

## glossary-agent

### 입력

| 파일 | 필수 | 용도 |
|------|------|------|
| `requirements/domain-glossary.md` | ✓ | 용어집 원본 |
| `src/locales/*.json` | ✓ | 위반 검사 대상 |
| `data/feedback/glossary-proposals.json` | — | 승인 대기 제안 |
| `glossary-proposal.md` | — | Dev-A의 1차 후보 목록 |

### 실행하는 명령어

| 명령어 | 용도 |
|--------|------|
| `npm run glossary:audit` | Layer 2 위반 검사 |
| `npm run glossary:approve` | 승인 대기 목록 |
| `npm run glossary:approve -- --approve "Term"` | 승인 (사용자 지시 시에만) |
| `npm run glossary:approve -- --reject "Term"` | 거부 |
| `npm run glossary:approve -- --write` | 승인분을 용어집에 반영 |
| `npm run glossary:index` | **용어집 수정 후 필수** |

### 출력

| 파일 | 생성 시점 |
|------|-----------|
| `data/feedback/glossary-proposals.json` | 승인/거부 상태 갱신 |
| `requirements/domain-glossary.md` | `--write` 시 §11 섹션에 추가 |
| `data/glossary-index/` | `glossary:index` 시 재생성 |

### 승인 게이트 (US-2.2)

수용 기준이 "사람이 승인해야만 용어집에 등록된다"입니다. 에이전트는 **근거와 추천만
제시하고 사용자 지시 없이 `--approve` / `--write`를 실행하지 않습니다.**

용어집은 Dev-A 파이프라인이 하드 제약으로 읽습니다. 조용히 바꾸면 Dev-A의 출력이
바뀝니다. 그래서 승인은 사람이 합니다.

### 용어집 수정 후 반드시

```bash
npm run glossary:approve -- --write
npm run glossary:index      # 안 하면 벡터 인덱스가 낡은 용어집 기준으로 남음
```

---

## 두 에이전트의 경계

겹치는 영역이 Layer 2입니다. 구분은 이렇습니다.

| 상황 | 담당 |
|------|------|
| 등록된 용어를 Dev-A가 안 지켰다 | review-agent → Dev-A 반송 |
| 용어집에 없어서 계속 어긋난다 | glossary-agent → 등재 제안 |
| 제품명이 번역됐다 | review-agent → Dev-A 반송 (등재 불필요) |
| 새 표현이 반복 등장한다 | glossary-agent → 승인 요청 |

`round:check`가 반복 위반 용어를 집계해 주므로, 어느 쪽인지 판단할 근거는 스크립트가
제공합니다.

---

## 실행 검증 결과

갱신된 설정으로 두 에이전트를 실제 실행해 확인했습니다.

**review-agent** — `validate:i18n`, `glossary:audit`, `round:check` 세 개를 실행하고
계층별 숫자를 스크립트 산출값 그대로 보고했습니다. `glossary:audit`의 Layer 2 결과
(FAIL 6 / WARN 4)가 `validate:i18n`과 일치하는지 교차 확인까지 했습니다.
Layer 4 항목 11개를 표로 정리해 "번역으로 고치면 안 된다"는 처리 경로를 명시했습니다.
R1에서 이미 반송한 항목이 미수정임을 감지해 에스컬레이션 대상으로 표시했습니다.

**glossary-agent** — `glossary:audit`, `glossary:approve`, `round:check --dry-run`을
실행했습니다. 파일을 수정하지 않았고(dry-run), 승인 대기 2건에 대해 **둘 다 거부를
권장**했습니다. 근거는 `Settings`/`Delete`가 도메인 고유 용어가 아니라 범용 UI 단어이고,
어떤 번역 모델도 일관되게 번역하므로 등재해도 오역 방지 효과가 없다는 것입니다.
Dev-A의 `glossary-proposal.md` 16건 중 2건만 시스템 제안으로 남은 이유도 설명했습니다.

---

## 이전 설정의 문제 (수정 완료)

참고용으로 남깁니다. 같은 실수를 반복하지 않기 위한 기록입니다.

| 문제 | 영향 | 수정 |
|------|------|------|
| 두 에이전트가 `.kiro/steering/domain-glossary.md`를 참조 | **그 파일은 존재하지 않음.** 용어집 없이 리뷰 수행 | `requirements/domain-glossary.md`로 교정 |
| glossary-agent 훅이 없는 파일을 `cat` | 매번 `0 terms loaded` 출력, 아무도 눈치채지 못함 | `npm run stats`로 교체 (실제 로더 사용) |
| 두 에이전트에 `shell` 도구 없음 | 검증 스크립트를 실행할 수 없어 눈대중 리뷰만 가능 | `shell` 추가 (allowedTools에는 미포함 → 실행 시 승인 필요) |
| review-agent에 `write` 도구 없음 | 리포트 파일 작성 불가 | `write` 추가 |
| 프롬프트가 4계층 명세·루프·스크립트를 모름 | 임의 기준으로 리뷰, 라운드 간 숫자 비교 불가 | 프롬프트 전면 교체 |

첫 번째 항목이 가장 위험했습니다. 에이전트가 용어집을 로드하지 못한 상태로 "용어집
일치율 95%" 같은 보고를 내고 있었고, 실제 결정론적 검증 결과와 달랐습니다.
