import { useEffect, useState } from 'react';
import { Alert, Button, Container, Navbar, Nav } from 'react-bootstrap';
import { Skeleton, SkeletonRegion, SkeletonList, SkeletonStatCards } from './components/Skeleton';
import LanguageSwitcher from './components/LanguageSwitcher';
import { loadLocalesFromApi, type LocaleLoadResult } from './i18n';
import StepInput from './components/steps/StepInput';
import StepExtraction from './components/steps/StepExtraction';
import StepGlossary from './components/steps/StepGlossary';
import StepTranslation from './components/steps/StepTranslation';
import StepCodeGen from './components/steps/StepCodeGen';
import StepPreview from './components/steps/StepPreview';
import StepQAGuide from './components/steps/StepQAGuide';

const steps = [
  { id: 1, label: 'Figma 입력', icon: '📂' },
  { id: 2, label: '텍스트 추출', icon: '📄' },
  { id: 3, label: '용어집', icon: '📚' },
  { id: 4, label: 'EXAONE 번역', icon: '🤖' },
  { id: 5, label: '코드 생성', icon: '⚛️' },
  { id: 6, label: '미리보기', icon: '🖥️' },
  { id: 7, label: 'QA·법인감수', icon: '✅' },
];

const TOTAL_STEPS = steps.length;

function App() {
  const [currentStep, setCurrentStep] = useState(1);

  // locale은 번들에 없고 런타임에 API에서 받는다 (src/i18n.ts 주석 참고).
  // 앱 진입 시 1회 로드하고, 상태를 화면에 드러내 "번역이 아직 없음"을 감추지 않는다.
  const [localeState, setLocaleState] = useState<{
    loading: boolean;
    result: LocaleLoadResult | null;
  }>({ loading: true, result: null });

  useEffect(() => {
    let cancelled = false;
    void loadLocalesFromApi().then((result) => {
      if (!cancelled) setLocaleState({ loading: false, result });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 이전에는 step 1/3/4에서 setTimeout(1500)으로 "Figma MCP 분석 중..." 스피너를 보여줬다.
  // 실제로는 아무 작업도 하지 않는 연출이었으므로 제거했다.
  // 실제 처리는 각 Step 컴포넌트가 API를 호출하며 자체 로딩 상태를 표시한다.
  //   - Step 5 StepCodeGen  → POST /api/pipeline/run (SSE 진행률)
  //   - Step 6 StepPreview  → GET  /api/figma/structure (Figma MCP)
  const handleNext = () => {
    setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  /**
   * 스텝 자유 이동.
   *
   * 이전에는 `if (currentStep > step)`으로 뒤로만 갈 수 있었다.
   * 그 결과 산출물이 없는 상태에서 Step 2가 에러 화면이 되면
   * 파이프라인 실행 버튼이 있는 Step 5에 도달할 방법이 없어 데드락이 됐다.
   * 데모 도구에서 순차 진행을 강제할 이유가 없으므로 양방향 이동을 허용한다.
   */
  const handleGoTo = (step: number) => {
    setCurrentStep(Math.min(Math.max(step, 1), TOTAL_STEPS));
  };

  /** 산출물이 없을 때 파이프라인 실행 화면(Step 5)으로 바로 보낸다 */
  const handleGoToPipeline = () => setCurrentStep(5);

  // 마지막 단계(Step 8)의 "완료". 대시보드로 돌아가 새 파이프라인을 시작할 수 있게 한다.
  const handleComplete = () => {
    setCurrentStep(1);
  };

  return (
    <div className="d-flex flex-column min-vh-100">
      {/* Navbar */}
      {/*
        data-bs-theme="dark" 필수.
        .ux-navbar는 짙은 남색 배경인데 이 속성이 없으면 Bootstrap이 light 기본값을 적용해
        .navbar-brand 색상이 rgba(0,0,0,.9)(거의 검정)가 되어 로고 글씨가 안 보인다.
      */}
      <Navbar className="ux-navbar px-4" expand="lg" data-bs-theme="dark">
        <Navbar.Brand className="d-flex align-items-center gap-3">
          <div className="brand-icon">🌐</div>
          <div>
            <div className="fw-bold fs-5">UX DLC</div>
            <div className="brand-subtitle d-none d-md-block">
              Design → Localization → Code
            </div>
          </div>
        </Navbar.Brand>
        <Nav className="ms-auto d-flex align-items-center gap-3">
          <Nav.Item className="d-none d-lg-block">
            <span className="text-white-50 small">Powered by EXAONE 2.0</span>
          </Nav.Item>
          {currentStep >= 6 && <LanguageSwitcher />}
        </Nav>
      </Navbar>

      {/* Step Progress */}
      <div className="ux-steps-container py-3 px-4">
        <div className="d-flex justify-content-between align-items-start position-relative">
          {steps.map((step) => {
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;

            return (
              <div
                key={step.id}
                // 모든 단계를 클릭 가능하게 한다 (위 handleGoTo 주석의 데드락 사유)
                className="ux-step clickable"
                role="button"
                tabIndex={0}
                title={`${step.id}. ${step.label}로 이동`}
                onClick={() => handleGoTo(step.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleGoTo(step.id);
                  }
                }}
              >
                <div
                  className={`ux-step-circle ${
                    isActive ? 'active' : isCompleted ? 'completed' : 'pending'
                  }`}
                >
                  {isCompleted ? '✓' : step.icon}
                </div>
                <div
                  className={`ux-step-label ${
                    isActive ? 'active' : isCompleted ? 'completed' : ''
                  }`}
                >
                  {step.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <Container className="flex-grow-1 py-4">
        {/* 번역 리소스 상태를 명시한다. 번들에 박힌 값이 아니라 파이프라인 산출물을 쓴다는 점이 드러나야 한다. */}
        {localeState.loading ? (
          <SkeletonRegion label="번역 리소스를 불러오는 중">
            {/* 헤더: 제목 + 배지 */}
            <div className="d-flex align-items-center justify-content-between mb-4">
              <div>
                <Skeleton width={180} height="1.5rem" className="mb-2" />
                <Skeleton width={300} height="0.85rem" />
              </div>
              <div className="d-flex gap-2">
                <Skeleton width={140} height="1.75rem" style={{ borderRadius: 9999 }} />
                <Skeleton width={110} height="1.75rem" style={{ borderRadius: 9999 }} />
              </div>
            </div>
            {/* 탭 목록 */}
            <div className="d-flex gap-2 mb-4">
              <Skeleton width={90} height="2rem" style={{ borderRadius: 6 }} />
              <Skeleton width={100} height="2rem" style={{ borderRadius: 6 }} />
              <Skeleton width={110} height="2rem" style={{ borderRadius: 6 }} />
            </div>
            {/* 통계 카드 4개 */}
            <SkeletonStatCards count={4} />
            {/* 파일 목록 */}
            <div className="card mt-4">
              <div className="card-header py-2">
                <Skeleton width={120} height="0.85rem" />
              </div>
              <SkeletonList items={5} />
            </div>
          </SkeletonRegion>
        ) : null}
        {!localeState.loading && localeState.result?.loaded.length === 0 && (
          <Alert variant="warning" className="d-flex align-items-start gap-3">
            <span className="fs-4">🈳</span>
            <div className="small flex-grow-1">
              <strong>번역 리소스가 없습니다.</strong>
              <div className="text-muted">
                i18n 키가 번역문 대신 키 문자열로 표시됩니다. 파이프라인을 실행하면 생성됩니다.
              </div>
              <div className="text-muted mt-1">
                API 서버가 꺼져 있어도 이 상태가 됩니다 — <code>npm run dev:all</code> 확인
              </div>
            </div>
            {currentStep !== 5 && (
              <Button size="sm" variant="warning" className="flex-shrink-0" onClick={handleGoToPipeline}>
                ⚡ 파이프라인 실행
              </Button>
            )}
          </Alert>
        )}
        {!localeState.loading &&
          localeState.result &&
          localeState.result.loaded.length > 0 &&
          localeState.result.failed.length > 0 && (
            <Alert variant="warning" className="py-2 small">
              일부 언어를 불러오지 못했습니다: {localeState.result.failed.join(', ')}
            </Alert>
          )}

        <div className="ux-fade-in">
          {!localeState.loading && currentStep === 1 && (
            <StepInput onNext={handleNext} onGoToPipeline={handleGoToPipeline} />
          )}
          {!localeState.loading && currentStep === 2 && (
            <StepExtraction
              onNext={handleNext}
              onBack={handleBack}
              onGoToPipeline={handleGoToPipeline}
            />
          )}
          {!localeState.loading && currentStep === 3 && <StepGlossary onNext={handleNext} onBack={handleBack} />}
          {!localeState.loading && currentStep === 4 && (
            <StepTranslation
              onNext={handleNext}
              onBack={handleBack}
              onGoToPipeline={handleGoToPipeline}
            />
          )}
          {!localeState.loading && currentStep === 5 && <StepCodeGen onNext={handleNext} onBack={handleBack} />}
          {!localeState.loading && currentStep === 6 && <StepPreview onBack={handleBack} onNext={handleNext} />}
          {!localeState.loading && currentStep === 7 && (
            <StepQAGuide
              onBack={handleBack}
              onComplete={handleComplete}
              onGoToPipeline={handleGoToPipeline}
            />
          )}
        </div>
      </Container>

      {/* Footer */}
      <footer className="ux-footer text-center">
        <span className="me-2">🚀</span>
        Powered by <strong>EXAONE 2.0</strong> · LG AI Research
        <span className="mx-2">|</span>
        <span className="opacity-75">AI-Driven Localization & Code Generation</span>
      </footer>
    </div>
  );
}

export default App;
