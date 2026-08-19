# AI DLC Inception — Requirements Analysis 질문지

> 팀원 모두 읽고 답변을 작성해주세요.
> 답변 완료 후 AI DLC 다음 단계(User Stories → Workflow Planning)로 진행합니다.

---

## 질문 1: Figma 파일 구조

현재 팀의 Figma UX 시나리오 파일은 어떻게 구성되어 있나요?

```
A) 1개 파일에 여러 페이지 (페이지 = UX 시나리오 단위)
B) 기능별로 별도 Figma 파일로 분리
C) 1개 파일, 1개 페이지에 모든 프레임이 나열
D) 아직 정해지지 않음 / 해커톤에서 새로 만들 예정
```

**[Answer]:**
C
---

## 질문 2: 번역 대상 언어

vision.md에 en, ko, ja, zh-CN 4개 언어로 정의했는데 맞나요?

```
A) 맞다 (en, ko, ja, zh-CN)
B) 다른 언어를 추가하고 싶다 → 추가 언어:
C) 줄이고 싶다 → 유지할 언어:
```

**[Answer]:**
A
---

## 질문 3: EXAONE 연동 방식

Hermes Agent를 통해 EXAONE을 사용한다고 했는데, 구체적으로:

```
A) Hermes Agent가 REST API를 제공하고, 우리가 HTTP로 호출
B) Hermes Agent 내부에서 MCP tool로 EXAONE을 호출
C) Kiro CLI 에이전트가 직접 Hermes Agent와 대화
D) 아직 연동 방식이 확정되지 않음
```

**[Answer]:**
A
---

## 질문 4: 해커톤 데모 시나리오

데모에서 보여줄 Figma 파일은:

```
A) 실제 업무에서 사용하는 Signage UX 시나리오 파일 (기존 것 활용)
B) 데모용으로 새로 만든 간단한 Figma 파일
C) 테스트한 파일(lNOFoSESnL6VHsUzhiw0j0)을 확장해서 사용
D) 아직 미정
```
C
**[Answer]:**

---

## 질문 5: 코드 생성 범위

Construction에서 생성할 코드의 범위는:

```
A) locale JSON 파일만 (번역 결과물)
B) locale JSON + React 컴포넌트 (전체 자동 생성)
C) locale JSON + 컴포넌트 스켈레톤 (기본 구조만 생성, 스타일은 수동)
D) locale JSON + Storybook stories (문서화 중심)
```

**[Answer]:**
B
---

## 질문 6: 용어집 관리 주체

도메인 용어집(domain-glossary.md)은 누가 관리하나요?

```
A) AI가 자동으로 추출 + 제안하고, 사람이 승인
B) 사람이 미리 작성해두고, AI는 참조만 함
C) AI가 완전 자동 관리 (사람 개입 최소화)
D) 미정
```

**[Answer]:**
A
---

## 질문 7: i18n key 네이밍 규칙

key 네이밍을 어떤 방식으로 할까요?

```
A) Figma 프레임 이름 기반 자동 생성 (예: frame명 "PlayerStatus" → signage.player.status)
B) 텍스트 역할 기반 (예: title, description, button, label)
C) 화면 경로 기반 (예: page.section.element)
D) 팀에서 별도 규칙을 정하고 싶다 → 규칙:
```
**[Answer]:**
D, 규칙은 정해서 제안해줘

---

## 질문 8: 번역 품질 검증 기준

리뷰 에이전트가 PASS/FAIL 판단할 핵심 기준은? (복수 선택 가능)

```
A) 용어집 준수 여부
B) 모든 locale 파일의 key 구조 일치
C) 번역 길이 (UI 깨짐 방지)
D) placeholder/변수 포맷 보존 ({0}, {{name}} 등)
E) 문맥 적합성 (문맥에 맞는 번역인지)
F) 전부 다
```

**[Answer]:**
A, B, D, E
---

## 질문 9: 해커톤 시간 제약

해커톤에서 사용할 수 있는 총 시간은?

```
A) 4시간 이내
B) 6시간
C) 8시간
D) 하루 종일 (10시간+)
```

**[Answer]:**
D
---

## 질문 10: 추가 요구사항

위 질문에 없지만 팀에서 중요하게 생각하는 요구사항이 있으면 자유롭게 작성해주세요.

**[Answer]:**
1. 마지막 React 컴포넌트 생성 후 데모에서 시연할 수 있게 웹서버를 하나 만들어서 띄워줘. 그래서 dropbox로 language 를 선택하면 그 언어에 맞게 만든 컴포넌트를 띄워줘.
2. 제품에 맞게 번역이 되는지 review-agent 가 검수할 수 있게 하고, review agent에 필요한 도메인 지식이나 단어에 대해서 용어집에 등록할지 결정할지 제안해줘.
3. 사용자가 이 서비스를 계속 사용하면서 용어집이나 관련된 데이터가 지속 적재되고 자가발전할 수 있도록 해줘.
4. 3번과 관련해서 vector DB와 같은 리소스는 어떤게 필요한지 제안해줘. 
---

## 작성 완료 후

답변을 모두 작성하면 저장하고 에이전트에게 알려주세요:
```
"requirements/questions.md 작성 완료했어. 다음 단계 진행해줘"
```
