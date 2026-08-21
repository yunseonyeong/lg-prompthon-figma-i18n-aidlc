import { useState, useEffect, useRef } from 'react';
import {
  Card,
  Row,
  Col,
  ListGroup,
  Badge,
  Button,
  Nav,
  Tab,
  Alert,
  ProgressBar,
  Form,
  Spinner,
} from 'react-bootstrap';
import {
  API_BASE,
  fetchLocaleHistory,
  fetchLocaleHistoryEntry,
  fetchProjectConfig,
  type LocaleHistoryRun,
} from '../../api/client';
import { retryComponentRun, useComponentRun } from '../../state/componentRun';

interface StepCodeGenProps {
  onNext: () => void;
  onBack: () => void;
}

interface GeneratedFile {
  path: string;
  size: string;
  keys: number;
  icon: string;
}

interface PipelineState {
  status: 'idle' | 'running' | 'complete' | 'error';
  step: number;
  message: string;
  extractedCount: number;
  translatedCount: number;
  /** Step 8이 만든 컴포넌트 수. 0이면 EXAONE 컴포넌트 생성이 실패한 것이다 */
  componentCount: number;
  files: GeneratedFile[];
  error?: string;
  /** exit code 0이지만 실패한 단계가 있을 때 서버가 올려주는 이유 */
  warnings: string[];
}

const PIPELINE_STEPS = [
  { step: 1, label: 'Figma 텍스트 추출', icon: '📄' },
  { step: 2, label: 'UX 흐름 문맥 분석', icon: '🔍' },
  { step: 3, label: 'i18n Key 생성', icon: '🔑' },
  { step: 4, label: 'EXAONE 문맥 번역', icon: '🤖' },
  { step: 5, label: 'Locale JSON 출력', icon: '📦' },
  { step: 6, label: 'Components Map', icon: '🗺️' },
  { step: 7, label: '용어집 제안', icon: '📚' },
  { step: 8, label: '컴포넌트 생성', icon: '⚛️' },
];

function StepCodeGen({ onNext, onBack }: StepCodeGenProps) {
  const [activeTab, setActiveTab] = useState('files');
  const [pipeline, setPipeline] = useState<PipelineState>({
    status: 'idle',
    step: 0,
    message: '',
    extractedCount: 0,
    translatedCount: 0,
    componentCount: 0,
    files: [],
    warnings: [],
  });
  const [localePreview, setLocalePreview] = useState<{ lang: string; content: any } | null>(null);
  // locale 실행 이력. 'latest'는 현재 src/locales/*.json, 그 외는 runId
  const [localeRuns, setLocaleRuns] = useState<LocaleHistoryRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<string>('latest');
  const [componentsMap, setComponentsMap] = useState<any[] | null>(null);
  const [generatedComponents, setGeneratedComponents] = useState<any[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<{
    name: string;
    fileName?: string;
    code: string;
  } | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Step 4의 "코드 생성"이 시작한 실행 (Step 8만 단독 실행)
  const componentRun = useComponentRun();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (componentRun.status !== 'running') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [componentRun.status]);
  const componentElapsed = componentRun.startedAt
    ? Math.max(0, Math.floor((now - componentRun.startedAt) / 1000))
    : 0;

  // 생성이 끝나면 결과의 첫 컴포넌트를 코드 뷰어에 띄운다
  useEffect(() => {
    if (componentRun.status === 'done' && componentRun.data?.components.length) {
      setSelectedComponent(componentRun.data.components[0]);
    }
  }, [componentRun.status, componentRun.data]);

  useEffect(() => {
    loadExistingFiles();
    void loadLocaleHistory();
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  const loadExistingFiles = async () => {
    try {
      const res = await fetch(`${API_BASE}/pipeline/status`);
      if (res.ok) {
        const data = await res.json();
        if (data.files.length > 0) {
          setPipeline((prev) => ({
            ...prev,
            status: 'complete',
            files: data.files,
            message: '이전에 생성된 파일이 있습니다.',
          }));
        }
      }
    } catch (error) {
      console.error('상태 로드 실패:', error);
    }
  };

  const runPipeline = async () => {
    setPipeline({
      status: 'running',
      step: 0,
      message: '파이프라인 시작 중...',
      extractedCount: 0,
      translatedCount: 0,
      componentCount: 0,
      files: [],
      warnings: [],
    });

    // 설정은 서버가 기준이다. 서버가 응답하지 않으면 localStorage 캐시로 폴백한다.
    // (도메인 설명·언어는 서버가 직접 읽어 env로 전달하므로 여기서 보낼 필요가 없다)
    let figmaFileKey = '';
    let figmaFrameIds = '';
    try {
      const server = await fetchProjectConfig();
      figmaFileKey = server.figmaFileKey || '';
      figmaFrameIds = server.figmaFrameIds || '';
    } catch {
      try {
        const saved = localStorage.getItem('ux-dlc-config');
        if (saved) {
          const cached = JSON.parse(saved);
          figmaFileKey = cached.figmaFileKey || '';
          figmaFrameIds = cached.figmaFrameIds || '';
        }
      } catch {
        /* 캐시도 없으면 파이프라인 기본값 사용 */
      }
    }

    try {
      const res = await fetch(`${API_BASE}/pipeline/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ figmaFileKey, figmaFrameIds }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('스트림을 읽을 수 없습니다.');

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const messages = buffer.split('\n\n');
        buffer = messages.pop() || '';

        for (const message of messages) {
          if (!message.trim()) continue;
          
          const lines = message.split('\n');
          let eventType = 'message';
          let data = '';

          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventType = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              data = line.slice(5).trim();
            }
          }

          if (data) {
            try {
              const parsed = JSON.parse(data);
              handleEvent(eventType, parsed);
            } catch (e) {
              console.error('SSE 파싱 오류:', e, data);
            }
          }
        }
      }
      
      console.log('스트림 종료됨');
      // 이번 실행이 남긴 locale 이력을 목록에 반영한다
      void loadLocaleHistory();
      const statusRes = await fetch(`${API_BASE}/pipeline/status`);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setPipeline((prev) => ({
          ...prev,
          status: 'complete',
          message: '파이프라인 완료!',
          files: statusData.files || [],
        }));
      } else {
        setPipeline((prev) => ({
          ...prev,
          status: 'complete',
          message: '파이프라인 완료!',
        }));
      }
    } catch (error: any) {
      console.error('파이프라인 오류:', error);
      setPipeline((prev) => ({
        ...prev,
        status: 'error',
        error: error.message || '파이프라인 실행 실패',
      }));
    }
  };

  const handleEvent = (event: string, data: any) => {
    switch (event) {
      case 'progress':
        setPipeline((prev) => ({
          ...prev,
          step: data.step,
          message: data.message,
        }));
        break;
      case 'info':
        if (data.type === 'extracted') {
          setPipeline((prev) => ({ ...prev, extractedCount: data.count }));
        } else if (data.type === 'translated') {
          setPipeline((prev) => ({ ...prev, translatedCount: data.count }));
        } else if (data.type === 'components') {
          setPipeline((prev) => ({ ...prev, componentCount: data.count }));
        }
        break;
      case 'complete':
        setPipeline((prev) => ({
          ...prev,
          status: data.success ? 'complete' : 'error',
          message: data.message,
          files: data.files || prev.files,
          componentCount: data.componentCount ?? prev.componentCount,
          warnings: data.warnings ?? prev.warnings,
          error: data.success ? undefined : data.message,
        }));
        break;
      case 'error':
        setPipeline((prev) => ({
          ...prev,
          error: data.message,
        }));
        break;
    }
  };

  /**
   * locale 미리보기.
   *
   * runId를 주면 그 시점 사본(src/data/locale-history/<runId>/)을 읽고,
   * 'latest'면 현재 산출물(src/locales/*.json)을 읽는다.
   */
  const loadLocalePreview = async (lang: string, runId: string = selectedRun) => {
    try {
      const content =
        runId === 'latest'
          ? await (await fetch(`${API_BASE}/pipeline/locales/${lang}`)).json()
          : await fetchLocaleHistoryEntry(runId, lang);
      setLocalePreview({ lang, content });
      setActiveTab('json');
    } catch (error) {
      console.error('Locale 로드 실패:', error);
    }
  };

  /** 실행 이력 목록 갱신. 파이프라인 완료 후와 탭 진입 시 호출한다 */
  const loadLocaleHistory = async () => {
    try {
      const { runs } = await fetchLocaleHistory();
      setLocaleRuns(runs);
    } catch (error) {
      console.error('locale 이력 로드 실패:', error);
    }
  };

  const loadComponentsMap = async () => {
    try {
      const res = await fetch(`${API_BASE}/pipeline/components-map`);
      if (res.ok) {
        const content = await res.json();
        setComponentsMap(content);
        setActiveTab('map');
      }
    } catch (error) {
      console.error('Components Map 로드 실패:', error);
    }
  };

  const loadGeneratedComponents = async () => {
    try {
      const res = await fetch(`${API_BASE}/pipeline/components`);
      if (res.ok) {
        const data = await res.json();
        setGeneratedComponents(data.components || []);
        if (data.components?.length > 0) {
          setSelectedComponent(data.components[0]);
        }
        setActiveTab('code');
      }
    } catch (error) {
      console.error('생성된 컴포넌트 로드 실패:', error);
    }
  };

  const totalKeys = pipeline.files.reduce((sum, f) => (f.path.includes('locales') ? Math.max(sum, f.keys) : sum), 0);

  return (
    <div className="ux-slide-up">
      {/* Header */}
      <div className="mb-4">
        <h4 className="mb-1 fw-bold">
          <span className="me-2">⚛️</span>
          Step 5. <span className="text-gradient">코드 생성</span>
        </h4>
        <p className="text-muted mb-0">
          Figma에서 텍스트를 추출하고 EXAONE AI로 문맥 기반 번역을 수행하여 i18n 파일과 React 컴포넌트를 생성합니다.
        </p>
      </div>

      {/*
        Step 4의 "코드 생성" 버튼이 시작한 실행.
        전체 파이프라인(아래 "파이프라인 실행")과 달리 재추출·재번역 없이 Step 8만 돈다.
      */}
      {componentRun.status !== 'idle' && (
        <Card className="ux-card mb-4">
          <Card.Header className="d-flex align-items-center justify-content-between">
            <strong>⚛️ 번역 결과로 컴포넌트 생성</strong>
            {componentRun.status === 'done' && componentRun.data && (
              <Badge bg="success">
                {componentRun.data.summary.generated}개 생성
                {componentRun.data.summary.failed > 0 &&
                  ` · ${componentRun.data.summary.failed}개 실패`}
              </Badge>
            )}
          </Card.Header>
          <Card.Body>
            {componentRun.status === 'running' && (
              <div className="d-flex align-items-center gap-3">
                <Spinner animation="border" size="sm" />
                <div className="small">
                  <strong>EXAONE이 컴포넌트 코드를 생성하는 중... {componentElapsed}초 경과</strong>
                  <div className="text-muted">
                    프레임 단위로 순차 호출하므로 프레임당 10초 이상 걸릴 수 있습니다. 다른 단계로
                    이동해도 실행은 계속됩니다.
                  </div>
                </div>
              </div>
            )}

            {componentRun.status === 'error' && (
              <Alert variant="danger" className="mb-0">
                <Alert.Heading className="h6">컴포넌트 생성에 실패했습니다</Alert.Heading>
                <p className="small mb-2">{componentRun.error}</p>
                <div className="small text-muted mb-2">
                  <code>FRIENDLI_API_KEY</code>와 서버 콘솔의 <code>Step 8</code> 로그를 확인하세요.
                </div>
                <Button
                  size="sm"
                  variant="outline-danger"
                  onClick={() => void retryComponentRun()}
                >
                  ↻ 다시 생성
                </Button>
              </Alert>
            )}

            {componentRun.status === 'done' && componentRun.data && (
              <>
                <div className="d-flex flex-wrap gap-2 mb-3">
                  {componentRun.data.components.map((c) => (
                    <Button
                      key={c.name}
                      size="sm"
                      variant={
                        selectedComponent?.name === c.name ? 'primary' : 'outline-secondary'
                      }
                      onClick={() => setSelectedComponent(c)}
                    >
                      ⚛️ {c.fileName}
                    </Button>
                  ))}
                </div>
                {componentRun.data.failures.length > 0 && (
                  <Alert variant="warning" className="py-2 small">
                    일부 프레임이 실패했습니다:
                    <ul className="mb-0 mt-1">
                      {componentRun.data.failures.map((f, i) => (
                        <li key={i}>
                          <code>{f}</code>
                        </li>
                      ))}
                    </ul>
                  </Alert>
                )}
                {selectedComponent && (
                  <div className="ux-code-block" style={{ maxHeight: 400, overflow: 'auto' }}>
                    <div className="text-success mb-1">
                      // src/components/generated/{selectedComponent.name}.tsx
                    </div>
                    <pre className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                      {selectedComponent.code}
                    </pre>
                  </div>
                )}
                <div className="d-flex justify-content-end mt-3">
                  <Button
                    size="sm"
                    variant="outline-primary"
                    onClick={() => void retryComponentRun()}
                  >
                    ↻ 다시 생성
                  </Button>
                </div>
              </>
            )}
          </Card.Body>
        </Card>
      )}

      {/* Idle State */}
      {pipeline.status === 'idle' && (
        <Card className="ux-card ux-card-gradient text-center py-5 mb-4">
          <Card.Body>
            <div className="mb-4">
              <div 
                className="d-inline-flex align-items-center justify-content-center rounded-circle bg-white bg-opacity-25"
                style={{ width: 80, height: 80, fontSize: '2.5rem' }}
              >
                🤖
              </div>
            </div>
            <h4 className="fw-bold mb-2">EXAONE AI 코드 생성 준비 완료</h4>
            <p className="opacity-75 mb-4 mx-auto" style={{ maxWidth: 500 }}>
              Figma에서 텍스트를 추출하고, UX 흐름 문맥을 분석하여 자동으로 다국어 번역과 React 컴포넌트를 생성합니다.
            </p>
            <Button 
              variant="light" 
              size="lg" 
              className="fw-semibold px-5 shadow"
              onClick={runPipeline}
            >
              🚀 파이프라인 실행
            </Button>
          </Card.Body>
        </Card>
      )}

      {/* Running State */}
      {pipeline.status === 'running' && (
        <Card className="ux-card mb-4">
          <Card.Body className="py-4">
            {/* Current Step Info */}
            <div className="d-flex align-items-center gap-3 mb-4">
              <div 
                className="d-flex align-items-center justify-content-center rounded-circle bg-primary"
                style={{ width: 48, height: 48, fontSize: '1.5rem' }}
              >
                <div className="spinner-border spinner-border-sm text-white" />
              </div>
              <div className="flex-grow-1">
                <div className="fw-bold text-primary">파이프라인 실행 중...</div>
                <div className="text-muted small">{pipeline.message}</div>
              </div>
              <Badge bg="primary" className="px-3 py-2">
                Step {pipeline.step} / 8
              </Badge>
            </div>

            {/* Progress Steps */}
            <div className="mb-4">
              <Row className="g-2">
                {PIPELINE_STEPS.map((s) => {
                  const isComplete = pipeline.step > s.step;
                  const isCurrent = pipeline.step === s.step;
                  return (
                    <Col key={s.step} xs={6} md={3}>
                      <div 
                        className={`d-flex align-items-center gap-2 p-2 rounded ${
                          isComplete ? 'bg-success bg-opacity-10' : 
                          isCurrent ? 'bg-primary bg-opacity-10' : 'bg-light'
                        }`}
                      >
                        <span className={`small ${isCurrent ? 'animate-pulse' : ''}`}>
                          {isComplete ? '✅' : s.icon}
                        </span>
                        <span className={`small ${
                          isComplete ? 'text-success' : 
                          isCurrent ? 'text-primary fw-semibold' : 'text-muted'
                        }`}>
                          {s.label}
                        </span>
                      </div>
                    </Col>
                  );
                })}
              </Row>
            </div>

            {/* Progress Bar */}
            <ProgressBar 
              now={(pipeline.step / 8) * 100} 
              className="ux-progress"
              style={{ height: 8 }}
            />

            {/* Stats */}
            <div className="d-flex gap-4 mt-3">
              {pipeline.extractedCount > 0 && (
                <Badge className="ux-badge ux-badge-primary">
                  📄 추출: {pipeline.extractedCount}개
                </Badge>
              )}
              {pipeline.translatedCount > 0 && (
                <Badge className="ux-badge ux-badge-success">
                  🌐 번역: {pipeline.translatedCount}개
                </Badge>
              )}
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Error State */}
      {pipeline.status === 'error' && (
        <Alert variant="danger" className="mb-4 d-flex align-items-start gap-3">
          <span className="fs-4">❌</span>
          <div className="flex-grow-1">
            <Alert.Heading className="h6 mb-1">파이프라인 오류</Alert.Heading>
            <p className="mb-2 small">{pipeline.error}</p>
            <Button variant="outline-danger" size="sm" onClick={runPipeline}>
              다시 시도
            </Button>
          </div>
        </Alert>
      )}

      {/* Complete State */}
      {pipeline.status === 'complete' && (
        <div className="ux-stagger">
          {/* Stats */}
          <Row className="mb-4 g-3">
            {[
              { value: pipeline.files.length, label: '생성된 파일', variant: 'primary', icon: '📁' },
              { value: totalKeys, label: 'i18n Keys', variant: 'info', icon: '🔑' },
              { value: pipeline.files.filter((f) => f.path.includes('locales')).length, label: 'Locale 파일', variant: 'success', icon: '🌐' },
              { value: pipeline.files.filter((f) => f.path.includes('components')).length, label: 'Components', variant: 'secondary', icon: '⚛️' },
            ].map((stat) => (
              <Col sm={6} md={3} key={stat.label}>
                <div className={`ux-stat-card ${stat.variant}`}>
                  <div className="mb-2">{stat.icon}</div>
                  <div className="ux-stat-value">{stat.value}</div>
                  <div className="ux-stat-label">{stat.label}</div>
                </div>
              </Col>
            ))}
          </Row>

          {/*
            exit code가 0이어도 Step 8(컴포넌트 생성)은 실패할 수 있다.
            파이프라인이 실패를 삼키고 계속 진행하므로, 여기서 명시하지 않으면
            "완료"만 보이고 컴포넌트가 왜 없는지 알 수 없다.
          */}
          {(pipeline.warnings.length > 0 ||
            pipeline.files.filter((f) => f.path.includes('generated') && f.path.endsWith('.tsx'))
              .length === 0) && (
            <Alert variant="warning" className="d-flex align-items-start gap-3 mb-4">
              <span className="fs-4">⚠️</span>
              <div className="small flex-grow-1">
                <strong>컴포넌트 생성이 완료되지 않았습니다</strong>
                <div className="text-muted">
                  locale 등 다른 산출물은 생성됐지만 <code>src/components/generated/*.tsx</code>가
                  없습니다. 서버 콘솔의 <code>Step 8</code> 로그를 확인하세요.
                </div>
                {pipeline.warnings.length > 0 && (
                  <ul className="mb-0 mt-2">
                    {pipeline.warnings.map((w, i) => (
                      <li key={i}>
                        <code className="small">{w}</code>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Alert>
          )}

          {/* EXAONE Badge */}
          <Alert className="ux-alert ux-alert-success d-flex align-items-center justify-content-between mb-4">
            <div className="d-flex align-items-center gap-3">
              <span className="fs-4">🤖</span>
              <div>
                <strong>EXAONE 2.0 문맥 번역 적용 완료</strong>
                <div className="small text-muted">
                  {pipeline.translatedCount > 0
                    ? `${pipeline.translatedCount}개 텍스트 번역 | 용어집 자동 적용`
                    : '문맥 기반 번역 완료'}
                  {pipeline.componentCount > 0 && ` | 컴포넌트 ${pipeline.componentCount}개 생성`}
                </div>
              </div>
            </div>
            <Button className="ux-btn-ghost" onClick={runPipeline}>
              🔄 재실행
            </Button>
          </Alert>

          {/* Tabs */}
          <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k || 'files')}>
            <Card className="ux-card">
              <Card.Header className="bg-white border-bottom-0 pb-0">
                <Nav variant="tabs" className="border-0">
                  <Nav.Item>
                    <Nav.Link eventKey="files" className="border-0">📁 생성된 파일</Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="json" className="border-0">🗂️ Locale JSON</Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="code" className="border-0">⚛️ 컴포넌트 코드</Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="map" className="border-0">🗺️ Components Map</Nav.Link>
                  </Nav.Item>
                </Nav>
              </Card.Header>
              <Card.Body>
                <Tab.Content>
                  {/* Files Tab */}
                  <Tab.Pane eventKey="files">
                    <ListGroup variant="flush" className="mx-n3">
                      {pipeline.files.map((file) => (
                        <ListGroup.Item
                          key={file.path}
                          className="ux-list-item justify-content-between cursor-pointer"
                          action
                          onClick={() => {
                            if (file.path.includes('locales')) {
                              const lang = file.path.match(/(\w+(-\w+)?)\.json/)?.[1] || 'en';
                              loadLocalePreview(lang);
                            } else if (file.path.includes('generated') && file.path.endsWith('.tsx')) {
                              loadGeneratedComponents();
                            } else if (file.path.includes('components-map')) {
                              loadComponentsMap();
                            }
                          }}
                        >
                          <div className="d-flex align-items-center gap-2">
                            <span>{file.icon}</span>
                            <code className="text-primary small">{file.path}</code>
                          </div>
                          <div className="d-flex align-items-center gap-3">
                            <span className="text-muted small">{file.size}</span>
                            {file.keys > 0 && (
                              <Badge className="ux-badge ux-badge-primary">{file.keys} keys</Badge>
                            )}
                          </div>
                        </ListGroup.Item>
                      ))}
                    </ListGroup>
                    <p className="small text-muted mt-3 mb-0">
                      💡 파일을 클릭하면 내용을 미리볼 수 있습니다.
                    </p>
                  </Tab.Pane>

                  {/* JSON Tab */}
                  <Tab.Pane eventKey="json">
                    {/*
                      src/locales/*.json은 실행마다 갱신된다. 실행 시점 사본이
                      src/data/locale-history/<runId>/에 남으므로 여기서 골라 본다.
                    */}
                    <div className="mb-3 d-flex flex-wrap gap-2 align-items-center">
                      <span className="text-muted small">생성 시점:</span>
                      <Form.Select
                        size="sm"
                        style={{ width: 'auto' }}
                        value={selectedRun}
                        onChange={(e) => {
                          const runId = e.target.value;
                          setSelectedRun(runId);
                          if (localePreview) void loadLocalePreview(localePreview.lang, runId);
                        }}
                      >
                        <option value="latest">현재 (src/locales)</option>
                        {localeRuns.map((run) => (
                          <option key={run.runId} value={run.runId}>
                            {run.at ? new Date(run.at).toLocaleString() : run.runId}
                            {run.keyCount > 0 ? ` · ${run.keyCount} keys` : ''}
                          </option>
                        ))}
                      </Form.Select>
                      {localeRuns.length === 0 && (
                        <span className="text-muted small">
                          이력이 없습니다 (다음 실행부터 쌓입니다)
                        </span>
                      )}
                    </div>

                    <div className="mb-3 d-flex gap-2">
                      {['en', 'ko', 'ja', 'zh-CN'].map((lang) => (
                        <Button
                          key={lang}
                          size="sm"
                          variant={localePreview?.lang === lang ? 'primary' : 'outline-secondary'}
                          onClick={() => loadLocalePreview(lang)}
                        >
                          {lang === 'en' && '🇺🇸'}
                          {lang === 'ko' && '🇰🇷'}
                          {lang === 'ja' && '🇯🇵'}
                          {lang === 'zh-CN' && '🇨🇳'}
                          {' '}{lang}
                        </Button>
                      ))}
                    </div>
                    {localePreview ? (
                      <>
                        <div className="text-muted small mb-2">
                          {selectedRun === 'latest' ? (
                            <>
                              <code>src/locales/{localePreview.lang}.json</code> (현재)
                            </>
                          ) : (
                            <>
                              <code>
                                src/data/locale-history/{selectedRun}/{localePreview.lang}.json
                              </code>{' '}
                              (과거 실행 사본 — 읽기 전용)
                            </>
                          )}
                        </div>
                        <div className="ux-code-block" style={{ maxHeight: 400, overflow: 'auto' }}>
                          <pre className="mb-0">{JSON.stringify(localePreview.content, null, 2)}</pre>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-5 text-muted">
                        <p>위에서 언어를 선택하세요</p>
                      </div>
                    )}
                  </Tab.Pane>

                  {/* Code Tab */}
                  <Tab.Pane eventKey="code">
                    {generatedComponents.length > 0 ? (
                      <>
                        <div className="mb-3 d-flex gap-2 flex-wrap">
                          {generatedComponents.map((comp) => (
                            <Button
                              key={comp.name}
                              size="sm"
                              variant={selectedComponent?.name === comp.name ? 'primary' : 'outline-secondary'}
                              onClick={() => setSelectedComponent(comp)}
                            >
                              ⚛️ {comp.name}.tsx
                            </Button>
                          ))}
                        </div>
                        {selectedComponent && (
                          <div className="ux-code-block" style={{ maxHeight: 400, overflow: 'auto' }}>
                            <div className="text-success mb-1">// src/components/generated/{selectedComponent.name}.tsx</div>
                            <div className="text-info mb-2">// 🤖 EXAONE AI가 자동 생성한 React 컴포넌트</div>
                            <pre className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>{selectedComponent.code}</pre>
                          </div>
                        )}
                        <p className="small text-muted mt-3 mb-0">
                          💡 EXAONE AI가 Figma 프레임 구조를 분석하여 React Bootstrap 기반 컴포넌트를 자동 생성했습니다.
                        </p>
                      </>
                    ) : (
                      <div className="text-center py-5 text-muted">
                        <Button variant="outline-primary" onClick={loadGeneratedComponents}>
                          생성된 컴포넌트 보기
                        </Button>
                      </div>
                    )}
                  </Tab.Pane>

                  {/* Map Tab */}
                  <Tab.Pane eventKey="map">
                    {componentsMap ? (
                      <div className="ux-code-block" style={{ maxHeight: 400, overflow: 'auto' }}>
                        <div className="text-muted mb-2">// src/components-map.json</div>
                        <pre className="mb-0">{JSON.stringify(componentsMap, null, 2)}</pre>
                      </div>
                    ) : (
                      <div className="text-center py-5 text-muted">
                        <Button variant="outline-primary" onClick={loadComponentsMap}>
                          Components Map 보기
                        </Button>
                      </div>
                    )}
                    <p className="small text-muted mt-3 mb-0">
                      💡 Components Map은 Figma 프레임별 i18n key 매핑 정보입니다.
                    </p>
                  </Tab.Pane>
                </Tab.Content>
              </Card.Body>
            </Card>
          </Tab.Container>
        </div>
      )}

      {/* Navigation */}
      <div className="d-flex justify-content-between mt-4">
        <Button className="ux-btn-secondary" onClick={onBack}>
          ← 이전
        </Button>
        <Button
          className="ux-btn-primary"
          size="lg"
          onClick={onNext}
          disabled={pipeline.status !== 'complete'}
        >
          🖥️ 최종 미리보기 →
        </Button>
      </div>
    </div>
  );
}

export default StepCodeGen;
