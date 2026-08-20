# ADR-002: 임베딩 모델로 multilingual-e5-small 선택

## Status

**Accepted** — 2026-08-20

ADR-001의 미결 항목을 확정합니다. ADR-001 Implementation 절에 남아 있던
`embeddings: /* EXAONE or LocalEmbeddings */` 주석이 이 결정으로 해소됩니다.

## Context

ADR-001에서 Vectra를 채택했으나 임베딩 생성 주체를 정하지 않았습니다.
번역 메모리와 용어집 인덱스는 임베딩이 있어야 동작합니다.

초기에는 해시 기반 TF 벡터(384d)로 구현해 두었으나, 자체 테스트셋에서
Recall@1이 47%에 머물렀습니다. 특히 다음이 검색되지 않았습니다.

- 동의어: `remove` → `Delete` (글자 겹침 0)
- 의역: `industry category` → `Vertical Type`
- 오타: `Licence Policys` → `License Policy` (점수 0.77 → 0.11로 붕괴)

`tech-env.md`가 허용한 EXAONE(Friendli)을 우선 검토했습니다.

## Decision

**`Xenova/multilingual-e5-small`** (ONNX, 384차원)을 `@huggingface/transformers`로
**로컬 실행**합니다.

## Rationale

### EXAONE / Friendli 임베딩은 사용 불가 (실측)

```
POST https://api.friendli.ai/dedicated/v1/embeddings  (model=depe675tjc2rcpo)
→ 422 {"message":"This model does not support the embedding endpoint"}

POST https://api.friendli.ai/serverless/v1/embeddings (bge-m3, e5-large 등)
→ 404 {"detail":"Model ... not found."}

GET /serverless/v1/models → 7개 모델 전부 mode=chat, 임베딩 모델 0개
```

엔드포인트 자체는 존재하나 접근 가능한 모델이 모두 채팅 모델입니다. 임베딩을
쓰려면 임베딩 전용 엔드포인트를 새로 프로비저닝해야 하고, GPU 할당과 과금이
발생해 해커톤 범위를 넘습니다.

### 후보 비교 (자체 테스트셋 17건, 코퍼스 107건)

| 모델 | 차원 | R@1 | R@3 | MRR | 재인덱싱 | 쿼리 | 크기 |
|------|------|-----|-----|-----|---------|------|------|
| hash-local (초기) | 384 | 47% | 65% | 0.568 | 4ms | 0ms | 0 |
| paraphrase-multilingual-MiniLM-L12-v2 | 384 | 50% | 61% | 0.565 | 2s | 4ms | 130MB |
| **multilingual-e5-small** | **384** | **76%** | **88%** | **0.826** | **1.7s** | **4ms** | **130MB** |
| multilingual-e5-base | 768 | 78% | 83% | 0.811 | 3.5s | 8ms | 283MB |

카테고리별 Recall@1 (e5-small): 완전일치 2/2, 오타 2/2, 동의어 1/2,
의역 1/3, 교차언어 4/5, 도메인함정 3/3

### 선택 근거

1. 초기 대비 R@1 +29pp. 동의어·의역·교차언어 검색이 실제로 동작
2. **384차원이라 기존 인덱스 차원 유지** — 교체 비용이 `textToVector()` 하나
3. e5-base는 +2pp에 그치는데 용량 2.2배, 인덱싱 1.8배. 해커톤 규모에서 비경제적
4. paraphrase-MiniLM은 같은 130MB에 R@1 22pp 낮음. 특히 교차언어 2/5로
   해시(3/5)보다 나빠 기각
5. **무료** — 모델 MIT, 라이브러리 Apache-2.0. API 키·과금·네트워크 의존 없음

### 다국어 정렬이 필수 조건

인덱싱 대상이 영문 원문 + 한국어 문맥설명 + ko/ja/zh 번역이 섞인 텍스트입니다.
영어 전용 모델(`all-MiniLM-L6-v2` 등)은 후보에서 제외했습니다.

교차언어 검색이 되는 것은 절반은 설계 덕입니다. 코퍼스 임베딩 텍스트를
`"영문 원문 / 한국어 번역"`으로 결합해 넣었습니다. 이 설계는 모델과 별개로
유지해야 합니다.

## Consequences

### 긍정적

- 의미 기반 검색이 실제로 동작 (`remove` → `삭제` 0.87)
- 오프라인 동작. 데모 중 네트워크 장애에 영향 없음
- 비용 0, API 키 관리 불필요

### 부정적 / 제약

- **prefix 필수**: 문서에 `passage: `, 질의에 `query: `. 누락 시 성능 저하.
  `src/retrieval/embedder.ts`에 캡슐화해 호출부에서 실수할 여지를 없앰
- **점수 분포가 0.7~1.0에 몰림** (InfoNCE 낮은 temperature). 0.5/0.7 같은
  임계값은 아무것도 걸러내지 못함. 실측으로 0.84를 채택
  (precision 92.3% / recall 92.3%)
- 최초 실행 시 130MB 다운로드. 이후 `node_modules/.cache`에 캐시
- 해시 벡터와 좌표계가 달라 혼용 시 검색이 무의미. `.embedder.json`으로
  인덱스별 방식을 기록하고 불일치를 감지
- 모델 로드 실패 시 해시로 fallback. 정확도는 떨어지나 죽지 않음

## Alternatives Considered

| 대안 | 기각 사유 |
|------|-----------|
| EXAONE/Friendli 임베딩 API | 임베딩 지원 모델 없음 (실측 확인) |
| 외부 임베딩 API (OpenAI 등) | `tech-env.md` 허용 서비스 목록에 없음 |
| Friendli에 임베딩 엔드포인트 신규 프로비저닝 | GPU 할당 + 과금, 해커톤 시간 내 리스크 |
| e5-base (768d) | +2pp 대비 용량 2.2배 |
| paraphrase-multilingual-MiniLM | 같은 용량에 R@1 22pp 낮음, 교차언어 열세 |
| 해시 TF 벡터 유지 | 동의어·의역 검색 불가 (R@1 47%) |
| EXAONE 채팅을 리랭커로 사용 | 검색당 API 호출로 지연, 후보 리콜 한계 잔존 |

## Verification

```bash
npm run bench:embed       # 모델 비교 (Recall@1/@3, MRR, 시간)
npm run bench:threshold   # 임계값 실증 (precision/recall)
```

측정 스크립트를 커밋해 두어 재현 가능합니다.
테스트셋 정답이 코퍼스에 실재하는지 검증하는 로직을 포함했습니다
(초기 테스트셋에 `Withdraw`처럼 en.json에 없는 정답이 섞여 있었음).

## Related

- ADR-001 — Vector DB로 Vectra 선택
- `src/retrieval/embedder.ts` — prefix 처리, fallback, 임계값 상수
- `src/retrieval/index-meta.ts` — 임베딩 방식 혼용 방지
- `requirements/tech-env.md` — 허용 클라우드 서비스
