import { useState } from 'react';

/**
 * 용어집 관리 화면
 *
 * Pain Point: 도메인 용어를 관리할 곳이 없어서
 * - 번역자마다 다르게 번역
 * - "Player"를 어떤 화면에선 "플레이어", 어떤 화면에선 "재생 장치"
 * - 용어 결정 후에도 문서로만 관리 → 실제 적용 안 됨
 *
 * 해결: 용어집을 UI에서 직접 관리하고, 번역 파이프라인에 강제 적용
 */

interface GlossaryTerm {
  id: string;
  term: string;
  ko: string;
  ja: string;
  zhCN: string;
  context: string;
  doNotTranslate: boolean;
}

const initialGlossary: GlossaryTerm[] = [
  { id: '1', term: 'Content', ko: '콘텐츠', ja: 'コンテンツ', zhCN: '内容', context: 'Signage 메뉴명', doNotTranslate: false },
  { id: '2', term: 'Device', ko: '디바이스', ja: 'デバイス', zhCN: '设备', context: 'Signage 장치', doNotTranslate: false },
  { id: '3', term: 'Schedule', ko: '스케줄', ja: 'スケジュール', zhCN: '日程', context: '콘텐츠 배포 일정', doNotTranslate: false },
  { id: '4', term: 'Dashboard', ko: '대시보드', ja: 'ダッシュボード', zhCN: '仪表板', context: '관리 콘솔 메인', doNotTranslate: false },
  { id: '5', term: 'Workspace', ko: '워크스페이스', ja: 'ワークスペース', zhCN: '工作区', context: 'Signage 관리 단위', doNotTranslate: false },
  { id: '6', term: 'Player', ko: '재생 장치', ja: 'プレーヤー', zhCN: '播放器', context: 'Signage 재생 장치', doNotTranslate: false },
  { id: '7', term: 'Videowall', ko: '비디오월', ja: 'ビデオウォール', zhCN: '视频墙', context: '대형 디스플레이', doNotTranslate: false },
  { id: '8', term: 'LG Electronics', ko: '', ja: '', zhCN: '', context: '회사명', doNotTranslate: true },
  { id: '9', term: 'UTC', ko: '', ja: '', zhCN: '', context: '시간대 표기', doNotTranslate: true },
  { id: '10', term: 'SSO', ko: '', ja: '', zhCN: '', context: '기술 약어', doNotTranslate: true },
];

interface StepGlossaryProps {
  onBack: () => void;
  onNext: () => void;
}

function StepGlossary({ onBack, onNext }: StepGlossaryProps) {
  const [glossary, setGlossary] = useState<GlossaryTerm[]>(initialGlossary);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTerm, setNewTerm] = useState({ term: '', ko: '', ja: '', zhCN: '', context: '' });
  const [filter, setFilter] = useState<'all' | 'translate' | 'dnt'>('all');
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);

  const filtered = glossary.filter((term) => {
    if (filter === 'translate') return !term.doNotTranslate;
    if (filter === 'dnt') return term.doNotTranslate;
    return true;
  });

  const handleAdd = () => {
    if (!newTerm.term.trim()) return;
    const term: GlossaryTerm = {
      id: Date.now().toString(),
      ...newTerm,
      doNotTranslate: false,
    };
    setGlossary((prev) => [...prev, term]);
    setNewTerm({ term: '', ko: '', ja: '', zhCN: '', context: '' });
    setShowAddForm(false);
  };

  const handleDelete = (id: string) => {
    setGlossary((prev) => prev.filter((t) => t.id !== id));
  };

  const toggleDNT = (id: string) => {
    setGlossary((prev) =>
      prev.map((t) => (t.id === id ? { ...t, doNotTranslate: !t.doNotTranslate } : t))
    );
  };

  const handleCellEdit = (id: string, field: string, value: string) => {
    setGlossary((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
    setEditingCell(null);
  };

  return (
    <div className="step-container">
      <div className="step-header">
        <h2>📚 용어집 관리</h2>
        <p className="step-description">
          도메인 용어를 등록하면 번역 파이프라인에서 <strong>강제 적용</strong>됩니다.<br />
          "번역 금지" 설정으로 고유명사나 시스템 값이 번역되는 것을 방지합니다.
        </p>
      </div>

      {/* Stats */}
      <div className="glossary-stats">
        <div className="glossary-stat">
          <span className="stat-number">{glossary.filter((t) => !t.doNotTranslate).length}</span>
          <span className="stat-label">번역 용어</span>
        </div>
        <div className="glossary-stat">
          <span className="stat-number">{glossary.filter((t) => t.doNotTranslate).length}</span>
          <span className="stat-label">번역 금지</span>
        </div>
        <div className="glossary-stat">
          <span className="stat-number">4</span>
          <span className="stat-label">지원 언어</span>
        </div>
      </div>

      {/* Callout */}
      <div className="glossary-callout">
        <strong>💡 용어집의 역할:</strong> 여기 등록된 용어는 AI 번역 시 우선 적용됩니다. 
        "Player"를 "재생 장치"로 등록하면, 어떤 화면에서든 일관되게 번역됩니다.
      </div>

      {/* Actions */}
      <div className="glossary-actions">
        <div className="filter-group">
          <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
            전체 ({glossary.length})
          </button>
          <button className={`filter-btn ${filter === 'translate' ? 'active' : ''}`} onClick={() => setFilter('translate')}>
            번역 용어
          </button>
          <button className={`filter-btn ${filter === 'dnt' ? 'active' : ''}`} onClick={() => setFilter('dnt')}>
            🚫 번역 금지
          </button>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
          + 용어 추가
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="glossary-add-form">
          <h4>새 용어 추가</h4>
          <div className="add-form-grid">
            <div className="add-field">
              <label>영문 용어 *</label>
              <input
                type="text"
                value={newTerm.term}
                onChange={(e) => setNewTerm((p) => ({ ...p, term: e.target.value }))}
                placeholder="Player"
              />
            </div>
            <div className="add-field">
              <label>한국어</label>
              <input
                type="text"
                value={newTerm.ko}
                onChange={(e) => setNewTerm((p) => ({ ...p, ko: e.target.value }))}
                placeholder="재생 장치"
              />
            </div>
            <div className="add-field">
              <label>日本語</label>
              <input
                type="text"
                value={newTerm.ja}
                onChange={(e) => setNewTerm((p) => ({ ...p, ja: e.target.value }))}
                placeholder="プレーヤー"
              />
            </div>
            <div className="add-field">
              <label>中文</label>
              <input
                type="text"
                value={newTerm.zhCN}
                onChange={(e) => setNewTerm((p) => ({ ...p, zhCN: e.target.value }))}
                placeholder="播放器"
              />
            </div>
            <div className="add-field full-width">
              <label>사용 문맥</label>
              <input
                type="text"
                value={newTerm.context}
                onChange={(e) => setNewTerm((p) => ({ ...p, context: e.target.value }))}
                placeholder="Signage 도메인에서 재생 장치를 의미"
              />
            </div>
          </div>
          <div className="add-form-actions">
            <button className="btn btn-secondary" onClick={() => setShowAddForm(false)}>취소</button>
            <button className="btn btn-primary" onClick={handleAdd} disabled={!newTerm.term.trim()}>추가</button>
          </div>
        </div>
      )}

      {/* Glossary Table */}
      <div className="glossary-table-wrapper">
        <table className="glossary-table">
          <thead>
            <tr>
              <th>영문 용어</th>
              <th>🇰🇷 한국어</th>
              <th>🇯🇵 日本語</th>
              <th>🇨🇳 中文</th>
              <th>문맥</th>
              <th>상태</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((term) => (
              <tr key={term.id} className={term.doNotTranslate ? 'dnt-row' : ''}>
                <td className="term-cell">
                  <EditableCell
                    value={term.term}
                    isEditing={editingCell?.id === term.id && editingCell?.field === 'term'}
                    onStartEdit={() => setEditingCell({ id: term.id, field: 'term' })}
                    onSave={(val) => handleCellEdit(term.id, 'term', val)}
                    onCancel={() => setEditingCell(null)}
                    bold
                  />
                </td>
                <td>
                  {term.doNotTranslate ? <span className="dnt-mark">—</span> : (
                    <EditableCell
                      value={term.ko}
                      isEditing={editingCell?.id === term.id && editingCell?.field === 'ko'}
                      onStartEdit={() => setEditingCell({ id: term.id, field: 'ko' })}
                      onSave={(val) => handleCellEdit(term.id, 'ko', val)}
                      onCancel={() => setEditingCell(null)}
                    />
                  )}
                </td>
                <td>
                  {term.doNotTranslate ? <span className="dnt-mark">—</span> : (
                    <EditableCell
                      value={term.ja}
                      isEditing={editingCell?.id === term.id && editingCell?.field === 'ja'}
                      onStartEdit={() => setEditingCell({ id: term.id, field: 'ja' })}
                      onSave={(val) => handleCellEdit(term.id, 'ja', val)}
                      onCancel={() => setEditingCell(null)}
                    />
                  )}
                </td>
                <td>
                  {term.doNotTranslate ? <span className="dnt-mark">—</span> : (
                    <EditableCell
                      value={term.zhCN}
                      isEditing={editingCell?.id === term.id && editingCell?.field === 'zhCN'}
                      onStartEdit={() => setEditingCell({ id: term.id, field: 'zhCN' })}
                      onSave={(val) => handleCellEdit(term.id, 'zhCN', val)}
                      onCancel={() => setEditingCell(null)}
                    />
                  )}
                </td>
                <td>
                  <EditableCell
                    value={term.context}
                    isEditing={editingCell?.id === term.id && editingCell?.field === 'context'}
                    onStartEdit={() => setEditingCell({ id: term.id, field: 'context' })}
                    onSave={(val) => handleCellEdit(term.id, 'context', val)}
                    onCancel={() => setEditingCell(null)}
                    small
                  />
                </td>
                <td>
                  <button
                    className={`status-toggle ${term.doNotTranslate ? 'dnt' : 'active'}`}
                    onClick={() => toggleDNT(term.id)}
                  >
                    {term.doNotTranslate ? '🚫 금지' : '✅ 번역'}
                  </button>
                </td>
                <td>
                  <button className="btn-icon" onClick={() => handleDelete(term.id)} title="삭제">
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="step-footer">
        <button className="btn btn-secondary" onClick={onBack}>← 이전</button>
        <button className="btn btn-primary btn-large" onClick={onNext}>
          다음 →
        </button>
      </div>
    </div>
  );
}

export default StepGlossary;

/** 셀 인라인 편집 컴포넌트 */
function EditableCell({
  value,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
  bold = false,
  small = false,
}: {
  value: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (val: string) => void;
  onCancel: () => void;
  bold?: boolean;
  small?: boolean;
}) {
  const [text, setText] = useState(value);

  if (isEditing) {
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
          onBlur={() => onSave(text)}
        />
      </div>
    );
  }

  return (
    <span
      className={`editable-cell ${bold ? 'bold' : ''} ${small ? 'small' : ''}`}
      onClick={onStartEdit}
      title="클릭하여 수정"
    >
      {value || <span className="empty-cell">비어있음</span>}
    </span>
  );
}
