import { useState } from 'react';
import { Card, Table, Badge, Button, Form, ProgressBar, Nav, Tab, Alert } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { useComponentsMap } from '../../hooks/useFigmaData';
import { SkeletonRegion, SkeletonStatCards, SkeletonTable } from '../Skeleton';

interface QAGuideItem {
  key: string;
  type: string;
  originalText: string;
  frame: string;
}

function StepQAGuide({
  onBack,
  onComplete,
  onGoToPipeline,
}: {
  onBack: () => void;
  /** 마지막 단계 완료. 대시보드(Step 1)로 복귀한다. */
  onComplete: () => void;
  /** 산출물이 없을 때 파이프라인 실행 화면으로 보낸다 (데드락 방지) */
  onGoToPipeline: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set());
  const [subsidiaryChecked, setSubsidiaryChecked] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('qa');
  const { data, loading, error } = useComponentsMap();
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

  if (loading) {
    return (
      <SkeletonRegion label="QA 항목을 불러오는 중">
        <h4 className="mb-4">Step 7. QA 검증 가이드 + 법인 감수</h4>
        <div className="mb-4">
          <SkeletonStatCards count={2} />
        </div>
        <Card>
          <SkeletonTable rows={12} columns={5} />
        </Card>
      </SkeletonRegion>
    );
  }

  if (error || total === 0) {
    return (
      <>
        <h4 className="mb-4">Step 7. QA 검증 가이드 + 법인 감수</h4>
        <Alert variant={error ? 'danger' : 'secondary'}>
          {error
            ? `불러오기 실패: ${error}`
            : 'QA 항목이 없습니다. 파이프라인을 실행하면 생성됩니다.'}
        </Alert>
        <div className="d-flex justify-content-between">
          <Button variant="outline-secondary" onClick={onBack}>
            ← 이전
          </Button>
          <Button variant="primary" onClick={onGoToPipeline}>
            ⚡ 파이프라인 실행하러 가기
          </Button>
        </div>
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
        {/* Step 7이 마지막 단계다 (Figma 비교 단계 제거). 완료 시 대시보드로 복귀한다. */}
        <Button variant="success" size="lg" onClick={onComplete}>
          ✅ 완료
        </Button>
      </div>
    </>
  );
}

export default StepQAGuide;
