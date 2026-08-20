import { useState } from 'react';
import LanguageSwitcher from './components/LanguageSwitcher';
import StepInput from './components/steps/StepInput';
import StepExtraction from './components/steps/StepExtraction';
import StepGlossary from './components/steps/StepGlossary';
import StepTranslation from './components/steps/StepTranslation';
import StepCodeGen from './components/steps/StepCodeGen';
import StepPreview from './components/steps/StepPreview';
import StepQAGuide from './components/steps/StepQAGuide';
import StepCompare from './components/steps/StepCompare';
import './styles/global.css';

/**
 * Figma i18n DLC — User Journey Demo
 *
 * Step 1: Figma URL 입력
 * Step 2: 텍스트 추출 결과 확인
 * Step 3: 용어집 관리 (번역 전 용어 확인/수정)
 * Step 4: 번역 리뷰 & 수정 (인라인 편집 가능)
 * Step 5: 코드 생성
 * Step 6: 실제 화면 미리보기 (언어 전환)
 * Step 7: QA 검증 가이드
 * Step 8: Figma ↔ 코드 비교
 */

const steps = [
  { id: 1, label: 'Figma 입력', icon: '🎨' },
  { id: 2, label: '텍스트 추출', icon: '📋' },
  { id: 3, label: '용어집', icon: '📚' },
  { id: 4, label: '번역 리뷰', icon: '🌐' },
  { id: 5, label: '코드 생성', icon: '⚡' },
  { id: 6, label: '미리보기', icon: '🖥️' },
  { id: 7, label: 'QA 가이드', icon: '📝' },
  { id: 8, label: 'Figma 비교', icon: '🔍' },
];

const TOTAL_STEPS = steps.length;

function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleNext = () => {
    if (currentStep === 3) {
      // 용어집 → 번역: AI 처리 시뮬레이션
      setIsProcessing(true);
      setTimeout(() => {
        setIsProcessing(false);
        setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
      }, 2000);
    } else if (currentStep === 1 || currentStep === 4) {
      // Figma 분석, 코드 생성: AI 처리 시뮬레이션
      setIsProcessing(true);
      setTimeout(() => {
        setIsProcessing(false);
        setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
      }, 1500);
    } else {
      setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleGoTo = (step: number) => {
    if (currentStep > step) setCurrentStep(step);
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <span className="header-logo">🔄</span>
          <h1 className="header-title">Figma i18n DLC</h1>
          <span className="header-subtitle">Design → Localization → Code</span>
        </div>
        <div className="header-right">
          {currentStep >= 6 && <LanguageSwitcher />}
        </div>
      </header>

      {/* Step Indicator */}
      <div className="step-indicator">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`step-item ${currentStep === step.id ? 'active' : ''} ${currentStep > step.id ? 'done' : ''}`}
            onClick={() => handleGoTo(step.id)}
          >
            <span className="step-icon">
              {currentStep > step.id ? '✅' : step.icon}
            </span>
            <span className="step-label">{step.label}</span>
          </div>
        ))}
        <div
          className="step-progress-bar"
          style={{ width: `${((currentStep - 1) / (TOTAL_STEPS - 1)) * 100}%` }}
        />
      </div>

      {/* Main Content */}
      <main className="main-content">
        {isProcessing && (
          <div className="processing-overlay">
            <div className="processing-spinner" />
            <p className="processing-text">
              {currentStep === 1 && 'Figma MCP로 파일을 분석하고 있습니다...'}
              {currentStep === 3 && 'EXAONE 2.0으로 용어집 기반 번역 중...'}
              {currentStep === 4 && 'React 컴포넌트를 생성하고 있습니다...'}
            </p>
          </div>
        )}

        {!isProcessing && (
          <>
            {currentStep === 1 && <StepInput onNext={handleNext} />}
            {currentStep === 2 && <StepExtraction onNext={handleNext} onBack={handleBack} />}
            {currentStep === 3 && <StepGlossary onNext={handleNext} onBack={handleBack} />}
            {currentStep === 4 && <StepTranslation onNext={handleNext} onBack={handleBack} />}
            {currentStep === 5 && <StepCodeGen onNext={handleNext} onBack={handleBack} />}
            {currentStep === 6 && <StepPreview onBack={handleBack} onNext={handleNext} />}
            {currentStep === 7 && <StepQAGuide onBack={handleBack} onNext={handleNext} />}
            {currentStep === 8 && <StepCompare onBack={handleBack} />}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
