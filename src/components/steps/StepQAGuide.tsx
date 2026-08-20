import { useState } from 'react';
import { Card, Table, Badge, Button, Form, ProgressBar, Nav, Tab, Alert } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { useComponentsMap, useLiveLocales } from '../../hooks/useFigmaData';

interface QAGuideItem {
  key: string;
  type: string;
  originalText: string;
  frame: string;
}

function StepQAGuide({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { t, i18n } = useTranslation();
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set());
  const [subsidiaryChecked, setSubsidiaryChecked] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('qa');
  const { data, loading, error } = useComponentsMap();
  useLiveLocales();
  const componentsMap = data ?? [];

  const qaItems: QAGuideItem[] = componentsMap.flatMap((frame) =>
    frame.children.map((child) => ({
      key: child.key,
      type: child.type,
      originalText: child.originalText,
      frame: frame.frame,
    }))
  ).filter((item, idx, arr) => arr.findIndex((x) => x.key === item.key) === idx);

  const qaProgress = checkedKeys.size;
  const subsidiaryProgress = subsidiaryChecked.size;
  const total = qaItems.length;
  // total이 0이면 NaN%가 표시된다 (파이프라인 미실행 상태)
  const qaPercent = total > 0 ? Math.round((qaProgress / total) * 100) : 0;
  const subsidiaryPercent = total > 0 ? Math.round((subsidiaryProgress / total) * 100) : 0;

  const toggleCheck = (key: string, isSubsidiary: boolean = false) => {
    const setter = isSubsidiary ? setSubsidiaryChecked : setCheckedKeys;
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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

  const displayItems = qaItems.slice(0, 20);

  /**
   * QA 검토용 CSV 내보내기.
   *
   * 이전에는 이 버튼들이 onClick 없이 조용히 아무 일도 하지 않았다.
   * CSV는 Excel에서 바로 열리므로 별도 의존성 없이 실제 동작하게 만든다.
   */
  const handleExportCsv = () => {
    const langs = ['en', 'ko', 'ja', 'zh-CN'];
    const header = ['frame', 'type', 'i18nKey', 'figmaOriginal', ...langs, 'qaChecked', 'subsidiaryChecked'];

    // 쉼표/따옴표/개행이 든 번역문이 열을 깨뜨리지 않도록 RFC 4180 방식으로 감싼다.
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

    const rows = qaItems.map((item) =>
      [
        item.frame,
        item.type,
        item.key,
        item.originalText,
        ...langs.map((l) => i18n.getFixedT(l)(item.key)),
        checkedKeys.has(item.key) ? 'Y' : 'N',
        subsidiaryChecked.has(item.key) ? 'Y' : 'N',
      ]
        .map(escape)
        .join(',')
    );

    // BOM을 붙이지 않으면 Excel이 UTF-8 한글/일본어/중국어를 깨뜨린다.
    const csv = '\uFEFF' + [header.map(escape).join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `i18n-qa-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading || error) {
    return (
      <>
        <h4 className="mb-4">Step 7. QA 검증 가이드 + 법인 감수</h4>
        <Alert variant={error ? 'danger' : 'secondary'}>
          {loading ? 'QA 항목을 불러오는 중...' : `불러오기 실패: ${error}`}
        </Alert>
        <Button variant="outline-secondary" onClick={onBack}>
          ← 이전
        </Button>
      </>
    );
  }

  return (
    <>
      <h4 className="mb-4">Step 7. QA 검증 가이드 + 법인 감수</h4>
      <p className="text-muted mb-4">
        각 i18n key가 UI의 어디에 표시되는지 자동으로 매핑되었습니다.
      </p>

      {/* Tabs */}
      <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k || 'qa')}>
        <Card className="mb-4">
          <Card.Header>
            <Nav variant="tabs">
              <Nav.Item>
                <Nav.Link eventKey="qa">🔍 QA 검증 ({qaPercent}%)</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="subsidiary">🏢 법인 감수 ({subsidiaryPercent}%)</Nav.Link>
              </Nav.Item>
            </Nav>
          </Card.Header>
          <Card.Body>
            {/* Progress */}
            <div className="mb-4">
              <div className="d-flex justify-content-between small mb-1">
                <span>{activeTab === 'qa' ? 'QA 검증' : '법인 감수'} 진행률</span>
                <span>
                  {activeTab === 'qa' ? qaProgress : subsidiaryProgress} / {total}
                </span>
              </div>
              <ProgressBar
                now={activeTab === 'qa' ? qaPercent : subsidiaryPercent}
                variant={activeTab === 'qa' ? 'primary' : 'success'}
              />
            </div>

            <Tab.Content>
              <Tab.Pane eventKey="qa">
                <Alert variant="info" className="small">
                  <strong>💡 이전 방식:</strong> QA가 개발자에게 "이 key 어디에 있어요?" 질문 → 반나절 소요<br />
                  <strong>지금:</strong> components-map.json에서 프레임 + 위치가 자동 매핑되어 즉시 확인 가능
                </Alert>
              </Tab.Pane>
              <Tab.Pane eventKey="subsidiary">
                <Alert variant="success" className="small">
                  <strong>🏢 법인 감수 체크포인트:</strong>
                  <ul className="mb-0 mt-2">
                    <li>현지 언어 표현이 자연스러운가?</li>
                    <li>법인 특화 용어가 올바르게 번역되었는가?</li>
                    <li>문화적으로 부적절한 표현이 없는가?</li>
                  </ul>
                </Alert>
              </Tab.Pane>
            </Tab.Content>

            {/* EXAONE Info */}
            <div className="d-flex align-items-center gap-2 mb-3 p-2 bg-light rounded small">
              <Badge bg="info">🤖 EXAONE</Badge>
              <span className="text-muted">
                오역 주의 용어 3건이 문맥 기반으로 처리되었습니다.
              </span>
            </div>

            {/* Table */}
            <Table striped hover responsive size="sm" className="align-middle">
              <thead>
                <tr>
                  <th style={{ width: 50 }}>✓</th>
                  <th>Frame</th>
                  <th style={{ width: 80 }}>Type</th>
                  <th>원문 (EN)</th>
                  <th>번역 ({i18n.language})</th>
                </tr>
              </thead>
              <tbody>
                {displayItems.map((item) => {
                  const isChecked = activeTab === 'qa'
                    ? checkedKeys.has(item.key)
                    : subsidiaryChecked.has(item.key);

                  return (
                    <tr key={item.key} className={isChecked ? 'table-success' : ''}>
                      <td>
                        <Form.Check
                          checked={isChecked}
                          onChange={() => toggleCheck(item.key, activeTab === 'subsidiary')}
                        />
                      </td>
                      <td className="small text-muted">{item.frame}</td>
                      <td>
                        <Badge bg={getBadgeVariant(item.type)} className="small">
                          {item.type}
                        </Badge>
                      </td>
                      <td>{item.originalText}</td>
                      <td className="fw-semibold">{t(item.key)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <div className="text-muted small">
              총 {qaItems.length}개 항목 중 20개 표시
            </div>
          </Card.Body>
        </Card>
      </Tab.Container>

      {/* Export */}
      <Card className="mb-4 bg-light">
        <Card.Body>
          <h6 className="mb-3">📤 내보내기</h6>
          <div className="d-flex gap-2 flex-wrap">
            <Button variant="outline-secondary" size="sm" onClick={handleExportCsv}>
              📊 CSV 내보내기 (Excel용)
            </Button>
            {/* 미구현 기능은 조용히 무반응하지 않도록 명시적으로 비활성화한다 */}
            <Button variant="outline-secondary" size="sm" disabled title="아직 구현되지 않았습니다">
              📄 PDF (법인 감수용) — 준비 중
            </Button>
            <Button variant="outline-secondary" size="sm" disabled title="아직 구현되지 않았습니다">
              📧 이메일 발송 — 준비 중
            </Button>
          </div>
        </Card.Body>
      </Card>

      <div className="d-flex justify-content-between">
        <Button variant="outline-secondary" onClick={onBack}>
          ← 이전
        </Button>
        <Button
          variant="outline-danger"
          size="sm"
          onClick={() => {
            setCheckedKeys(new Set());
            setSubsidiaryChecked(new Set());
          }}
        >
          체크 초기화
        </Button>
        <Button variant="primary" size="lg" onClick={onNext}>
          🔍 Figma 비교
        </Button>
      </div>
    </>
  );
}

export default StepQAGuide;
