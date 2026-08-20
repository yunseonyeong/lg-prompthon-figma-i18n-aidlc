# 자가발전 루프 (US-2.3, US-2.4)

검증이 진행되면서 번역 품질이 향상되는 구조입니다.

## 왜 필요한가

무상태 검증기는 100번 돌려도 101번째가 나아지지 않습니다. 검증 결과가 어디에도
남지 않으면 다음 번역이 같은 실수를 반복합니다. 이 루프는 검증 결과를 축적해
다음 라운드의 입력으로 되돌립니다.

## 개선 경로 3개

| 경로 | 방식 | 성격 |
|------|------|------|
| 용어집 성장 | 반복 위반 용어를 등재 → 규칙으로 강제 | 결정론적 |
| 확정 번역 재사용 | 검증 통과 번역을 고정 → 재번역 안 함 | 결정론적 |
| 유사 사례 few-shot | 과거 확정 사례를 프롬프트에 주입 | 확률적 |

앞의 두 개가 개선의 대부분을 담당합니다. 벡터 검색은 세 번째에만 쓰입니다.

## 저장소

```
data/feedback/
├── confirmed.json           확정 번역 — 회귀 검출 및 재사용 기준
├── rejected.json            거부 이력 + 사유 — 재발 방지
├── exclusions.json          Layer 4 추출 제외 확정
├── glossary-proposals.json  용어 제안 (승인 대기/승인/거부)
└── rounds.jsonl             라운드 지표 (append only)
```

확정 번역은 벡터가 아니라 평문 JSON입니다. `key + locale`로 정확히 찾아야 하는
데이터에 유사도 검색을 쓰면 다른 항목이 1위로 올라오는 사고가 납니다.

## 라운드 흐름

```
Dev-A locale JSON 도착
   ↓
① Layer 0 사전 차단 — 이미 아는 것부터 걸러냄
   · 확정본과 다른 번역이 왔나?        → 회귀 FAIL
   · 과거 거부된 번역이 또 왔나?       → 재발 FAIL
   · 추출 제외 항목이 또 번역됐나?     → 미수정 FAIL
   · 확정본과 동일한가?               → 검증 건너뜀
   ↓
② Layer 1~4 검증 — 신규/변경 항목만
   ↓
③ 판정 기록
   PASS → confirmed 등재
   FAIL → rejected 등재 (사유 포함)
   Layer 4 → exclusions + extraction-issues.md
   ↓
④ 용어 제안 (자동 등재 안 함 — 사람 승인 게이트)
   ↓
⑤ rounds.jsonl 지표 append
```

핵심은 ①입니다. 라운드가 지날수록 ②에 도달하는 항목이 줄어듭니다.

**회귀 검출이 특히 중요합니다.** LLM은 같은 입력에도 출력이 흔들립니다.
2라운드에서 통과한 번역이 3라운드에서 망가지면 "개선"이 아니라 "요동"입니다.
확정본과 대조해 이를 잡습니다.

## 명령어

| 명령어 | 역할 |
|--------|------|
| `npm run round:check` | 사전 차단 + 검증 + 기록 + 지표 (한 라운드) |
| `npm run round:check -- --dry-run` | 저장하지 않고 결과만 확인 |
| `npm run round:check -- --reset` | 누적 상태 초기화 후 R1부터 |
| `npm run round:check -- --locales <dir>` | 다른 디렉토리 검증 |
| `npm run glossary:approve` | 용어 제안 확인 |
| `npm run glossary:approve -- --approve "Filter"` | 승인 |
| `npm run glossary:approve -- --write` | 승인분을 용어집에 반영 |
| `npm run report:evolution` | 라운드 추이 리포트 |
| `npm run report:evolution -- --md` | evolution-report.md 생성 |
| `npm run round:simulate` | 루프 동작 검증 (5라운드 시뮬레이션) |

`validate:i18n`은 무상태 검증으로 남겨뒀습니다. 축적 없이 현재 상태만 볼 때 씁니다.
검증 규칙은 `src/validation/layers.ts`를 공유하므로 두 경로의 판정이 어긋나지 않습니다.

## 실측 결과

`npm run round:simulate` 출력입니다. Dev-A가 반송을 받아 수정하는 과정을
임시 사본으로 재현한 것으로, `src/locales`는 건드리지 않습니다.

```
R1  현재 상태              검증 330 / 건너뜀   0 / FAIL 39 / WARN 4 / 회귀 0 / 재발 0 / 확정 287
R2  추출필터+제품명 수정     검증  43 / 건너뜀 287 / FAIL  0 / WARN 4 / 회귀 0 / 재발 0 / 확정 326
R3  용어집 위반 수정        검증   4 / 건너뜀 326 / FAIL  0 / WARN 0 / 회귀 0 / 재발 0 / 확정 330
R4  회귀 발생              검증   2 / 건너뜀 328 / FAIL  2 / WARN 0 / 회귀 2 / 재발 0 / 확정 328
R5  재발 (거부번역 재제출)   검증   3 / 건너뜀 327 / FAIL  3 / WARN 0 / 회귀 1 / 재발 1 / 확정 329
```

| 지표 | R1 → R3 |
|------|---------|
| FAIL | 39 → 0 |
| WARN | 4 → 0 |
| 검증 대상 | 330 → 4 (-99%) |
| 확정 누적 | 287 → 330 |

R4/R5는 의도적으로 문제를 주입한 라운드입니다. 확정본을 바꾸면 회귀 2건,
거부된 번역을 재제출하면 재발 1건이 잡히는 것을 확인했습니다.
이 두 검출이 없으면 라운드를 반복해도 품질이 우연에 좌우됩니다.

## Dev-A 연동

리트리버가 이 저장소를 읽습니다. `docs/retriever-integration.md` 참조.

```ts
const ctx = await retrieveForBatch(entries);
ctx.confirmed    // 확정 번역 → 번역 호출에서 제외
ctx.promptBlock  // 용어집 + 금지패턴 + 유사사례
```

라운드가 쌓이면 `ctx.confirmed`와 `ctx.forbidden`이 채워지면서 리트리버가
점점 강해집니다. 현재는 R1만 기록된 상태입니다.

## 주의

**용어집은 자동 등재하지 않습니다.** US-2.2 수용 기준이 "사람이 승인해야만
용어집에 등록된다"입니다. `round:check`는 제안까지만 하고, 등재는
`glossary:approve`로 사람이 판단합니다. 용어집은 Dev-A도 참조하는 공유
자산이므로 자동 변경하면 안 됩니다.

**용어집을 갱신하면 인덱스를 다시 만들어야 합니다.**

```bash
npm run glossary:approve -- --write
npm run glossary:index
```

**data/ 는 git에 올라가지 않습니다.** 재생성 가능한 파생물입니다.
단 `confirmed.json`은 라운드를 거쳐 축적된 학습 결과이므로, 팀에서 공유가
필요하면 별도 논의가 필요합니다. 현재는 로컬 전용입니다.
