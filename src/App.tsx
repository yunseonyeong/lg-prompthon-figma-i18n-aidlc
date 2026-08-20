import { useState } from 'react';
import { Container, Navbar, Nav } from 'react-bootstrap';
import LanguageSwitcher from './components/LanguageSwitcher';
import StepInput from './components/steps/StepInput';
import StepExtraction from './components/steps/StepExtraction';
import StepGlossary from './components/steps/StepGlossary';
import StepTranslation from './components/steps/StepTranslation';
import StepCodeGen from './components/steps/StepCodeGen';
import StepPreview from './components/steps/StepPreview';
import StepQAGuide from './components/steps/StepQAGuide';
import StepCompare from './components/steps/StepCompare';

const steps = [
  { id: 1, label: 'Figma 입력', icon: '📂' },
  { id: 2, label: '텍스트 추출', icon: '📄' },
  { id: 3, label: '용어집', icon: '📚' },
  { id: 4, label: 'EXAONE 번역', icon: '🤖' },
  { id: 5, label: '코드 생성', icon: '⚛️' },
  { id: 6, label: '미리보기', icon: '🖥️' },
  { id: 7, label: 'QA·법인감수', icon: '✅' },
  { id: 8, label: 'Figma 비교', icon: '🔍' },
];

const TOTAL_STEPS = steps.length;

function App() {
  const [currentStep, setCurrentStep] = useState(1);

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

  const handleGoTo = (step: number) => {
    if (currentStep > step) setCurrentStep(step);
  };

  // 마지막 단계(Step 8)의 "완료". 대시보드로 돌아가 새 파이프라인을 시작할 수 있게 한다.
  const handleComplete = () => {
    setCurrentStep(1);
  };

  return (
    <div className="d-flex flex-column min-vh-100">
      {/* Navbar */}
      <Navbar className="ux-navbar px-4" expand="lg">
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
            const isClickable = currentStep > step.id;
            
            return (
              <div
                key={step.id}
                className={`ux-step ${isClickable ? 'clickable' : ''}`}
                onClick={() => isClickable && handleGoTo(step.id)}
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
        <div className="ux-fade-in">
          {currentStep === 1 && <StepInput onNext={handleNext} />}
          {currentStep === 2 && <StepExtraction onNext={handleNext} onBack={handleBack} />}
          {currentStep === 3 && <StepGlossary onNext={handleNext} onBack={handleBack} />}
          {currentStep === 4 && <StepTranslation onNext={handleNext} onBack={handleBack} />}
          {currentStep === 5 && <StepCodeGen onNext={handleNext} onBack={handleBack} />}
          {currentStep === 6 && <StepPreview onBack={handleBack} onNext={handleNext} />}
          {currentStep === 7 && <StepQAGuide onBack={handleBack} onNext={handleNext} />}
          {currentStep === 8 && <StepCompare onBack={handleBack} onComplete={handleComplete} />}
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
