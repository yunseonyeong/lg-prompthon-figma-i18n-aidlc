/**
 * Pipeline API Routes
 *
 * POST /api/pipeline/extract   - Step 1~3: Figma 텍스트 추출 → 문맥 분석 → i18n Key 생성
 * POST /api/pipeline/translate  - Step 4~7: EXAONE 번역 → Locale JSON → Components Map → 용어집 제안
 */

import { Router, Request, Response } from 'express';
import {
  extractTextsFromFigma,
  analyzeContext,
  assignI18nKeys,
  translateWithExaone,
  generateLocaleFiles,
  writeLocaleFiles,
  generateComponentsMap,
  writeComponentsMap,
  generateGlossaryProposal,
  writeGlossaryProposal,
} from '../../src/pipeline/figma-i18n-pipeline.js';
import { initRetriever, retrieverStatus } from '../../src/retrieval/index.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const pipelineRouter = Router();

// 최근 extract 결과 캐시 (translate에서 textNodes 사용)
let cachedTextNodes: TextNode[] = [];

// ===== Types (서버 응답용) =====

interface I18nEntry {
  key: string;
  source: string;
  context: string;
  role: string;
  translations: Record<string, string>;
  contextOnly: boolean;
}

interface TextNode {
  id: string;
  name: string;
  text: string;
  path: string;
  frameName: string;
  style: {
    fontSize: number | null;
    fontWeight: number | null;
  };
  role: string;
}

interface ExtractRequest {
  fileKey?: string;
}

interface ExtractResponse {
  success: boolean;
  data?: {
    translationTargets: I18nEntry[];
    relevantGlossary: Record<string, Record<string, string>>;
  };
  error?: string;
}

interface TranslateRequest {
  translationTargets: I18nEntry[];
  relevantGlossary?: Record<string, Record<string, string>>;
}

interface TranslateResponse {
  success: boolean;
  data?: {
    translated: I18nEntry[];
    locales: Record<string, object>;
    componentsMap: any[];
    glossaryProposal: string;
    summary: {
      translatedCount: number;
      localeLanguages: string[];
      componentsMapFrames: number;
    };
  };
  error?: string;
}

// ===== API 1: POST /extract =====
// Step 1~3: Figma 텍스트 추출 + 문맥 분석 + i18n Key 생성

pipelineRouter.post('/extract', async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileKey } = req.body as ExtractRequest;
    const targetFileKey = fileKey || process.env.FIGMA_FILE_KEY || 'zdG3CHXVU6TzD4cc28o5Yb';

    console.log('📄 [API] Step 1: Figma 텍스트 추출...');
    console.log(`   ⏱️ Figma API 호출 시작... (fileKey: ${targetFileKey})`);
    const textNodes = await extractTextsFromFigma(targetFileKey);
    console.log(`   ⏱️ Figma API 호출 완료`);
    console.log(`   추출된 텍스트 노드: ${textNodes.length}개`);

    if (textNodes.length === 0) {
      res.status(400).setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({
        success: false,
        error: '추출된 텍스트가 0개입니다. File Key 또는 Frame ID를 확인하세요.',
      }, null, 2));
      return;
    }

    // Step 2: 문맥 분석
    console.log('🔍 [API] Step 2: UX 흐름 문맥 분석...');
    const frameContexts = analyzeContext(textNodes);
    console.log(`   분석된 프레임: ${frameContexts.size}개`);

    // Step 3: i18n Key 생성 (기존 en.json의 key 재사용)
    console.log('🔑 [API] Step 3: i18n Key 생성...');
    const assignment = assignI18nKeys(textNodes, frameContexts);
    const entries = assignment.entries;

    const translationTargets = entries;
    console.log(`   생성된 Key: ${entries.length}개 (노드 ${assignment.stats.nodes}개 → 원문 중복 제거)`);
    console.log(
      `   key 재사용: 기존 en.json ${assignment.stats.reusedRegistered}건 / 이번 실행 내 ${assignment.stats.reusedInRun}건`
    );

    // textNodes를 캐시 (translate API에서 사용)
    cachedTextNodes = textNodes;

    // 추출된 텍스트에서 용어집 매칭 (includes)
    const fullGlossary = loadGlossary();
    const allSourceText = entries.map((e) => e.source).join(' ').toLowerCase();
    const relevantGlossary: Record<string, Record<string, string>> = {};
    for (const [term, translations] of Object.entries(fullGlossary)) {
      if (allSourceText.includes(term.toLowerCase())) {
        relevantGlossary[term] = translations;
      }
    }
    console.log(`   연관 용어집: ${Object.keys(relevantGlossary).length}/${Object.keys(fullGlossary).length}개`);
    console.log('   ⏱️ extract 응답 전송 중...');

    const result: ExtractResponse = {
      success: true,
      data: {
        translationTargets,
        relevantGlossary,
      },
    };
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('[API] Extract error:', error);
    res.status(500).setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, null, 2));
  }
});

// ===== API 2: POST /translate =====
// Step 4~7: EXAONE 번역 → Locale JSON 출력 → Components Map → 용어집 제안

pipelineRouter.post('/translate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { translationTargets, relevantGlossary } = req.body as TranslateRequest;

    if (!translationTargets || !Array.isArray(translationTargets) || translationTargets.length === 0) {
      res.status(400).setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({
        success: false,
        error: 'translationTargets 배열이 필요합니다. /api/pipeline/extract 결과를 전달하세요.',
      }, null, 2));
      return;
    }

    // Step 4: EXAONE 번역
    console.log('🌐 [API] Step 4: EXAONE 문맥 기반 번역...');
    console.log('   ⏱️ initRetriever 시작...');
    await initRetriever();
    console.log('   ⏱️ initRetriever 완료');
    const rs = retrieverStatus();
    console.log(
      `   리트리버: 용어 ${rs.glossaryTerms} / 확정 ${rs.confirmed} / 거부 ${rs.rejected} / 벡터검색 ${rs.vectorReady ? 'ON' : 'OFF'}`
    );

    // 사용자가 보낸 relevantGlossary만 사용 (없으면 빈 객체 → 용어집 없이 번역)
    const userGlossary = relevantGlossary || {};
    console.log(`   사용자 용어집: ${Object.keys(userGlossary).length}개`);
    console.log('   ⏱️ translateWithExaone 시작...');
    const translated = await translateWithExaone(translationTargets as any[], userGlossary);
    console.log('   ⏱️ translateWithExaone 완료');
    console.log(`   번역 완료: ${translated.length}개`);

    if (translated.length === 0) {
      res.status(500).setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({
        success: false,
        error: '번역 결과가 0개입니다.',
      }, null, 2));
      return;
    }

    // Step 5: Locale JSON 출력
    console.log('💾 [API] Step 5: Locale JSON 출력...');
    const locales = generateLocaleFiles(translated);
    writeLocaleFiles(locales);

    // Step 6: Components Map 출력
    console.log('🗺️  [API] Step 6: Components Map 생성...');
    let componentsMap: any[] = [];
    if (cachedTextNodes.length > 0) {
      componentsMap = generateComponentsMap(cachedTextNodes as any[], translated);
      writeComponentsMap(componentsMap);
      console.log(`   프레임 수: ${componentsMap.length}개`);
    } else {
      console.log('   ⚠️ textNodes 없음 - Components Map 생성 생략');
    }

    // Step 7: 용어집 등록 제안
    console.log('📖 [API] Step 7: 용어집 등록 제안 생성...');
    const proposal = generateGlossaryProposal(translated, userGlossary);
    writeGlossaryProposal(proposal);

    console.log('✅ [API] Pipeline Step 4~7 완료!');
    console.log('   ⏱️ 응답 전송 중...');

    const result: TranslateResponse = {
      success: true,
      data: {
        translated,
        locales,
        componentsMap,
        glossaryProposal: proposal,
        summary: {
          translatedCount: translated.length,
          localeLanguages: Object.keys(locales),
          componentsMapFrames: componentsMap.length,
        },
      },
    };
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('[API] Translate error:', error);
    res.status(500).setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, null, 2));
  }
});

// ===== Helper: 용어집 로드 =====
function loadGlossary(): Record<string, Record<string, string>> {
  const glossaryPath = path.resolve(__dirname, '../../requirements/domain-glossary.md');

  if (!fs.existsSync(glossaryPath)) {
    console.warn('⚠️ domain-glossary.md not found, proceeding without glossary');
    return {};
  }

  const content = fs.readFileSync(glossaryPath, 'utf-8');
  const glossary: Record<string, Record<string, string>> = {};

  const lines = content.split('\n');
  for (const line of lines) {
    if (!line.startsWith('|') || line.includes('---')) continue;
    const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
    if (cells.length >= 5 && cells[0] !== 'English') {
      glossary[cells[0]] = {
        ko: cells[2],
        ja: cells[3],
        'zh-CN': cells[4],
      };
    }
  }

  return glossary;
}
