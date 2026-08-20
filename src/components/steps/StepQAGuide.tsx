import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import componentsMap from '../../components-map.json';

/**
 * QA 검증 가이드 자동 생성 화면
 *
 * Pain Point 해결:
 * - QA가 각 i18n key가 어디에 쓰이는지 일일이 개발자에게 물어봐야 했음
 * - components-map.json에서 frame + type 정보를 활용하여 자동으로 위치 가이드 생성
 */

interface QAGuideItem {
  key: string;
  type: string;
  originalText: string;
  frame: string;
  frameId: string;
  location: string;
}

function StepQAGuide({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { t, i18n } = useTranslation();
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set());

  // components-map에서 QA 가이드 데이터 생성
  const qaItems: QAGuideItem[] = componentsMap.flatMap((frame) =>
    frame.children.map((child) => ({
      key: child.key,
      type: child.type,
      originalText: child.originalText,
      frame: frame.frame,
      frameId: frame.frameId,
      location: getLocationDescription(frame.frame, child.type),
    }))
  ).filter(
    (item, idx, arr) => arr.findIndex((x) => x.key === item.key) === idx
  );

  const filteredItems = qaItems.filter((item) => {
    const matchesType = filterType === 'all' || item.type === filterType;
    const matchesSearch = searchQuery === '' ||
      item.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.originalText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t(item.key).toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const progress = checkedKeys.size;
  const total = qaItems.length;
  const progressPercent = Math.round((progress / total) * 100);

  const toggleCheck = (key: string) => {
    setCheckedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="step-container">
      <div className="step-header">
        <h2>📝 QA 검증 가이드</h2>
        <p className="step-description">
          각 i18n key가 UI의 어디에 표시되는지 자동으로 매핑되었습니다.<br />
          QA 담당자는 이 가이드를 보고 각 번역의 위치를 바로 찾을 수 있습니다.
        </p>
      </div>

      {/* Progress */}
      <div className="qa-progress">
        <div className="qa-progress-bar">
          <div className="qa-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
        <span className="qa-progress-text">
          검증 완료: {progress} / {total} ({progressPercent}%)
        </span>
      </div>

      {/* Pain Point Callout */}
      <div className="qa-callout">
        <div className="callout-icon">💡</div>
        <div className="callout-content">
          <strong>이전 방식:</strong> QA가 개발자에게 "이 key 어디에 있어요?" 일일이 질문 → 반나절 소요<br />
          <strong>지금:</strong> components-map.json에서 <strong>프레임 + 위치가 자동 매핑</strong>되어 즉시 확인 가능
        </div>
      </div>

      {/* Filters */}
      <div className="qa-filters">
        <div className="qa-search">
          <input
            type="text"
            placeholder="Key, 원문, 번역으로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="qa-type-filter">
          {['all', 'title', 'label', 'button', 'placeholder', 'status'].map((type) => (
            <button
              key={type}
              className={`filter-btn ${filterType === type ? 'active' : ''}`}
              onClick={() => setFilterType(type)}
            >
              {type === 'all' ? '전체' : type}
            </button>
          ))}
        </div>
        <div className="qa-lang-info">
          현재 검증 언어: <strong>{i18n.language}</strong>
        </div>
      </div>

      {/* QA Table */}
      <div className="qa-table-wrapper">
        <table className="qa-table">
          <thead>
            <tr>
              <th className="qa-check-col">✓</th>
              <th>UI 위치</th>
              <th>Type</th>
              <th>원문 (EN)</th>
              <th>번역 ({i18n.language})</th>
              <th>i18n Key</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr
                key={item.key}
                className={checkedKeys.has(item.key) ? 'row-checked' : ''}
              >
                <td className="qa-check-col">
                  <input
                    type="checkbox"
                    checked={checkedKeys.has(item.key)}
                    onChange={() => toggleCheck(item.key)}
                  />
                </td>
                <td className="qa-location">
                  <span className="location-frame">{item.frame}</span>
                  <span className="location-desc">{item.location}</span>
                </td>
                <td><span className={`badge badge-${item.type}`}>{item.type}</span></td>
                <td className="qa-original">{item.originalText}</td>
                <td className="qa-translated">{t(item.key)}</td>
                <td className="qa-key"><code>{item.key}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="qa-summary">
        <span>총 {filteredItems.length}개 항목 표시</span>
        {searchQuery && <span> (필터: "{searchQuery}")</span>}
      </div>

      <div className="step-footer">
        <button className="btn btn-secondary" onClick={onBack}>← 이전</button>
        <button className="btn btn-outline" onClick={() => setCheckedKeys(new Set())}>
          체크 초기화
        </button>
        <button className="btn btn-primary btn-large" onClick={onNext}>
          🔍 Figma 비교
        </button>
      </div>
    </div>
  );
}

/** Frame 이름과 type으로 UI 위치 설명 자동 생성 */
function getLocationDescription(frame: string, type: string): string {
  if (frame.includes('Setting') || frame.includes('Console')) {
    switch (type) {
      case 'title': return '페이지/섹션 제목';
      case 'button': return '액션 버튼 영역';
      case 'label': return '폼 필드 또는 메뉴';
      case 'placeholder': return '입력 필드 힌트';
      case 'status': return '상태 표시 영역';
      default: return '본문';
    }
  }
  if (frame.includes('Doc')) {
    switch (type) {
      case 'title': return '문서 제목';
      case 'status': return '문서 상태 뱃지';
      case 'label': return '문서 설명';
      default: return '문서 영역';
    }
  }
  return '일반 영역';
}

export default StepQAGuide;
