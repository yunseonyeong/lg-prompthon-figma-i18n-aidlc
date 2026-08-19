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
- `{domain}.{page}.{component}.{element}` 형식
- 영문 소문자 + dot 구분자만 사용
- 의미 있는 네이밍 (텍스트 내용이 아닌 역할 기반)

예시:
```
signage.player.management.title → "Player Management"
signage.player.status.offline → "Player is offline"
signage.player.action.restart → "Restart"
```

### Step 4: 문맥 기반 번역

- domain-glossary.md의 용어를 우선 적용
- UX 흐름의 전후 맥락을 참고하여 번역
- 같은 단어도 화면/기능에 따라 다르게 번역 가능

### Step 5: 출력 생성

```json
// src/locales/en.json
{
  "signage": {
    "player": {
      "management": { "title": "Player Management" },
      "status": { "offline": "Player is offline" },
      "action": { "restart": "Restart" }
    }
  }
}
```

## 출력 형식

1. `src/locales/{lang}.json` — 언어별 i18n 파일
2. `i18n-report.md` — 추출 결과 요약 (key 목록, 용어집 적용 내역, 신규 용어 제안)

## 주의사항

- 디자인에 placeholder 텍스트(Lorem ipsum 등)가 있으면 무시
- 숫자만으로 구성된 텍스트는 번역 대상에서 제외
- 아이콘 레이블과 실제 UI 텍스트를 구분
