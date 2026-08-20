import componentsMap from '../../components-map.json';
import Pagination, { usePagination } from '../Pagination';

interface StepExtractionProps {
  onNext: () => void;
  onBack: () => void;
}

function StepExtraction({ onNext, onBack }: StepExtractionProps) {
  const allItems = componentsMap.flatMap((frame) =>
    frame.children.map((child) => ({
      ...child,
      frame: frame.frame,
    }))
  );

  const uniqueKeys = allItems.filter(
    (item, idx, arr) => arr.findIndex((x) => x.key === item.key) === idx
  );

  const { paginatedItems, handlePageChange, totalItems, pageSize } = usePagination(uniqueKeys, 15);

  const typeCount = {
    title: uniqueKeys.filter((x) => x.type === 'title').length,
    label: uniqueKeys.filter((x) => x.type === 'label').length,
    button: uniqueKeys.filter((x) => x.type === 'button').length,
    placeholder: uniqueKeys.filter((x) => x.type === 'placeholder').length,
    status: uniqueKeys.filter((x) => x.type === 'status').length,
  };

  return (
    <div className="step-container">
      <div className="step-header">
        <h2>📋 Step 2. 텍스트 추출 결과</h2>
        <p className="step-description">
          Figma 파일에서 <strong>{allItems.length}개 텍스트</strong>를 추출하고,
          중복 제거 후 <strong>{uniqueKeys.length}개 고유 i18n key</strong>를 생성했습니다.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="extraction-summary">
        <div className="summary-card">
          <span className="summary-number">{componentsMap.length}</span>
          <span className="summary-label">Figma Frames</span>
        </div>
        <div className="summary-card">
          <span className="summary-number">{allItems.length}</span>
          <span className="summary-label">총 텍스트</span>
        </div>
        <div className="summary-card highlight">
          <span className="summary-number">{uniqueKeys.length}</span>
          <span className="summary-label">고유 Keys</span>
        </div>
        <div className="summary-card">
          <span className="summary-number">4</span>
          <span className="summary-label">번역 언어</span>
        </div>
      </div>

      {/* Type Breakdown */}
      <div className="type-breakdown">
        <h4>텍스트 유형 분류</h4>
        <div className="type-bars">
          {Object.entries(typeCount).map(([type, count]) => (
            <div key={type} className="type-bar-row">
              <span className={`badge badge-${type}`}>{type}</span>
              <div className="type-bar">
                <div
                  className="type-bar-fill"
                  style={{ width: `${(count / uniqueKeys.length) * 100}%` }}
                />
              </div>
              <span className="type-count">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Frame Breakdown */}
      <div className="frame-list">
        <h4>프레임별 추출 결과</h4>
        {componentsMap.map((frame) => (
          <div key={frame.frameId} className="frame-item">
            <div className="frame-item-header">
              <strong>{frame.frame}</strong>
              <code>{frame.frameId}</code>
              <span className="frame-count">{frame.children.length}개 텍스트</span>
            </div>
          </div>
        ))}
      </div>

      {/* Key Sample */}
      <div className="key-sample">
        <h4>생성된 i18n Key 목록 ({uniqueKeys.length}개)</h4>
        <table className="sample-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>i18n Key</th>
              <th>Original Text</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((item) => (
              <tr key={item.key}>
                <td><span className={`badge badge-${item.type}`}>{item.type}</span></td>
                <td><code>{item.key}</code></td>
                <td>{item.originalText}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination totalItems={totalItems} pageSize={pageSize} onPageChange={handlePageChange} />
      </div>

      <div className="step-footer">
        <button className="btn btn-secondary" onClick={onBack}>← 이전</button>
        <button className="btn btn-primary btn-large" onClick={onNext}>
          🌐 번역 시작 (EXAONE)
        </button>
      </div>
    </div>
  );
}

export default StepExtraction;
