import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { getFigmaStructure, getMcpStatus } from './figma-mcp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 파이프라인 CONFIG와 동일한 기본값. 쿼리로 넘어오지 않으면 이 값을 쓴다.
const DEFAULT_FIGMA_FILE_KEY = process.env.FIGMA_FILE_KEY || 'zdG3CHXVU6TzD4cc28o5Yb';
const DEFAULT_FIGMA_NODE_ID = process.env.FIGMA_NODE_ID || '15682:100905';
const GLOSSARY_PATH = path.join(__dirname, '../src/data/glossary.json');
const LOCALES_DIR = path.join(__dirname, '../src/locales');
const COMPONENTS_MAP_PATH = path.join(__dirname, '../src/components-map.json');
const GENERATED_COMPONENTS_DIR = path.join(__dirname, '../src/components/generated');
const HISTORY_PATH = path.join(__dirname, '../src/data/pipeline-history.json');
// 실행별 번역 결과 스냅샷 (locales는 다음 실행에 덮어써지므로 별도 보관)
const TRANSLATIONS_DIR = path.join(__dirname, '../src/data/translations');
const CONFIG_PATH = path.join(__dirname, '../src/data/project-config.json');

const app = express();
app.use(cors());
app.use(express.json());

// ============ 프로젝트 설정 API ============

// GET /api/config - 프로젝트 설정 조회
app.get('/api/config', async (_req, res) => {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    res.json(JSON.parse(data));
  } catch {
    // 기본 설정 반환
    res.json({
      figmaUrl: 'https://www.figma.com/design/zdG3CHXVU6TzD4cc28o5Yb/LG-Business-Cloud-Console',
      figmaFileKey: 'zdG3CHXVU6TzD4cc28o5Yb',
      domainDescription: 'LG Business Cloud console — a B2B admin console for managing business sites, workspaces, device groups, users, roles and licenses',
      targetLanguages: ['en', 'ko', 'ja', 'zh-CN'],
    });
  }
});

// PUT /api/config - 프로젝트 설정 저장
app.put('/api/config', async (req, res) => {
  try {
    const config = req.body;
    config.lastUpdated = new Date().toISOString();
    await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    res.json({ success: true, config });
  } catch (error) {
    console.error('설정 저장 실패:', error);
    res.status(500).json({ error: '설정을 저장할 수 없습니다.' });
  }
});

// ============ 히스토리 API ============

// GET /api/pipeline/history - 실행 히스토리 조회
app.get('/api/pipeline/history', async (_req, res) => {
  try {
    const data = await fs.readFile(HISTORY_PATH, 'utf-8');
    res.json(JSON.parse(data));
  } catch {
    res.json({ history: [] });
  }
});

// POST /api/pipeline/history - 히스토리 추가
app.post('/api/pipeline/history', async (req, res) => {
  try {
    let data: { history: any[] } = { history: [] };
    try {
      data = JSON.parse(await fs.readFile(HISTORY_PATH, 'utf-8'));
    } catch {}
    
    const entry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      ...req.body,
    };
    
    data.history.unshift(entry); // 최신이 위로
    data.history = data.history.slice(0, 50); // 최대 50개 유지
    
    await fs.mkdir(path.dirname(HISTORY_PATH), { recursive: true });
    await fs.writeFile(HISTORY_PATH, JSON.stringify(data, null, 2), 'utf-8');
    res.json({ success: true, entry });
  } catch (error) {
    console.error('히스토리 저장 실패:', error);
    res.status(500).json({ error: '히스토리를 저장할 수 없습니다.' });
  }
});

// ============ 용어집 API ============

// GET /api/glossary - 용어집 조회
app.get('/api/glossary', async (_req, res) => {
  try {
    const data = await fs.readFile(GLOSSARY_PATH, 'utf-8');
    res.json(JSON.parse(data));
  } catch (error) {
    console.error('용어집 읽기 실패:', error);
    res.status(500).json({ error: '용어집을 불러올 수 없습니다.' });
  }
});

// PUT /api/glossary - 용어집 전체 저장
app.put('/api/glossary', async (req, res) => {
  try {
    const { terms } = req.body;
    const data = {
      terms,
      lastUpdated: new Date().toISOString(),
    };
    await fs.writeFile(GLOSSARY_PATH, JSON.stringify(data, null, 2), 'utf-8');
    res.json({ success: true, lastUpdated: data.lastUpdated });
  } catch (error) {
    console.error('용어집 저장 실패:', error);
    res.status(500).json({ error: '용어집을 저장할 수 없습니다.' });
  }
});

// POST /api/glossary/term - 용어 추가
app.post('/api/glossary/term', async (req, res) => {
  try {
    const newTerm = req.body;
    const data = JSON.parse(await fs.readFile(GLOSSARY_PATH, 'utf-8'));
    
    newTerm.id = Date.now().toString();
    data.terms.push(newTerm);
    data.lastUpdated = new Date().toISOString();
    
    await fs.writeFile(GLOSSARY_PATH, JSON.stringify(data, null, 2), 'utf-8');
    res.json({ success: true, term: newTerm });
  } catch (error) {
    console.error('용어 추가 실패:', error);
    res.status(500).json({ error: '용어를 추가할 수 없습니다.' });
  }
});

// PUT /api/glossary/term/:id - 용어 수정
app.put('/api/glossary/term/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const data = JSON.parse(await fs.readFile(GLOSSARY_PATH, 'utf-8'));
    
    const index = data.terms.findIndex((t: any) => t.id === id);
    if (index === -1) {
      return res.status(404).json({ error: '용어를 찾을 수 없습니다.' });
    }
    
    data.terms[index] = { ...data.terms[index], ...updates };
    data.lastUpdated = new Date().toISOString();
    
    await fs.writeFile(GLOSSARY_PATH, JSON.stringify(data, null, 2), 'utf-8');
    res.json({ success: true, term: data.terms[index] });
  } catch (error) {
    console.error('용어 수정 실패:', error);
    res.status(500).json({ error: '용어를 수정할 수 없습니다.' });
  }
});

// DELETE /api/glossary/term/:id - 용어 삭제
app.delete('/api/glossary/term/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = JSON.parse(await fs.readFile(GLOSSARY_PATH, 'utf-8'));
    
    const index = data.terms.findIndex((t: any) => t.id === id);
    if (index === -1) {
      return res.status(404).json({ error: '용어를 찾을 수 없습니다.' });
    }
    
    data.terms.splice(index, 1);
    data.lastUpdated = new Date().toISOString();
    
    await fs.writeFile(GLOSSARY_PATH, JSON.stringify(data, null, 2), 'utf-8');
    res.json({ success: true });
  } catch (error) {
    console.error('용어 삭제 실패:', error);
    res.status(500).json({ error: '용어를 삭제할 수 없습니다.' });
  }
});

// ============ 파이프라인 API ============

// GET /api/pipeline/status - 현재 생성된 파일 상태 조회
app.get('/api/pipeline/status', async (_req, res) => {
  try {
    const files: any[] = [];
    
    // Locale 파일 확인
    const languages = ['en', 'ko', 'ja', 'zh-CN'];
    for (const lang of languages) {
      const filePath = path.join(LOCALES_DIR, `${lang}.json`);
      try {
        const stat = await fs.stat(filePath);
        const content = await fs.readFile(filePath, 'utf-8');
        const keys = countKeys(JSON.parse(content));
        files.push({
          path: `src/locales/${lang}.json`,
          size: formatSize(stat.size),
          keys,
          icon: '🗂️',
          lastModified: stat.mtime,
        });
      } catch {
        // 파일 없음
      }
    }
    
    // Components Map 확인
    try {
      const stat = await fs.stat(COMPONENTS_MAP_PATH);
      const content = await fs.readFile(COMPONENTS_MAP_PATH, 'utf-8');
      const data = JSON.parse(content);
      files.push({
        path: 'src/components-map.json',
        size: formatSize(stat.size),
        keys: data.length,
        icon: '🗺️',
        lastModified: stat.mtime,
      });
    } catch {
      // 파일 없음
    }

    // 생성된 컴포넌트 확인
    try {
      const componentFiles = await fs.readdir(GENERATED_COMPONENTS_DIR);
      const tsxFiles = componentFiles.filter(f => f.endsWith('.tsx'));
      for (const file of tsxFiles) {
        const filePath = path.join(GENERATED_COMPONENTS_DIR, file);
        const stat = await fs.stat(filePath);
        files.push({
          path: `src/components/generated/${file}`,
          size: formatSize(stat.size),
          keys: 0,
          icon: '⚛️',
          lastModified: stat.mtime,
        });
      }
    } catch {
      // 폴더 없음
    }
    
    res.json({ files, generated: files.length > 0 });
  } catch (error) {
    console.error('상태 조회 실패:', error);
    res.status(500).json({ error: '상태를 조회할 수 없습니다.' });
  }
});

// 지원 언어 allowlist.
// :lang을 그대로 path.join에 넣으면 '../../secret' 같은 값으로 경로를 벗어날 수 있다.
const SUPPORTED_LANGS = ['en', 'ko', 'ja', 'zh-CN'] as const;
type SupportedLang = (typeof SUPPORTED_LANGS)[number];

function localeFilePath(lang: string): string | null {
  if (!(SUPPORTED_LANGS as readonly string[]).includes(lang)) return null;
  return path.join(LOCALES_DIR, `${lang as SupportedLang}.json`);
}

/** 'a.b.c' 경로에 값을 써넣는다. 중간 노드가 없으면 만든다. */
function setNestedValue(obj: Record<string, any>, dottedKey: string, value: string): void {
  const parts = dottedKey.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (typeof cur[p] !== 'object' || cur[p] === null) cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function getNestedValue(obj: Record<string, any>, dottedKey: string): unknown {
  return dottedKey.split('.').reduce<any>((acc, p) => (acc == null ? undefined : acc[p]), obj);
}

// GET /api/pipeline/locales/:lang - 특정 언어 locale 파일 조회
app.get('/api/pipeline/locales/:lang', async (req, res) => {
  const filePath = localeFilePath(req.params.lang);
  if (!filePath) {
    return res.status(400).json({ error: `지원하지 않는 언어: ${req.params.lang}` });
  }
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    res.json(JSON.parse(content));
  } catch {
    res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
  }
});

// PUT /api/pipeline/locales/:lang - 번역 1건 수정 후 저장
//
// 이전에는 번역 수정 UI가 화면에 "클릭하여 수정할 수 있습니다"라고 안내하면서도
// 실제 편집/저장 경로가 존재하지 않았다. 이 엔드포인트가 그 저장 경로다.
app.put('/api/pipeline/locales/:lang', async (req, res) => {
  const filePath = localeFilePath(req.params.lang);
  if (!filePath) {
    return res.status(400).json({ error: `지원하지 않는 언어: ${req.params.lang}` });
  }

  const { key, value } = req.body ?? {};
  if (typeof key !== 'string' || key.trim() === '') {
    return res.status(400).json({ error: 'key는 필수입니다.' });
  }
  if (typeof value !== 'string') {
    return res.status(400).json({ error: 'value는 문자열이어야 합니다.' });
  }
  // 프로토타입 오염 방지 — key가 __proto__ 등을 포함하면 거부
  if (key.split('.').some((p) => p === '__proto__' || p === 'constructor' || p === 'prototype')) {
    return res.status(400).json({ error: '허용되지 않는 key입니다.' });
  }

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    const before = getNestedValue(data, key);
    setNestedValue(data, key, value);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');

    console.log(`   [locale] ${req.params.lang} ${key}: ${JSON.stringify(before)} → ${JSON.stringify(value)}`);
    res.json({ success: true, lang: req.params.lang, key, before, value });
  } catch (error: any) {
    console.error('locale 저장 실패:', error);
    res.status(500).json({ error: '저장에 실패했습니다.', detail: error?.message });
  }
});

// GET /api/pipeline/components-map - Components Map 조회
app.get('/api/pipeline/components-map', async (_req, res) => {
  try {
    const content = await fs.readFile(COMPONENTS_MAP_PATH, 'utf-8');
    res.json(JSON.parse(content));
  } catch (error) {
    res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
  }
});

// GET /api/pipeline/components - 생성된 컴포넌트 목록 조회
app.get('/api/pipeline/components', async (_req, res) => {
  try {
    const componentFiles = await fs.readdir(GENERATED_COMPONENTS_DIR);
    const components = [];
    
    for (const file of componentFiles.filter(f => f.endsWith('.tsx'))) {
      const filePath = path.join(GENERATED_COMPONENTS_DIR, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const stat = await fs.stat(filePath);
      components.push({
        name: file.replace('.tsx', ''),
        fileName: file,
        code: content,
        size: formatSize(stat.size),
        lastModified: stat.mtime,
      });
    }
    
    res.json({ components });
  } catch (error) {
    res.json({ components: [] });
  }
});

// GET /api/pipeline/components/:name - 특정 컴포넌트 코드 조회
app.get('/api/pipeline/components/:name', async (req, res) => {
  const { name } = req.params;

  // 경로 탐색 차단.
  // 검증 없이 path.join(dir, `${name}.tsx`)를 쓰면 name="../../App"이
  // src/App.tsx로 빠져나가 저장소의 임의 .tsx 파일을 읽을 수 있다 (실측 확인).
  if (!/^[A-Za-z0-9_-]+$/.test(name)) {
    return res.status(400).json({ error: '잘못된 컴포넌트 이름입니다.' });
  }

  const filePath = path.join(GENERATED_COMPONENTS_DIR, `${name}.tsx`);
  // 이중 안전장치 — 해석된 절대경로가 생성 디렉터리 안에 있는지 확인
  const root = path.resolve(GENERATED_COMPONENTS_DIR);
  if (!path.resolve(filePath).startsWith(root + path.sep)) {
    return res.status(400).json({ error: '허용되지 않는 경로입니다.' });
  }

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    res.json({ name, code: content });
  } catch (error) {
    res.status(404).json({ error: '컴포넌트를 찾을 수 없습니다.' });
  }
});

// POST /api/pipeline/run - 파이프라인 실행
app.post('/api/pipeline/run', async (req, res) => {
  const { figmaFileKey, figmaFrameIds } = req.body;
  
  console.log('');
  console.log('========================================');
  console.log('🚀 파이프라인 실행 시작');
  console.log('========================================');
  console.log(`   시간: ${new Date().toISOString()}`);
  console.log(`   Figma File Key: ${figmaFileKey || '(기본값 사용)'}`);
  console.log(`   Figma Frame IDs: ${figmaFrameIds || '(기본값 사용)'}`);
  
  // SSE로 진행 상황 스트리밍
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  const sendEvent = (event: string, data: any) => {
    console.log(`   [SSE] ${event}:`, JSON.stringify(data).slice(0, 100));
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  
  try {
    sendEvent('progress', { step: 1, message: '파이프라인 시작...' });
    
    const pipelinePath = path.join(__dirname, '../src/pipeline/figma-i18n-pipeline.ts');
    const args = ['--import', 'tsx', pipelinePath];
    if (figmaFileKey) args.push(figmaFileKey);
    if (figmaFrameIds) args.push(figmaFrameIds);  // 두 번째 인자로 프레임 ID 전달
    
    console.log(`   실행 명령: node ${args.join(' ')}`);

    // 저장된 프로젝트 설정을 파이프라인에 전달한다.
    // fileKey/frameIds는 argv로 넘기지만 도메인 설명·언어는 argv 자리가 없어
    // 환경변수로 전달한다. 이걸 하지 않으면 화면에서 설정을 바꿔도 번역에 반영되지 않는다.
    const pipelineEnv: Record<string, string> = { ...(process.env as Record<string, string>) };
    try {
      const saved = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf-8'));
      if (typeof saved.domainDescription === 'string' && saved.domainDescription.trim()) {
        pipelineEnv.PIPELINE_DOMAIN_DESCRIPTION = saved.domainDescription.trim();
        console.log(`   도메인 설명: ${saved.domainDescription.slice(0, 60)}...`);
      }
      if (Array.isArray(saved.targetLanguages) && saved.targetLanguages.length > 0) {
        pipelineEnv.PIPELINE_LANGUAGES = saved.targetLanguages.join(',');
        console.log(`   번역 대상 언어: ${pipelineEnv.PIPELINE_LANGUAGES}`);
      }
    } catch {
      console.log('   (저장된 프로젝트 설정 없음 — 파이프라인 기본값 사용)');
    }
    console.log('');

    const child = spawn('node', args, {
      cwd: path.join(__dirname, '..'),
      env: pipelineEnv,
    });
    
    let output = '';
    let extractedCount = 0;
    let translatedCount = 0;
    
    child.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      output += text;
      console.log(text);
      
      // 진행 단계 파싱
      if (text.includes('Step 1')) {
        sendEvent('progress', { step: 1, message: 'Figma 텍스트 추출 중...' });
      } else if (text.includes('Step 2')) {
        sendEvent('progress', { step: 2, message: 'UX 흐름 문맥 분석 중...' });
      } else if (text.includes('Step 3')) {
        sendEvent('progress', { step: 3, message: 'i18n Key 생성 중...' });
      } else if (text.includes('Step 4')) {
        sendEvent('progress', { step: 4, message: 'EXAONE 문맥 기반 번역 중...' });
      } else if (text.includes('Step 5')) {
        sendEvent('progress', { step: 5, message: 'Locale JSON 출력 중...' });
      } else if (text.includes('Step 6')) {
        sendEvent('progress', { step: 6, message: 'Components Map 생성 중...' });
      } else if (text.includes('Step 7')) {
        sendEvent('progress', { step: 7, message: '용어집 등록 제안 생성 중...' });
      } else if (text.includes('Step 8')) {
        sendEvent('progress', { step: 8, message: 'EXAONE React 컴포넌트 생성 중...' });
      }
      
      // 추출된 텍스트 수 파싱
      const textMatch = text.match(/추출된 텍스트 노드: (\d+)개/);
      if (textMatch) {
        extractedCount = parseInt(textMatch[1]);
        sendEvent('info', { type: 'extracted', count: extractedCount });
      }
      
      // 번역 완료 수 파싱
      const translateMatch = text.match(/번역 완료: (\d+)개/);
      if (translateMatch) {
        translatedCount = parseInt(translateMatch[1]);
        sendEvent('info', { type: 'translated', count: translatedCount });
      }
    });
    
    child.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      console.error('   [STDERR]', text);
      sendEvent('error', { message: text });
    });
    
    child.on('close', async (code) => {
      console.log('');
      console.log(`========================================`);
      console.log(`파이프라인 종료 (exit code: ${code})`);
      console.log(`========================================`);
      
      if (code === 0) {
        // 생성된 파일 정보 수집
        const files = await getGeneratedFiles();
        console.log(`   생성된 파일: ${files.length}개`);
        
        // 히스토리 + 번역 결과 스냅샷 저장
        try {
          const componentsCount = files.filter(f => f.path.includes('generated') && f.path.endsWith('.tsx')).length;

          // 이번 실행이 만든 번역을 별도 테이블로 보관한다.
          // locales는 다음 실행에서 덮어써지므로 스냅샷이 없으면 과거 결과를 볼 수 없다.
          const rows = await buildTranslationRows();

          const runId = await saveHistory({
            figmaFileKey: figmaFileKey || 'zdG3CHXVU6TzD4cc28o5Yb',
            figmaFileName: 'LG Business Cloud Console',
            extractedCount,
            translatedCount,
            componentsCount,
            languages: ['en', 'ko', 'ja', 'zh-CN'],
            keyCount: rows.length,
            hasTranslations: rows.length > 0,
          });

          if (rows.length > 0) {
            await saveTranslationSnapshot(runId, rows);
            console.log(`   번역 스냅샷 저장: ${rows.length}건 (runId=${runId})`);
          }
        } catch (e) {
          console.error('히스토리 저장 실패:', e);
        }
        
        sendEvent('complete', { 
          success: true, 
          files,
          message: '파이프라인 완료!' 
        });
      } else {
        console.log(`   ❌ 파이프라인 실패`);
        sendEvent('complete', { 
          success: false, 
          message: `파이프라인 실패 (exit code: ${code})` 
        });
      }
      res.end();
    });
    
    child.on('error', (err) => {
      console.error('   [SPAWN ERROR]', err);
      sendEvent('error', { message: err.message });
    });
    
  } catch (error: any) {
    console.error('   [CATCH ERROR]', error);
    sendEvent('error', { message: error.message });
    res.end();
  }
});

// ============ Figma MCP API ============
// 브라우저는 stdio MCP에 직접 붙을 수 없으므로 이 서버가 MCP 클라이언트 역할을 한다.

// GET /api/figma/status - MCP 연결 상태 (UI가 실제 연동 여부를 표시하기 위함)
app.get('/api/figma/status', async (_req, res) => {
  try {
    res.json(await getMcpStatus());
  } catch (error: any) {
    res.status(500).json({ connected: false, lastError: error?.message ?? String(error) });
  }
});

// GET /api/figma/structure - 프레임 구조 조회 (기본 캐시, ?refresh=true면 MCP 재호출)
app.get('/api/figma/structure', async (req, res) => {
  const fileKey = (req.query.fileKey as string) || DEFAULT_FIGMA_FILE_KEY;
  const nodeId = (req.query.nodeId as string) || DEFAULT_FIGMA_NODE_ID;
  const refresh = req.query.refresh === 'true';
  const depth = req.query.depth ? Number(req.query.depth) : undefined;

  try {
    const payload = await getFigmaStructure({ fileKey, nodeId, depth, refresh });
    console.log(
      `   [Figma] structure 응답: source=${payload.source}, frames=${payload.frames.length}, ` +
        `텍스트 ${payload.stats.mappedKeys}/${payload.stats.textNodes} 키 매핑`
    );
    res.json(payload);
  } catch (error: any) {
    // 실패를 숨기지 않는다. 화면이 "가짜 성공"을 보여주면 안 된다.
    res.status(502).json({
      error: 'Figma 구조를 가져올 수 없습니다.',
      detail: error?.message ?? String(error),
      hint: 'Figma API가 429(rate limit)일 수 있습니다. 잠시 후 재시도하거나 캐시된 구조를 사용하세요.',
    });
  }
});

// ============ 산출물 다운로드 ============

/**
 * 다운로드 허용 파일 allowlist.
 *
 * 사용자 입력을 path.join에 그대로 넣으면 '../../.env' 같은 값으로 경로를 벗어난다.
 * 이름 → 절대경로를 미리 고정해 그 외 요청은 거부한다.
 */
function downloadablePath(name: string): string | null {
  const map: Record<string, string> = {
    'en.json': path.join(LOCALES_DIR, 'en.json'),
    'ko.json': path.join(LOCALES_DIR, 'ko.json'),
    'ja.json': path.join(LOCALES_DIR, 'ja.json'),
    'zh-CN.json': path.join(LOCALES_DIR, 'zh-CN.json'),
    'components-map.json': COMPONENTS_MAP_PATH,
    'figma-structure.json': path.join(__dirname, '../src/figma-structure.json'),
  };
  return map[name] ?? null;
}

// GET /api/pipeline/download/:name - 현재 산출물 파일 다운로드
app.get('/api/pipeline/download/:name', async (req, res) => {
  const filePath = downloadablePath(req.params.name);
  if (!filePath) {
    return res.status(400).json({ error: `다운로드할 수 없는 파일: ${req.params.name}` });
  }
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.name}"`);
    res.send(content);
  } catch {
    res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
  }
});

// ============ 번역 결과 스냅샷 (다국어 테이블) ============

/**
 * 실행 시점의 번역 결과를 별도 테이블로 보관한다.
 *
 * src/locales/*.json 은 다음 실행에서 덮어써지므로 "이번 실행이 무엇을 만들었는지"가
 * 남지 않는다. 히스토리 항목마다 스냅샷을 따로 두어 과거 실행 결과를 조회/다운로드할 수 있게 한다.
 * 히스토리 JSON에 인라인으로 넣으면 실행당 ~20KB가 쌓여 파일이 비대해지므로 실행별 파일로 분리한다.
 */
interface TranslationRow {
  key: string;
  en: string;
  ko: string;
  ja: string;
  'zh-CN': string;
}

function flattenLocale(obj: any, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      Object.assign(out, flattenLocale(v, key));
    } else if (typeof v === 'string') {
      out[key] = v;
    }
  }
  return out;
}

/** 현재 locale 파일들을 읽어 다국어 행 배열로 만든다 */
async function buildTranslationRows(): Promise<TranslationRow[]> {
  const langs = ['en', 'ko', 'ja', 'zh-CN'] as const;
  const flat: Partial<Record<(typeof langs)[number], Record<string, string>>> = {};
  for (const lang of langs) {
    try {
      const raw = await fs.readFile(path.join(LOCALES_DIR, `${lang}.json`), 'utf-8');
      flat[lang] = flattenLocale(JSON.parse(raw));
    } catch {
      flat[lang] = {};
    }
  }
  return Object.keys(flat.en ?? {}).map((key) => ({
    key,
    en: flat.en?.[key] ?? '',
    ko: flat.ko?.[key] ?? '',
    ja: flat.ja?.[key] ?? '',
    'zh-CN': flat['zh-CN']?.[key] ?? '',
  }));
}

async function saveTranslationSnapshot(runId: string, rows: TranslationRow[]): Promise<void> {
  await fs.mkdir(TRANSLATIONS_DIR, { recursive: true });
  await fs.writeFile(
    path.join(TRANSLATIONS_DIR, `${runId}.json`),
    JSON.stringify({ runId, at: new Date().toISOString(), rowCount: rows.length, rows }, null, 2),
    'utf-8'
  );
}

/** 실행 ID 검증 — 파일명으로 쓰이므로 경로 문자를 막는다 */
function safeRunId(id: string): string | null {
  return /^[A-Za-z0-9_-]+$/.test(id) ? id : null;
}

// GET /api/pipeline/history/:id/translations - 실행 시점 번역 결과 (다국어 테이블)
app.get('/api/pipeline/history/:id/translations', async (req, res) => {
  const runId = safeRunId(req.params.id);
  if (!runId) return res.status(400).json({ error: '잘못된 실행 ID입니다.' });
  try {
    const raw = await fs.readFile(path.join(TRANSLATIONS_DIR, `${runId}.json`), 'utf-8');
    res.json(JSON.parse(raw));
  } catch {
    res.status(404).json({ error: '이 실행의 번역 스냅샷이 없습니다.' });
  }
});

// GET /api/pipeline/history/:id/translations.csv - 다국어 테이블 CSV 다운로드
app.get('/api/pipeline/history/:id/translations.csv', async (req, res) => {
  const runId = safeRunId(req.params.id);
  if (!runId) return res.status(400).json({ error: '잘못된 실행 ID입니다.' });
  try {
    const raw = await fs.readFile(path.join(TRANSLATIONS_DIR, `${runId}.json`), 'utf-8');
    const { rows } = JSON.parse(raw) as { rows: TranslationRow[] };

    // RFC 4180 — 번역문에 쉼표/따옴표/개행이 있어도 열이 깨지지 않게 감싼다
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['key', 'en', 'ko', 'ja', 'zh-CN'];
    const csv =
      // BOM 없으면 Excel이 UTF-8 한중일 문자를 깨뜨린다
      '\uFEFF' +
      [
        header.map(esc).join(','),
        ...rows.map((r) => [r.key, r.en, r.ko, r.ja, r['zh-CN']].map(esc).join(',')),
      ].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="translations-${runId}.csv"`);
    res.send(csv);
  } catch {
    res.status(404).json({ error: '이 실행의 번역 스냅샷이 없습니다.' });
  }
});

// 헬퍼 함수들
/** 히스토리 항목을 추가하고 실행 ID를 반환한다 (번역 스냅샷 파일명으로 사용) */
async function saveHistory(entry: any): Promise<string> {
  let data = { history: [] as any[] };
  try {
    data = JSON.parse(await fs.readFile(HISTORY_PATH, 'utf-8'));
  } catch {}

  const id = Date.now().toString();
  data.history.unshift({
    id,
    timestamp: new Date().toISOString(),
    ...entry,
  });
  data.history = data.history.slice(0, 50);

  await fs.mkdir(path.dirname(HISTORY_PATH), { recursive: true });
  await fs.writeFile(HISTORY_PATH, JSON.stringify(data, null, 2), 'utf-8');
  return id;
}

function countKeys(obj: any, prefix = ''): number {
  let count = 0;
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      count += countKeys(obj[key], `${prefix}${key}.`);
    } else {
      count++;
    }
  }
  return count;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function getGeneratedFiles() {
  const files: any[] = [];
  const languages = ['en', 'ko', 'ja', 'zh-CN'];
  
  for (const lang of languages) {
    const filePath = path.join(LOCALES_DIR, `${lang}.json`);
    try {
      const stat = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      const keys = countKeys(JSON.parse(content));
      files.push({
        path: `src/locales/${lang}.json`,
        size: formatSize(stat.size),
        keys,
        icon: '🗂️',
      });
    } catch {}
  }
  
  try {
    const stat = await fs.stat(COMPONENTS_MAP_PATH);
    const content = await fs.readFile(COMPONENTS_MAP_PATH, 'utf-8');
    const data = JSON.parse(content);
    files.push({
      path: 'src/components-map.json',
      size: formatSize(stat.size),
      keys: data.length,
      icon: '🗺️',
    });
  } catch {}
  
  return files;
}

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 UX DLC API 서버 실행 중: http://localhost:${PORT}`);
  console.log('   - 용어집 API: /api/glossary');
  console.log('   - 파이프라인 API: /api/pipeline');
});
