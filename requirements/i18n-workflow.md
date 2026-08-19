# AI DLC (Design → Localization → Code) Workflow

## Flow Steps

1. **Design 분석**: Figma MCP를 통해 UX 시나리오의 페이지/프레임 구조와 텍스트 노드를 추출한다.
2. **Context 파악**: UX 흐름(페이지 순서, 프레임 계층)을 분석하여 도메인과 문맥을 파악한다.
3. **Key 생성**: 텍스트별 i18n key를 계층적으로 네이밍한다.
   - 형식: `{domain}.{page}.{component}.{element}`
   - 예: `console.setting.group.button.publish`
4. **Localization**: 문맥 기반으로 다국어 번역한다. 반드시 domain-glossary를 참조한다.
5. **Code 생성**: i18n JSON 파일과 FE 컴포넌트 코드를 생성한다.

## Rules

- 동일 단어라도 문맥에 따라 번역이 달라야 한다.
- 번역 시 반드시 UX 흐름의 전후 화면을 참고한다.
- 용어집에 등록된 단어는 용어집의 번역을 우선한다.
- 지원 언어: en, ko, ja, zh-CN
- key 네이밍은 영문 소문자와 dot(.)으로만 구성한다.
- 하나의 Figma 페이지는 하나의 UX 시나리오 단위로 취급한다.

## Output Structure

```
src/
├── locales/
│   ├── en.json
│   ├── ko.json
│   ├── ja.json
│   └── zh-CN.json
└── components/
    └── (generated components)
```

## Quality Checklist

- [ ] 모든 텍스트 노드가 key로 매핑되었는가
- [ ] 용어집 용어가 일관되게 적용되었는가
- [ ] 번역에 문맥이 반영되었는가
- [ ] key 네이밍 규칙을 준수하는가
- [ ] JSON 파일 간 key 구조가 동일한가
