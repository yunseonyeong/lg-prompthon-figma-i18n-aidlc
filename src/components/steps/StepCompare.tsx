import { useState } from 'react';
import { Card, Row, Col, Badge, Button, Nav, Alert } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { useComponentsMap } from '../../hooks/useFigmaData';

interface StepCompareProps {
  onBack: () => void;
  /** 8단계 위저드 종료. Step 1(대시보드)로 복귀한다. */
  onComplete: () => void;
}

function StepCompare({ onBack, onComplete }: StepCompareProps) {
  const { t, i18n } = useTranslation();
  const [selectedFrame, setSelectedFrame] = useState(0);
  const { data, loading, error } = useComponentsMap();
  const componentsMap = data ?? [];

  const frame = componentsMap[selectedFrame];
  const uniqueChildren = (frame?.children ?? []).filter(
    (child, idx, arr) => arr.findIndex((x) => x.key === child.key) === idx
  );

  const totalChanged = uniqueChildren.filter(
    (child) => t(child.key) !== child.originalText
  ).length;

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

  if (loading || error || !frame) {
    return (
      <>
        <h4 className="mb-4">Step 8. Figma ↔ 코드 비교</h4>
        <Alert variant={error ? 'danger' : 'secondary'}>
          {loading
            ? 'components-map.json을 불러오는 중...'
            : error
              ? `불러오기 실패: ${error}`
              : '비교할 프레임이 없습니다. Step 5에서 파이프라인을 먼저 실행하세요.'}
        </Alert>
        <Button variant="outline-secondary" onClick={onBack}>
          ← 이전
        </Button>
      </>
    );
  }

  return (
    <>
      <h4 className="mb-4">Step 8. Figma ↔ 코드 비교</h4>
      <p className="text-muted mb-4">
        Figma 원본 텍스트와 생성된 코드의 번역 결과를 나란히 비교합니다.
      </p>

      {/* Frame Selector */}
      <Card className="mb-4">
        <Card.Header className="p-2">
          <Nav variant="pills" className="flex-nowrap overflow-auto">
            {componentsMap.map((f, idx) => (
              <Nav.Item key={f.frameId}>
                <Nav.Link
                  active={selectedFrame === idx}
                  onClick={() => setSelectedFrame(idx)}
                  className="small text-nowrap"
                >
                  {f.frame}
                </Nav.Link>
              </Nav.Item>
            ))}
          </Nav>
        </Card.Header>
      </Card>

      {/* Stats */}
      <Row className="mb-4">
        <Col sm={6} md={3}>
          <Card className="text-center">
            <Card.Body className="py-2">
              <div className="fw-bold text-primary">{frame.frame}</div>
              <div className="small text-muted">프레임</div>
            </Card.Body>
          </Card>
        </Col>
        <Col sm={6} md={3}>
          <Card className="text-center">
            <Card.Body className="py-2">
              <div className="fw-bold">{uniqueChildren.length}</div>
              <div className="small text-muted">Key 수</div>
            </Card.Body>
          </Card>
        </Col>
        <Col sm={6} md={3}>
          <Card className="text-center">
            <Card.Body className="py-2">
              <div className="fw-bold">{i18n.language}</div>
              <div className="small text-muted">비교 언어</div>
            </Card.Body>
          </Card>
        </Col>
        <Col sm={6} md={3}>
          <Card className="text-center">
            <Card.Body className="py-2">
              {i18n.language === 'en' ? (
                <div className="fw-bold text-success">원문과 동일</div>
              ) : (
                <div className="fw-bold text-info">변경 {totalChanged}건</div>
              )}
              <div className="small text-muted">상태</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Comparison */}
      <Card className="mb-4">
        <Card.Header>
          <Row>
            <Col className="text-center">
              <strong>🎨 Figma 원본 (English)</strong>
            </Col>
            <Col className="text-center">
              <strong>⚛️ 코드 출력 ({i18n.language})</strong>
            </Col>
          </Row>
        </Card.Header>
        <Card.Body className="p-0">
          {uniqueChildren.map((child) => {
            const translated = t(child.key);
            const changed = translated !== child.originalText;

            return (
              <Row
                key={child.key}
                className={`g-0 border-bottom align-items-center ${changed ? 'bg-info bg-opacity-10' : ''}`}
              >
                <Col className="p-3 border-end">
                  <Badge bg={getBadgeVariant(child.type)} className="me-2 small">
                    {child.type}
                  </Badge>
                  {child.originalText}
                </Col>
                <Col className="p-3 d-flex justify-content-between align-items-center">
                  <span className={changed ? 'fw-semibold' : ''}>{translated}</span>
                  {changed && <Badge bg="info">●</Badge>}
                </Col>
              </Row>
            );
          })}
        </Card.Body>
      </Card>

      {/* Legend */}
      <Alert variant="light" className="border small">
        <span className="me-4">
          <Badge bg="info" className="me-1">●</Badge> 번역됨 (원문과 다름)
        </span>
        <span>
          <Badge bg="secondary" className="me-1 opacity-50">●</Badge> 동일 (영문 유지)
        </span>
      </Alert>

      {/* Code Info */}
      <Card className="mb-4 bg-dark text-light">
        <Card.Header className="small">💡 코드에서의 사용</Card.Header>
        <Card.Body style={{ fontSize: 13 }}>
          <code className="d-block text-warning">
            {`// Figma: "${uniqueChildren[0]?.originalText}"`}
          </code>
          <code className="d-block text-info">
            {`// Code:  {t('${uniqueChildren[0]?.key}')}`}
          </code>
          <code className="d-block text-success">
            {`// ${i18n.language}: "${t(uniqueChildren[0]?.key || '')}"`}
          </code>
        </Card.Body>
      </Card>

      <div className="d-flex justify-content-between">
        <Button variant="outline-secondary" onClick={onBack}>
          ← 이전
        </Button>
        {/* 이전에는 disabled + onClick 없음이라 클릭이 아예 불가능했다 */}
        <Button variant="success" size="lg" onClick={onComplete}>
          ✅ 완료
        </Button>
      </div>
    </>
  );
}

export default StepCompare;
