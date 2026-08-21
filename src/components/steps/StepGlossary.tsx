import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Card,
  Row,
  Col,
  Table,
  Badge,
  Button,
  Form,
  ButtonGroup,
  Alert,
  Modal,
  Spinner,
  Toast,
  ToastContainer,
} from 'react-bootstrap';
import { API_BASE, type GlossaryPayload } from '../../api/client';
import { useExtraction } from '../../hooks/useFigmaData';
import { startTranslationRun, useTranslationRun } from '../../state/translationRun';
import { SkeletonRegion, Skeleton, SkeletonStatCards, SkeletonTable } from '../Skeleton';

/**
 * 화면에 뿌리는 용어 한 줄.
 *
 * 출처는 추출 응답의 relevantGlossary다 — 즉 "Figma에서 뽑은 원문에 실제로 등장한 용어"만
 * 다룬다. 전체 용어집 카탈로그(GET /api/glossary)는 카테고리/문맥 같은 메타데이터를
 * 붙이는 데만 쓴다. 없으면 없는 대로 렌더한다.
 */
interface GlossaryRow {
  term: string;
  ko: string;
  ja: string;
  zhCN: string;
  context: string;
  category: string;
  doNotTranslate: boolean;
  /** 추출 원문에서 매칭된 용어인지 (false = 사용자가 이 화면에서 직접 추가) */
  matched: boolean;
}

/** GET /api/glossary 카탈로그 항목 (메타데이터 출처) */
interface CatalogTerm {
  term: string;
  context?: string;
  category?: string;
  doNotTranslate?: boolean;
}

interface StepGlossaryProps {
  onBack: () => void;
  onNext: () => void;
}

const UNCATEGORIZED = '미분류';

function StepGlossary({ onBack, onNext }: StepGlossaryProps) {
  // 용어집 내용은 추출 결과(relevantGlossary)에서 온다. Step 2에서 이미 추출했으면
  // 훅 캐시를 그대로 재사용하므로 추가 호출이 없다.
  const extraction = useExtraction();
  const run = useTranslationRun();

  const [catalog, setCatalog] = useState<Record<string, CatalogTerm>>({});
  // 성공이든 실패든 "조회가 끝났다"는 사실. 표를 만들기 전에 메타데이터를 기다려야
  // 카테고리/문맥이 뒤늦게 붙으면서 표가 재생성되는 일이 없다.
  const [catalogSettled, setCatalogSettled] = useState(false);
  const [rows, setRows] = useState<GlossaryRow[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTerm, setEditingTerm] = useState<GlossaryRow | null>(null);
  const [toast, setToast] = useState<{ show: boolean; message: string; variant: string }>({
    show: false,
    message: '',
    variant: 'success',
  });

  // 카테고리/문맥 메타데이터. 실패하면 조용히 넘어간다 (용어집 표시를 막지 않는다)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/glossary`);
        if (!res.ok) return;
        const data = await res.json();
        const byTerm: Record<string, CatalogTerm> = {};
        for (const t of (data.terms ?? []) as CatalogTerm[]) {
          if (t?.term) byTerm[t.term.toLowerCase()] = t;
        }
        if (!cancelled) setCatalog(byTerm);
      } catch {
        /* 메타데이터는 있으면 좋고 없어도 되는 정보다 */
      } finally {
        if (!cancelled) setCatalogSettled(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 표는 추출 결과 1건당 한 번만 만든다. 다시 만들면 사용자의 수정·삭제·토글이 날아간다.
  // (그래서 rows.length 같은 조건을 넣지 않는다 — 전부 삭제한 상태도 유효한 상태다.)
  const builtFrom = useRef<object | null>(null);
  const relevantGlossary = extraction.data?.relevantGlossary;

  useEffect(() => {
    if (!relevantGlossary || !catalogSettled) return;
    if (builtFrom.current === relevantGlossary) return;
    builtFrom.current = relevantGlossary;

    setRows(
      Object.entries(relevantGlossary)
        .map(([term, translations]) => {
          const meta = catalog[term.toLowerCase()];
          return {
            term,
            ko: translations.ko ?? '',
            ja: translations.ja ?? '',
            zhCN: translations['zh-CN'] ?? '',
            context: meta?.context ?? '',
            category: meta?.category ?? UNCATEGORIZED,
            doNotTranslate: meta?.doNotTranslate ?? false,
            matched: true,
          };
        })
        .sort((a, b) => a.term.localeCompare(b.term))
    );
  }, [relevantGlossary, catalog, catalogSettled]);

  const showToast = (message: string, variant: string = 'success') =>
    setToast({ show: true, message, variant });

  const updateRow = (term: string, updates: Partial<GlossaryRow>) =>
    setRows((prev) => prev.map((r) => (r.term === term ? { ...r, ...updates } : r)));

  /** 번역 여부 토글. 서버 호출 없이 로컬 상태만 바꾼다 (번역 시작 시 한 번에 전송) */
  const toggleDNT = (term: string) => {
    const row = rows.find((r) => r.term === term);
    if (row) updateRow(term, { doNotTranslate: !row.doNotTranslate });
  };

  const handleAddTerm = (newRow: Omit<GlossaryRow, 'matched'>) => {
    if (rows.some((r) => r.term.toLowerCase() === newRow.term.toLowerCase())) {
      showToast(`"${newRow.term}"은 이미 목록에 있습니다.`, 'warning');
      return;
    }
    setRows((prev) => [...prev, { ...newRow, matched: false }]);
    setShowAddModal(false);
    showToast(`"${newRow.term}"을 이번 번역 용어집에 추가했습니다.`, 'success');
  };

  const handleDeleteTerm = (term: string) => {
    if (!confirm(`"${term}"을 이번 번역 용어집에서 제외하시겠습니까?`)) return;
    setRows((prev) => prev.filter((r) => r.term !== term));
    showToast(`"${term}"을 제외했습니다.`, 'success');
  };

  const categories = useMemo(() => {
    const found = Array.from(new Set(rows.map((r) => r.category)));
    return ['all', ...found.sort()];
  }, [rows]);

  const warningTerms = rows.filter((r) => r.context.includes('⚠️'));
  const filtered = rows.filter((r) => filter === 'all' || r.category === filter);

  /**
   * /translate에 보낼 용어집. 번역 금지로 표시한 용어는 제외한다.
   *
   * 필드명은 extract 응답의 relevantGlossary를 그대로 유지한다 —
   * 추출에서 받은 것을 확인·정리해 되돌려주는 구조라는 게 이름에서 드러나야 한다.
   */
  const relevantGlossaryPayload: GlossaryPayload = useMemo(() => {
    const payload: GlossaryPayload = {};
    for (const r of rows) {
      if (r.doNotTranslate) continue;
      payload[r.term] = { ko: r.ko, ja: r.ja, 'zh-CN': r.zhCN };
    }
    return payload;
  }, [rows]);

  const translationTargets = extraction.data?.translationTargets ?? [];
  const appliedCount = Object.keys(relevantGlossaryPayload).length;
  const excludedCount = rows.length - appliedCount;

  /** 용어집 확인 완료 → 이 시점에 POST /api/pipeline/translate 한 번 */
  const startTranslation = () => {
    if (translationTargets.length === 0) return;
    void startTranslationRun({
      translationTargets,
      relevantGlossary: relevantGlossaryPayload,
    });
    onNext();
  };

  // 메타데이터 조회 전에는 표를 만들지 않으므로 그 시간도 로딩으로 다룬다
  if ((extraction.loading || !catalogSettled) && rows.length === 0 && !extraction.error) {
    return (
      <SkeletonRegion label="추출 결과에서 용어집을 불러오는 중" className="ux-slide-up">
        <div className="d-flex justify-content-between align-items-start mb-4">
          <div>
            <Skeleton width={220} height="1.5rem" className="mb-2" />
            <Skeleton width={280} height="0.85rem" />
          </div>
          <div className="d-flex gap-2">
            <Skeleton width={90} height="2rem" style={{ borderRadius: 6 }} />
          </div>
        </div>
        <SkeletonStatCards count={4} />
        <div className="d-flex gap-2 my-4">
          {[80, 70, 65, 75, 60].map((w, i) => (
            <Skeleton key={i} width={w} height="2rem" style={{ borderRadius: 6 }} />
          ))}
        </div>
        <div className="card">
          <SkeletonTable
            rows={8}
            columns={7}
            columnWidths={['10%', '14%', '12%', '12%', '12%', '28%', '12%']}
          />
        </div>
      </SkeletonRegion>
    );
  }

  return (
    <div className="ux-slide-up">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h4 className="mb-1 fw-bold">
            <span className="me-2">📚</span>
            Step 3. <span className="text-gradient">용어집 확인</span>
          </h4>
          <p className="text-muted small mb-0">
            추출된 원문에서 매칭된 용어입니다. 확인·수정한 내용이 번역 시작 시 그대로 전달됩니다.
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
        </div>
      </div>

      {extraction.error && (
        <Alert variant="danger">
          <Alert.Heading className="h6">텍스트 추출 결과를 불러올 수 없습니다</Alert.Heading>
          <div className="small">{extraction.error}</div>
          <div className="small text-muted mt-1">
            용어집은 추출 결과의 relevantGlossary에서 만들어집니다. Step 2에서 추출을 먼저
            성공시켜야 합니다.
          </div>
        </Alert>
      )}

      {/* Stats */}
      <Row className="mb-4 g-3 ux-stagger">
        {[
          {
            value: rows.filter((r) => !r.doNotTranslate).length,
            label: '번역 용어',
            variant: 'primary',
            icon: '🔤',
          },
          {
            value: rows.filter((r) => r.doNotTranslate).length,
            label: '번역 금지',
            variant: 'secondary',
            icon: '🚫',
          },
          { value: warningTerms.length, label: '⚠️ 오역 주의', variant: 'info', icon: '⚠️' },
          {
            value: translationTargets.length,
            label: '번역 대상 텍스트',
            variant: 'success',
            icon: '📄',
          },
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
        <Alert
          className="ux-alert mb-4"
          style={{ background: 'rgba(245, 158, 11, 0.1)', borderLeft: '4px solid #f59e0b' }}
        >
          <div className="d-flex align-items-start gap-3">
            <span className="fs-4">⚠️</span>
            <div>
              <strong>오역 주의 용어 ({warningTerms.length}개)</strong>
              <div className="d-flex gap-2 flex-wrap mt-2">
                {warningTerms.map((t) => (
                  <Badge
                    key={t.term}
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
      {rows.length > 0 && (
        <div className="d-flex justify-content-between align-items-center mb-3">
          <ButtonGroup size="sm">
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={filter === cat ? 'primary' : 'outline-secondary'}
                onClick={() => setFilter(cat)}
                className="px-3"
              >
                {cat === 'all' ? `전체 (${rows.length})` : cat}
              </Button>
            ))}
          </ButtonGroup>
        </div>
      )}

      {/* Table */}
      {rows.length > 0 ? (
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
                  <th style={{ width: 80 }}>번역</th>
                  <th style={{ width: 90 }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((term) => (
                  <tr key={term.term} className={term.context.includes('⚠️') ? 'table-warning' : ''}>
                    <td>
                      <Badge bg="secondary" className="fw-normal">
                        {term.category}
                      </Badge>
                    </td>
                    <td className="fw-semibold">
                      {term.term}
                      {!term.matched && (
                        <Badge bg="info" className="ms-2 fw-normal">
                          추가
                        </Badge>
                      )}
                    </td>
                    <td>{term.doNotTranslate ? <span className="text-muted">—</span> : term.ko}</td>
                    <td>{term.doNotTranslate ? <span className="text-muted">—</span> : term.ja}</td>
                    <td>{term.doNotTranslate ? <span className="text-muted">—</span> : term.zhCN}</td>
                    <td className="small text-muted" style={{ maxWidth: 200 }}>
                      {term.context}
                    </td>
                    <td>
                      {/* 토글은 로컬 상태만 바꾼다. 서버 반영은 번역 시작 요청 한 번으로 끝난다 */}
                      <Form.Check
                        type="switch"
                        checked={!term.doNotTranslate}
                        onChange={() => toggleDNT(term.term)}
                        label=""
                        title={
                          term.doNotTranslate
                            ? '번역 금지 — 번역 요청의 relevantGlossary에서 제외됩니다'
                            : '번역 — relevantGlossary에 포함됩니다'
                        }
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
                          onClick={() => handleDeleteTerm(term.term)}
                          title="이번 번역에서 제외"
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
      ) : (
        !extraction.error && (
          <Alert variant="secondary" className="mb-4">
            <strong>매칭된 용어가 없습니다.</strong>
            <div className="small text-muted mt-1">
              추출된 원문에 도메인 용어집(requirements/domain-glossary.md)의 용어가 등장하지
              않았습니다. 용어집 없이 번역을 진행하거나, 위 "용어 추가"로 직접 넣을 수 있습니다.
            </div>
          </Alert>
        )
      )}

      {/* EXAONE Info */}
      <Alert className="ux-alert ux-alert-info mb-4">
        <div className="d-flex align-items-center gap-3">
          <span className="fs-4">💡</span>
          <div>
            <strong>번역 요청에 담기는 내용</strong>
            <div className="small text-muted mt-1">
              추출된 텍스트 {translationTargets.length}개를 <code>translationTargets</code>로, 용어{' '}
              {appliedCount}개를 <code>relevantGlossary</code>로 묶어{' '}
              <code>POST /api/pipeline/translate</code>에 한 번 전송합니다.
              {excludedCount > 0 && <> 번역 금지 {excludedCount}개는 전송에서 제외됩니다.</>}
            </div>
          </div>
        </div>
      </Alert>

      {run.status === 'running' && (
        <Alert variant="info" className="py-2 small d-flex align-items-center gap-2">
          <Spinner animation="border" size="sm" />
          번역이 진행 중입니다. 다시 시작하지 않고 다음 단계에서 결과를 볼 수 있습니다.
        </Alert>
      )}

      {/* Navigation */}
      <div className="d-flex justify-content-between">
        <Button className="ux-btn-secondary" onClick={onBack}>
          ← 이전
        </Button>
        <Button
          className="ux-btn-primary"
          size="lg"
          onClick={run.status === 'running' ? onNext : startTranslation}
          disabled={translationTargets.length === 0}
          title={
            translationTargets.length === 0
              ? '추출된 텍스트가 없어 번역할 수 없습니다'
              : '용어집과 추출 텍스트를 /api/pipeline/translate로 전송합니다'
          }
        >
          {run.status === 'running' ? '진행 중인 번역 보기 →' : '🤖 EXAONE 번역 시작 →'}
        </Button>
      </div>

      {/* Modals */}
      <AddTermModal
        show={showAddModal}
        onHide={() => setShowAddModal(false)}
        categories={categories.filter((c) => c !== 'all')}
        onAdd={handleAddTerm}
      />
      <EditTermModal
        term={editingTerm}
        categories={categories.filter((c) => c !== 'all')}
        onHide={() => setEditingTerm(null)}
        onSave={(term, updates) => {
          updateRow(term, updates);
          setEditingTerm(null);
          showToast('용어를 수정했습니다. 번역 시작 시 반영됩니다.', 'success');
        }}
      />

      {/* Toast */}
      <ToastContainer position="bottom-end" className="p-3">
        <Toast
          show={toast.show}
          onClose={() => setToast({ ...toast, show: false })}
          delay={3000}
          autohide
          bg={toast.variant}
        >
          <Toast.Body
            className={
              toast.variant === 'warning' || toast.variant === 'danger' ? '' : 'text-white'
            }
          >
            {toast.message}
          </Toast.Body>
        </Toast>
      </ToastContainer>
    </div>
  );
}

const DEFAULT_FORM: Omit<GlossaryRow, 'matched'> = {
  term: '',
  ko: '',
  ja: '',
  zhCN: '',
  context: '',
  category: UNCATEGORIZED,
  doNotTranslate: false,
};

// Add Modal — 서버에 저장하지 않는다. 이번 번역 요청의 용어집에만 들어간다.
function AddTermModal({
  show,
  onHide,
  categories,
  onAdd,
}: {
  show: boolean;
  onHide: () => void;
  categories: string[];
  onAdd: (term: Omit<GlossaryRow, 'matched'>) => void;
}) {
  const [form, setForm] = useState(DEFAULT_FORM);

  const options = categories.length > 0 ? categories : [UNCATEGORIZED];

  const handleSubmit = () => {
    if (!form.term.trim()) return;
    onAdd({ ...form, term: form.term.trim() });
    setForm(DEFAULT_FORM);
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
                  {options.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
          <Row>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold small">🇰🇷 한국어</Form.Label>
                <Form.Control
                  value={form.ko}
                  onChange={(e) => setForm({ ...form, ko: e.target.value })}
                  className="border-2"
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold small">🇯🇵 日本語</Form.Label>
                <Form.Control
                  value={form.ja}
                  onChange={(e) => setForm({ ...form, ja: e.target.value })}
                  className="border-2"
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold small">🇨🇳 中文</Form.Label>
                <Form.Control
                  value={form.zhCN}
                  onChange={(e) => setForm({ ...form, zhCN: e.target.value })}
                  className="border-2"
                />
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
            label="번역 금지 (고유명사 — 번역 요청에서 제외)"
            checked={form.doNotTranslate}
            onChange={(e) => setForm({ ...form, doNotTranslate: e.target.checked })}
          />
        </Form>
      </Modal.Body>
      <Modal.Footer className="border-0 pt-0">
        <Button variant="outline-secondary" onClick={onHide}>
          취소
        </Button>
        <Button className="ux-btn-primary" onClick={handleSubmit} disabled={!form.term.trim()}>
          추가
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

// Edit Modal — 로컬 수정만 한다 (번역 시작 요청에 반영)
function EditTermModal({
  term,
  categories,
  onHide,
  onSave,
}: {
  term: GlossaryRow | null;
  categories: string[];
  onHide: () => void;
  onSave: (term: string, updates: Partial<GlossaryRow>) => void;
}) {
  const [form, setForm] = useState<GlossaryRow | null>(null);

  useEffect(() => {
    setForm(term);
  }, [term]);

  if (!form) return null;

  const options = categories.length > 0 ? categories : [UNCATEGORIZED];

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
                {/* 원문 용어는 추출 결과와의 매칭 기준이므로 바꾸지 않는다 */}
                <Form.Control value={form.term} readOnly disabled className="border-2" />
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
                  {options.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
          <Row>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold small">🇰🇷 한국어</Form.Label>
                <Form.Control
                  value={form.ko}
                  onChange={(e) => setForm({ ...form, ko: e.target.value })}
                  className="border-2"
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold small">🇯🇵 日本語</Form.Label>
                <Form.Control
                  value={form.ja}
                  onChange={(e) => setForm({ ...form, ja: e.target.value })}
                  className="border-2"
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label className="fw-semibold small">🇨🇳 中文</Form.Label>
                <Form.Control
                  value={form.zhCN}
                  onChange={(e) => setForm({ ...form, zhCN: e.target.value })}
                  className="border-2"
                />
              </Form.Group>
            </Col>
          </Row>
          <Form.Group className="mb-3">
            <Form.Label className="fw-semibold small">문맥</Form.Label>
            <Form.Control
              value={form.context}
              onChange={(e) => setForm({ ...form, context: e.target.value })}
              className="border-2"
            />
          </Form.Group>
          <Form.Check
            type="switch"
            label="번역 금지 (번역 요청에서 제외)"
            checked={form.doNotTranslate}
            onChange={(e) => setForm({ ...form, doNotTranslate: e.target.checked })}
          />
        </Form>
      </Modal.Body>
      <Modal.Footer className="border-0 pt-0">
        <Button variant="outline-secondary" onClick={onHide}>
          취소
        </Button>
        <Button className="ux-btn-primary" onClick={() => onSave(form.term, form)}>
          적용
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default StepGlossary;
