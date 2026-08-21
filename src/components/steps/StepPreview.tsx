/**
 * Step 6. 최종 미리보기
 *
 * 이전 구현은 사이드바/폼/테이블을 손으로 쓴 JSX였고 Figma 데이터를 전혀 참조하지 않았다.
 * 지금은 서버가 Figma MCP로 가져온 프레임 구조를 그대로 렌더링하고,
 * TEXT 노드만 i18n 키로 치환한다. 즉 화면에 보이는 레이아웃은 Figma에서 온 것이다.
 */

import { useMemo, useState } from 'react';
import { Card, Row, Col, Table, Button, Badge, Alert, Spinner, Form } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../LanguageSwitcher';
import FigmaFrameRenderer, { type FigmaRenderMode } from '../FigmaFrameRenderer';
import GeneratedComponentPreview, {
  listGeneratedComponents,
} from '../GeneratedComponentPreview';
import { useComponentsMap, useFigmaMcpStatus, useFigmaStructure } from '../../hooks/useFigmaData';
import { stripUxDocNodes } from '../../utils/figmaPreview';
import { SkeletonPanel, SkeletonRegion, SkeletonTable } from '../Skeleton';
import type { FigmaNodeView, FigmaSource } from '../../types/figma';

interface StepPreviewProps {
  onBack: () => void;
  onNext: () => void;
}

const LANG_LABELS: Record<string, string> = {
  en: '🇺🇸 English',
  ko: '🇰🇷 한국어',
  ja: '🇯🇵 日本語',
  'zh-CN': '🇨🇳 中文',
};

const SOURCE_META: Record<FigmaSource, { label: string; variant: string; detail: string }> = {
  mcp: {
    label: 'Figma MCP (실시간)',
    variant: 'success',
    detail: 'figma-developer-mcp의 get_figma_data로 방금 조회한 구조입니다.',
  },
  rest: {
    label: 'Figma REST (MCP 폴백)',
    variant: 'warning',
    detail: 'MCP 프로세스 기동에 실패해 REST API로 조회했습니다.',
  },
  cache: {
    label: '캐시 (src/figma-structure.json)',
    variant: 'secondary',
    detail: '이전에 MCP로 가져와 저장한 구조입니다. 새로고침하면 MCP를 다시 호출합니다.',
  },
};

function StepPreview({ onBack, onNext }: StepPreviewProps) {
  const { t, i18n } = useTranslation();
  const mcp = useFigmaMcpStatus();
  const structure = useFigmaStructure();
  const componentsMap = useComponentsMap();

  const [selectedFrameIdx, setSelectedFrameIdx] = useState(0);
  const [highlight, setHighlight] = useState(true);
  // 기본은 Figma 좌표 그대로(pixel). flow는 Auto Layout으로 흐르게 두는 비교용 모드로,
  // 번역이 길어져 상자를 넘칠 때 어떻게 밀리는지 확인할 때 쓴다.
  const [renderMode, setRenderMode] = useState<FigmaRenderMode>('pixel');
  // UX 시나리오 장표의 문서 요소(설명 표 / 장표 제목)를 숨긴다. 기본 켜짐.
  const [hideDocNodes, setHideDocNodes] = useState(true);

  /**
   * 렌더 소스.
   *  - 'generated': Step 8이 만든 src/components/generated/*.tsx를 실제로 실행
   *  - 'structure': Figma 구조(FigmaNodeView)를 렌더러가 그대로 그린다
   * 생성된 파일이 있으면 그것을 기본값으로 쓴다 (코드 결과를 보는 게 이 단계의 목적).
   */
  const generatedList = useMemo(() => listGeneratedComponents(), []);
  const [renderSource, setRenderSource] = useState<'generated' | 'structure'>(
    generatedList.length > 0 ? 'generated' : 'structure'
  );
  const [generatedName, setGeneratedName] = useState(generatedList[0]?.name ?? '');

  const frames = structure.data?.frames ?? [];
  const rawFrame: FigmaNodeView | undefined = frames[selectedFrameIdx];
  const stats = structure.data?.stats;

  /**
   * 대상 프레임은 UX 시나리오 장표라 실제 화면과 문서 부속물(No/Classification/Description
   * 설명 표, 장표 제목)이 형제로 들어 있다. 기본은 화면만 보여준다.
   * (서버 응답은 그대로 두고 화면에서만 걸러낸다 — src/utils/figmaPreview.ts)
   */
  const stripped = useMemo(() => (rawFrame ? stripUxDocNodes(rawFrame) : null), [rawFrame]);
  const frame: FigmaNodeView | undefined = hideDocNodes
    ? stripped?.frame ?? rawFrame
    : rawFrame;

  // 미리보기에 실제로 등장하는 키만 매핑 표에 보여준다 (하드코딩 5개 목록 대체)
  const renderedKeys = useMemo(() => {
    if (!frame) return [];
    const acc: { key: string; source: string }[] = [];
    const walk = (n: FigmaNodeView) => {
      if (n.i18nKey && n.text) acc.push({ key: n.i18nKey, source: n.text });
      for (const c of n.children ?? []) walk(c);
    };
    walk(frame);
    const seen = new Set<string>();
    return acc.filter((e) => (seen.has(e.key) ? false : (seen.add(e.key), true)));
  }, [frame]);

  const totalMappedKeys = useMemo(
    () => (componentsMap.data ?? []).reduce((sum, f) => sum + f.children.length, 0),
    [componentsMap.data]
  );

  const sourceMeta = structure.data ? SOURCE_META[structure.data.source] : null;

  return (
    <>
      <h4 className="mb-2">Step 6. 최종 미리보기</h4>
      <p className="text-muted mb-4">
        아래 화면은 <strong>Figma MCP로 조회한 프레임 구조를 그대로 렌더링</strong>한 것입니다.
        레이아웃·색상·간격은 Figma에서 오고, 텍스트만 i18n 키로 치환됩니다.
      </p>

      {/* 연동 상태 — 사실만 표시한다 */}
      <Card className="mb-4">
        <Card.Header className="ux-card-header d-flex align-items-center gap-2">
          <span>🔌</span> Figma MCP 연동 상태
        </Card.Header>
        <Card.Body>
          <Row className="g-3 align-items-center">
            <Col md={6}>
              {mcp.loading ? (
                <span className="text-muted small">
                  <Spinner animation="border" size="sm" className="me-2" />
                  상태 확인 중...
                </span>
              ) : mcp.data?.connected ? (
                <div>
                  <Badge bg="success" className="me-2">
                    MCP 연결됨
                  </Badge>
                  <code className="small">{mcp.data.serverCommand}</code>
                  <div className="small text-muted mt-1">
                    tools: {mcp.data.tools.join(', ') || '없음'}
                  </div>
                </div>
              ) : (
                <div>
                  <Badge bg="danger" className="me-2">
                    MCP 미연결
                  </Badge>
                  <div className="small text-muted mt-1">
                    {mcp.data?.lastError || mcp.error || 'API 서버(:3001)가 실행 중인지 확인하세요.'}
                  </div>
                </div>
              )}
            </Col>
            <Col md={6} className="text-md-end">
              {sourceMeta && (
                <>
                  <Badge bg={sourceMeta.variant} className="me-2">
                    데이터 출처: {sourceMeta.label}
                  </Badge>
                  <div className="small text-muted mt-1">{sourceMeta.detail}</div>
                </>
              )}
              <Button
                size="sm"
                variant="outline-primary"
                className="mt-2"
                disabled={structure.loading}
                onClick={() => void structure.refresh()}
              >
                {structure.loading ? '조회 중...' : '🔄 MCP로 다시 가져오기'}
              </Button>
            </Col>
          </Row>
          {structure.data?.warning && (
            <Alert variant="warning" className="mt-3 mb-0 py-2 small">
              ⚠️ {structure.data.warning}
            </Alert>
          )}
        </Card.Body>
      </Card>

      {/* 언어 전환 */}
      <Card className="mb-4 bg-light">
        <Card.Body className="d-flex align-items-center gap-3 flex-wrap">
          <span>🌐 언어 전환:</span>
          <LanguageSwitcher />
          {/* <Form.Check
            type="switch"
            id="highlight-mapped"
            label="i18n 매핑 표시"
            checked={highlight}
            onChange={(e) => setHighlight(e.target.checked)}
            className="ms-2"
          /> */}
          {/* <div className="d-flex align-items-center gap-2 ms-2">
            <span className="text-muted small">렌더 소스:</span>
            <Form.Select
              size="sm"
              style={{ width: 'auto' }}
              value={renderSource}
              onChange={(e) => setRenderSource(e.target.value as 'generated' | 'structure')}
              title="생성된 tsx를 실행할지, Figma 구조를 직접 렌더링할지 선택합니다"
            >
              <option value="generated" disabled={generatedList.length === 0}>
                생성된 컴포넌트 (.tsx 실행)
                {generatedList.length === 0 ? ' — 없음' : ''}
              </option>
              <option value="structure">Figma 구조</option>
            </Form.Select>
            {renderSource === 'generated' && generatedList.length > 1 && (
              <Form.Select
                size="sm"
                style={{ width: 'auto' }}
                value={generatedName}
                onChange={(e) => setGeneratedName(e.target.value)}
              >
                {generatedList.map((g) => (
                  <option key={g.name} value={g.name}>
                    {g.name}.tsx
                  </option>
                ))}
              </Form.Select>
            )}
          </div> */}

          {/* Figma 구조를 직접 그릴 때만 의미 있는 옵션들 */}
          {renderSource === 'structure' && (
            <>
              <Form.Check
                type="switch"
                id="hide-doc-nodes"
                label="UX 문서 요소 숨기기"
                checked={hideDocNodes}
                onChange={(e) => setHideDocNodes(e.target.checked)}
                className="ms-2"
                title="No/Classification/Description 설명 표와 장표 상단 제목을 제외하고 화면만 렌더링합니다"
              />
              <div className="d-flex align-items-center gap-2 ms-2">
                <span className="text-muted small">배치:</span>
                <Form.Select
                  size="sm"
                  style={{ width: 'auto' }}
                  value={renderMode}
                  onChange={(e) => setRenderMode(e.target.value as FigmaRenderMode)}
                  title="Figma 픽셀 좌표로 배치하거나, Auto Layout으로 흐르게 배치합니다"
                >
                  <option value="pixel">Figma 픽셀 (좌표 그대로)</option>
                  <option value="flow">Auto Layout (흐름)</option>
                </Form.Select>
              </div>
            </>
          )}
          <span className="text-muted ms-auto">
            현재: <strong>{LANG_LABELS[i18n.language] || i18n.language}</strong>
          </span>
        </Card.Body>
      </Card>

      {/* Figma 프레임 렌더링 */}
      <Card className="mb-4">
        <Card.Header className="bg-secondary text-white d-flex align-items-center gap-2 flex-wrap">
          <span className="d-flex gap-1">
            <span className="bg-danger rounded-circle" style={{ width: 10, height: 10 }} />
            <span className="bg-warning rounded-circle" style={{ width: 10, height: 10 }} />
            <span className="bg-success rounded-circle" style={{ width: 10, height: 10 }} />
          </span>
          <span className="small">
            {renderSource === 'generated'
              ? `src/components/generated/${generatedName}.tsx`
              : frame
                ? `${frame.name} — ${frame.width}×${frame.height}`
                : 'Figma 프레임'}
          </span>
          {renderSource === 'generated' && (
            <Badge bg="light" text="dark" className="fw-normal" title="생성된 tsx를 실제로 실행한 결과입니다">
              생성 코드 실행
            </Badge>
          )}
          {/* 무엇을 걸러냈는지 숨기지 않는다 */}
          {renderSource === 'structure' &&
            hideDocNodes &&
            stripped &&
            (stripped.pickedScreen || stripped.removed.length > 0) && (
            <Badge
              bg="light"
              text="dark"
              className="fw-normal"
              title={
                [
                  stripped.pickedScreen
                    ? `장표 래퍼 "${rawFrame?.name}" → 화면 프레임 "${stripped.pickedScreen}"만 렌더링`
                    : '',
                  stripped.removed.length > 0
                    ? `추가로 제거한 문서 노드: ${stripped.removed.join(', ')}`
                    : '',
                  '설명 표(No/Classification/Description)와 장표 제목은 제외됩니다.',
                ]
                  .filter(Boolean)
                  .join('\n')
              }
            >
              {stripped.pickedScreen ? '화면 프레임만 표시' : `문서 노드 ${stripped.removed.length}개 제외`}
            </Badge>
          )}
          {renderSource === 'structure' && frames.length > 1 && (
            <Form.Select
              size="sm"
              className="ms-auto"
              style={{ width: 'auto' }}
              value={selectedFrameIdx}
              onChange={(e) => setSelectedFrameIdx(Number(e.target.value))}
            >
              {frames.map((f, i) => (
                <option key={f.id} value={i}>
                  {f.name}
                </option>
              ))}
            </Form.Select>
          )}
        </Card.Header>
        <Card.Body className="p-3 bg-white">
          {/*
            생성된 tsx를 그대로 실행한다. Figma 구조 조회 상태와 무관하게 동작하므로
            (파일만 있으면 된다) 구조 로딩/에러 처리보다 앞에 둔다.
          */}
          {renderSource === 'generated' && (
            <div style={{ overflow: 'auto' }}>
              <GeneratedComponentPreview name={generatedName} />
            </div>
          )}

          {renderSource === 'structure' && structure.loading && (
            <SkeletonRegion label="Figma 구조를 불러오는 중">
              {/* 프레임이 들어갈 큰 영역 골격 */}
              <SkeletonPanel height={420} />
            </SkeletonRegion>
          )}

          {renderSource === 'structure' && !structure.loading && structure.error && (
            <Alert variant="danger" className="mb-0">
              <Alert.Heading className="h6">Figma 구조를 가져올 수 없습니다</Alert.Heading>
              <p className="small mb-2">{structure.error}</p>
              <hr />
              <div className="small mb-0">
                확인할 항목:
                <ul className="mb-0">
                  <li>
                    API 서버 실행 여부 — <code>npm run dev:all</code>
                  </li>
                  <li>
                    <code>FIGMA_API_KEY</code> 설정 (프로젝트 <code>.env</code> 또는{' '}
                    <code>~/.hermes/.env</code>)
                  </li>
                  <li>Figma API 429(rate limit) — 잠시 후 재시도</li>
                </ul>
              </div>
            </Alert>
          )}

          {renderSource === 'structure' && !structure.loading && !structure.error && !frame && (
            <Alert variant="secondary" className="mb-0 small">
              렌더링할 프레임이 없습니다. Frame ID를 확인하고 "MCP로 다시 가져오기"를 눌러주세요.
            </Alert>
          )}

          {renderSource === 'structure' && frame && (
            <FigmaFrameRenderer
              node={frame}
              highlightMapped={highlight}
              fitWidth={1040}
              mode={renderMode}
            />
          )}
        </Card.Body>
        {renderSource === 'structure' && highlight && frame && (
          <Card.Footer className="small text-muted d-flex gap-4 flex-wrap">
            <span>
              <span
                style={{
                  display: 'inline-block',
                  width: 12,
                  height: 12,
                  outline: '1px dashed rgba(13,110,253,.45)',
                  marginRight: 6,
                }}
              />
              i18n 키 매핑됨 (언어 전환 시 변경)
            </span>
            <span>
              <span
                style={{
                  display: 'inline-block',
                  width: 12,
                  height: 12,
                  outline: '1px dashed rgba(108,117,125,.35)',
                  marginRight: 6,
                }}
              />
              i18n 미적용 — Figma 원문 표시 (시나리오 설명·숫자·날짜 등 번역 제외 대상 포함)
            </span>
          </Card.Footer>
        )}
      </Card>

      {/* 실제 렌더된 키 매핑 */}
      <Card className="mb-4 border-info">
        <Card.Header className="bg-info text-white d-flex align-items-center">
          <span>🔤 이 화면에 적용된 i18n 키</span>
          <Badge bg="light" text="dark" className="ms-auto">
            {renderedKeys.length}개
          </Badge>
        </Card.Header>
        <Card.Body className="p-0">
          {structure.loading || componentsMap.loading ? (
            <SkeletonRegion label="i18n 키 매핑을 불러오는 중">
              <SkeletonTable rows={8} columns={3} columnWidths={['45%', '27%', '28%']} />
            </SkeletonRegion>
          ) : renderedKeys.length === 0 ? (
            <div className="p-3 small text-muted">
              매핑된 키가 없습니다. 파이프라인을 실행해 <code>components-map.json</code>을 생성하세요.
            </div>
          ) : (
            <div style={{ maxHeight: 320, overflow: 'auto' }}>
              <Table size="sm" className="mb-0">
                <thead className="position-sticky top-0 bg-white">
                  <tr>
                    <th>i18n Key</th>
                    <th>Figma 원문 (en)</th>
                    <th>현재 값 ({i18n.language})</th>
                  </tr>
                </thead>
                <tbody>
                  {renderedKeys.map((entry) => (
                    <tr key={entry.key}>
                      <td>
                        <code className="small">{entry.key}</code>
                      </td>
                      <td className="small text-muted">{entry.source}</td>
                      <td>
                        <strong>{t(entry.key)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* 실측 요약 — 하드코딩 수치 제거 */}
      <Card className="mb-4 bg-success bg-opacity-10 border-success">
        <Card.Body>
          <h6 className="text-success mb-3">✨ 결과 요약 (실측)</h6>
          <ul className="mb-0 small">
            <li>
              Figma 노드 <strong>{stats?.totalNodes ?? '-'}개</strong> 중 텍스트 노드{' '}
              <strong>{stats?.textNodes ?? '-'}개</strong>
            </li>
            <li>
              i18n 키 매핑 <strong>{stats?.mappedKeys ?? '-'}개</strong>
              {stats && stats.textNodes > 0 && (
                <> ({Math.round((stats.mappedKeys / stats.textNodes) * 100)}%)</>
              )}
            </li>
            <li>
              <code>components-map.json</code> 총 키{' '}
              <strong>{componentsMap.loading ? '...' : totalMappedKeys}개</strong> /{' '}
              프레임 {componentsMap.data?.length ?? 0}개
            </li>
            <li>
              데이터 출처 <strong>{sourceMeta?.label ?? '-'}</strong>
              {structure.data?.fetchedAt && (
                <> · 조회 시각 {new Date(structure.data.fetchedAt).toLocaleString()}</>
              )}
            </li>
          </ul>
        </Card.Body>
      </Card>

      <div className="d-flex justify-content-between">
        <Button variant="outline-secondary" onClick={onBack}>
          ← 이전
        </Button>
        <Button variant="primary" size="lg" onClick={onNext}>
          📝 QA 검증 가이드
        </Button>
      </div>
    </>
  );
}

export default StepPreview;
