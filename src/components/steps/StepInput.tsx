import { useState } from 'react';

interface StepInputProps {
  onNext: () => void;
}

function StepInput({ onNext }: StepInputProps) {
  const [url, setUrl] = useState('https://www.figma.com/design/abc123/LG-Signage-Console');

  return (
    <div className="step-container">
      <div className="step-header">
        <h2>🎨 Step 1. Figma 파일 입력</h2>
        <p className="step-description">
          번역할 Figma 파일의 URL을 입력하세요.<br />
          AI가 UX 시나리오를 분석하여 텍스트를 자동 추출합니다.
        </p>
      </div>

      <div className="input-card">
        <label className="input-label">Figma File URL</label>
        <div className="url-input-row">
          <input
            type="text"
            className="url-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.figma.com/design/..."
          />
        </div>

        <div className="options-grid">
          <div className="option-item">
            <label>대상 언어</label>
            <div className="tag-list">
              <span className="tag active">🇺🇸 English</span>
              <span className="tag active">🇰🇷 한국어</span>
              <span className="tag active">🇯🇵 日本語</span>
              <span className="tag active">🇨🇳 中文</span>
            </div>
          </div>

          <div className="option-item">
            <label>도메인</label>
            <select className="option-select">
              <option>Signage (자동 감지)</option>
              <option>WebOS</option>
              <option>ThinQ</option>
            </select>
          </div>

          <div className="option-item">
            <label>용어집</label>
            <span className="option-value">✅ domain-glossary.md (32개 용어 등록)</span>
          </div>
        </div>
      </div>

      <div className="info-card">
        <h4>💡 이 도구가 하는 일</h4>
        <div className="info-steps">
          <div className="info-step">
            <span className="info-num">1</span>
            <span>Figma MCP로 페이지/프레임 구조와 텍스트 노드를 추출합니다</span>
          </div>
          <div className="info-step">
            <span className="info-num">2</span>
            <span>UX 흐름(화면 순서)을 분석하여 문맥을 파악합니다</span>
          </div>
          <div className="info-step">
            <span className="info-num">3</span>
            <span>도메인 용어집을 참조하여 i18n key를 자동 생성합니다</span>
          </div>
          <div className="info-step">
            <span className="info-num">4</span>
            <span>EXAONE 2.0으로 4개 언어 문맥 기반 번역을 수행합니다</span>
          </div>
          <div className="info-step">
            <span className="info-num">5</span>
            <span>React 컴포넌트와 i18n JSON 파일을 자동 생성합니다</span>
          </div>
        </div>
      </div>

      <div className="step-footer">
        <button className="btn btn-primary btn-large" onClick={onNext} disabled={!url}>
          🚀 분석 시작
        </button>
      </div>
    </div>
  );
}

export default StepInput;
