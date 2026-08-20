# 리트리버 통합 가이드 (Dev-B → Dev-A)

번역 직전에 호출해서 프롬프트에 넣을 컨텍스트를 받아가는 함수입니다.
`src/retrieval/`에 있고 외부 의존성 추가는 필요 없습니다.

## 2줄 요약

```ts
import { initRetriever, retrieveForBatch } from '../retrieval/index.js';

await initRetriever();                        // 파이프라인 시작 시 1회
const ctx = await retrieveForBatch(entries);  // translateBatch 안에서 배치마다
```

## 적용 위치

`translateBatch()` 안, `fetch()` 직전입니다.

```ts
async function translateBatch(
  entries: I18nEntry[],
  glossary: Record<string, Record<string, string>>,
  contextEntries: I18nEntry[] = []
): Promise<I18nEntry[]> {

  // ① 컨텍스트 검색
  const ctx = await retrieveForBatch(
    entries.map((e) => ({ key: e.key, source: e.source, context: e.context, role: e.role }))
  );

  // ② 확정된 항목은 번역하지 않고 재사용 (선택이지만 권장)
  const needTranslation = entries.filter((e) => !ctx.confirmed[e.key]);
  for (const e of entries) {
    const c = ctx.confirmed[e.key];
    if (c) {
      e.translations = { en: e.source.trim(), ...c } as typeof e.translations;
    }
  }
  if (needTranslation.length === 0) return entries;   // API 호출 자체가 불필요

  // ③ 프롬프트에 블록 삽입
  const prompt = `...
${ctx.promptBlock}

TEXTS TO TRANSLATE:
${textsToTranslate}
...`;
}
```

`I18nEntry`가 `key/source/context/role`을 이미 가지고 있어서 그대로 넘기면 됩니다.

## 반환값

| 필드 | 타입 | 용도 |
|------|------|------|
| `confirmed` | `{ [key]: { ko?, ja?, 'zh-CN'? } }` | 검증 통과한 확정 번역. 재번역하면 회귀 |
| `promptBlock` | `string` | 프롬프트에 그대로 삽입. 비면 `''` |
| `glossaryTerms` | `GlossaryHit[]` | 이 배치 원문에 등장한 용어집 항목만 |
| `forbidden` | `ForbiddenHit[]` | 과거 거부된 번역 + 사유 |
| `similar` | `SimilarHit[]` | 의미가 가까운 과거 확정 사례 |
| `stats` | 객체 | 진단용. `degraded`가 true면 축소 동작 중 |

`promptBlock`은 내용이 있는 섹션만 조립합니다. 현재 4종입니다.

```
GLOSSARY (MANDATORY — apply even inside longer phrases):
  "Workspace" → ko: "워크스페이스", ja: "ワークスペース", zh-CN: "工作区"   // Business Site 하위 작업 단위

PREVIOUSLY REJECTED — do NOT repeat these translations:
  "Art Lounge" [ko] ✗ "아트 라운지" — 제품명 번역 금지 (glossary §7) → use "Art Lounge"

SIMILAR APPROVED TRANSLATIONS (reference for consistency):
  "Delete" → ja: "削除"

ALREADY APPROVED — reuse verbatim, do not re-translate:
  console.setting.group.button.save → ko: "저장", ja: "保存"
```

## 보장사항

**절대 throw하지 않습니다.** 피드백 저장소가 없거나 인덱스가 없거나 임베딩 모델
로드가 실패해도 빈 컨텍스트를 반환합니다. 리트리버 때문에 파이프라인이 죽는 일은
없습니다. 문제가 있으면 `ctx.stats.degraded`와 `ctx.stats.notes`로 알립니다.

**기존 `glossary` 인자를 대체하지 않습니다.** 현재 쓰고 있는 `runningGlossary`
누적 로직과 병행 가능합니다. `ctx.glossaryTerms`는 이 배치 원문에 실제로 등장한
용어만 담아서 전체 용어집을 넣는 것보다 프롬프트가 짧습니다.

## 성능

4건 배치 기준 45ms입니다. 대부분 벡터 검색(항목당 약 4ms)이고 결정론적 채널은
1ms 미만입니다. 배치 10건이면 100ms 내외로, EXAONE 호출 시간에 비하면 무시할 수준입니다.

첫 `initRetriever()` 호출 때 임베딩 모델을 로드합니다(캐시된 상태에서 약 1초).
최초 실행 시에는 모델 130MB를 다운로드합니다.

## 알아둘 점

**프롬프트 부풀림 주의.** 컨텍스트를 많이 넣으면 EXAONE이 정작 중요한 용어집
규칙을 흘립니다. 유사 사례는 배치당 5건으로 제한했고 유사도 0.84 이상만 채택합니다.
조정이 필요하면 `initRetriever({ maxSimilar: 3, minScore: 0.86 })`로 바꿀 수 있습니다.

**벡터 검색을 끄고 싶으면** `initRetriever({ disableVectorSearch: true })`입니다.
용어집·확정번역·금지패턴은 그대로 동작합니다.

**확정 번역이 쌓이기 전에는** `confirmed`가 비어 있습니다. 검증 라운드가 돌면서
채워집니다. 지금은 용어집 + 유사 사례만 반환합니다.

## 확인 방법

```bash
npm run retriever:demo    # 실제 인덱스로 동작 확인, promptBlock 출력
npx vitest run src/retrieval/    # 계약 테스트 12건
```

인덱스가 없으면 먼저 생성해야 합니다.

```bash
npm run init:vectra && npm run reindex
```

## 요청사항

`confirmed`를 실제로 반영해 주시면 좋겠습니다. 이게 회귀를 막는 핵심입니다.
LLM은 같은 입력에도 출력이 흔들리는데, 2라운드에서 통과한 번역이 3라운드에서
망가지면 검증이 앞으로 못 나갑니다. 확정된 항목은 번역을 건너뛰는 게
품질과 API 비용 양쪽에 이득입니다.
