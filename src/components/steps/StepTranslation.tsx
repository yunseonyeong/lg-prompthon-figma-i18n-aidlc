import { useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, Table, Badge, Button, ButtonGroup, Alert, Form, Spinner } from 'react-bootstrap';
import Pagination, { usePagination } from '../Pagination';
import { SkeletonRegion, SkeletonStatCards, SkeletonTable } from '../Skeleton';
import { updateLocaleEntry } from '../../api/client';
import { retryTranslationRun, useTranslationRun } from '../../state/translationRun';
import i18n from '../../i18n';

interface StepTranslationProps {
  onNext: () => void;
  onBack: () => void;
  /** 실행할 것이 없을 때 파이프라인 실행 화면으로 보낸다 (데드락 방지) */
  onGoToPipeline: () => void;
}

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

/** 진행 중 경과 시간(초). 번역이 수십 초 걸리므로 멈춘 화면처럼 보이지 않게 한다. */
function useElapsedSeconds(startedAt: number | null, active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active || startedAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active, startedAt]);
  if (startedAt === null) return 0;
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

function StepTranslation({ onNext, onBack, onGoToPipeline }: StepTranslationProps) {
  // 번역 결과는 Step 3에서 시작한 POST /api/pipeline/translate 응답이다.
  // 이전에는 components-map.json + locale 파일(i18next)을 조합해 보여줬는데,
  // 그건 "지난 실행 산출물"이라 방금 확인한 용어집이 반영됐는지 알 수 없었다.
  const run = useTranslationRun();
  const elapsed = useElapsedSeconds(run.startedAt, run.status === 'running');

  const [reviewLang, setReviewLang] = useState<'ko' | 'ja' | 'zh-CN'>('ko');

  // ── 번역 인라인 편집 상태 ──
  const [editing, setEditing] = useState<{ key: string; lang: string } | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  /** `${key}::${lang}` → 수정된 값. 저장 성공한 항목만 담긴다. */
  const [edits, setEdits] = useState<Record<string, string>>({});

  const translated = run.data?.translated ?? [];
  // 번역 금지 용어는 Step 3에서 이미 빠진 상태로 전송된다 (여기 있는 건 전부 적용된 용어)
  const glossaryUsed = run.request?.relevantGlossary ?? {};
  const glossaryTerms = useMemo(() => Object.keys(glossaryUsed), [glossaryUsed]);

  const uniqueKeys = useMemo(
    () => translated.filter((item, idx, arr) => arr.findIndex((x) => x.key === item.key) === idx),
    [translated]
  );

  const { paginatedItems, handlePageChange, totalItems, pageSize } = usePagination(uniqueKeys, 15);

  const editCount = Object.keys(edits).length;

  const glossaryHitCount = uniqueKeys.filter((item) =>
    glossaryTerms.some((term) => item.source.includes(term))
  ).length;

  /**
   * 번역이 비어 있거나 원문과 같은 항목 수.
   *
   * /translate는 EXAONE 호출이 실패해도(예: 401) success: true로 응답하고
   * 번역되지 않은 엔트리를 그대로 돌려준다. 실측으로 확인한 동작이다.
   * 수치로 드러내지 않으면 "번역 완료"로 오해된다.
   */
  const untranslatedCount = uniqueKeys.filter((item) => {
    const value = edits[`${item.key}::${reviewLang}`] ?? item.translations[reviewLang];
    return !value || value === item.source;
  }).length;

  const langNames: Record<string, string> = {
    ko: '🇰🇷 한국어',
    ja: '🇯🇵 日本語',
    'zh-CN': '🇨🇳 中文',
  };

  const getBadgeVariant = (role: string) => {
    const variants: Record<string, string> = {
      title: 'primary',
      label: 'info',
      button: 'success',
      placeholder: 'warning',
      status: 'secondary',
      description: 'dark',
      message: 'danger',
    };
    return variants[role] || 'secondary';
  };

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

  // ── 아직 번역을 시작하지 않은 상태 ──
  if (run.status === 'idle') {
    return (
      <>
        <h4 className="mb-4">Step 4. EXAONE 번역 리뷰</h4>
        <Alert variant="secondary">
          <Alert.Heading className="h6">번역을 아직 실행하지 않았습니다</Alert.Heading>
          <div className="small mb-0">
            Step 3 용어집에서 내용을 확인한 뒤 <strong>“EXAONE 번역 시작”</strong>을 누르면
            추출 텍스트와 용어집이 <code>POST /api/pipeline/translate</code>로 전송됩니다.
          </div>
        </Alert>
        <div className="d-flex justify-content-between">
          <Button variant="outline-secondary" onClick={onBack}>
            ← 용어집으로
          </Button>
          <Button variant="primary" onClick={onBack}>
            📚 용어집 확인하고 번역 시작
          </Button>
        </div>
      </>
    );
  }

  // ── 번역 진행 중 ──
  if (run.status === 'running') {
    return (
      <SkeletonRegion label="EXAONE 번역이 진행 중입니다">
        <h4 className="mb-2">Step 4. EXAONE 번역 리뷰</h4>
        <Alert variant="info" className="d-flex align-items-center gap-3">
          <Spinner animation="border" size="sm" />
          <div className="small">
            <strong>
              EXAONE 번역 중... {elapsed}초 경과 ({run.request?.translationTargets.length ?? 0}개
              텍스트,
              용어집 {Object.keys(run.request?.relevantGlossary ?? {}).length}개)
            </strong>
            <div className="text-muted">
              10개 단위 배치로 호출하므로 항목 수에 비례해 시간이 걸립니다. 다른 단계로 이동해도
              실행은 계속됩니다.
            </div>
          </div>
        </Alert>
        <div className="mb-4">
          <SkeletonStatCards count={4} />
        </div>
        <Card>
          <SkeletonTable rows={15} columns={4} columnWidths={['10%', '40%', '40%', '10%']} />
        </Card>
      </SkeletonRegion>
    );
  }

  // ── 실패 ──
  if (run.status === 'error' || uniqueKeys.length === 0) {
    return (
      <>
        <h4 className="mb-4">Step 4. EXAONE 번역 리뷰</h4>
        <Alert variant={run.status === 'error' ? 'danger' : 'secondary'}>
          <Alert.Heading className="h6">
            {run.status === 'error' ? '번역에 실패했습니다' : '번역 결과가 비어 있습니다'}
          </Alert.Heading>
          {run.error && <div className="small mb-2">{run.error}</div>}
          <div className="small text-muted mb-0">
            EXAONE(Friendli) API 키와 API 서버 상태를 확인하세요 — <code>npm run dev:all</code>
          </div>
        </Alert>
        <div className="d-flex justify-content-between">
          <Button variant="outline-secondary" onClick={onBack}>
            ← 이전
          </Button>
          <div className="d-flex gap-2">
            <Button
              variant="outline-primary"
              onClick={() => void retryTranslationRun()}
              disabled={!run.request}
            >
              ↻ 다시 번역
            </Button>
            <Button variant="primary" onClick={onGoToPipeline}>
              ⚡ 파이프라인 실행하러 가기
            </Button>
          </div>
        </div>
      </>
    );
  }

  // ── 완료 ──
  const durationSec =
    run.startedAt && run.finishedAt ? Math.round((run.finishedAt - run.startedAt) / 1000) : null;

  return (
    <>
      <h4 className="mb-4">Step 4. EXAONE 번역 리뷰</h4>
      <p className="text-muted mb-4">
        EXAONE 2.0이 <strong>UX 문맥과 Step 3에서 확인한 용어집</strong>을 참조하여 번역했습니다.
      </p>

      {/* 실행 요약 — 하드코딩된 문구 대신 이번 응답의 실제 값 */}
      <Card className="mb-4 border-info">
        <Card.Header className="bg-info text-white">
          <strong>🤖 번역 실행 요약</strong>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={4}>
              <div className="text-center">
                <div className="fs-5 fw-bold text-info">{run.data?.summary.translatedCount ?? 0}건</div>
                <div className="small text-muted">번역된 텍스트</div>
              </div>
            </Col>
            <Col md={4}>
              <div className="text-center">
                <div className="fs-5 fw-bold">
                  {(run.data?.summary.localeLanguages ?? []).join(', ') || '—'}
                </div>
                <div className="small text-muted">생성된 locale</div>
              </div>
            </Col>
            <Col md={4}>
              <div className="text-center">
                <div className="fs-5 fw-bold text-warning">
                  {durationSec !== null ? `${durationSec}초` : '—'}
                </div>
                <div className="small text-muted">소요 시간</div>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {untranslatedCount > 0 && (
        <Alert variant="warning" className="d-flex align-items-start gap-3">
          <span className="fs-4">🈳</span>
          <div className="small flex-grow-1">
            <strong>
              {langNames[reviewLang]} 번역이 없는 항목 {untranslatedCount}/{uniqueKeys.length}건
            </strong>
            <div className="text-muted">
              원문이 그대로 남아 있습니다. EXAONE(Friendli) 호출이 실패해도 API는 성공으로
              응답하므로, 이 수치가 크면 서버 로그와 <code>FRIENDLI_API_KEY</code>를 확인하세요.
            </div>
          </div>
          <Button
            size="sm"
            variant="warning"
            className="flex-shrink-0"
            onClick={() => void retryTranslationRun()}
            disabled={!run.request}
          >
            ↻ 다시 번역
          </Button>
        </Alert>
      )}

      {/* 이번 번역에 실제로 전달된 용어집 */}
      {glossaryTerms.length > 0 && (
        <Alert variant="light" className="border mb-4">
          <h6 className="mb-3">
            📖 번역에 전달된 용어집 <code>relevantGlossary</code> ({glossaryTerms.length}개)
          </h6>
          <div className="d-flex gap-2 flex-wrap">
            {glossaryTerms.map((term) => (
              <Badge
                key={term}
                bg="light"
                text="dark"
                className="border px-2 py-1 fw-normal"
                style={{ fontSize: '0.8rem' }}
              >
                <strong>{term}</strong>
                <span className="mx-1">→</span>
                <span className="text-success">{glossaryUsed[term]?.[reviewLang] || '—'}</span>
              </Badge>
            ))}
          </div>
          <div className="small text-muted mt-2">
            번역 금지로 표시한 용어는 이 목록에서 제외된 상태로 전송됐습니다.
          </div>
        </Alert>
      )}

      {/* Quality Summary */}
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
              const isGlossary = glossaryTerms.some((term) => item.source.includes(term));
              const editKey = `${item.key}::${reviewLang}`;
              // 응답의 번역문이 기준이고, 저장 성공한 수정이 있으면 그것을 우선한다
              const translatedText =
                edits[editKey] ?? item.translations[reviewLang] ?? item.source;
              const isEditing = editing?.key === item.key && editing?.lang === reviewLang;
              const wasEdited = edits[editKey] !== undefined;

              return (
                <tr key={item.key} className={isGlossary ? 'table-info' : ''}>
                  <td>
                    <Badge bg={getBadgeVariant(item.role)}>{item.role}</Badge>
                  </td>
                  <td>{item.source}</td>
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
                        onClick={() => startEdit(item.key, translatedText)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            startEdit(item.key, translatedText);
                          }
                        }}
                      >
                        {/* 번역문이 원문과 같으면 미번역 상태다. 회색으로 구분한다 */}
                        <span className={translatedText === item.source ? 'text-muted' : ''}>
                          {translatedText}
                        </span>
                        {wasEdited && (
                          <Badge bg="info" className="ms-2 fw-normal">
                            수정됨
                          </Badge>
                        )}
                      </span>
                    )}
                  </td>
                  <td>{isGlossary && <Badge bg="light" text="dark">📖</Badge>}</td>
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
