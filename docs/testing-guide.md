# 테스트 가이드 (Dev-B)

Dev-A가 올린 `src/locales/*.json`을 검증하고 산출물을 만드는 절차입니다.

## 준비 (클론 직후 1회)

```bash
npm install
npm run init:vectra && npm run reindex
```

`data/`는 git에 없습니다. 위 명령으로 재생성합니다 (약 15초, 임베딩 모델 130MB 최초 다운로드).

## 에이전트로 실행

```bash
kiro-cli chat --agent review-agent      # 검증
kiro-cli chat --agent glossary-agent    # 용어집
```

`"src/locales 검증해줘"` 처럼 말하면 에이전트가 아래 스크립트를 실행하고 결과를 해석해 담당자별로 라우팅합니다.

시작 시 훅이 환경 상태를 출력합니다. `glossary 0 terms`나 `vectra MISSING`이 보이면 준비가 안 된 상태입니다.

```
Review Agent | glossary 48 terms + 8 product names | locales 4 | vectra ready | rounds 1 | ...
```

> 에이전트가 스크립트를 실행할 때 승인을 물어봅니다 (`shell` 도구가 자동 허용 목록에 없음). 의도된 설정입니다.

## 명령어와 산출물

| 명령어 | 하는 일 | 산출물 |
|--------|---------|--------|
| `npm run round:check` | 사전차단 + 4계층 검증 + 판정 기록 | `i18n-report.md`, `extraction-issues.md`, `escalations.md` |
| `npm run retranslate` | FAIL 항목 EXAONE 재번역 (최대 3회) | `retranslation-patch.json` |
| `npm run validate:layer3` | 문맥 적합성 EXAONE 역검증 | `layer3-report.md` (`--md`) |
| `npm run glossary:approve` | 용어 제안 승인 (사람 판단) | `domain-glossary.md` (`--write`) |
| `npm run report:evolution` | 라운드 추이 | `evolution-report.md` (`--md`) |

검증 명령어의 **exit code 1은 정상**입니다. FAIL을 찾았다는 뜻입니다.

## 산출물이 가는 곳

| 파일 | 받는 사람 | 내용 |
|------|-----------|------|
| `extraction-issues.md` | **Dev-A** | 추출 필터 수정 요청. 번역으로 고치면 안 되는 항목 |
| `retranslation-patch.json` | **Dev-A** | 재검증 통과한 번역. `src/locales`는 Dev-B가 수정하지 않음 |
| `i18n-report.md` | 전원 | 계층별 전체 검증 결과 |
| `escalations.md` | 사람 | 3회 재시도 후에도 미해결 — 규칙/원문 검토 필요 |
| `evolution-report.md` | 전원 | 라운드별 개선 추이 (데모용) |

## 한 라운드 흐름

```
Dev-A locale JSON 업로드
   ↓
npm run reindex          번역 메모리 갱신
npm run round:check      검증 + 판정 기록
npm run retranslate      FAIL 재번역 → 패치
   ↓
extraction-issues.md / retranslation-patch.json → Dev-A
escalations.md → 사람
```

## 리뷰어용 (3분)

```bash
npm run test:run         # 79건 통과
npm run round:simulate   # 5라운드 시뮬레이션, src/locales 미변경
```

`round:simulate`에서 FAIL 39→0, 검증 대상 330→4로 줄고 회귀/재발이 검출되는 것을 보면 됩니다.

## 참고

- `npm test`는 watch 모드입니다. `npm run test:run`을 쓰세요.
- `round:simulate`는 `data/feedback/`을 초기화합니다.
- `.env`는 필요 없습니다. 단 `retranslate`와 `validate:layer3`는 EXAONE을 호출하며, 키는 `~/.hermes/.env`에 이미 있습니다.
- 용어집을 수정하면 `npm run glossary:index`로 인덱스를 갱신해야 합니다.
- `data/`는 지워도 됩니다: `rm -rf data && npm run init:vectra && npm run reindex`

## 상세 문서

| 문서 | 내용 |
|------|------|
| `docs/agent-io-contract.md` | 에이전트별 입출력 계약 |
| `docs/retriever-integration.md` | Dev-A 리트리버 연동 |
| `docs/self-improving-loop.md` | 자가발전 루프 설계 |
