# ADR-001: Vector DB로 Vectra 선택

## Status

**Accepted** — 2026-08-19

## Context

프로젝트의 자가발전 시스템(번역 이력 저장, 유사 문맥 검색, 용어집 자동 제안)을 위해 Vector DB가 필요합니다. 후보로 Vectra와 ChromaDB를 비교했습니다.

### 요구사항

- 번역 문맥/이력을 임베딩으로 저장
- 유사 문맥 검색으로 번역 일관성 향상
- 해커톤 환경에서 빠르게 세팅 가능
- 별도 서버/프로세스 없이 동작
- TypeScript 프로젝트와 자연스러운 통합

## Decision

**Vectra**를 Vector DB로 채택합니다.

## Rationale

| 기준 | Vectra | ChromaDB |
|------|--------|----------|
| 언어 호환 | ✅ TypeScript 네이티브 | ❌ Python (별도 환경 필요) |
| 설치 복잡도 | `npm install vectra` | `pip install chromadb` + Python 환경 |
| 서버 필요 | ❌ 파일 기반 | ❌ (인메모리) |
| 브라우저 지원 | ✅ IndexedDB | ❌ |
| 해커톤 적합성 | ✅ 높음 | △ Python 의존성 추가 |
| AI 에이전트 연동 | ✅ llms.txt 제공 | △ LangChain 중심 |
| 커뮤니티 규모 | △ 631 stars | ✅ 16K+ stars |

### 선택 근거

1. 프로젝트 스택(TypeScript)과 동일 생태계 — 추가 런타임 불필요
2. 파일 기반 저장 — 해커톤에서 DB 서버 세팅 없이 즉시 사용
3. 브라우저 지원 — 데모 웹앱에서 Vector 검색까지 시연 가능
4. sub-millisecond 쿼리 — 소규모 인덱스에서 실시간 응답

### 기각 사유 (ChromaDB)

- Python 의존성 추가로 프로젝트 복잡도 증가
- 해커톤 시간 내 환경 세팅 리스크
- TypeScript 프로젝트에서 별도 프로세스로 관리해야 함

## Consequences

### 긍정적

- 단일 언어(TypeScript)로 전체 스택 유지
- `npm install` 한 줄로 설치 완료
- 데모 시 브라우저에서도 Vector 검색 시연 가능
- 번역 이력이 로컬 폴더에 저장되어 git으로 추적 가능

### 부정적/리스크

- 커뮤니티 규모가 ChromaDB 대비 작음 (문제 발생 시 레퍼런스 부족 가능)
- 대규모 데이터(수만 건 이상) 시 성능 미검증 (해커톤 규모에서는 문제 없음)
- 프로덕션 전환 시 재평가 필요

## Implementation

```typescript
import { LocalDocumentIndex } from 'vectra';

// 번역 메모리 인덱스
const translationMemory = new LocalDocumentIndex({
  folderPath: './data/translation-memory',
  embeddings: /* EXAONE or LocalEmbeddings */,
});

// 용어집 인덱스
const glossaryIndex = new LocalDocumentIndex({
  folderPath: './data/glossary-index',
  embeddings: /* EXAONE or LocalEmbeddings */,
});
```

## Related

- `requirements/tech-env.md` — 기술 스택 정의
- `requirements/vision.md` — 자가발전 요구사항 (질문 10-3, 10-4)
