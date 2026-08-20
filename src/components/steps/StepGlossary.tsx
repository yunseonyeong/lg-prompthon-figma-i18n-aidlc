import { useState, useEffect } from 'react';
import { Card, Row, Col, Table, Badge, Button, Form, ButtonGroup, Alert, Modal, Spinner, Toast, ToastContainer } from 'react-bootstrap';
import { API_BASE } from '../../api/client';

interface GlossaryTerm {
  id: string;
  term: string;
  ko: string;
  ja: string;
  zhCN: string;
  context: string;
  doNotTranslate: boolean;
  category: string;
}

interface StepGlossaryProps {
  onBack: () => void;
  onNext: () => void;
}

const categories = ['all', '엔티티', '라이선스', '비즈니스', '권한', '인증', '메뉴', '고유명사'];

function StepGlossary({ onBack, onNext }: StepGlossaryProps) {
  const [glossary, setGlossary] = useState<GlossaryTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTerm, setEditingTerm] = useState<GlossaryTerm | null>(null);
  const [toast, setToast] = useState<{ show: boolean; message: string; variant: string }>({ show: false, message: '', variant: 'success' });
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    loadGlossary();
  }, []);

  const loadGlossary = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/glossary`);
      if (!res.ok) throw new Error('API 오류');
      const data = await res.json();
      setGlossary(data.terms);
      setLastUpdated(data.lastUpdated);
    } catch (error) {
      console.error('용어집 로드 실패:', error);
      setGlossary(getDefaultGlossary());
      showToast('API 서버에 연결할 수 없습니다. 로컬 데이터를 사용합니다.', 'warning');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, variant: string = 'success') => {
    setToast({ show: true, message, variant });
  };

  const saveGlossary = async (terms: GlossaryTerm[]) => {
    try {
      setSaving(true);
      const res = await fetch(`${API_BASE}/glossary`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ terms }),
      });
      if (!res.ok) throw new Error('저장 실패');
      const data = await res.json();
      setLastUpdated(data.lastUpdated);
      showToast('용어집이 저장되었습니다.', 'success');
    } catch (error) {
      console.error('저장 실패:', error);
      showToast('저장에 실패했습니다. API 서버를 확인하세요.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTerm = async (newTerm: Omit<GlossaryTerm, 'id'>) => {
    try {
      const res = await fetch(`${API_BASE}/glossary/term`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTerm),
      });
      if (!res.ok) throw new Error('추가 실패');
      const data = await res.json();
      setGlossary((prev) => [...prev, data.term]);
      setShowAddModal(false);
      showToast(`"${newTerm.term}" 용어가 추가되었습니다.`, 'success');
    } catch (error) {
      const term = { ...newTerm, id: Date.now().toString() } as GlossaryTerm;
      setGlossary((prev) => [...prev, term]);
      setShowAddModal(false);
      showToast('로컬에 추가되었습니다. (API 저장 실패)', 'warning');
    }
  };

  const handleUpdateTerm = async (id: string, updates: Partial<GlossaryTerm>) => {
    try {
      const res = await fetch(`${API_BASE}/glossary/term/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('수정 실패');
      setGlossary((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
      setEditingTerm(null);
      showToast('용어가 수정되었습니다.', 'success');
    } catch (error) {
      setGlossary((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
      setEditingTerm(null);
      showToast('로컬에 수정되었습니다. (API 저장 실패)', 'warning');
    }
  };

  const handleDeleteTerm = async (id: string) => {
    const term = glossary.find((t) => t.id === id);
    if (!confirm(`"${term?.term}" 용어를 삭제하시겠습니까?`)) return;

    try {
      const res = await fetch(`${API_BASE}/glossary/term/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('삭제 실패');
      setGlossary((prev) => prev.filter((t) => t.id !== id));
      showToast('용어가 삭제되었습니다.', 'success');
    } catch (error) {
      setGlossary((prev) => prev.filter((t) => t.id !== id));
      showToast('로컬에서 삭제되었습니다. (API 저장 실패)', 'warning');
    }
  };

  const toggleDNT = (id: string) => {
    const term = glossary.find((t) => t.id === id);
    if (term) {
      handleUpdateTerm(id, { doNotTranslate: !term.doNotTranslate });
    }
  };

  const warningTerms = glossary.filter((t) => t.context.includes('⚠️'));
  const filtered = glossary.filter((term) => filter === 'all' || term.category === filter);

  if (loading) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center py-5">
        <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }} />
        <p className="text-muted">용어집을 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="ux-slide-up">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h4 className="mb-1 fw-bold">
            <span className="me-2">📚</span>
            Step 3. <span className="text-gradient">용어집 관리</span>
          </h4>
          <p className="text-muted small mb-0">
            EXAONE 번역 시 용어집이 우선 적용됩니다
            {lastUpdated && (
              <span className="ms-2">
                · 마지막 저장: {new Date(lastUpdated).toLocaleString()}
              </span>
            )}
          </p>
        </div>
        <div className="d-flex gap-2">
          <Button 
            variant="outline-primary" 
            size="sm" 
            onClick={() => setShowAddModal(true)}
            className="d-flex align-items-center gap-1"
          >
            <span>+</span> 용어 추가
          </Button>
          <Button
            className="ux-btn-primary py-1 px-3"
            size="sm"
            onClick={() => saveGlossary(glossary)}
            disabled={saving}
          >
            {saving ? <Spinner size="sm" animation="border" /> : '💾 저장'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <Row className="mb-4 g-3 ux-stagger">
        {[
          { value: glossary.filter((t) => !t.doNotTranslate).length, label: '번역 용어', variant: 'primary', icon: '🔤' },
          { value: glossary.filter((t) => t.doNotTranslate).length, label: '번역 금지', variant: 'secondary', icon: '🚫' },
          { value: warningTerms.length, label: '⚠️ 오역 주의', variant: 'info', icon: '⚠️' },
          { value: 4, label: '지원 언어', variant: 'success', icon: '🌐' },
        ].map((stat) => (
          <Col sm={6} md={3} key={stat.label}>
            <div className={`ux-stat-card ${stat.variant}`}>
              <div className="mb-1">{stat.icon}</div>
              <div className="ux-stat-value">{stat.value}</div>
              <div className="ux-stat-label">{stat.label}</div>
            </div>
          </Col>
        ))}
      </Row>

      {/* Warning Alert */}
      {warningTerms.length > 0 && (
        <Alert className="ux-alert mb-4" style={{ background: 'rgba(245, 158, 11, 0.1)', borderLeft: '4px solid #f59e0b' }}>
          <div className="d-flex align-items-start gap-3">
            <span className="fs-4">⚠️</span>
            <div>
              <strong>오역 주의 용어 ({warningTerms.length}개)</strong>
              <div className="d-flex gap-2 flex-wrap mt-2">
                {warningTerms.map((t) => (
                  <Badge 
                    key={t.id} 
                    bg="light" 
                    text="dark" 
                    className="border px-2 py-1"
                    style={{ fontSize: '0.8rem' }}
                  >
                    <strong>{t.term}</strong>
                    <span className="mx-1">→</span>
                    <span className="text-success">{t.ko}</span>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Alert>
      )}

      {/* Filter */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <ButtonGroup size="sm">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={filter === cat ? 'primary' : 'outline-secondary'}
              onClick={() => setFilter(cat)}
              className="px-3"
            >
              {cat === 'all' ? `전체 (${glossary.length})` : cat}
            </Button>
          ))}
        </ButtonGroup>
      </div>

      {/* Table */}
      <Card className="ux-card mb-4">
        <div className="table-responsive">
          <Table className="ux-table mb-0">
            <thead>
              <tr>
                <th style={{ width: 100 }}>카테고리</th>
                <th>영문 용어</th>
                <th>🇰🇷 한국어</th>
                <th>🇯🇵 日本語</th>
                <th>🇨🇳 中文</th>
                <th>문맥</th>
                <th style={{ width: 80 }}>상태</th>
                <th style={{ width: 90 }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((term) => (
                <tr 
                  key={term.id} 
                  className={term.context.includes('⚠️') ? 'table-warning' : ''}
                >
                  <td>
                    <Badge bg="secondary" className="fw-normal">{term.category}</Badge>
                  </td>
                  <td className="fw-semibold">{term.term}</td>
                  <td>{term.doNotTranslate ? <span className="text-muted">—</span> : term.ko}</td>
                  <td>{term.doNotTranslate ? <span className="text-muted">—</span> : term.ja}</td>
                  <td>{term.doNotTranslate ? <span className="text-muted">—</span> : term.zhCN}</td>
                  <td className="small text-muted" style={{ maxWidth: 200 }}>{term.context}</td>
                  <td>
                    <Form.Check
                      type="switch"
                      checked={!term.doNotTranslate}
                      onChange={() => toggleDNT(term.id)}
                      label=""
                      title={term.doNotTranslate ? '번역 금지' : '번역'}
                    />
                  </td>
                  <td>
                    <div className="d-flex gap-1">
                      <Button
                        variant="link"
                        size="sm"
                        className="p-1 text-secondary"
                        onClick={() => setEditingTerm(term)}
                        title="수정"
                      >
                        ✏️
                      </Button>
                      <Button
                        variant="link"
                        size="sm"
                        className="p-1 text-danger"
                        onClick={() => handleDeleteTerm(term.id)}
                        title="삭제"
                      >
                        🗑️
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>

      {/* EXAONE Info */}
      <Alert className="ux-alert ux-alert-info mb-4">
        <div className="d-flex align-items-center gap-3">
          <span className="fs-4">💡</span>
          <div>
            <strong>EXAONE 번역 시 용어집 적용 방식</strong>
            <div className="small text-muted mt-1">
              용어집에 등록된 용어는 AI 번역 결과를 덮어씁니다. "Withdraw → 회수"처럼 문맥에 따른 특수 번역이 필요한 경우 반드시 등록하세요.
            </div>
          </div>
        </div>
      </Alert>

      {/* Navigation */}
      <div className="d-flex justify-content-between">
        <Button className="ux-btn-secondary" onClick={onBack}>
          ← 이전
        </Button>
        <Button className="ux-btn-primary" size="lg" onClick={onNext}>
          🤖 EXAONE 번역 시작 →
        </Button>
      </div>

      {/* Modals */}
      <AddTermModal show={showAddModal} onHide={() => setShowAddModal(false)} onAdd={handleAddTerm} />
      <EditTermModal term={editingTerm} onHide={() => setEditingTerm(null)} onSave={handleUpdateTerm} />

      {/* Toast */}
      <ToastContainer position="bottom-end" className="p-3">
        <Toast
          show={toast.show}
          onClose={() => setToast({ ...toast, show: false })}
          delay={3000}
          autohide
          bg={toast.variant}
        >
          <Toast.Body className={toast.variant === 'warning' || toast.variant === 'danger' ? '' : 'text-white'}>
            {toast.message}
          </Toast.Body>
        </Toast>
      </ToastContainer>
    </div>
  );
}

// Add Modal
function AddTermModal({ show, onHide, onAdd }: { show: boolean; onHide: () => void; onAdd: (term: Omit<GlossaryTerm, 'id'>) => void }) {
  const [form, setForm] = useState({
    term: '', ko: '', ja: '', zhCN: '', context: '', category: '엔티티', doNotTranslate: false,
  });

  const handleSubmit = () => {
    if (!form.term.trim()) return;
    onAdd(form);
    setForm({ term: '', ko: '', ja: '', zhCN: '', context: '', category: '엔티티', doNotTranslate: false });
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton className="border-0 pb-0">
        <Modal.Title className="fw-bold">
          <span className="me-2">➕</span> 용어 추가
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Row>
            <Col md={8}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold small">영문 용어 *</Form.Label>
                <Form.Control
                  value={form.term}
                  onChange={(e) => setForm({ ...form, term: e.target.value })}
                  placeholder="Player"
                  className="border-2"
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold small">카테고리</Form.Label>
                <Form.Select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="border-2"
                >
                  {categories.filter((c) => c !== 'all').map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
          <Row>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold small">🇰🇷 한국어</Form.Label>
                <Form.Control value={form.ko} onChange={(e) => setForm({ ...form, ko: e.target.value })} className="border-2" />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold small">🇯🇵 日本語</Form.Label>
                <Form.Control value={form.ja} onChange={(e) => setForm({ ...form, ja: e.target.value })} className="border-2" />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold small">🇨🇳 中文</Form.Label>
                <Form.Control value={form.zhCN} onChange={(e) => setForm({ ...form, zhCN: e.target.value })} className="border-2" />
              </Form.Group>
            </Col>
          </Row>
          <Form.Group className="mb-3">
            <Form.Label className="fw-semibold small">문맥 (오역 위험 시 ⚠️ 포함)</Form.Label>
            <Form.Control
              value={form.context}
              onChange={(e) => setForm({ ...form, context: e.target.value })}
              placeholder="⚠️ 라이선스 회수 (탈퇴 아님)"
              className="border-2"
            />
          </Form.Group>
          <Form.Check
            type="switch"
            label="번역 금지 (고유명사)"
            checked={form.doNotTranslate}
            onChange={(e) => setForm({ ...form, doNotTranslate: e.target.checked })}
          />
        </Form>
      </Modal.Body>
      <Modal.Footer className="border-0 pt-0">
        <Button variant="outline-secondary" onClick={onHide}>취소</Button>
        <Button className="ux-btn-primary" onClick={handleSubmit} disabled={!form.term.trim()}>추가</Button>
      </Modal.Footer>
    </Modal>
  );
}

// Edit Modal
function EditTermModal({ term, onHide, onSave }: { term: GlossaryTerm | null; onHide: () => void; onSave: (id: string, updates: Partial<GlossaryTerm>) => void }) {
  const [form, setForm] = useState<GlossaryTerm | null>(null);

  useEffect(() => {
    setForm(term);
  }, [term]);

  if (!form) return null;

  return (
    <Modal show={!!term} onHide={onHide} centered>
      <Modal.Header closeButton className="border-0 pb-0">
        <Modal.Title className="fw-bold">
          <span className="me-2">✏️</span> 용어 수정: {term?.term}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Row>
            <Col md={8}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold small">영문 용어</Form.Label>
                <Form.Control value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} className="border-2" />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold small">카테고리</Form.Label>
                <Form.Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="border-2">
                  {categories.filter((c) => c !== 'all').map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
          <Row>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold small">🇰🇷 한국어</Form.Label>
                <Form.Control value={form.ko} onChange={(e) => setForm({ ...form, ko: e.target.value })} className="border-2" />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold small">🇯🇵 日本語</Form.Label>
                <Form.Control value={form.ja} onChange={(e) => setForm({ ...form, ja: e.target.value })} className="border-2" />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold small">🇨🇳 中文</Form.Label>
                <Form.Control value={form.zhCN} onChange={(e) => setForm({ ...form, zhCN: e.target.value })} className="border-2" />
              </Form.Group>
            </Col>
          </Row>
          <Form.Group className="mb-3">
            <Form.Label className="fw-semibold small">문맥</Form.Label>
            <Form.Control value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })} className="border-2" />
          </Form.Group>
          <Form.Check
            type="switch"
            label="번역 금지"
            checked={form.doNotTranslate}
            onChange={(e) => setForm({ ...form, doNotTranslate: e.target.checked })}
          />
        </Form>
      </Modal.Body>
      <Modal.Footer className="border-0 pt-0">
        <Button variant="outline-secondary" onClick={onHide}>취소</Button>
        <Button className="ux-btn-primary" onClick={() => onSave(form.id, form)}>저장</Button>
      </Modal.Footer>
    </Modal>
  );
}

function getDefaultGlossary(): GlossaryTerm[] {
  return [
    { id: '1', term: 'Business Site', ko: '비즈니스 사이트', ja: 'ビジネスサイト', zhCN: '业务站点', context: '최상위 고객사 단위', doNotTranslate: false, category: '엔티티' },
    { id: '2', term: 'Workspace', ko: '워크스페이스', ja: 'ワークスペース', zhCN: '工作区', context: 'Business Site 하위 작업 단위', doNotTranslate: false, category: '엔티티' },
    { id: '3', term: 'Withdraw', ko: '회수', ja: '回収', zhCN: '回收', context: '⚠️ 라이선스 회수 (탈퇴 아님)', doNotTranslate: false, category: '라이선스' },
    { id: '4', term: 'Extend', ko: '연장', ja: '延長', zhCN: '延长', context: '⚠️ 유효기간 연장 (확장 아님)', doNotTranslate: false, category: '라이선스' },
    { id: '5', term: 'Vertical Type', ko: '산업 분야', ja: '業種', zhCN: '行业类型', context: '⚠️ 업종 분류 (세로 유형 아님)', doNotTranslate: false, category: '비즈니스' },
    { id: '6', term: 'LG Electronics', ko: '', ja: '', zhCN: '', context: '회사명', doNotTranslate: true, category: '고유명사' },
  ];
}

export default StepGlossary;
