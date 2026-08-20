# 번역 메모리 (Vectra) 인터페이스 계약

> **구현 담당**: Dev-B (US-2.3)
> **호출 담당**: Dev-A (파이프라인)
> **작성**: Dev-A → Dev-B 전달
> **목적**: 시그니처를 먼저 확정해 두 사람이 서로 기다리지 않고 병렬 작업

---

## 1. 왜 필요한가 (근거 데이터)

Figma `zdG3CHXVU6TzD4cc28o5Yb` Scenario 페이지 실측:

| 항목 | 값 |
|------|-----|
| UI 텍스트 총량 | 7,830건 |
| 고유 텍스트 | 990건 |
| **완전 중복률** | **87.4%** |

990건만 번역하면 7,830건이 커버된다. 번역 메모리의 효과가 매우 큰 구조다.

유사 텍스트 군집도 존재한다 (few-shot 검색의 근거):

```
"Business Site ..."  14개 변형
"IAM > ..."          30개 변형
"Access Group ..."    9개 변형
"Search for ..."      7개 변형
```

### 현재 해결되지 않은 문제

| 문제 | 현재 상태 | Vectra 기여 |
|------|-----------|------------|
| 번역 비결정성 (재실행 시 5건 변동) | 미해결 | 캐시로 직접 해결 |
| 용어집 미등록 신규 용어 오역 | 미해결 | few-shot으로 완화 |
| 구분 소실 (`Settings`/`Setting` 둘 다 "설정") | 미해결 | 의미 유사도로 검출 |
| 문맥 오역 (`Vertical Type` 유형) | 용어집 등록으로 사후 대응 | 사전 탐지 |

---

## 2. 역할 경계

```
Dev-A 파이프라인                         Dev-B Vectra
──────────────────                      ──────────────
① 번역 전 조회      ── lookup() ────────→  인덱스
② few-shot 요청  ── findSimilar() ──────→  인덱스
③ 문맥 요청   ── findSimilarScreen() ───→  인덱스

                                          ④ save()
                                          검증 PASS 후 Dev-B가 호출
```

Dev-A는 ①②③만 호출한다. **④ `save()`는 Dev-B가 검증 파이프라인에서 호출한다.**
이유는 6절 참조.

| 구분 | Dev-B | Dev-A |
|------|-------|-------|
| 임베딩 모델 선정·설치 | ✅ | |
| 인덱스 스키마·생성·갱신 | ✅ | |
| 검색 구현 | ✅ | |
| 확정 번역 저장 | ✅ | |
| 충돌 탐지 (L2-02/L2-03) | ✅ | |
| 신규 용어 발견 | ✅ | |
| 번역 시점 조회·주입 | | ✅ |
| 형제 필드 추출·가공 | | ✅ |
| fallback 처리 | | ✅ |

---

## 3. 인터페이스 (Dev-B 구현 대상)

```typescript
// src/memory/translation-memory.ts (파일 위치는 Dev-B 재량)

export interface TranslationRecord {
  /** i18n key. 예: console.setting.group.label.businessSiteInformation */
  key: string;
  /** 영문 원문 */
  source: string;
  /** 문맥 문자열. Dev-A가 "{frameName} > {role}" 형태로 전달 */
  context: string;
  /** Figma 프레임 정보 */
  frameName: string;
  frameId: string;
  /** title | label | button | status | placeholder | description | message */
  role: string;
  /** 언어별 번역. en은 원문과 동일 */
  translations: {
    en: string;
    ko: string;
    ja: string;
    'zh-CN': string;
  };
  /** 검증 통과 여부. confirmed만 조회 결과에 포함해야 한다 */
  status: 'confirmed' | 'pending' | 'rejected';
  /** 검증 시각 (ISO 8601) */
  verifiedAt?: string;
  /** 적용된 용어집 항목. 디버깅·감사용 */
  glossaryTermsApplied?: string[];
}

export interface ScreenContext {
  frameId: string;
  frameName: string;
  /** 해당 프레임의 형제 텍스트 목록 */
  siblingTexts: string[];
  /** 화면 유형 라벨. 예: 'B2B 파트너 등록', '라이선스 할당' */
  screenType?: string;
  /** 이 화면에서 확정된 문맥 판정. 오역 방지의 핵심 자산 */
  disambiguations: Array<{
    term: string;       // 'Vertical'
    meaning: string;    // '업종/산업 분야'
    rejected?: string;  // '화면 방향'  (흔한 오역)
  }>;
  /** 코사인 유사도 0~1 */
  similarity: number;
}

export interface TranslationMemory {
  /**
   * ① 정확 일치 조회 (캐시)
   * source + context가 모두 일치하고 status가 'confirmed'인 레코드를 반환.
   * 없으면 null.
   * 임베딩 검색이 아니라 정확 매칭이어야 한다 (결정적 동작 보장).
   */
  lookup(source: string, context: string): Promise<TranslationRecord | null>;

  /**
   * ② 유사 사례 검색 (few-shot 예시용)
   * status가 'confirmed'인 것만 반환.
   * 유사도 내림차순. threshold 미달은 제외.
   */
  findSimilar(
    source: string,
    options?: { limit?: number; minSimilarity?: number }
  ): Promise<TranslationRecord[]>;

  /**
   * ③ 화면 문맥 검색 (오역 방지용)
   * 형제 텍스트 묶음과 유사한 과거 화면을 반환.
   */
  findSimilarScreen(
    siblingTexts: string[],
    options?: { limit?: number; minSimilarity?: number }
  ): Promise<ScreenContext[]>;

  /**
   * ④ 확정 번역 저장 — Dev-B 검증 파이프라인에서만 호출
   * Dev-A는 호출하지 않는다.
   */
  save(records: TranslationRecord[]): Promise<void>;

  /**
   * 인덱스 사용 가능 여부. Dev-A의 fallback 판단에 사용.
   * 인덱스 미생성·모델 로드 실패 시 false를 반환하고 예외를 던지지 않는다.
   */
  isAvailable(): Promise<boolean>;
}
```

### 권장 기본값 (튜닝 필요)

| 파라미터 | 권장 초기값 | 근거 |
|----------|------------|------|
| `findSimilar.limit` | 5 | 프롬프트 길이와 효과의 균형 |
| `findSimilar.minSimilarity` | 0.75 | 낮으면 무관한 예시가 섞여 오히려 해가 됨 |
| `findSimilarScreen.limit` | 3 | |
| `findSimilarScreen.minSimilarity` | 0.70 | 화면 단위는 텍스트보다 느슨하게 |

임계값은 실측 후 조정한다. **낮게 잡으면 무관한 예시가 프롬프트에 들어가 번역이 나빠진다.**

---

## 4. 인덱스 구성

두 개의 인덱스가 필요하다. 성격이 달라 분리한다.

| 인덱스 | 경로 | 임베딩 대상 | 용도 |
|--------|------|------------|------|
| 번역 메모리 | `data/translation-memory/` | `source` (영문 원문) | ①② |
| 화면 문맥 | `data/screen-context/` | `siblingTexts.join(' ')` | ③ |

`.gitignore`에 추가할지 결정이 필요하다.
- 커밋하면: 팀원 간 지식 공유됨, 데모에서 자가발전 누적 보여주기 좋음
- 제외하면: 저장소 가벼움, 각자 로컬에서 재생성

**권장: 커밋한다.** 자가발전이 요구사항(Q10-3)이고 데모 자산이다.

---

## 5. 임베딩 모델

**다국어 모델이어야 한다.** 영어 전용 모델은 `Extend ↔ 연장`을 가깝게 놓지 못한다.

| 항목 | 권장 |
|------|------|
| 방식 | Vectra `TransformersEmbeddings` (로컬 실행, API 키 불필요) |
| 모델 | `paraphrase-multilingual-MiniLM-L12-v2` 계열 |
| 이유 | 외부 의존 없음. Friendli가 임베딩 엔드포인트를 제공하는지 미확인 |

Friendli에 임베딩 API가 있다면 그쪽도 후보다. 확인은 Dev-B가 진행한다.

### 검증 방법

모델을 고른 뒤 아래가 성립하는지 확인한다. 성립하지 않으면 다국어 성능이 부족한 모델이다.

```
similarity("Extend", "연장")              > similarity("Extend", "삭제")
similarity("Assign Device", "장치 할당")   > similarity("Assign Device", "사용자 검색")
similarity("Business Site", "비즈니스 사이트") > 0.7
```

---

## 6. 저장 시점 — 가장 중요한 설계 결정

**검증 PASS된 번역만 저장한다. Dev-A는 저장하지 않는다.**

### 이유

미검증 번역을 저장하면 few-shot 예시가 되어 **오역이 전파된다.**

실제 사례로 설명하면, `Vertical Type → 세로 유형`이 검증 없이 저장됐다면
이후 `Vertical Type Name`, `Select Vertical Type` 등이 모두 그 오역을 참고한다.
자가발전이 아니라 자가오염이 된다.

### 흐름

```
Dev-A 번역
   ↓  status: 'pending'
Dev-B 검증 (Layer 1~4)
   ↓
 ├─ PASS → status: 'confirmed' → save()  → 이후 조회 대상이 됨
 └─ FAIL → status: 'rejected'  → 저장 안 함 (또는 rejected로 기록)
```

`rejected`를 기록해두면 "이 번역은 과거에 반려됨"을 알 수 있어 재발 방지에 쓸 수 있다.
필수는 아니다.

### 조회 시 필터

`lookup`과 `findSimilar`는 **`status === 'confirmed'`만 반환해야 한다.**
이걸 빠뜨리면 위 오염 문제가 그대로 발생한다.

---

## 7. Cold start와 fallback

### Cold start

첫 실행에는 인덱스가 비어 있어 few-shot 예시가 없다.
이건 정상이며 용어집이 baseline을 담당한다. 현재 번역 품질이 그 baseline이다.

### fallback (Dev-A 담당이지만 계약 사항)

`isAvailable()`이 `false`거나 조회가 실패하면 Dev-A는 현재 방식(용어집 + 앵커 용어)으로
번역을 계속한다. **파이프라인이 멈추지 않아야 한다.**

Dev-B 구현이 늦어져도 Dev-A 파이프라인과 데모가 살아 있어야 하므로,
`isAvailable()`은 예외를 던지지 말고 `false`를 반환한다.

---

## 8. 추가 기능 (여유 있으면)

### 8-1. 충돌 탐지 — 검증 명세 L2-02 / L2-03

| 규칙 | 검출 방법 |
|------|----------|
| L2-02 같은 원문, 다른 번역 | 정확 매칭으로 가능 (임베딩 불필요) |
| L2-03 다른 원문, 같은 번역 | **의미 유사도 필요.** 원문 임베딩은 멀고 번역이 동일한 케이스 |

L2-03 실제 사례: `Settings`와 `Setting`이 둘 다 `설정`.
현재 검증 체계로는 잡히지 않는다.

### 8-2. 신규 용어 발견

현재 `glossary-proposal.md`는 빈도 기반이라 노이즈가 있다
(`Business Site`가 등록됐는데 `Site`, `Business`가 따로 제안됨).

기존 용어집 엔트리 임베딩과의 **유사도가 낮은** 텍스트를 찾으면
"기존에 없는 개념"을 더 정확히 뽑을 수 있다.

---

## 9. 착수 순서

시그니처 합의만 끝나면 두 사람이 동시에 진행할 수 있다.

| 단계 | Dev-B | Dev-A | 검증 |
|------|-------|-------|------|
| 1 | 인터페이스 시그니처 확정 (같이) | 동일 | 타입 컴파일 통과 |
| 2 | 임베딩 모델 설치·유사도 검증 | 호출 지점 + fallback 골격 (스텁) | 5절 검증식 성립 |
| 3 | `lookup` + `save` | 캐시 조회 연결 | 재실행 시 번역 변동 0건 |
| 4 | `findSimilar` | few-shot 주입 연결 | 유사 군집에서 용어 일관성 유지 |
| 5 | `findSimilarScreen` | 문맥 주입 연결 | `Vertical Type` 유형 오역 사전 탐지 |
| 6 | 충돌 탐지 (8-1) | — | `Settings`/`Setting` 검출 |

### 단계별 성공 기준 (실측 가능)

| 단계 | 기준 |
|------|------|
| 3 | 파이프라인 2회 연속 실행 시 locale 파일 diff 0줄 (현재 5건 변동) |
| 3 | EXAONE 호출 수 감소 (중복률 87.4% 기준 대폭 감소 기대) |
| 4 | 용어집 미등록 용어의 복합어 변형에서 번역 일관성 유지 |
| 5 | 신규 프레임 추가 시 문맥 오역 발생 건수 감소 |

---

## 10. Dev-A 쪽 참고 사항

Dev-A가 전달할 데이터 형태를 미리 알려둔다.

### `context` 문자열 형식

```
"{frameName} > {role}"
예: "Console_Setting_Group@User > label"
```

### 형제 텍스트 추출

`src/components-map.json`의 프레임별 `children`에서 뽑는다.
같은 프레임에 속한 다른 텍스트의 `originalText` 배열이다.

```json
{
  "frame": "Console_Setting_Group@User",
  "frameId": "I15682:100919",
  "children": [
    { "type": "label", "key": "console.setting.group.label.subsidiary", "originalText": "Subsidiary" },
    { "type": "label", "key": "console.setting.group.label.licensePolicy", "originalText": "License Policy" }
  ]
}
```

### 현재 파이프라인 산출물

| 파일 | 내용 |
|------|------|
| `src/locales/{en,ko,ja,zh-CN}.json` | 110 key, 4개 언어 구조 일치 |
| `src/components-map.json` | 프레임 2개, 139개 항목 |
| `glossary-proposal.md` | 용어 등록 후보 |

실행: `npm run pipeline`

---

## 11. 미결 사항

| 항목 | 결정권자 |
|------|----------|
| 인덱스를 git에 커밋할지 (4절) | 팀 합의. Dev-A 권장: 커밋 |
| 임베딩 모델 최종 선정 (5절) | Dev-B |
| `rejected` 상태를 기록할지 (6절) | Dev-B |
| 유사도 임계값 (3절) | Dev-B, 실측 후 |
