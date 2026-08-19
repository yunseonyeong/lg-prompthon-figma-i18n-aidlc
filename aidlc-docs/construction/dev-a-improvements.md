# Dev-A 개선 과제 (Unit 1: i18n Pipeline)

> **대상**: `src/pipeline/figma-i18n-pipeline.ts`
> **기준 시점**: 2026-08-19, Figma `zdG3CHXVU6TzD4cc28o5Yb` / Frame `15682:100905`
> **현재 산출**: 110 key, 4개 언어 구조 일치, 용어집 위반 0건

---

## 우선순위 요약

| # | 과제 | 심각도 | 차단 대상 | 상태 |
|---|------|--------|-----------|------|
| 1 | 추출 필터 보강 (Layer 4) | 높음 | Dev-B 검증 노이즈 | 대기 (Dev-B 반송 예정) |
| 2 | 중복 key 제거 | 높음 | Dev-C 컴포넌트 | 미착수 |
| 3 | 용어 제안 정확도 | 중간 | Dev-B 용어집 검토 | 미착수 |
| 4 | 번역 비결정성 | 중간 | Dev-B/Dev-C 정합성 | 미착수 (Dev-B와 조율) |
| 5 | 프레임 확장 | 중간 | 데모 범위 | Dev-C 결정 대기 |
| 6 | 제품명 번역 금지 반영 | 낮음 | - | 미착수 |
| 7 | 문장 조각 대응 | 낮음 | - | 원문 문제 (디자이너) |

---

## 1. 추출 필터 보강 (Layer 4) — 12건

번역 대상이 아닌 텍스트가 추출되어 번역까지 되고 있다.
검증 명세상 Layer 4로 분류되며, **Dev-B가 `extraction-issues.md`로 반송**하기로 합의됨.

| 유형 | 건수 | 사례 |
|------|------|------|
| 샘플 주소 | 2 | `MagokJungang 10-ro, Gangseo-gu, Seoul`, `30, A101 bldg.` |
| 샘플 파일명 | 1 | `FileName_sample_00123.jpg` |
| 더미 텍스트 | 4 | `supporting text`, `Label`, `Button`, `Description Description ...` |
| 샘플 데이터 | 5 | `Business A`, `Workspace A1`, `Workspace N`, `Device N`, `User N` |

### 수정 위치
`isTranslatableUIText()`

### 판별 난이도 주의

단순 패턴만으로는 위험하다. `Business A`는 샘플이지만 `Business Type`은 실제 UI다.
`components-map.json`의 `role`과 프레임 내 위치를 함께 봐야 한다.

디자인 시안의 예시값은 보통 입력 필드 내부나 테이블 셀에 위치하므로,
Figma 노드 경로(부모가 Input/Cell 계열인지)를 판별에 활용하는 것이 안전하다.

### 부수 효과
`30A101Bldg` (숫자로 시작하는 identifier)도 함께 사라진다.

---

## 2. 중복 key 제거 — 3건

동일 텍스트가 `role`만 달라 서로 다른 key로 두 번 등록된다.

| 원문 | 생성된 key |
|------|-----------|
| `Settings` | `console.setting.group.label.settings` / `console.doc.title.title.settings` |
| `Business Site Name` | `...label.businessSiteName` / `...title.businessSiteName` |
| `Delete` | `...label.delete` / `...button.delete` |

### 문제

- 같은 문구를 두 곳에서 번역·검증하게 되어 비용이 중복된다
- 두 key의 번역이 갈릴 수 있다 (일관성 위반의 씨앗)
- Dev-C가 어느 key를 써야 할지 판단해야 한다

### 판단 필요

전부 병합하면 안 된다. `Delete`는 목록의 라벨과 버튼이 실제로 다른 UI 요소일 수 있고,
언어에 따라 다르게 번역되어야 할 수도 있다 (버튼=`삭제`, 상태 라벨=`삭제됨`).

**제안**: 동일 프레임 + 동일 텍스트인 경우만 병합하고,
프레임이 다르면 유지한다. `Settings`는 프레임이 다르므로(`setting.group` vs `doc.title`) 유지.

### 수정 위치
`runPipeline()`의 key 생성 구간 + `generateComponentsMap()`

---

## 3. 용어 제안 정확도

`glossary-proposal.md`에 노이즈가 있다.

### 3-1. 제품명이 미등록으로 제안됨

`Art Lounge`가 제안 목록에 오르지만, 용어집 7절 "제품명 (번역 금지)"에 이미 있다.
7절이 표 형식이 아니라 인라인 목록이어서 `loadGlossary()` 파서가 읽지 못한다.

**수정**: 7절을 파싱하여 "번역 금지 목록"으로 로드하고,
제안 대상과 번역 대상 모두에서 제외한다.

### 3-2. 복합어 구성 단어가 별도 제안됨

`Business Site`가 등록되어 있는데 `Site`(12회), `Business`(11회)가 각각 제안된다.
`System Integrator` 등록에도 `System`, `Integrator`가 따로 올라온다.

**수정**: 이미 등록된 복합어에 포함된 단일 단어는 제안에서 제외한다.

### 수정 위치
`generateGlossaryProposal()`, `loadGlossary()`

---

## 4. 번역 비결정성

동일 입력으로 재실행하면 5건 내외의 번역이 달라진다 (temperature 0.2에서도 발생).

```
아시아 및 태평양  ↔  아시아 & 태평양
켜기            ↔  켜짐
30, A101 건물    ↔  30, A101동
```

### 왜 문제인가

Dev-B가 버전 X를 검증하고 Dev-C가 버전 Y로 빌드하면 어긋난다.
`src/locales/*.json`이 커밋된 산출물이라 재실행 시점에 따라 팀원 간 불일치가 생긴다.

### 해결 방향

원문 해시 → 확정 번역 캐시. 원문이 바뀌지 않으면 이전 번역을 재사용한다.
API 호출도 줄어든다.

### 역할 중복 주의

Dev-B의 US-2.3(Vectra 번역 메모리)이 같은 문제를 다룬다.
**둘 중 하나로 정해야 한다.**

- Dev-A 로컬 캐시: 단순, 파이프라인 내부, 즉시 적용 가능
- Dev-B Vectra: 유사 문맥 검색까지 가능, 자가발전 데모에 직결

권장: **Dev-B의 Vectra로 통합**하고, Dev-A는 캐시 조회 인터페이스만 호출한다.
자가발전이 요구사항(Q10-3)이므로 Vectra 쪽에 무게가 있다.

---

## 5. 프레임 확장

현재 1개 프레임(`15682:100905`)만 처리한다. 110 key.

같은 파일 Scenario 페이지에는 프레임이 107개 있고, 전체 UI 텍스트는 7,830건이다.
후보로 확인된 상위 프레임:

| Frame ID | 고유 텍스트 | 특징 |
|----------|-------------|------|
| `15682:100905` | 136 | 현재 사용. Settings, 테이블 적음 |
| `15682:100308` | 134 | Agent Settings, Group 계열 |
| `15682:102086` | 110 | IAM/Auth, SAML·API Access |

### 결정 필요

프레임을 늘리면 key가 늘고 Dev-C의 컴포넌트 생성 부담이 커진다.
**Dev-C가 데모 파일·범위를 정한 뒤 확정**한다.

### 수정 위치
`CONFIG.targetFrameIds` (배열이므로 코드 변경 없이 추가 가능)

---

## 6. 제품명 번역 금지 반영

용어집 7절의 제품명 목록이 파이프라인에 전달되지 않는다.
현재는 EXAONE이 프롬프트 규칙만으로 판단하고 있어 보장되지 않는다.

대상: `Art Lounge`, `Hotel Mobile App`, `CreateBoard Lab`, `Enterprise Content`,
`Content Pro`, `LG Electronics`, `LGEBN`, `Business Cloud`

**수정**: 7절을 파싱해 번역 대상에서 제외하거나, 원문을 그대로 출력한다.
(3-1과 같은 작업)

---

## 7. 문장 조각 — 원문 문제

`is required`가 단독으로 추출된다. 원문이 `{field} is required` 형태여야 한다.

영어는 조각을 이어붙일 수 있으나 한국어는 어순이 달라 불가능하다.
파이프라인에서 해결할 수 없고 **디자인 단계에서 문장 단위를 지켜야 한다**.

Dev-B가 `extraction-issues.md`를 통해 디자이너에게 전달한다.

---

## 완료된 개선 (참고)

| 항목 | 내용 |
|------|------|
| 산출물 유실 가드 | 추출 0건 시 파일 쓰지 않고 중단. 잘못된 File Key로 locale이 `{}`로 덮어써지던 문제 |
| 배치 간 용어 불일치 | 앵커 용어 우선 번역 + 누적 용어집 주입. Workspace 6가지 → 1가지 |
| 용어집 도메인 교체 | Signage → Console. 적중률 4/12 → 오역 3건(Vertical/Extend/Withdraw) 해소 |
| key prefix | `signage` → `console`. 프롬프트용 도메인 서술과 분리 |
| identifier 표기 | snake_case → camelCase. 구분자 제거로 단어가 붙던 버그 동시 수정 |
| 공백 정규화 | 원문·번역 양쪽 trim |
| 실행 편의 | dotenv 로드 (`~/.hermes/.env` fallback), `npm run pipeline` |
