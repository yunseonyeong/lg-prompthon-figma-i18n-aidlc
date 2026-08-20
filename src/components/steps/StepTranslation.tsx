import { useState } from 'react';
import { Card, Row, Col, Table, Badge, Button, ButtonGroup, Alert, Form, Spinner } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import Pagination, { usePagination } from '../Pagination';
import { useComponentsMap, useLiveLocales } from '../../hooks/useFigmaData';
import { updateLocaleEntry } from '../../api/client';
import i18n from '../../i18n';

interface StepTranslationProps {
  onNext: () => void;
  onBack: () => void;
}

/**
 * 용어집(requirements/domain-glossary.md §3)에 명시된 오역 방지 규칙 예시.
 * 화면의 "오역 방지 N건" 수치를 이 배열 길이로 계산해 표기와 내용을 일치시킨다.
 */
const MISTRANSLATION_CASES = [
  { term: 'Withdraw', naive: '탈퇴', correct: '회수', reason: '라이선스 관리 문맥' },
  { term: 'Vertical Type', naive: '세로 유형', correct: '산업 분야', reason: 'B2B 업종 분류 문맥' },
  { term: 'Extend', naive: '확장', correct: '연장', reason: '유효기간 문맥' },
] as const;

/** 'a.b.c' + value → { a: { b: { c: value } } } (i18next addResourceBundle deep merge용) */
function buildNested(dottedKey: string, value: string): Record<string, unknown> {
  const parts = dottedKey.split('.');
  const root: Record<string, any> = {};
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
  return root;
}

function StepTranslation({ onNext, onBack }: StepTranslationProps) {
  const { t } = useTranslation();
  const [reviewLang, setReviewLang] = useState<'ko' | 'ja' | 'zh-CN'>('ko');

  // ── 번역 인라인 편집 상태 ──
  // 이전에는 editCount가 useState(0)로 고정되어 항상 "수동 수정 0건"만 표시했고,
  // 편집 UI 자체가 없는데도 "클릭하여 수정할 수 있습니다"라고 안내하고 있었다.
  const [editing, setEditing] = useState<{ key: string; lang: string } | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  /** `${key}::${lang}` → 수정된 값. 저장 성공한 항목만 담긴다. */
  const [edits, setEdits] = useState<Record<string, string>>({});

  const { data, loading, error } = useComponentsMap();
  // 파이프라인이 방금 쓴 locale JSON을 런타임에 주입한다 (번들 값 고정 문제 해결)
  useLiveLocales();
  const componentsMap = data ?? [];

  const allItems = componentsMap.flatMap((frame) => frame.children.map((child) => child));
  const uniqueKeys = allItems.filter(
    (item, idx, arr) => arr.findIndex((x) => x.key === item.key) === idx
  );

  const { paginatedItems, handlePageChange, totalItems, pageSize } = usePagination(uniqueKeys, 15);

  const editCount = Object.keys(edits).length;

  const startEdit = (key: string, current: string) => {
    setSaveError(null);
    setEditing({ key, lang: reviewLang });
    setDraft(current);
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraft('');
    setSaveError(null);
  };

  const commitEdit = async () => {
    if (!editing) return;
    const { key, lang } = editing;
    const value = draft.trim();
    if (value === '') {
      setSaveError('빈 값은 저장할 수 없습니다.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await updateLocaleEntry(lang, key, value);
      // 서버 저장 성공 후에만 i18next에 반영한다. 순서를 뒤집으면
      // 저장 실패 시 화면과 파일 내용이 어긋난다.
      i18n.addResourceBundle(lang, 'translation', buildNested(key, value), true, true);
      setEdits((prev) => ({ ...prev, [`${key}::${lang}`]: value }));
      setEditing(null);
      setDraft('');
    } catch (e: any) {
      setSaveError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const glossaryTerms = ['License', 'Workspace', 'Device', 'Settings', 'Dashboard', 'Content'];

  const glossaryHitCount = uniqueKeys.filter((item) =>
    glossaryTerms.some((term) => item.originalText.includes(term))
  ).length;

  const langNames: Record<string, string> = {
    ko: '🇰🇷 한국어',
    ja: '🇯🇵 日本語',
    'zh-CN': '🇨🇳 中文',
  };

  const getBadgeVariant = (type: string) => {
    const variants: Record<string, string> = {
      title: 'primary',
      label: 'info',
      button: 'success',
      placeholder: 'warning',
      status: 'secondary',
    };
    return variants[type] || 'secondary';
  };

  if (loading || error) {
    return (
      <>
        <h4 className="mb-4">Step 4. EXAONE 번역 결과</h4>
        <Alert variant={error ? 'danger' : 'secondary'}>
          {loading ? '번역 결과를 불러오는 중...' : `불러오기 실패: ${error}`}
        </Alert>
        <Button variant="outline-secondary" onClick={onBack}>
          ← 이전
        </Button>
      </>
    );
  }

  return (
    <>
      <h4 className="mb-4">Step 4. EXAONE 번역 리뷰</h4>
      <p className="text-muted mb-4">
        EXAONE 2.0이 <strong>UX 문맥과 도메인 용어집</strong>을 참조하여 번역했습니다.
      </p>

      {/* EXAONE Analysis */}
      <Card className="mb-4 border-info">
        <Card.Header className="bg-info text-white">
          <strong>🤖 EXAONE 문맥 분석 결과</strong>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={4}>
              <div className="text-center">
                <div className="fs-5 fw-bold text-info">LG Business Cloud Console</div>
                <div className="small text-muted">감지된 도메인</div>
              </div>
            </Col>
            <Col md={4}>
              <div className="text-center">
                <div className="fs-5 fw-bold">라이선스, 권한, 비즈니스 분류</div>
                <div className="small text-muted">문맥 분석</div>
              </div>
            </Col>
            <Col md={4}>
              <div className="text-center">
                {/* 하드코딩 '3건' 대신 아래 사례 카드의 실제 개수를 쓴다 */}
                <div className="fs-5 fw-bold text-warning">{MISTRANSLATION_CASES.length}건</div>
                <div className="small text-muted">오역 방지 규칙 (용어집 기준)</div>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Context Examples */}
      <Alert variant="light" className="border mb-4">
        {/* "실제 적용 사례"는 측정값을 뜻하는 표현이라 오해를 준다.
            이 항목들은 용어집 §3에 정의된 규칙이므로 그렇게 표기한다. */}
        <h6 className="mb-3">💡 용어집 기반 오역 방지 규칙 (domain-glossary.md §3)</h6>
        <Row>
          {MISTRANSLATION_CASES.map((c) => (
            <Col md={4} key={c.term}>
              <div className="mb-2">
                <Badge bg="danger" className="me-2">❌ 단순 번역</Badge>
                "{c.term}" → <strong>{c.naive}</strong>
              </div>
              <div>
                <Badge bg="success" className="me-2">✅ 문맥 반영</Badge>
                "{c.term}" → <strong>{c.correct}</strong>
              </div>
              <div className="small text-muted mt-1">
                {c.reason} → "{c.correct}"
              </div>
            </Col>
          ))}
        </Row>
      </Alert>

      {/* Quality Summary — 하드코딩된 '용어집 일치율 100%', '오역 방지 3건', '문맥 분석 PASS'를
          실제로 계산 가능한 값으로 교체했다. 근거 없는 수치를 화면에 띄우지 않는다. */}
      <Row className="mb-4">
        {[
          { label: '고유 i18n Key', value: `${uniqueKeys.length}개`, color: 'primary' },
          { label: '용어집 용어 포함', value: `${glossaryHitCount}개`, color: 'info' },
          { label: '검토 언어', value: langNames[reviewLang], color: 'secondary' },
          { label: '수동 수정', value: `${editCount}건`, color: editCount > 0 ? 'info' : 'success' },
        ].map((item) => (
          <Col sm={6} md={3} key={item.label}>
            <Card className="text-center">
              <Card.Body className="py-3">
                <div className={`fs-5 fw-bold text-${item.color}`}>{item.value}</div>
                <div className="text-muted small">{item.label}</div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Language Toggle */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <span className="text-muted me-2">비교 언어:</span>
          <ButtonGroup size="sm">
            {(['ko', 'ja', 'zh-CN'] as const).map((lang) => (
              <Button
                key={lang}
                variant={reviewLang === lang ? 'primary' : 'outline-secondary'}
                onClick={() => setReviewLang(lang)}
              >
                {langNames[lang]}
              </Button>
            ))}
          </ButtonGroup>
        </div>
        <small className="text-muted">
          💡 번역 텍스트를 클릭하면 수정할 수 있습니다 (저장 시{' '}
          <code>src/locales/{reviewLang}.json</code>에 기록)
        </small>
      </div>

      {saveError && (
        <Alert variant="danger" className="py-2 small" dismissible onClose={() => setSaveError(null)}>
          저장 실패: {saveError}
          <div className="text-muted">API 서버가 실행 중인지 확인하세요 (npm run dev:all)</div>
        </Alert>
      )}

      {/* Translation Table */}
      <Card className="mb-4">
        <Table striped hover responsive className="mb-0 align-middle">
          <thead>
            <tr>
              <th style={{ width: 80 }}>Type</th>
              <th>English (원본)</th>
              <th>{langNames[reviewLang]} (번역)</th>
              <th style={{ width: 80 }}>용어집</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((item) => {
              const isGlossary = glossaryTerms.some((term) => item.originalText.includes(term));
              const translated = t(item.key, { lng: reviewLang });
              const isEditing = editing?.key === item.key && editing?.lang === reviewLang;
              const wasEdited = edits[`${item.key}::${reviewLang}`] !== undefined;

              return (
                <tr key={item.key} className={isGlossary ? 'table-info' : ''}>
                  <td>
                    <Badge bg={getBadgeVariant(item.type)}>{item.type}</Badge>
                  </td>
                  <td>{item.originalText}</td>
                  <td className="fw-semibold">
                    {isEditing ? (
                      <div className="d-flex gap-2 align-items-center">
                        <Form.Control
                          size="sm"
                          autoFocus
                          value={draft}
                          disabled={saving}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void commitEdit();
                            if (e.key === 'Escape') cancelEdit();
                          }}
                        />
                        <Button size="sm" variant="primary" disabled={saving} onClick={() => void commitEdit()}>
                          {saving ? <Spinner animation="border" size="sm" /> : '저장'}
                        </Button>
                        <Button size="sm" variant="outline-secondary" disabled={saving} onClick={cancelEdit}>
                          취소
                        </Button>
                      </div>
                    ) : (
                      <span
                        role="button"
                        tabIndex={0}
                        title="클릭하여 수정"
                        className="d-inline-block w-100"
                        style={{ cursor: 'text' }}
                        onClick={() => startEdit(item.key, translated)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            startEdit(item.key, translated);
                          }
                        }}
                      >
                        {translated}
                        {wasEdited && (
                          <Badge bg="info" className="ms-2 fw-normal">
                            수정됨
                          </Badge>
                        )}
                      </span>
                    )}
                  </td>
                  <td>
                    {isGlossary && <Badge bg="light" text="dark">📖</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <Card.Footer>
          <Pagination totalItems={totalItems} pageSize={pageSize} onPageChange={handlePageChange} />
        </Card.Footer>
      </Card>

      <div className="d-flex justify-content-between">
        <Button variant="outline-secondary" onClick={onBack}>
          ← 이전
        </Button>
        <Button variant="primary" size="lg" onClick={onNext}>
          ⚡ 코드 생성
        </Button>
      </div>
    </>
  );
}

export default StepTranslation;
