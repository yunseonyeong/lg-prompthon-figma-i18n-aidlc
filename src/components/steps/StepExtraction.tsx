import { Alert, Card, Row, Col, Table, Badge, Button, ProgressBar, Spinner } from 'react-bootstrap';
import Pagination, { usePagination } from '../Pagination';
import { SkeletonRegion, SkeletonStatCards, SkeletonTable } from '../Skeleton';
import { useExtraction } from '../../hooks/useFigmaData';

interface StepExtractionProps {
  onNext: () => void;
  onBack: () => void;
  /** 추출이 실패했을 때 파이프라인 실행 화면으로 보낸다 (데드락 방지) */
  onGoToPipeline: () => void;
}

/** context는 `${frameName} > ${role}` 형태다. 프레임 이름만 떼어낸다. */
function frameOf(context: string): string {
  const [frame] = context.split('>');
  return (frame ?? '').trim() || '(unknown)';
}

const BADGE_VARIANTS: Record<string, string> = {
  title: 'primary',
  label: 'info',
  button: 'success',
  placeholder: 'warning',
  status: 'secondary',
  description: 'dark',
  message: 'danger',
};

function getBadgeVariant(role: string) {
  return BADGE_VARIANTS[role] || 'secondary';
}

function StepExtraction({ onNext, onBack, onGoToPipeline }: StepExtractionProps) {
  // 디스크에 남은 components-map.json을 읽는 대신 POST /api/pipeline/extract를 호출한다.
  // 지난 실행 결과가 아니라 지금 Figma의 추출 결과를 보여주기 위함.
  const { data, loading, error, refresh } = useExtraction();

  const entries = data?.translationTargets ?? [];
  const glossaryHits = Object.keys(data?.relevantGlossary ?? {}).length;

  const uniqueKeys = entries.filter(
    (item, idx, arr) => arr.findIndex((x) => x.key === item.key) === idx
  );

  const frameNames = Array.from(new Set(entries.map((e) => frameOf(e.context))));

  const { paginatedItems, handlePageChange, totalItems, pageSize } = usePagination(uniqueKeys, 15);

  // role 종류를 하드코딩하지 않는다. 파이프라인이 role을 추가해도 표에 그대로 드러난다.
  const roleCount = uniqueKeys.reduce<Record<string, number>>((acc, item) => {
    acc[item.role] = (acc[item.role] ?? 0) + 1;
    return acc;
  }, {});
  const roleRows = Object.entries(roleCount).sort((a, b) => b[1] - a[1]);

  // 최초 추출 중. Figma API 왕복이라 수 초 걸린다.
  if (loading && entries.length === 0) {
    return (
      <SkeletonRegion label="Figma에서 텍스트를 추출하는 중">
        <h4 className="mb-2">Step 2. 텍스트 추출 결과</h4>
        <p className="text-muted small mb-4">
          Figma API로 파일을 읽어 텍스트를 추출하고 i18n 키를 생성하는 중입니다. 수 초 걸릴 수 있습니다.
        </p>
        <div className="mb-4">
          <SkeletonStatCards count={4} />
        </div>
        <Card>
          {/* 실제 표와 동일한 4열 15행 → 완료 시 높이가 튀지 않는다 */}
          <SkeletonTable rows={15} columns={4} columnWidths={['10%', '35%', '35%', '20%']} />
        </Card>
      </SkeletonRegion>
    );
  }

  // 추출이 실패했거나 결과가 0건인 상태. 여기서 반드시 다음 길을 열어둔다.
  if (error || entries.length === 0) {
    return (
      <>
        <h4 className="mb-4">Step 2. 텍스트 추출 결과</h4>
        <Alert variant={error ? 'danger' : 'secondary'}>
          <Alert.Heading className="h6">
            {error ? '텍스트 추출에 실패했습니다' : '추출된 텍스트가 없습니다'}
          </Alert.Heading>
          {error && <p className="small mb-2">{error}</p>}
          <div className="small mb-0">
            {error ? (
              <>
                Figma File Key와 FIGMA_API_KEY를 확인하세요.
                <br />
                API 서버가 꺼져 있는지도 확인하세요 — <code>npm run dev:all</code>
              </>
            ) : (
              'File Key 또는 대상 프레임 ID가 맞는지 확인하세요.'
            )}
          </div>
        </Alert>
        <div className="d-flex justify-content-between">
          <Button variant="outline-secondary" onClick={onBack}>
            ← 이전
          </Button>
          <div className="d-flex gap-2">
            <Button variant="outline-primary" onClick={refresh} disabled={loading}>
              {loading ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  추출 중...
                </>
              ) : (
                '↻ 다시 추출'
              )}
            </Button>
            <Button variant="primary" onClick={onGoToPipeline}>
              ⚡ 파이프라인 실행하러 가기
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="d-flex align-items-start justify-content-between mb-2">
        <h4 className="mb-0">Step 2. 텍스트 추출 결과</h4>
        <Button variant="outline-secondary" size="sm" onClick={refresh} disabled={loading}>
          {loading ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" />
              추출 중...
            </>
          ) : (
            '↻ 다시 추출'
          )}
        </Button>
      </div>

      <p className="text-muted mb-4">
        Figma 파일에서 <strong>{entries.length}개 텍스트</strong>를 추출하고,
        중복 제거 후 <strong>{uniqueKeys.length}개 고유 i18n key</strong>를 생성했습니다.
      </p>

      {/* Summary Cards */}
      <Row className="mb-4">
        <Col sm={6} md={3}>
          <Card className="text-center">
            <Card.Body>
              <div className="fs-3 fw-bold text-primary">{frameNames.length}</div>
              <div className="text-muted small">Figma Frames</div>
            </Card.Body>
          </Card>
        </Col>
        <Col sm={6} md={3}>
          <Card className="text-center">
            <Card.Body>
              <div className="fs-3 fw-bold">{entries.length}</div>
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
              {/* 번역 언어 수는 이 단계에서 확인할 수 없다. 추출 결과로 실제 매칭된 용어 수를 보여준다 */}
              <div className="fs-3 fw-bold text-success">{glossaryHits}</div>
              <div className="text-muted small">매칭된 용어집</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Role Breakdown */}
      <Card className="mb-4">
        <Card.Header>텍스트 유형 분류</Card.Header>
        <Card.Body>
          {roleRows.map(([role, count]) => (
            <div key={role} className="d-flex align-items-center mb-2">
              <Badge bg={getBadgeVariant(role)} className="me-2" style={{ width: 90 }}>
                {role}
              </Badge>
              <ProgressBar
                now={(count / uniqueKeys.length) * 100}
                variant={getBadgeVariant(role)}
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
              <th style={{ width: 180 }}>Frame</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((item) => (
              <tr key={item.key}>
                <td>
                  <Badge bg={getBadgeVariant(item.role)}>{item.role}</Badge>
                </td>
                <td><code className="text-primary">{item.key}</code></td>
                <td>{item.source}</td>
                <td className="text-muted small">{frameOf(item.context)}</td>
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
