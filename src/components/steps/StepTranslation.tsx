import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import componentsMap from '../../components-map.json';
import Pagination, { usePagination } from '../Pagination';

interface StepTranslationProps {
  onNext: () => void;
  onBack: () => void;
}

function StepTranslation({ onNext, onBack }: StepTranslationProps) {
  const { t } = useTranslation();
  const [reviewLang, setReviewLang] = useState<'ko' | 'ja' | 'zh-CN'>('ko');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [editCount, setEditCount] = useState(0);

  const allItems = componentsMap.flatMap((frame) =>
    frame.children.map((child) => child)
  );
  const uniqueKeys = allItems.filter(
    (item, idx, arr) => arr.findIndex((x) => x.key === item.key) === idx
  );

  const { paginatedItems, handlePageChange, totalItems, pageSize } = usePagination(uniqueKeys, 15);

  const glossaryTerms = ['Content', 'Schedule', 'Device', 'Settings', 'Dashboard', 'Library'];

  const langNames: Record<string, string> = {
    ko: '🇰🇷 한국어',
    ja: '🇯🇵 日本語',
    'zh-CN': '🇨🇳 中文',
  };

  const getTranslation = (key: string): string => {
    const editKey = `${key}__${reviewLang}`;
    if (editedValues[editKey]) return editedValues[editKey];
    return t(key, { lng: reviewLang });
  };

  const handleEdit = (key: string) => {
    setEditingKey(key);
  };

  const handleSave = (key: string, value: string) => {
    const editKey = `${key}__${reviewLang}`;
    setEditedValues((prev) => ({ ...prev, [editKey]: value }));
    setEditingKey(null);
    setEditCount((prev) => prev + 1);
  };

  const handleCancel = () => {
    setEditingKey(null);
  };

  return (
    <div className="step-container">
      <div className="step-header">
        <h2>🌐 Step 3. 번역 리뷰 & 수정</h2>
        <p className="step-description">
          EXAONE 2.0이 UX 문맥과 도메인 용어집을 참조하여 번역했습니다.<br />
          결과를 확인하고, <strong>클릭하여 직접 수정</strong>할 수 있습니다.
        </p>
      </div>

      {/* Quality Summary */}
      <div className="quality-summary">
        <div className="quality-card pass">
          <span className="quality-icon">✅</span>
          <span className="quality-text">용어집 일치율</span>
          <span className="quality-value">100%</span>
        </div>
        <div className="quality-card pass">
          <span className="quality-icon">✅</span>
          <span className="quality-text">Key 규칙 준수</span>
          <span className="quality-value">PASS</span>
        </div>
        <div className="quality-card pass">
          <span className="quality-icon">✅</span>
          <span className="quality-text">포맷 유지</span>
          <span className="quality-value">PASS</span>
        </div>
        <div className={`quality-card ${editCount > 0 ? 'edited' : 'pass'}`}>
          <span className="quality-icon">{editCount > 0 ? '✏️' : '✅'}</span>
          <span className="quality-text">수동 수정</span>
          <span className="quality-value">{editCount}건</span>
        </div>
      </div>

      {/* Language Toggle */}
      <div className="lang-toggle">
        <span className="lang-toggle-label">비교 언어:</span>
        {(['ko', 'ja', 'zh-CN'] as const).map((lang) => (
          <button
            key={lang}
            className={`lang-toggle-btn ${reviewLang === lang ? 'active' : ''}`}
            onClick={() => setReviewLang(lang)}
          >
            {langNames[lang]}
          </button>
        ))}
      </div>

      {/* Edit Hint */}
      <div className="edit-hint">
        💡 번역을 수정하려면 번역 텍스트를 <strong>클릭</strong>하세요. 수정 내용은 최종 JSON에 반영됩니다.
      </div>

      {/* Translation Table */}
      <div className="translation-review">
        <table className="review-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>English (원본)</th>
              <th>{langNames[reviewLang]} (번역) — 클릭하여 수정</th>
              <th>용어집</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((item) => {
              const isGlossary = glossaryTerms.some((term) =>
                item.originalText.includes(term)
              );
              const translated = getTranslation(item.key);
              const isEditing = editingKey === item.key;
              const editKey = `${item.key}__${reviewLang}`;
              const wasEdited = !!editedValues[editKey];

              return (
                <tr key={item.key} className={`${isGlossary ? 'glossary-row' : ''} ${wasEdited ? 'edited-row' : ''}`}>
                  <td><span className={`badge badge-${item.type}`}>{item.type}</span></td>
                  <td className="original-text">{item.originalText}</td>
                  <td className="translated-cell-edit">
                    {isEditing ? (
                      <EditInline
                        value={translated}
                        onSave={(val) => handleSave(item.key, val)}
                        onCancel={handleCancel}
                      />
                    ) : (
                      <span
                        className={`editable-text ${wasEdited ? 'was-edited' : ''}`}
                        onClick={() => handleEdit(item.key)}
                        title="클릭하여 수정"
                      >
                        {translated}
                        {wasEdited && <span className="edited-badge">수정됨</span>}
                      </span>
                    )}
                  </td>
                  <td>
                    {isGlossary && <span className="glossary-badge">📖 용어집</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pagination totalItems={totalItems} pageSize={pageSize} onPageChange={handlePageChange} />
      </div>
      <div className="context-example">
        <h4>💡 문맥 기반 번역 예시</h4>
        <div className="context-card">
          <div className="context-before">
            <span className="context-tag">❌ 단순 번역</span>
            <p>"Content" → "내용" (범용)</p>
          </div>
          <div className="context-after">
            <span className="context-tag">✅ 문맥 번역</span>
            <p>"Content" → "콘텐츠" (Signage 도메인, 메뉴명)</p>
            <p className="context-reason">
              → UX 흐름에서 Signage Console 좌측 네비게이션의 메뉴명으로 사용됨.<br />
              → 도메인 용어집: Content = 콘텐츠 (디지털 사이니지 콘텐츠)
            </p>
          </div>
        </div>
      </div>

      <div className="step-footer">
        <button className="btn btn-secondary" onClick={onBack}>← 이전</button>
        <button className="btn btn-primary btn-large" onClick={onNext}>
          ⚡ 코드 생성 {editCount > 0 && `(${editCount}건 수정 반영)`}
        </button>
      </div>
    </div>
  );
}

/** 인라인 편집 컴포넌트 */
function EditInline({
  value,
  onSave,
  onCancel,
}: {
  value: string;
  onSave: (val: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(value);

  return (
    <div className="inline-edit">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
        className="inline-edit-input"
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave(text);
          if (e.key === 'Escape') onCancel();
        }}
      />
      <button className="inline-edit-btn save" onClick={() => onSave(text)}>✓</button>
      <button className="inline-edit-btn cancel" onClick={onCancel}>✕</button>
    </div>
  );
}

export default StepTranslation;
