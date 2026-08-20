import { useState, useEffect } from 'react';
import { Card, Form, Button, Row, Col, ListGroup, Badge, Tab, Nav, Alert, Table, Spinner } from 'react-bootstrap';
import { API_BASE } from '../../api/client';
import { useFigmaMcpStatus } from '../../hooks/useFigmaData';

interface StepInputProps {
  onNext: () => void;
}

interface PipelineHistory {
  id: string;
  timestamp: string;
  figmaFileKey: string;
  figmaFileName: string;
  extractedCount: number;
  translatedCount: number;
  componentsCount: number;
  languages: string[];
}

interface ProjectConfig {
  figmaUrl: string;
  figmaFileKey: string;
  figmaFrameIds: string;  // 쉼표로 구분된 프레임 ID들
  domainDescription: string;
  targetLanguages: string[];
  glossaryTermCount: number;
}

function StepInput({ onNext }: StepInputProps) {
  const mcp = useFigmaMcpStatus();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [config, setConfig] = useState<ProjectConfig>({
    figmaUrl: 'https://www.figma.com/design/zdG3CHXVU6TzD4cc28o5Yb/LG-Business-Cloud-Console',
    figmaFileKey: 'zdG3CHXVU6TzD4cc28o5Yb',
    figmaFrameIds: '15682:100905',  // 기본값
    domainDescription: 'LG Business Cloud console — a B2B admin console for managing business sites, workspaces, device groups, users, roles and licenses',
    targetLanguages: ['en', 'ko', 'ja', 'zh-CN'],
    glossaryTermCount: 47,
  });
  const [history, setHistory] = useState<PipelineHistory[]>([]);
  const [existingFiles, setExistingFiles] = useState<any[]>([]);
  const [hasExistingData, setHasExistingData] = useState(false);

  useEffect(() => {
    loadExistingData();
    loadHistory();
    // 저장된 설정 불러오기
    const saved = localStorage.getItem('ux-dlc-config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConfig(prev => ({ ...prev, ...parsed }));
      } catch {}
    }
  }, []);

  const loadExistingData = async () => {
    try {
      const res = await fetch(`${API_BASE}/pipeline/status`);
      if (res.ok) {
        const data = await res.json();
        setExistingFiles(data.files || []);
        setHasExistingData(data.files?.length > 0);
      }
    } catch (error) {
      console.error('기존 데이터 로드 실패:', error);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/pipeline/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch {
      const saved = localStorage.getItem('pipeline-history');
      if (saved) setHistory(JSON.parse(saved));
    }
  };

  const handleUrlChange = (url: string) => {
    setConfig({ ...config, figmaUrl: url });
    const match = url.match(/figma\.com\/(?:design|file)\/([a-zA-Z0-9]+)/);
    if (match) {
      setConfig((prev) => ({ ...prev, figmaUrl: url, figmaFileKey: match[1] }));
    }
  };

  const saveConfig = () => {
    localStorage.setItem('ux-dlc-config', JSON.stringify(config));
    alert('설정이 저장되었습니다.');
  };

  const localeFiles = existingFiles.filter((f) => f.path.includes('locales'));
  const componentFiles = existingFiles.filter((f) => f.path.includes('generated'));
  const totalKeys = localeFiles.reduce((sum, f) => Math.max(sum, f.keys || 0), 0);

  return (
    <div className="ux-slide-up">
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="mb-1 fw-bold">
            <span className="text-gradient">UX DLC</span> 대시보드
          </h4>
          <p className="text-muted mb-0 small">
            Figma 디자인에서 다국어 코드까지, AI가 자동으로 생성합니다
          </p>
        </div>
        <div className="d-flex gap-2 align-items-center">
          {/* MCP 연동 상태를 실제로 확인해서 표시한다 (문구로만 주장하지 않는다) */}
          {mcp.loading ? (
            <Badge bg="light" text="dark" className="px-3 py-2">
              <Spinner animation="border" size="sm" className="me-1" /> Figma MCP 확인 중
            </Badge>
          ) : mcp.data?.connected ? (
            <Badge bg="success" className="px-3 py-2" title={`tools: ${mcp.data.tools.join(', ')}`}>
              🔌 Figma MCP 연결됨
            </Badge>
          ) : (
            <Badge
              bg="danger"
              className="px-3 py-2"
              title={mcp.data?.lastError || mcp.error || 'API 서버(:3001) 확인'}
            >
              🔌 Figma MCP 미연결
            </Badge>
          )}
          <Badge bg="light" text="dark" className="px-3 py-2">
            🤖 EXAONE 2.0
          </Badge>
        </div>
      </div>

      {!mcp.loading && !mcp.data?.connected && (
        <Alert variant="warning" className="d-flex align-items-start gap-3">
          <span className="fs-4">⚠️</span>
          <div className="small">
            <strong>Figma MCP가 연결되지 않았습니다.</strong>
            <div className="text-muted">
              {mcp.data?.tokenPresent === false
                ? 'FIGMA_API_KEY가 없습니다. 프로젝트 .env 또는 ~/.hermes/.env에 설정하세요.'
                : mcp.data?.lastError || mcp.error || 'API 서버를 실행하세요: npm run dev:all'}
            </div>
            <div className="text-muted mt-1">
              미연결 상태에서는 미리보기가 캐시된 <code>src/figma-structure.json</code>을 사용합니다.
            </div>
          </div>
        </Alert>
      )}

      <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k || 'dashboard')}>
        <Nav variant="pills" className="mb-4 gap-2">
          <Nav.Item>
            <Nav.Link eventKey="dashboard" className="d-flex align-items-center gap-2">
              <span>📊</span> 대시보드
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="config" className="d-flex align-items-center gap-2">
              <span>⚙️</span> 프로젝트 설정
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="history" className="d-flex align-items-center gap-2">
              <span>📜</span> 실행 히스토리
            </Nav.Link>
          </Nav.Item>
        </Nav>

        <Tab.Content>
          {/* Dashboard Tab */}
          <Tab.Pane eventKey="dashboard">
            {hasExistingData ? (
              <div className="ux-stagger">
                {/* Stats */}
                <Row className="mb-4 g-3">
                  {[
                    { value: totalKeys, label: 'i18n Keys', variant: 'primary', icon: '🔑' },
                    { value: localeFiles.length, label: '언어 파일', variant: 'success', icon: '🌐' },
                    { value: componentFiles.length, label: '컴포넌트', variant: 'info', icon: '⚛️' },
                    { value: config.glossaryTermCount, label: '용어집 항목', variant: 'secondary', icon: '📚' },
                  ].map((stat) => (
                    <Col sm={6} md={3} key={stat.label}>
                      <div className={`ux-stat-card ${stat.variant}`}>
                        <div className="mb-2 fs-4">{stat.icon}</div>
                        <div className="ux-stat-value">{stat.value}</div>
                        <div className="ux-stat-label">{stat.label}</div>
                      </div>
                    </Col>
                  ))}
                </Row>

                {/* Generated Files */}
                <Card className="ux-card mb-4">
                  <Card.Header className="ux-card-header d-flex align-items-center gap-2">
                    <span>📁</span> 생성된 파일
                  </Card.Header>
                  <ListGroup variant="flush">
                    {existingFiles.map((file) => (
                      <ListGroup.Item
                        key={file.path}
                        className="ux-list-item justify-content-between"
                      >
                        <div className="d-flex align-items-center gap-2">
                          <span>{file.icon}</span>
                          <code className="text-primary small">{file.path}</code>
                        </div>
                        <div className="d-flex align-items-center gap-3">
                          {/* 산출물이 언제 생성된 것인지 보여야 '이어서 할지 / 다시 돌릴지' 판단이 된다 */}
                          {file.lastModified && (
                            <span className="text-muted small">
                              {new Date(file.lastModified).toLocaleString()}
                            </span>
                          )}
                          <span className="text-muted small">{file.size}</span>
                          {file.keys > 0 && (
                            <Badge className="ux-badge ux-badge-primary">{file.keys} keys</Badge>
                          )}
                        </div>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                </Card>

                <Alert className="ux-alert ux-alert-info d-flex align-items-center gap-3">
                  <span className="fs-4">💡</span>
                  <div>
                    <strong>기존 작업이 있습니다.</strong>
                    <div className="small text-muted">이어서 작업하거나, 새로 파이프라인을 실행할 수 있습니다.</div>
                  </div>
                </Alert>
              </div>
            ) : (
              <Card className="ux-card text-center py-5">
                <Card.Body>
                  <div className="fs-1 mb-3">🚀</div>
                  <h5 className="fw-bold mb-2">아직 생성된 데이터가 없습니다</h5>
                  <p className="text-muted mb-4">프로젝트 설정 후 파이프라인을 실행하세요.</p>
                  <Button className="ux-btn-primary" onClick={() => setActiveTab('config')}>
                    프로젝트 설정하기
                  </Button>
                </Card.Body>
              </Card>
            )}

            {/* EXAONE Feature Card */}
            <Card className="ux-card ux-card-gradient mt-4">
              <Card.Header className="border-0 bg-transparent pt-4 pb-0">
                <h5 className="d-flex align-items-center gap-2 mb-0">
                  <span>🤖</span> EXAONE 2.0 기반 UX DLC
                </h5>
              </Card.Header>
              <Card.Body>
                <Row>
                  <Col md={8}>
                    <div className="d-flex flex-column gap-2">
                      {[
                        { step: 1, text: 'Figma MCP로 페이지/프레임 구조와 텍스트 노드 추출' },
                        { step: 2, text: 'UX 흐름을 분석하여 도메인 문맥 파악', highlight: true },
                        { step: 3, text: '도메인 용어집 기반 i18n key 자동 생성' },
                        { step: 4, text: '주변 텍스트 문맥 기반 번역 (오역 방지)', highlight: true },
                        { step: 5, text: 'React 컴포넌트 + i18n JSON 자동 생성' },
                      ].map((item) => (
                        <div key={item.step} className="d-flex align-items-center gap-3">
                          <Badge 
                            bg={item.highlight ? 'warning' : 'light'} 
                            text={item.highlight ? 'dark' : 'dark'}
                            className="rounded-circle"
                            style={{ width: 24, height: 24, padding: 0, lineHeight: '24px' }}
                          >
                            {item.step}
                          </Badge>
                          <span className={item.highlight ? 'fw-semibold' : 'opacity-90'}>
                            {item.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Col>
                  <Col md={4} className="border-start border-white border-opacity-25 ps-4">
                    <div className="d-flex flex-column gap-3">
                      <div>
                        <div className="fw-semibold d-flex align-items-center gap-2">
                          <span>🎯</span> 문맥 오역 방지
                        </div>
                        <div className="small opacity-75">"Withdraw" → "회수" (탈퇴 ❌)</div>
                      </div>
                      <div>
                        <div className="fw-semibold d-flex align-items-center gap-2">
                          <span>🇰🇷</span> 한국어 특화 LLM
                        </div>
                        <div className="small opacity-75">한→일/중 번역 정확도 향상</div>
                      </div>
                      <div>
                        <div className="fw-semibold d-flex align-items-center gap-2">
                          <span>💰</span> 비용 절감
                        </div>
                        <div className="small opacity-75">사내 Hermes Agent 활용</div>
                      </div>
                    </div>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Tab.Pane>

          {/* Config Tab */}
          <Tab.Pane eventKey="config">
            <Row className="ux-stagger">
              <Col lg={8}>
                <Card className="ux-card mb-4">
                  <Card.Header className="ux-card-header d-flex align-items-center gap-2">
                    <span>📂</span> Figma 프로젝트
                  </Card.Header>
                  <Card.Body>
                    <Form.Group className="mb-3">
                      <Form.Label className="fw-semibold small">Figma File URL</Form.Label>
                      <Form.Control
                        type="text"
                        value={config.figmaUrl}
                        onChange={(e) => handleUrlChange(e.target.value)}
                        placeholder="https://www.figma.com/design/..."
                        className="border-2"
                      />
                      <Form.Text className="text-muted">
                        File Key: <code className="text-primary">{config.figmaFileKey}</code>
                      </Form.Text>
                    </Form.Group>
                    
                    <Form.Group className="mb-0">
                      <Form.Label className="fw-semibold small">
                        Frame ID <Badge bg="danger" className="ms-1">필수</Badge>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        value={config.figmaFrameIds}
                        onChange={(e) => setConfig({ ...config, figmaFrameIds: e.target.value })}
                        placeholder="15682:100905"
                        className="border-2 font-monospace"
                      />
                      <Form.Text className="text-muted">
                        Figma에서 프레임 선택 → 우클릭 → "Copy link" → URL 끝의 <code>node-id=</code> 값
                        <br />
                        여러 프레임은 쉼표로 구분 (예: <code>15682:100905, 15682:100906</code>)
                      </Form.Text>
                    </Form.Group>
                  </Card.Body>
                </Card>

                <Card className="ux-card mb-4">
                  <Card.Header className="ux-card-header">
                    <div className="d-flex align-items-center gap-2">
                      <span>📝</span> 도메인 설명
                      <Badge className="ux-badge ux-badge-info ms-2">EXAONE 번역 품질에 영향</Badge>
                    </div>
                  </Card.Header>
                  <Card.Body>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={config.domainDescription}
                      onChange={(e) => setConfig({ ...config, domainDescription: e.target.value })}
                      placeholder="이 서비스가 무엇인지 설명해주세요..."
                      className="border-2"
                    />
                    <Form.Text className="text-muted">
                      예: "B2B 디바이스 관리 콘솔 - 라이선스 할당/회수, 사용자 권한 관리 기능 제공"
                    </Form.Text>
                  </Card.Body>
                </Card>

                <Card className="ux-card mb-4">
                  <Card.Header className="ux-card-header d-flex align-items-center gap-2">
                    <span>🌐</span> 번역 대상 언어
                  </Card.Header>
                  <Card.Body>
                    <div className="d-flex gap-3 flex-wrap">
                      {[
                        { code: 'en', label: '🇺🇸 English', required: true },
                        { code: 'ko', label: '🇰🇷 한국어', required: false },
                        { code: 'ja', label: '🇯🇵 日本語', required: false },
                        { code: 'zh-CN', label: '🇨🇳 简体中文', required: false },
                      ].map((lang) => (
                        <Form.Check
                          key={lang.code}
                          type="checkbox"
                          id={`lang-${lang.code}`}
                          label={lang.label}
                          checked={config.targetLanguages.includes(lang.code)}
                          disabled={lang.required}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setConfig({
                                ...config,
                                targetLanguages: [...config.targetLanguages, lang.code],
                              });
                            } else {
                              setConfig({
                                ...config,
                                targetLanguages: config.targetLanguages.filter((l) => l !== lang.code),
                              });
                            }
                          }}
                          className="user-select-none"
                        />
                      ))}
                    </div>
                  </Card.Body>
                </Card>

                <div className="d-flex gap-2">
                  <Button className="ux-btn-primary" onClick={saveConfig}>
                    💾 설정 저장
                  </Button>
                  <Button className="ux-btn-secondary" onClick={() => setActiveTab('dashboard')}>
                    취소
                  </Button>
                </div>
              </Col>

              <Col lg={4}>
                <Card className="ux-card bg-light border-0">
                  <Card.Header className="ux-card-header bg-transparent d-flex align-items-center gap-2">
                    <span>💡</span> 설정 가이드
                  </Card.Header>
                  <Card.Body className="small">
                    <div className="mb-4">
                      <div className="fw-semibold mb-1">도메인 설명이 중요한 이유</div>
                      <div className="text-muted">
                        EXAONE에게 서비스 맥락을 알려주면 "Withdraw"가 "탈퇴"가 아닌 "회수"(라이선스)임을 더 잘 판단합니다.
                      </div>
                    </div>
                    <div className="mb-4">
                      <div className="fw-semibold mb-1">좋은 설명 예시</div>
                      <div className="text-success small mb-1">
                        ✅ "B2B 디바이스 관리 콘솔로, 라이선스 할당/회수, 사용자 권한 관리 기능 제공"
                      </div>
                      <div className="text-danger small">
                        ❌ "관리 시스템"
                      </div>
                    </div>
                    <div>
                      <div className="fw-semibold mb-1">용어집 연동</div>
                      <div className="text-muted">
                        <code className="small">requirements/domain-glossary.md</code> 파일의 용어가 번역에 우선 적용됩니다.
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Tab.Pane>

          {/* History Tab */}
          <Tab.Pane eventKey="history">
            {history.length > 0 ? (
              <Card className="ux-card">
                <Card.Header className="ux-card-header d-flex align-items-center gap-2">
                  <span>📜</span> 파이프라인 실행 히스토리
                </Card.Header>
                <div className="table-responsive">
                  <Table className="ux-table mb-0">
                    <thead>
                      <tr>
                        <th>실행 시간</th>
                        <th>Figma 파일</th>
                        <th>추출</th>
                        <th>번역</th>
                        <th>컴포넌트</th>
                        <th>언어</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((item) => (
                        <tr key={item.id}>
                          <td className="small">{new Date(item.timestamp).toLocaleString()}</td>
                          <td>
                            <code className="small text-primary">{item.figmaFileKey.slice(0, 8)}...</code>
                          </td>
                          <td>
                            <Badge className="ux-badge ux-badge-primary">{item.extractedCount}개</Badge>
                          </td>
                          <td>
                            <Badge className="ux-badge ux-badge-success">{item.translatedCount}개</Badge>
                          </td>
                          <td>
                            <Badge className="ux-badge ux-badge-info">{item.componentsCount}개</Badge>
                          </td>
                          <td>
                            <div className="d-flex gap-1 flex-wrap">
                              {item.languages.map((l) => (
                                <Badge key={l} bg="secondary" className="fw-normal">
                                  {l}
                                </Badge>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </Card>
            ) : (
              <Card className="ux-card text-center py-5">
                <Card.Body>
                  <div className="fs-1 mb-3">📜</div>
                  <h5 className="fw-bold mb-2">실행 히스토리가 없습니다</h5>
                  <p className="text-muted">파이프라인을 실행하면 히스토리가 기록됩니다.</p>
                </Card.Body>
              </Card>
            )}
          </Tab.Pane>
        </Tab.Content>
      </Tab.Container>

      {/* Next Button */}
      <div className="d-flex justify-content-end mt-4">
        {/*
          이전에는 라벨이 '이어서 작업하기' / '🚀 시작하기'로 갈렸지만 두 분기의 동작이
          완전히 동일했다(onNext만 호출). 게다가 산출물이 디스크에 한 번 생기면
          hasExistingData가 영구히 true여서 항상 '이어서 작업하기'로 고정됐다.
          라벨이 상태를 암시하지 않고 실제 동작(다음 단계 이동)을 설명하도록 바꿨다.
          기존 작업 유무는 위 대시보드 Alert와 파일 목록이 이미 보여준다.
        */}
        <Button className="ux-btn-primary px-4 py-2" size="lg" onClick={onNext}>
          텍스트 추출 결과 보기
          <span className="ms-2">→</span>
        </Button>
      </div>
    </div>
  );
}

export default StepInput;
