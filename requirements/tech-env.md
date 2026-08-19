# Technical Environment: Figma i18n DLC

## Languages

### Required

| Language | Version | Purpose |
|----------|---------|---------|
| TypeScript | 5.x | 전체 FE 코드 |
| Node.js | 20.x LTS | 런타임 |

### Prohibited

| Language | Reason | Use Instead |
|----------|--------|-------------|
| JavaScript (plain) | 타입 안전성 부재 | TypeScript |
| CoffeeScript | 팀 미사용 | TypeScript |

## Frameworks and Libraries

### Required

| Library | Version | Purpose |
|---------|---------|---------|
| React | 18.x | UI 프레임워크 |
| react-i18next | 14.x | i18n 통합 |
| i18next | 23.x | i18n 코어 |
| TypeScript | 5.x | 타입 시스템 |

### Preferred

| Library | Version | Purpose | Alternative |
|---------|---------|---------|-------------|
| Vite | 5.x | 번들러/개발서버 | webpack (비선호) |
| Tailwind CSS | 3.x | 스타일링 | CSS Modules |

### Prohibited

| Library | Reason | Use Instead |
|---------|--------|-------------|
| moment.js | 번들 크기 큼 | date-fns |
| jQuery | React와 불필요한 중복 | React DOM |
| i18next-http-backend | 로컬 JSON으로 충분 | i18next static import |

## Cloud Services

### Allowed

| Service | Purpose | Constraints |
|---------|---------|-------------|
| Figma API | 디자인 파일 읽기 | Personal Access Token 사용 |
| EXAONE 2.0 (Hermes Agent) | 문맥 분석 + 번역 | API Key 기발급 |

### Not Allowed

| Service | Reason |
|---------|--------|
| Google Translate API | 문맥 인식 불가, 비용 |
| DeepL API | 도메인 용어집 미지원 |
| AWS Translate | 문맥 기반 번역 아님 |

## Architecture and Patterns

### Project Structure

```
src/
├── locales/              # i18n JSON 파일 (언어별)
│   ├── en.json
│   ├── ko.json
│   ├── ja.json
│   └── zh-CN.json
├── components/           # React 컴포넌트
│   └── {feature}/
│       ├── index.ts
│       ├── {Component}.tsx
│       └── {Component}.types.ts
├── i18n.ts              # i18next 설정
├── App.tsx              # 루트 컴포넌트
└── main.tsx             # 엔트리포인트
```

### API Style

- Figma MCP: stdio 기반 JSON-RPC (MCP Protocol)
- EXAONE: Hermes Agent를 통한 호출 (HTTP REST, OpenAI-compatible)

### Data Patterns

- i18n 데이터: 계층적 JSON 구조 (`{domain}.{page}.{component}.{element}`)
- 용어집: Markdown 테이블 (steering 파일)
- 상태 관리: React 기본 useState/useContext (복잡한 상태관리 불필요)

### Coding Conventions

- 컴포넌트: 함수형 컴포넌트 + hooks
- 네이밍: PascalCase (컴포넌트), camelCase (함수/변수), kebab-case (파일)
- i18n key: 영문 소문자 + dot 구분자 (`signage.player.status.offline`)
- export: barrel export (index.ts)
- 텍스트: 절대 하드코딩 금지 → 반드시 `useTranslation()` 사용

## Security

### Authentication

| 항목 | 방식 |
|------|------|
| Figma API | Personal Access Token (환경변수) |
| EXAONE | Hermes Agent API Key (환경변수) |

### Secrets Management

- `.env` 파일로 관리
- `.gitignore`에 `.env` 포함 (커밋 금지)
- 코드 내 시크릿 하드코딩 금지

### Input Validation

- Figma API 응답: 텍스트 노드 존재 여부 확인
- 번역 결과: 빈 문자열, null 체크
- JSON 출력: 스키마 검증 (모든 locale 파일 key 구조 동일)

## Testing

### Test Types

| 타입 | 도구 | 대상 |
|------|------|------|
| Unit Test | Vitest | 유틸리티 함수, key 생성 로직 |
| Component Test | React Testing Library | 컴포넌트 렌더링 + i18n |
| i18n Validation | 커스텀 스크립트 | locale JSON 일관성 |

### Coverage Target

- 유틸리티 함수: 80% 이상
- 컴포넌트: 기본 렌더링 확인
- i18n: 모든 locale 파일 key 일치 100%

### CI/CD (향후)

- PR 시 자동 빌드 + 테스트
- locale JSON key 일관성 검증 자동화

## Example Code Patterns

### i18n 설정 (i18n.ts)

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ko from './locales/ko.json';
import ja from './locales/ja.json';
import zhCN from './locales/zh-CN.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ko: { translation: ko },
    ja: { translation: ja },
    'zh-CN': { translation: zhCN },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
```

### 컴포넌트 패턴 ({Component}.tsx)

```typescript
import { useTranslation } from 'react-i18next';

interface PlayerStatusProps {
  isOnline: boolean;
}

export const PlayerStatus = ({ isOnline }: PlayerStatusProps) => {
  const { t } = useTranslation();

  return (
    <div>
      <h2>{t('signage.player.management.title')}</h2>
      <p>
        {isOnline
          ? t('signage.player.status.online')
          : t('signage.player.status.offline')}
      </p>
    </div>
  );
};
```

### locale JSON 패턴 (en.json)

```json
{
  "signage": {
    "player": {
      "management": {
        "title": "Player Management"
      },
      "status": {
        "online": "Player is online",
        "offline": "Player is offline"
      },
      "action": {
        "restart": "Restart",
        "shutdown": "Shutdown"
      }
    }
  }
}
```

### 테스트 패턴

```typescript
import { describe, it, expect } from 'vitest';
import { generateI18nKey } from './key-generator';

describe('generateI18nKey', () => {
  it('should generate hierarchical key from context', () => {
    const result = generateI18nKey({
      domain: 'signage',
      page: 'player',
      component: 'status',
      element: 'offline',
    });
    expect(result).toBe('signage.player.status.offline');
  });
});
```
