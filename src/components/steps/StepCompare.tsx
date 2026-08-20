import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import componentsMap from '../../components-map.json';

/**
 * US-3.4: Figma ↔ 코드 비교 화면
 *
 * 좌측: Figma 원본 텍스트 (English, design source)
 * 우측: 생성된 코드의 번역 결과 (현재 선택 언어)
 *
 * 프레임 단위로 비교 가능, 변경된 부분 하이라이트
 */

interface StepCompareProps {
  onBack: () => void;
}

function StepCompare({ onBack }: StepCompareProps) {
  const { t, i18n } = useTranslation();
  const [selectedFrame, setSelectedFrame] = useState(0);

  const frame = componentsMap[selectedFrame];
  const uniqueChildren = frame.children.filter(
    (child, idx, arr) => arr.findIndex((x) => x.key === child.key) === idx
  );

  // 번역이 원문과 다른지 체크
  const isDifferent = (key: string, original: string): boolean => {
    const translated = t(key);
    return translated !== original;
  };

  const totalChanged = uniqueChildren.filter((child) =>
    isDifferent(child.key, child.originalText)
  ).length;

  return (
    <div className="step-container">
      <div className="step-header">
        <h2>🔍 Figma ↔ 코드 비교</h2>
        <p className="step-description">
          Figma 원본 텍스트와 생성된 코드의 번역 결과를 나란히 비교합니다.<br />
          디자이너가 의도한 내용이 정확하게 번역되었는지 확인할 수 있습니다.
        </p>
      </div>

      {/* Frame Selector */}
      <div className="compare-frame-selector">
        {componentsMap.map((f, idx) => (
          <button
            key={f.frameId}
            className={`frame-tab ${selectedFrame === idx ? 'active' : ''}`}
            onClick={() => setSelectedFrame(idx)}
          >
            {f.frame}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="compare-stats">
        <span className="compare-stat">
          📄 프레임: <strong>{frame.frame}</strong>
        </span>
        <span className="compare-stat">
          🔑 Key 수: <strong>{uniqueChildren.length}</strong>
        </span>
        <span className="compare-stat">
          🌐 비교 언어: <strong>{i18n.language}</strong>
        </span>
        <span className="compare-stat">
          {i18n.language === 'en' ? (
            <span className="compare-same">✅ 원문과 동일 (English)</span>
          ) : (
            <span className="compare-diff">🔄 변경됨: {totalChanged}/{uniqueChildren.length}</span>
          )}
        </span>
      </div>

      {/* Comparison View */}
      <div className="compare-view">
        {/* Header */}
        <div className="compare-row compare-header-row">
          <div className="compare-col compare-left">
            <span className="col-label">🎨 Figma 원본 (English)</span>
          </div>
          <div className="compare-col compare-right">
            <span className="col-label">⚛️ 코드 출력 ({i18n.language})</span>
          </div>
        </div>

        {/* Items */}
        {uniqueChildren.map((child) => {
          const translated = t(child.key);
          const changed = translated !== child.originalText;

          return (
            <div
              key={child.key}
              className={`compare-row ${changed ? 'row-changed' : 'row-same'}`}
            >
              <div className="compare-col compare-left">
                <span className={`badge badge-${child.type}`}>{child.type}</span>
                <span className="compare-text">{child.originalText}</span>
              </div>
              <div className="compare-col compare-right">
                <span className="compare-text translated">
                  {translated}
                </span>
                {changed && <span className="change-indicator">●</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="compare-legend">
        <span className="legend-item">
          <span className="legend-dot changed" /> 번역됨 (원문과 다름)
        </span>
        <span className="legend-item">
          <span className="legend-dot same" /> 동일 (영문 유지)
        </span>
      </div>

      {/* Code mapping info */}
      <div className="compare-code-info">
        <h4>💡 코드에서의 사용</h4>
        <div className="code-mapping-sample">
          <code className="mapping-line">
            {`// Figma: "${uniqueChildren[0]?.originalText}"`}
          </code>
          <code className="mapping-line">
            {`// Code:  {t('${uniqueChildren[0]?.key}')}`}
          </code>
          <code className="mapping-line">
            {`// ${i18n.language}: "${t(uniqueChildren[0]?.key || '')}"`}
          </code>
        </div>
      </div>

      <div className="step-footer">
        <button className="btn btn-secondary" onClick={onBack}>← 이전</button>
      </div>
    </div>
  );
}

export default StepCompare;
