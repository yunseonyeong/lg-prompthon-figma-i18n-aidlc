---
name: figma-i18n-extractor
description: Figma UX 시나리오에서 텍스트를 추출하고, 문맥 기반 i18n key 생성 및 다국어 번역을 수행하는 스킬. Figma 파일 분석, 다국어 번역, i18n 코드 생성이 필요할 때 사용.
---

# Figma i18n Extractor Skill

## 사용 시점

- Figma 파일에서 텍스트를 추출해야 할 때
- UX 시나리오의 문맥을 분석하여 i18n key를 생성해야 할 때
- 도메인 용어를 고려한 다국어 번역이 필요할 때
- i18n JSON 파일과 FE 코드를 생성해야 할 때

## 입력

- Figma File Key 또는 URL
- 대상 페이지/프레임 (선택사항, 미지정 시 전체)
- 출력 언어 (기본: en, ko, ja, zh-CN)

## 처리 절차

### Step 1: Figma 데이터 추출

Figma MCP의 `get_file` 도구를 사용하여:
- 페이지 목록 및 구조 확인
- 각 프레임 내 텍스트 노드 추출
- 프레임 간 계층/순서 관계 파악

### Step 2: UX 흐름 분석

추출된 데이터에서:
- 페이지 순서 → 시나리오 흐름 파악
- 프레임 이름 → 화면 목적 추론
- 텍스트 위치/계층 → 컴포넌트 역할 파악 (제목, 버튼, 설명 등)

### Step 3: i18n Key 생성

규칙:
- `{domain}.{feature}.{role}.{identifier}` 형식
- `domain`은 파이프라인의 `CONFIG.keyPrefix` 값 (현재 `console`)
- `role`은 title / label / button / status / placeholder / description / message
- 영문 소문자 + dot 구분자만 사용
- 의미 있는 네이밍 (텍스트 내용이 아닌 역할 기반)

예시 (실제 생성값):
```
console.setting.group.title.console                    → "Console"
console.setting.group.label.business_site_information  → "Business Site Information"
console.setting.group.button.publish                   → "Publish"
console.doc.title.status.modified                      → "Modified"
```

### Step 4: 문맥 기반 번역

- `requirements/domain-glossary.md`의 용어를 우선 적용
- **복합어 내부에도 용어집을 적용한다.**
  `Workspace/Group Settings` → `워크스페이스/그룹 설정` (`작업 공간...`은 위반)
- UX 흐름의 전후 맥락을 참고하여 번역
- 같은 단어도 화면/기능에 따라 다르게 번역 가능

문맥 오역 주의 예시 (실제 발견 사례):
```
Vertical Type → "세로 유형" ❌  /  "산업 분야" ✅   (B2B 업종 분류)
Extend        → "확장"     ❌  /  "연장"     ✅   (라이선스 기간)
Withdraw      → "탈퇴"     ❌  /  "회수"     ✅   (라이선스 회수)
```
→ 단독 판단으로는 오역이 난다. **같은 프레임의 주변 필드를 함께 봐야 한다.**

### Step 5: 출력 생성

```json
// src/locales/en.json
{
  "console": {
    "setting": {
      "group": {
        "title": { "console": "Console" },
        "label": { "business_site_information": "Business Site Information" },
        "button": { "publish": "Publish" }
      }
    }
  }
}
```

## 출력 형식

파이프라인(`npm run pipeline`)이 생성하는 산출물:

1. `src/locales/{en,ko,ja,zh-CN}.json` — 언어별 i18n 파일
2. `src/components-map.json` — 프레임별 key 매핑 (**Dev-C 컴포넌트 생성용**)
3. `glossary-proposal.md` — 용어집 등록 제안 (**Dev-B 검토용**)

검증 리포트(`i18n-report.md`)는 Dev-B가 생성한다.
검증 규칙은 `aidlc-docs/construction/build-and-test/i18n-verification-spec.md` 참조.

## 주의사항

### 번역 대상에서 제외할 것

- **UX 시나리오 설명 테이블**: No / Classification / Description 3열 테이블 전체
- **더미 텍스트**: `Text Text`, `Description Description`, `supporting text`, `Label`, `Button`
- **샘플 데이터**: `Business A`, `Workspace A1`, `Device N`, `workspace 1-1-1`
- **샘플 주소·파일명**: `MagokJungang 10-ro...`, `FileName_sample_00123.jpg`
- **변수 placeholder**: `{Company name}`, `{{userName}}` — 런타임 주입값이므로 원문 유지
- **코드·포맷 값**: `LGEBN`, `YYYY.MM.DD`, `N.N.N`, `1 / 100`
- 숫자·기호만으로 구성된 텍스트

전체 목록은 `requirements/domain-glossary.md` 9절 참조.

### 기타

- 아이콘 레이블과 실제 UI 텍스트를 구분한다
- 약어(SSO, API, SAML, OAuth)는 풀어서 번역하지 않는다
- 제품명(Art Lounge, Hotel Mobile App 등)은 번역하지 않는다
