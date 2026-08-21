/**
 * 생성된 컴포넌트를 그대로 렌더링한다.
 *
 * Step 8이 만든 `src/components/generated/*.tsx`를 실제로 import해서 화면에 띄운다.
 * Figma 구조를 다시 그리는 것(FigmaFrameRenderer)이 아니라 "생성된 코드의 실행 결과"다.
 * 두 결과가 같아야 정상이며, 다르면 생성기와 렌더러 규칙이 어긋난 것이다.
 *
 * ## import.meta.glob을 쓰는 이유
 * 배럴(`generated/index.ts`)을 static import하면 폴더가 비었을 때 모듈을 못 찾아
 * 빌드가 깨진다(locale JSON에서 이미 겪은 문제다). glob은 매칭 결과가 없어도
 * 빈 객체가 되므로 "아직 생성 안 됨" 상태를 화면에서 다룰 수 있다.
 *
 * 주의: glob은 dev 서버/빌드 시점에 해석된다. 파이프라인이 방금 만든 파일은
 * Vite가 변경을 감지해 다시 불러온다(HMR). 반영이 안 보이면 새로고침하면 된다.
 */

import { Component, Suspense, lazy, useMemo, type ErrorInfo, type ReactNode } from 'react';
import { Alert, Spinner } from 'react-bootstrap';

/** path → 지연 import. 값이 없으면 아직 생성되지 않은 상태다. */
const GENERATED_MODULES = import.meta.glob('./generated/*.tsx') as Record<
  string,
  () => Promise<{ default?: unknown }>
>;

export interface GeneratedEntry {
  /** 컴포넌트 이름 (= 파일명) */
  name: string;
  /** glob 키 (예: './generated/ConsoleSettingGroupUser.tsx') */
  path: string;
}

/** 생성된 컴포넌트 목록 (이름 오름차순) */
export function listGeneratedComponents(): GeneratedEntry[] {
  return Object.keys(GENERATED_MODULES)
    .map((path) => ({ path, name: path.replace(/^.*\//, '').replace(/\.tsx$/, '') }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * 렌더 에러 격리.
 *
 * 생성된 코드는 자동 산출물이라 런타임 에러가 날 수 있다. 그대로 두면 Step 6 화면
 * 전체가 하얗게 죽으므로 여기서 잡아 무엇이 실패했는지 보여준다.
 */
class RenderErrorBoundary extends Component<
  { name: string; children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[GeneratedComponentPreview] 렌더 실패', error, info.componentStack);
  }

  componentDidUpdate(prev: { name: string }) {
    // 다른 컴포넌트를 고르면 에러 상태를 초기화한다
    if (prev.name !== this.props.name && this.state.error) this.setState({ error: null });
  }

  render() {
    if (this.state.error) {
      return (
        <Alert variant="danger" className="mb-0">
          <Alert.Heading className="h6">
            생성된 컴포넌트를 렌더링하지 못했습니다 — {this.props.name}.tsx
          </Alert.Heading>
          <pre className="small mb-2" style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error.message}
          </pre>
          <div className="small text-muted mb-0">
            Step 5에서 코드를 다시 생성하거나 해당 파일을 직접 확인하세요.
          </div>
        </Alert>
      );
    }
    return this.props.children;
  }
}

interface GeneratedComponentPreviewProps {
  /** 렌더할 컴포넌트 이름 (listGeneratedComponents의 name) */
  name: string;
}

function GeneratedComponentPreview({ name }: GeneratedComponentPreviewProps) {
  const entry = useMemo(() => listGeneratedComponents().find((e) => e.name === name), [name]);

  const LazyComponent = useMemo(() => {
    if (!entry) return null;
    return lazy(async () => {
      const mod = await GENERATED_MODULES[entry.path]();
      if (typeof mod.default !== 'function') {
        throw new Error(`${entry.name}.tsx에 default export가 없습니다.`);
      }
      return { default: mod.default as React.ComponentType };
    });
  }, [entry]);

  if (!entry || !LazyComponent) {
    return (
      <Alert variant="secondary" className="mb-0 small">
        <strong>{name}</strong> 컴포넌트를 찾을 수 없습니다. Step 5에서 코드 생성을 먼저 실행하세요.
      </Alert>
    );
  }

  return (
    <RenderErrorBoundary name={name}>
      <Suspense
        fallback={
          <div className="text-center py-4 text-muted small">
            <Spinner animation="border" size="sm" className="me-2" />
            {name}.tsx 불러오는 중...
          </div>
        }
      >
        <LazyComponent />
      </Suspense>
    </RenderErrorBoundary>
  );
}

export default GeneratedComponentPreview;
