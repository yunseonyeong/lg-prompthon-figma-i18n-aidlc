# 테스트 가이드 (PR 리뷰어 / Dev-A / Dev-C)

`feat/review-glossary-vectra` 브랜치 검증 방법입니다.
아래 절차는 **깨끗한 클론에서 실제로 실행해 확인**했습니다.

## 0. 준비 (2분)

```bash
git fetch origin
git checkout feat/review-glossary-vectra
npm install
```

`npm warn install-scripts` 경고가 나오는 건 정상입니다. 무시해도 됩니다.

> ⚠️ **`data/` 디렉토리는 git에 없습니다.** 재생성 가능한 파생물이라 제외했습니다.
> 벡터 검색을 쓰는 항목(5, 6번)을 테스트하려면 3번을 먼저 실행하세요.

---

## 1. 타입체크 + 단위 테스트 (30초)

인덱스나 모델 없이 바로 됩니다.

```bash
npx tsc --noEmit     # 또는 npm run typecheck
npm run test:run
```

기대 결과:

```
Test Files  3 passed (3)
     Tests  59 passed (59)
```

> `npm test`는 watch 모드로 떠서 안 끝납니다. `npm run test:run`을 쓰세요.

테스트 구성: 검증 계층 24건 + 자가발전 루프 23건 + 리트리버 12건

---

## 2. 검증 실행 (10초)

```bash
npm run validate:i18n     # 4계층 검증
npm run glossary:audit    # 용어집 위반만
```

기대 결과:

```
Layer 1: 구조적 결함        PASS
Layer 2: 용어집 위반        FAIL=6, WARN=4
Layer 3: 문맥 오역          PASS (원문 오타 1건 INFO)
Layer 4: 번역 제외 대상      FAIL=33
총계: FAIL=39, WARN=4, INFO=1
```

> **exit code 1이 정상입니다.** FAIL을 찾았다는 뜻입니다. 스크립트 오류가 아닙니다.
> 두 명령어의 Layer 2 결과(FAIL 6 / WARN 4)가 일치하는지 봐주세요.
> 규칙을 공유 모듈로 통합한 부분이라, 어긋나면 버그입니다.

생성물: `i18n-report.md`, `extraction-issues.md`

---

## 3. Vectra 인덱스 생성 (15초, 최초 1회)

```bash
npm run init:vectra
npm run reindex
```

기대 결과:

```
✅ translation-memory — 생성 완료
✅ glossary-index — 생성 완료
✅ 임베딩 완료 (9.9s, Xenova/multilingual-e5-small (384d))   ← 용어집 144건
✅ 임베딩 완료 (2.3s, Xenova/multilingual-e5-small (384d))   ← 번역메모리 330건
```

최초 실행 시 임베딩 모델 130MB를 다운로드합니다(약 10초, 네트워크에 따라 변동).
이후 `node_modules/@huggingface/transformers/.cache`에 캐시되어 오프라인으로 동작합니다.
API 키 불필요, 비용 없음 (모델 MIT 라이선스).

---

## 4. 자가발전 루프 (20초) ★ 핵심

```bash
npm run round:simulate
```

Dev-A가 반송을 받아 수정하는 과정을 5라운드로 재현합니다.
**`src/locales`는 건드리지 않고** 임시 사본으로 검증하므로 안전합니다.

기대 결과:

```
R1 현재 상태            검증 330 / 건너뜀   0 / FAIL 39 / 회귀 0 / 재발 0 / 확정 287
R2 추출필터+제품명 수정   검증  43 / 건너뜀 287 / FAIL  0 / 회귀 0 / 재발 0 / 확정 326
R3 용어집 위반 수정      검증   4 / 건너뜀 326 / FAIL  0 / 회귀 0 / 재발 0 / 확정 330
R4 회귀 발생            검증   2 / 건너뜀 328 / FAIL  2 / 회귀 2 / 재발 0 / 확정 328
R5 재발                검증   3 / 건너뜀 327 / FAIL  3 / 회귀 1 / 재발 1 / 확정 329

✅ FAIL 감소 / 검증대상 감소 / 확정 증가 / 회귀 검출 / 재발 검출 / WARN 비증가
✅ 자가발전 루프 정상 동작
```

봐주실 포인트는 **검증 대상이 330 → 4로 줄어드는 것**입니다.
확정된 번역이 쌓여 재검증이 불필요해졌다는 의미입니다.

R4/R5는 일부러 문제를 주입한 라운드입니다.
확정본을 바꾸면 회귀, 거부된 번역을 다시 내면 재발로 잡힙니다.
이게 없으면 라운드를 반복해도 품질이 우연에 좌우됩니다.

추이 확인:

```bash
npm run report:evolution          # 콘솔 표 + 막대그래프
npm run report:evolution -- --md  # evolution-report.md 생성
```

> `round:simulate`는 `data/feedback/`을 초기화합니다.
> 누적 상태를 유지하려면 `npm run round:check`를 쓰세요.

---

## 5. Dev-A: 리트리버 확인 (10초)

```bash
npm run retriever:demo
```

기대 결과:

```
벡터 검색   : 활성
용어집 규칙 : 2건
유사 사례   : 4건
degraded    : false
프롬프트 블록 크기: 1003자
```

`promptBlock` 전문이 출력됩니다. EXAONE 프롬프트에 그대로 넣는 문자열입니다.

**연동 방법은 `docs/retriever-integration.md`에 코드로 적어뒀습니다.**
`translateBatch()` 안 `fetch()` 직전에 2줄 추가하는 형태입니다.

```ts
await initRetriever();                        // 파이프라인 시작 시 1회
const ctx = await retrieveForBatch(entries);  // 배치마다
```

`I18nEntry`가 이미 `key/source/context/role`을 갖고 있어 그대로 넘기면 됩니다.

확인 부탁드릴 것:

1. `ctx.confirmed`를 반영해 주세요. 확정된 항목은 번역을 건너뛰면 회귀가 원천 차단되고 API 비용도 줍니다
2. `extraction-issues.md`의 11개 key — 추출 필터에서 제외해 주세요. **번역을 고쳐서 해결하면 안 됩니다.** 애초에 추출되면 안 됐던 항목입니다 (`Business A`, `supporting text`, `Label` 등 더미/샘플)

리트리버는 **절대 throw하지 않습니다.** 저장소·인덱스·모델이 없어도 빈 컨텍스트를 반환하고 `ctx.stats.degraded`로 알립니다. 제 코드 결함으로 파이프라인이 멈추지 않습니다.

---

## 6. Dev-C: 앱이 안 깨졌는지 (5초)

```bash
npx vite build
```

기대 결과:

```
✓ 65 modules transformed.
✓ built in ~900ms
```

**`tsconfig.json`이 충돌했어서 병합했습니다.** Dev-C 설정을 기준으로 두고
`include`에 `scripts`를 추가했습니다. `include: ["src"]`만 두면 제 스크립트가
타입체크에서 빠지기 때문입니다. `noUnusedLocals` 등 엄격 설정은 그대로 유지했습니다.

앱 코드는 건드리지 않았습니다. 빌드가 깨지면 알려주세요.

---

## 7. 번역 메모리 검색 (선택)

```bash
npm run memory:search -- "remove" --locale ko --top 3
npm run memory:search -- "산업 분야" --top 3        # 한국어로 검색해도 걸림
npm run memory:search -- "remove" --min 0.84       # 임계값 적용
```

`remove` → `Delete`/`삭제`가 1위로 나오면 정상입니다.
글자가 하나도 겹치지 않는데 찾아내는 게 임베딩 교체 효과입니다.

---

## 명령어 요약

| 명령어 | 소요 | 인덱스 필요 |
|--------|------|------------|
| `npm run test:run` | 2초 | ✗ |
| `npm run typecheck` | 5초 | ✗ |
| `npm run validate:i18n` | 3초 | ✗ |
| `npm run glossary:audit` | 3초 | ✗ |
| `npm run init:vectra` + `reindex` | 15초 | (생성) |
| `npm run round:check` | 3초 | ✗ |
| `npm run round:simulate` | 15초 | ✗ |
| `npm run report:evolution` | 1초 | ✗ |
| `npm run retriever:demo` | 10초 | ✓ |
| `npm run memory:search -- "..."` | 5초 | ✓ |
| `npm run glossary:approve` | 1초 | ✗ |

---

## 알아두실 것

**검증 명령어의 exit 1은 정상입니다.** FAIL을 찾았다는 뜻입니다. CI에 붙일 때는 이 동작이 의도된 것입니다.

**용어집은 자동으로 안 바뀝니다.** 승인 대기 2건(`Settings`, `Delete`)이 있습니다. `npm run glossary:approve`로 확인 가능하고, 등재는 사람이 판단합니다 (US-2.2 수용 기준). 용어집은 Dev-A도 참조하는 공유 자산이라 자동 변경하지 않습니다.

**용어집을 수정하면 인덱스를 다시 만들어야 합니다.**

```bash
npm run glossary:approve -- --write
npm run glossary:index
```

**`data/`를 지워도 됩니다.** 재생성 가능합니다.

```bash
rm -rf data && npm run init:vectra && npm run reindex
```

---

## 상세 문서

| 문서 | 내용 |
|------|------|
| `docs/retriever-integration.md` | Dev-A 연동 가이드 (코드 예시 포함) |
| `docs/self-improving-loop.md` | 자가발전 루프 설계와 실측 |
| `aidlc-docs/construction/build-and-test/i18n-verification-spec.md` | 4계층 검증 명세 |
