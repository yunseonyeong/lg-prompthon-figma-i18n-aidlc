# Backend API 문서

이 프로젝트의 백엔드는 **Express 서버 1개**(`server/glossary-api.ts`)로 구성됩니다. 용어집 CRUD, 파이프라인 실행/산출물 조회, Figma MCP 프록시를 모두 이 서버가 담당합니다.

- 소스: `server/glossary-api.ts` (라우트 정의), `server/figma-mcp.ts` (Figma MCP/REST 클라이언트)
- 프론트엔드 클라이언트: `src/api/client.ts`
- 실행: `npm run api` (단독) 또는 `npm run dev:all` (API + Vite 동시)
- Base URL: `http://localhost:3001/api` (포트 3001 하드코딩, `glossary-api.ts` 최하단 `PORT`)
- 프론트엔드는 `VITE_API_BASE` 환경변수로 이 값을 덮어쓸 수 있습니다. Vite 프록시는 사용하지 않고 절대 URL로 직접 호출합니다.

이 서버는 **인증이 없고 CORS가 전면 허용**(`app.use(cors())`)입니다. 로컬 데모 전제이며, 외부 노출 시 그대로 쓰면 안 됩니다. 자세한 내용은 [보안 고려사항](#보안-고려사항)을 참고하세요.

---

## 저장소 (파일 기반)

DB가 없습니다. 모든 상태는 워크스페이스의 JSON 파일입니다.

| 상수 | 경로 | 용도 |
|---|---|---|
| `CONFIG_PATH` | `src/data/project-config.json` | 프로젝트 설정 |
| `GLOSSARY_PATH` | `src/data/glossary.json` | 용어집 |
| `HISTORY_PATH` | `src/data/pipeline-history.json` | 파이프라인 실행 히스토리 (최대 50건) |
| `TRANSLATIONS_DIR` | `src/data/translations/{runId}.json` | 실행별 번역 스냅샷 |
| `LOCALES_DIR` | `src/locales/{lang}.json` | i18n locale 산출물 |
| `COMPONENTS_MAP_PATH` | `src/components-map.json` | 텍스트↔키 매핑 산출물 |
| `GENERATED_COMPONENTS_DIR` | `src/components/generated/*.tsx` | 생성된 React 컴포넌트 |
| (figma-mcp.ts) | `src/figma-structure.json` | Figma 구조 캐시 |

지원 언어는 `en`, `ko`, `ja`, `zh-CN` 4개로 서버 전역에 하드코딩되어 있습니다.

---

## 공통 규약

**성공 응답**은 엔드포인트마다 형태가 다릅니다. 통일된 envelope이 없으며, 조회는 파일 내용을 그대로, 쓰기는 대부분 `{ "success": true, ... }`를 반환합니다.

**에러 응답**은 다음 형태입니다.

```json
{ "error": "사람이 읽을 한국어 메시지", "detail": "원인 문자열(선택)", "hint": "조치 안내(선택)" }
```

| 코드 | 발생 조건 |
|---|---|
| 400 | 잘못된 입력 (미지원 언어, 필수 필드 누락, allowlist 밖의 파일명/ID) |
| 404 | 대상 파일 또는 리소스 없음 |
| 500 | 파일 읽기/쓰기 실패 |
| 502 | Figma 구조 조회 실패 (MCP·REST·캐시 3단 폴백 전부 실패) |

`src/api/client.ts`의 `getJson`은 에러 본문에서 `detail` → `error` → `"{status} {statusText}"` 순으로 메시지를 뽑아 `Error`로 던집니다.

헬스체크 엔드포인트는 없습니다.

---

## 엔드포인트 요약

| # | Method | Path | 설명 |
|---|---|---|---|
| 1 | GET | `/api/config` | 프로젝트 설정 조회 |
| 2 | PUT | `/api/config` | 프로젝트 설정 저장 |
| 3 | GET | `/api/glossary` | 용어집 전체 조회 |
| 4 | PUT | `/api/glossary` | 용어집 전체 교체 |
| 5 | POST | `/api/glossary/term` | 용어 1건 추가 |
| 6 | PUT | `/api/glossary/term/:id` | 용어 1건 부분 수정 |
| 7 | DELETE | `/api/glossary/term/:id` | 용어 1건 삭제 |
| 8 | POST | `/api/pipeline/run` | 파이프라인 실행 (SSE 스트리밍) |
| 9 | GET | `/api/pipeline/status` | 현재 산출물 파일 목록 |
| 10 | GET | `/api/pipeline/locales/:lang` | locale JSON 조회 |
| 11 | PUT | `/api/pipeline/locales/:lang` | 번역 1건 수정 |
| 12 | GET | `/api/pipeline/components-map` | components-map 조회 |
| 13 | GET | `/api/pipeline/components` | 생성 컴포넌트 목록 + 코드 |
| 14 | GET | `/api/pipeline/components/:name` | 특정 컴포넌트 코드 |
| 15 | GET | `/api/pipeline/download/:name` | 산출물 파일 다운로드 |
| 16 | GET | `/api/pipeline/history` | 실행 히스토리 조회 |
| 17 | POST | `/api/pipeline/history` | 히스토리 수동 추가 |
| 18 | GET | `/api/pipeline/history/:id/translations` | 실행별 번역 스냅샷 (JSON) |
| 19 | GET | `/api/pipeline/history/:id/translations.csv` | 실행별 번역 스냅샷 (CSV) |
| 20 | GET | `/api/figma/status` | MCP 연결 상태 |
| 21 | GET | `/api/figma/structure` | Figma 프레임 구조 조회 |

---

## 1. 프로젝트 설정

### GET /api/config

`src/data/project-config.json`을 반환합니다. **파일이 없으면 200과 함께 하드코딩된 기본값**을 반환합니다 (404가 아님). 현재 워크스페이스에는 이 파일이 없으므로 항상 기본값이 나옵니다.

```json
{
  "figmaUrl": "https://www.figma.com/design/zdG3CHXVU6TzD4cc28o5Yb/LG-Business-Cloud-Console",
  "figmaFileKey": "zdG3CHXVU6TzD4cc28o5Yb",
  "domainDescription": "LG Business Cloud console — a B2B admin console for ...",
  "targetLanguages": ["en", "ko", "ja", "zh-CN"]
}
```

### PUT /api/config

요청 본문을 **검증 없이 그대로** 저장하고 `lastUpdated`(ISO 8601)를 서버가 덧붙입니다.

```bash
curl -X PUT http://localhost:3001/api/config \
  -H 'Content-Type: application/json' \
  -d '{"figmaFileKey":"abc123","targetLanguages":["en","ko"]}'
```

응답: `{ "success": true, "config": { ...저장된 값, "lastUpdated": "..." } }`

---

## 2. 용어집

용어집 항목(`term`) 스키마는 `src/data/glossary.json`에서 관찰된 형태입니다. 서버는 스키마를 검증하지 않습니다.

```json
{
  "id": "1",
  "term": "Business Site",
  "ko": "비즈니스 사이트",
  "ja": "ビジネスサイト",
  "zhCN": "业务站点",
  "context": "최상위 고객사 단위",
  "doNotTranslate": false,
  "category": "엔티티"
}
```

`zhCN`은 카멜케이스입니다. locale 파일과 번역 테이블에서 쓰는 `zh-CN`과 표기가 다르므로 매핑 시 주의하세요.

### GET /api/glossary

```json
{ "terms": [ /* ... */ ], "lastUpdated": "2026-08-20T12:31:24.811Z" }
```

파일이 없거나 파싱 실패면 500입니다.

### PUT /api/glossary

본문의 `terms` 배열로 **전체를 교체**합니다. `lastUpdated`는 서버가 갱신합니다.

요청: `{ "terms": [ ... ] }` → 응답: `{ "success": true, "lastUpdated": "..." }`

### POST /api/glossary/term

본문을 새 항목으로 추가합니다. `id`는 서버가 `Date.now().toString()`으로 부여하며 **클라이언트가 보낸 `id`는 덮어써집니다**.

응답: `{ "success": true, "term": { ...본문, "id": "1787229084811" } }`

### PUT /api/glossary/term/:id

본문을 기존 항목에 얕은 병합(`{ ...기존, ...본문 }`)합니다. `id`가 없으면 404.

응답: `{ "success": true, "term": { /* 병합 결과 */ } }`

### DELETE /api/glossary/term/:id

해당 항목을 배열에서 제거합니다. `id`가 없으면 404. 응답: `{ "success": true }`

---

## 3. 파이프라인 실행

### POST /api/pipeline/run

`src/pipeline/figma-i18n-pipeline.ts`를 자식 프로세스로 실행하고 진행 상황을 **SSE(Server-Sent Events)로 스트리밍**합니다.

요청 본문 (둘 다 선택):

| 필드 | 타입 | 설명 |
|---|---|---|
| `figmaFileKey` | string | 생략 시 파이프라인 기본값 |
| `figmaFrameIds` | string | 생략 시 파이프라인 기본값 |

실행 명령은 `node --import tsx <pipelinePath> [figmaFileKey] [figmaFrameIds]`이며, `spawn`에 배열 인자로 전달되므로 셸 인젝션은 발생하지 않습니다.

응답 헤더: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`

**이벤트 종류**

| event | data | 발생 시점 |
|---|---|---|
| `progress` | `{ step: 1-8, message: string }` | 자식 stdout에 `Step N`이 나타날 때 |
| `info` | `{ type: "extracted" \| "translated", count: number }` | stdout에서 `추출된 텍스트 노드: N개` / `번역 완료: N개` 정규식 매칭 시 |
| `error` | `{ message: string }` | 자식 stderr 출력 또는 spawn 실패 |
| `complete` | `{ success: boolean, files?: [...], message: string }` | 자식 프로세스 종료 |

step 번호와 의미는 다음과 같습니다.

1. Figma 텍스트 추출
2. UX 흐름 문맥 분석
3. i18n Key 생성
4. EXAONE 문맥 기반 번역
5. Locale JSON 출력
6. Components Map 생성
7. 용어집 등록 제안 생성
8. EXAONE React 컴포넌트 생성

진행률은 자식 프로세스의 **stdout 문자열을 정규식으로 파싱**해 산출합니다. 파이프라인의 로그 문구를 바꾸면 진행 표시가 조용히 깨집니다. 구조화된 채널이 아니라는 점을 알고 계셔야 합니다.

`exit code === 0`이면 종료 시 서버가 추가로 다음을 수행합니다.

1. `getGeneratedFiles()`로 산출물 목록 수집
2. `buildTranslationRows()`로 현재 locale 4개를 평탄화해 번역 행 생성
3. `saveHistory()`로 히스토리 추가 → `runId` 획득
4. 행이 1건 이상이면 `saveTranslationSnapshot(runId, rows)`로 `src/data/translations/{runId}.json` 기록

호출 예:

```bash
curl -N -X POST http://localhost:3001/api/pipeline/run \
  -H 'Content-Type: application/json' \
  -d '{"figmaFileKey":"zdG3CHXVU6TzD4cc28o5Yb"}'
```

---

## 4. 산출물 조회

### GET /api/pipeline/status

locale 4개 + `components-map.json` + 생성 컴포넌트 `.tsx` 전부를 스캔해 목록으로 반환합니다. 없는 파일은 조용히 건너뜁니다.

실제 응답 (2026-08-20 기준):

```json
{
  "files": [
    { "path": "src/locales/en.json", "size": "4.7 KB", "keys": 110, "icon": "🗂️", "lastModified": "2026-08-20T12:31:24.342Z" },
    { "path": "src/locales/ko.json", "size": "5.0 KB", "keys": 110, "icon": "🗂️", "lastModified": "..." },
    { "path": "src/locales/ja.json", "size": "5.2 KB", "keys": 110, "icon": "🗂️", "lastModified": "..." },
    { "path": "src/locales/zh-CN.json", "size": "4.7 KB", "keys": 110, "icon": "🗂️", "lastModified": "..." },
    { "path": "src/components-map.json", "size": "45.6 KB", "keys": 2, "icon": "🗺️", "lastModified": "..." }
  ],
  "generated": true
}
```

`keys`의 의미가 파일 종류마다 다릅니다. locale은 중첩 리프 개수, components-map은 프레임 개수, 컴포넌트는 항상 0입니다.

컴포넌트 항목이 위 응답에 없는 이유는 `src/components/generated/`가 현재 비어 있기 때문입니다. `.tsx`가 있으면 `icon: "⚛️"`, `keys: 0` 항목으로 함께 나열됩니다.

### GET /api/pipeline/locales/:lang

`:lang`은 `en` | `ko` | `ja` | `zh-CN` allowlist입니다. 그 외는 400, 파일 없으면 404. 응답은 locale JSON 원문(중첩 객체)입니다.

### PUT /api/pipeline/locales/:lang

번역 1건을 수정합니다. 프론트엔드 번역 편집 UI의 저장 경로입니다.

요청:

```json
{ "key": "console.setting.group.label.device", "value": "장치" }
```

`key`는 점(`.`) 구분 경로이며 중간 노드가 없으면 생성합니다. 검증 규칙:

| 조건 | 결과 |
|---|---|
| `:lang`이 allowlist 밖 | 400 |
| `key`가 문자열이 아니거나 빈 문자열 | 400 |
| `value`가 문자열이 아님 | 400 |
| `key` 경로에 `__proto__` / `constructor` / `prototype` 포함 | 400 (프로토타입 오염 방지) |

응답에 변경 전 값이 함께 담깁니다.

```json
{ "success": true, "lang": "ko", "key": "console...device", "before": "Device", "value": "장치" }
```

### GET /api/pipeline/components-map

`src/components-map.json`을 그대로 반환합니다. `ComponentMapFrame[]` 배열입니다.

```json
[
  {
    "frame": "Console_Setting_Group@User",
    "frameId": "I15682:100919",
    "children": [
      {
        "type": "label",
        "key": "console.setting.group.label.device",
        "originalText": "Device",
        "layout": { "x": 33933, "y": -3530, "width": 37, "height": 16 },
        "parentName": "BO_menuItem",
        "fontSize": 11.675676345825195
      }
    ]
  }
]
```

파일이 없으면 404입니다.

### GET /api/pipeline/components

`src/components/generated/*.tsx` 전부를 **코드 본문까지 포함**해 반환합니다. 디렉터리가 없으면 에러 대신 `{ "components": [] }`입니다.

```json
{
  "components": [
    { "name": "ConsoleSettingGroupUser", "fileName": "ConsoleSettingGroupUser.tsx",
      "code": "import ...", "size": "8.2 KB", "lastModified": "..." }
  ]
}
```

### GET /api/pipeline/components/:name

`{name}.tsx` 하나의 코드를 반환합니다. 응답: `{ "name": "...", "code": "..." }`. 없으면 404.

이 엔드포인트에는 경로 검증이 없습니다. [보안 고려사항](#보안-고려사항)을 확인하세요.

### GET /api/pipeline/download/:name

산출물 파일을 첨부파일로 내려줍니다. **allowlist에 등록된 이름만** 허용하며, 그 외는 400입니다.

허용 값: `en.json`, `ko.json`, `ja.json`, `zh-CN.json`, `components-map.json`, `figma-structure.json`

응답 헤더: `Content-Type: application/json; charset=utf-8`, `Content-Disposition: attachment; filename="..."`

---

## 5. 실행 히스토리와 번역 스냅샷

### GET /api/pipeline/history

파일이 없으면 200 + `{ "history": [] }`입니다.

```json
{
  "history": [
    {
      "id": "1787229084811",
      "timestamp": "2026-08-20T12:31:24.811Z",
      "figmaFileKey": "zdG3CHXVU6TzD4cc28o5Yb",
      "figmaFileName": "LG Business Cloud Console",
      "extractedCount": 139,
      "translatedCount": 139,
      "componentsCount": 0,
      "languages": ["en", "ko", "ja", "zh-CN"]
    }
  ]
}
```

최신 항목이 배열 앞(`unshift`)에 오고, **최대 50건**만 유지됩니다(초과분은 잘려나감). `id`는 `Date.now()` 문자열입니다.

`/api/pipeline/run`이 저장하는 항목에는 `keyCount`, `hasTranslations` 필드가 추가로 붙습니다. 위 예시처럼 이 필드가 없는 항목은 스냅샷 기능 도입 이전에 기록된 것입니다.

### POST /api/pipeline/history

본문에 `id`와 `timestamp`를 서버가 붙여 히스토리에 추가합니다. 파이프라인 실행과 무관하게 수동으로 항목을 넣는 용도입니다.

응답: `{ "success": true, "entry": { "id": "...", "timestamp": "...", ...본문 } }`

### GET /api/pipeline/history/:id/translations

해당 실행 시점의 4개 언어 번역을 한 테이블로 반환합니다. `src/locales/*.json`은 다음 실행에서 덮어써지므로, 과거 실행 결과를 보려면 이 스냅샷이 필요합니다.

`:id`는 `/^[A-Za-z0-9_-]+$/`만 허용합니다(파일명으로 쓰이므로 경로 문자 차단). 위반 시 400, 스냅샷 파일이 없으면 404.

```json
{
  "runId": "1787229084811",
  "at": "2026-08-20T12:31:24.900Z",
  "rowCount": 139,
  "rows": [
    { "key": "console.setting.group.label.device", "en": "Device", "ko": "장치", "ja": "デバイス", "zh-CN": "设备" }
  ]
}
```

행 집합은 **`en.json`의 키를 기준**으로 만들어집니다. 다른 언어에만 있는 키는 테이블에 나타나지 않고, en에만 있는 키는 나머지 언어가 빈 문자열로 채워집니다.

### GET /api/pipeline/history/:id/translations.csv

같은 데이터를 CSV로 내려줍니다.

- 헤더: `key,en,ko,ja,zh-CN`
- 전 필드를 따옴표로 감싸고 내부 `"`는 `""`로 이스케이프 (RFC 4180)
- 줄바꿈 `\r\n`
- **UTF-8 BOM(`\uFEFF`) 선행** — Excel에서 한중일 문자가 깨지지 않게 하기 위함
- `Content-Disposition: attachment; filename="translations-{runId}.csv"`

---

## 6. Figma MCP 프록시

`figma-developer-mcp`는 stdio 기반 JSON-RPC MCP 서버입니다. 브라우저는 자식 프로세스의 stdin/stdout에 붙을 수 없으므로, 이 Express 서버가 MCP 클라이언트가 되어 REST로 프록시합니다.

**데이터 출처 3단 폴백** (`server/figma-mcp.ts`)

| 순위 | `source` | 경로 |
|---|---|---|
| 1 | `mcp` | MCP `get_figma_data` 도구 호출 |
| 2 | `rest` | `https://api.figma.com/v1/files/...` 직접 호출 |
| 3 | `cache` | `src/figma-structure.json` 디스크 캐시 |

MCP/REST 응답은 서로 형식이 다르지만(simplified vs raw) 서버가 동일한 `FigmaNodeView`로 정규화하므로 프론트엔드는 출처를 신경 쓰지 않습니다. 응답에는 항상 `source`가 실려 화면이 "Figma에서 가져온 척"하는 것을 막습니다.

### GET /api/figma/status

MCP 연결을 시도(lazy, 1회)하고 상태를 반환합니다. **Figma 토큰 값은 노출하지 않고 보유 여부만** 알려줍니다. `tools`는 MCP 서버가 `tools/list`로 실제 보고한 목록이며, 연결 실패 시 빈 배열입니다.

```json
{
  "connected": true,
  "tools": ["get_figma_data", "download_figma_images"],
  "tokenPresent": true,
  "transport": "stdio",
  "serverCommand": "figma-developer-mcp --stdio",
  "lastError": null,
  "lastSource": "cache"
}
```

예외 발생 시 500 + `{ "connected": false, "lastError": "..." }`.

### GET /api/figma/structure

| 쿼리 | 기본값 | 설명 |
|---|---|---|
| `fileKey` | `FIGMA_FILE_KEY` 또는 `zdG3CHXVU6TzD4cc28o5Yb` | Figma 파일 키 |
| `nodeId` | `FIGMA_NODE_ID` 또는 `15682:100905` | 노드 ID. 쉼표 구분 시 첫 번째만 사용 |
| `depth` | `8` | 탐색 깊이 |
| `refresh` | `false` | `true`면 캐시를 건너뛰고 MCP/REST 재호출 |

**기본 동작은 캐시 우선**입니다. Figma `GET /v1/files`는 rate limit이 엄격한 Tier 1 엔드포인트라(Viewer/Collab 시트는 월 6회) 화면 로드마다 실시간 호출하면 데모가 깨집니다. 실시간 조회는 `?refresh=true`일 때만 일어납니다.

```json
{
  "source": "cache",
  "fileKey": "zdG3CHXVU6TzD4cc28o5Yb",
  "nodeId": "15682:100905",
  "fetchedAt": "2026-08-20T12:31:24.811Z",
  "frames": [ /* FigmaNodeView 트리 */ ],
  "stats": { "textNodes": 139, "mappedKeys": 139, "totalNodes": 412 },
  "warning": "실시간 조회 실패 → 캐시 사용 (mcp: ... | rest: ...)"
}
```

`warning`은 MCP/REST가 모두 실패해 캐시로 폴백했을 때만 존재합니다. 3단 전부 실패하면 **502**를 반환하며 가짜 데이터를 만들지 않습니다.

```json
{
  "error": "Figma 구조를 가져올 수 없습니다.",
  "detail": "mcp: ... | rest: Figma REST 429 Too Many Requests",
  "hint": "Figma API가 429(rate limit)일 수 있습니다. 잠시 후 재시도하거나 캐시된 구조를 사용하세요."
}
```

`FigmaNodeView`는 CSS 친화적 값으로 정규화된 노드입니다. 전체 필드는 `src/types/figma.ts`를 참고하세요. 텍스트 노드에는 `components-map.json` 역인덱스로 매칭한 `i18nKey`가 붙습니다(원문 문자열 완전일치 기준).

---

## 프론트엔드 클라이언트 커버리지

`src/api/client.ts`가 감싼 것은 아래 9개입니다.

| 함수 | 엔드포인트 |
|---|---|
| `fetchFigmaMcpStatus()` | GET `/figma/status` |
| `fetchFigmaStructure(opts)` | GET `/figma/structure` |
| `fetchComponentsMap()` | GET `/pipeline/components-map` |
| `fetchLocale(lang)` | GET `/pipeline/locales/:lang` |
| `updateLocaleEntry(lang, key, value)` | PUT `/pipeline/locales/:lang` |
| `fetchProjectConfig()` / `saveProjectConfig(c)` | GET/PUT `/config` |
| `extractTexts({ fileKey })` | POST `/pipeline/extract` |
| `translateEntries({ translationTargets, relevantGlossary })` | POST `/pipeline/translate` |

`extract` / `translate`는 `{ success, data, error }` 래퍼를 쓰므로 `postPipeline()` 헬퍼가 래퍼를 풀고 실패 시 `error`를 예외 메시지로 올립니다.

화면 연결은 이렇습니다.

- Step 2 텍스트 추출 → `useExtraction()`이 `extractTexts()` 호출. 결과(`translationTargets`, `relevantGlossary`)를 모듈 캐시에 보관해 Step 3이 재사용합니다.
- Step 3 용어집 → `relevantGlossary`를 표로 보여주고, 편집·번역 여부 토글은 **로컬 상태로만** 반영합니다. 서버 호출은 "EXAONE 번역 시작"에서 한 번뿐입니다. 이때 **번역 금지로 표시한 용어는 제외**해서 보냅니다.
- `POST /pipeline/translate`의 요청 필드는 extract 응답과 같은 이름을 씁니다: `translationTargets`, `relevantGlossary`. 이전 이름 `entries` / `glossary`도 폴백으로 남겨뒀습니다(`translationTargets || entries`, `relevantGlossary || glossary || {}`).
- Step 4 번역 리뷰 → `src/state/translationRun.ts` 스토어가 실행 상태(idle/running/done/error)와 응답을 보관합니다. Step 이동으로 언마운트돼도 실행이 유지됩니다.

주의: `/translate`는 EXAONE 호출이 실패해도 `success: true`로 응답하고 번역이 비어 있는 엔트리를 그대로 돌려줍니다(실측: Friendli 401). Step 4가 "번역 없는 항목 N건"으로 이를 드러냅니다.

용어집 카탈로그(`/glossary`), 히스토리, 파이프라인 SSE 실행은 이 모듈을 거치지 않습니다. 해당 화면들이 `fetch`를 직접 호출하고 있으므로, 새 호출을 추가할 때는 이 클라이언트에 모으는 편이 에러 처리(`getJson`의 `detail` 추출)를 재사용할 수 있어 유리합니다.

---

## 환경 변수

`server/figma-mcp.ts`가 `.env`를 먼저 읽고, 빈 값은 `~/.hermes/.env`로 보완합니다(파이프라인과 동일 규칙).

| 변수 | 사용처 |
|---|---|
| `FIGMA_API_KEY` | MCP/REST 인증. 없으면 `mcp`·`rest` 경로 모두 실패하고 캐시만 동작 |
| `FIGMA_FILE_KEY` | `/api/figma/structure`의 `fileKey` 기본값 |
| `FIGMA_NODE_ID` | `/api/figma/structure`의 `nodeId` 기본값 |
| `VITE_API_BASE` | 프론트엔드가 바라볼 API base URL |

---

## 보안 고려사항

로컬 데모 전제로 만들어진 서버입니다. 외부에 노출하려면 아래를 먼저 처리해야 합니다.

**이미 방어된 것**

- `PUT /api/pipeline/locales/:lang` — 언어 allowlist + 프로토타입 오염(`__proto__` 등) 차단
- `GET /api/pipeline/download/:name` — 이름→절대경로 고정 allowlist로 `../../.env` 류 차단
- `GET /api/pipeline/history/:id/*` — `runId` 정규식 검증
- `POST /api/pipeline/run` — `spawn` 배열 인자 전달로 셸 인젝션 없음
- `GET /api/figma/status` — 토큰 값 대신 보유 여부(`tokenPresent`)만 노출

**미해결**

- **인증·인가 없음.** 모든 엔드포인트가 무제한 공개입니다. `POST /api/pipeline/run`은 임의 호출자가 서버에서 자식 프로세스를 띄우고 LLM API 비용을 발생시킬 수 있습니다.
- **CORS 전면 허용.** `cors()`를 옵션 없이 사용해 모든 origin을 허용합니다.
- **`GET /api/pipeline/components/:name`에 경로 검증이 없습니다 (실측 확인됨).** `path.join(GENERATED_COMPONENTS_DIR, name + '.tsx')`로 경로를 조립하므로 디렉터리 밖의 `.tsx` 파일을 읽을 수 있습니다.

  ```bash
  curl "http://localhost:3001/api/pipeline/components/..%2F..%2FApp"
  # → 200, src/App.tsx 전문 반환
  ```

  확장자가 `.tsx`로 고정되어 `.env` 같은 파일까지는 닿지 않지만, locale·download 엔드포인트와 달리 allowlist가 빠져 있습니다. `GENERATED_COMPONENTS_DIR` 기준으로 `path.resolve` 후 prefix를 검사하거나, `/api/pipeline/components` 목록에 있는 이름만 허용하는 방식으로 막을 수 있습니다.
- **쓰기 요청 스키마 검증 없음.** `PUT /api/config`, `PUT /api/glossary`, `POST /api/glossary/term`은 본문을 그대로 파일에 씁니다.
- **동시 쓰기 보호 없음.** read-modify-write 사이에 락이 없어 동시 요청 시 갱신이 유실될 수 있습니다.
- **요청 크기 제한 미설정.** `express.json()` 기본값(100KB)에만 의존합니다.

---

## 알려진 제약

- `src/data/project-config.json`과 `src/data/translations/`는 현재 워크스페이스에 존재하지 않습니다. 각각 `PUT /api/config`와 파이프라인 성공 실행 시 생성됩니다.
- 기존 히스토리 항목(`keyCount`/`hasTranslations` 없는 항목)은 스냅샷 파일이 없으므로 `/translations`가 404를 반환합니다. 스냅샷은 도입 이후 실행분부터 쌓입니다.
- 파이프라인 진행률은 stdout 문자열 파싱에 의존합니다. 로그 문구 변경 시 SSE `progress`/`info` 이벤트가 조용히 멈춥니다.
- Figma 429 응답의 `Retry-After`, `X-Figma-Plan-Tier`, `X-Figma-Rate-Limit-Type`, `X-Figma-Upgrade-Link` 헤더를 `fetchViaRest`가 버리고 상태 코드만 메시지에 담습니다. 429 원인 진단에 필요한 정보라 보존할 여지가 있습니다.
- 포트 3001이 하드코딩되어 있어 환경변수로 바꿀 수 없습니다.
