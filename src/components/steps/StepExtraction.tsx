import { Alert, Card, Row, Col, Table, Badge, Button, ProgressBar, Spinner } from 'react-bootstrap';
import Pagination, { usePagination } from '../Pagination';
import { useComponentsMap } from '../../hooks/useFigmaData';

interface StepExtractionProps {
  onNext: () => void;
  onBack: () => void;
}

function StepExtraction({ onNext, onBack }: StepExtractionProps) {
  // static import를 쓰면 파이프라인 재실행 결과가 재빌드 전까지 반영되지 않는다.
  const { data, loading, error } = useComponentsMap();
  const componentsMap = data ?? [];

  const allItems = componentsMap.flatMap((frame) =>
    frame.children.map((child) => ({
      ...child,
      frame: frame.frame,
    }))
  );

  const uniqueKeys = allItems.filter(
    (item, idx, arr) => arr.findIndex((x) => x.key === item.key) === idx
  );

  const { paginatedItems, handlePageChange, totalItems, pageSize } = usePagination(uniqueKeys, 15);

  const typeCount = {
    title: uniqueKeys.filter((x) => x.type === 'title').length,
    label: uniqueKeys.filter((x) => x.type === 'label').length,
    button: uniqueKeys.filter((x) => x.type === 'button').length,
    placeholder: uniqueKeys.filter((x) => x.type === 'placeholder').length,
    status: uniqueKeys.filter((x) => x.type === 'status').length,
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

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" className="mb-3" />
        <div className="text-muted small">추출 결과를 불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <>
        <h4 className="mb-4">Step 2. 텍스트 추출 결과</h4>
        <Alert variant="danger">
          <Alert.Heading className="h6">components-map.json을 불러올 수 없습니다</Alert.Heading>
          <p className="small mb-2">{error}</p>
          <div className="small mb-0">
            API 서버를 실행하고(<code>npm run dev:all</code>) Step 5에서 파이프라인을 먼저 실행하세요.
          </div>
        </Alert>
        <Button variant="outline-secondary" onClick={onBack}>
          ← 이전
        </Button>
      </>
    );
  }

  return (
    <>
      <h4 className="mb-4">Step 2. 텍스트 추출 결과</h4>
      <p className="text-muted mb-4">
        Figma 파일에서 <strong>{allItems.length}개 텍스트</strong>를 추출하고,
        중복 제거 후 <strong>{uniqueKeys.length}개 고유 i18n key</strong>를 생성했습니다.
      </p>

      {/* Summary Cards */}
      <Row className="mb-4">
        <Col sm={6} md={3}>
          <Card className="text-center">
            <Card.Body>
              <div className="fs-3 fw-bold text-primary">{componentsMap.length}</div>
              <div className="text-muted small">Figma Frames</div>
            </Card.Body>
          </Card>
        </Col>
        <Col sm={6} md={3}>
          <Card className="text-center">
            <Card.Body>
              <div className="fs-3 fw-bold">{allItems.length}</div>
              <div className="text-muted small">총 텍스트</div>
            </Card.Body>
          </Card>
        </Col>
        <Col sm={6} md={3}>
          <Card className="text-center border-primary">
            <Card.Body>
              <div className="fs-3 fw-bold text-primary">{uniqueKeys.length}</div>
              <div className="text-muted small">고유 Keys</div>
            </Card.Body>
          </Card>
        </Col>
        <Col sm={6} md={3}>
          <Card className="text-center">
            <Card.Body>
              <div className="fs-3 fw-bold text-success">4</div>
              <div className="text-muted small">번역 언어</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Type Breakdown */}
      <Card className="mb-4">
        <Card.Header>텍스트 유형 분류</Card.Header>
        <Card.Body>
          {Object.entries(typeCount).map(([type, count]) => (
            <div key={type} className="d-flex align-items-center mb-2">
              <Badge bg={getBadgeVariant(type)} className="me-2" style={{ width: 80 }}>
                {type}
              </Badge>
              <ProgressBar
                now={(count / uniqueKeys.length) * 100}
                variant={getBadgeVariant(type)}
                className="flex-grow-1 me-2"
                style={{ height: 8 }}
              />
              <span className="text-muted small" style={{ width: 30 }}>{count}</span>
            </div>
          ))}
        </Card.Body>
      </Card>

      {/* Key Table */}
      <Card className="mb-4">
        <Card.Header>생성된 i18n Key 목록 ({uniqueKeys.length}개)</Card.Header>
        <Table striped hover responsive className="mb-0">
          <thead>
            <tr>
              <th style={{ width: 100 }}>Type</th>
              <th>i18n Key</th>
              <th>Original Text</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((item) => (
              <tr key={item.key}>
                <td>
                  <Badge bg={getBadgeVariant(item.type)}>{item.type}</Badge>
                </td>
                <td><code className="text-primary">{item.key}</code></td>
                <td>{item.originalText}</td>
              </tr>
            ))}
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
          🌐 번역 시작 (EXAONE)
        </Button>
      </div>
    </>
  );
}

export default StepExtraction;
