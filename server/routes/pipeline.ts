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

    // Step 4.5: Glossary 준수 검증 + FAIL 재번역 (EXAONE 재호출)
    if (Object.keys(userGlossary).length > 0) {
      console.log('🔍 [API] Step 4.5: Glossary 준수 검증...');
      const targetEntries = translated.filter((entry) =>
        Object.keys(userGlossary).some((term) =>
          entry.source.toLowerCase().includes(term.toLowerCase())
        )
      );
      console.log(`   검증 대상: ${targetEntries.length}개`);

      const allViolations: GlossaryViolation[] = [];
      const batchSize = 10;
      for (let i = 0; i < targetEntries.length; i += batchSize) {
        const batch = targetEntries.slice(i, i + batchSize);
        console.log(`   ⏱️ 검증 배치 ${Math.floor(i / batchSize) + 1}/${Math.ceil(targetEntries.length / batchSize)}...`);
        const violations = await validateGlossaryBatch(batch, userGlossary);
        allViolations.push(...violations);
      }

      const failCount = allViolations.filter((v) => v.verdict === 'FAIL').length;
      const passCount = allViolations.filter((v) => v.verdict === 'PASS').length;
      console.log(`   검증 완료: PASS ${passCount} / FAIL ${failCount}`);

      // Step 4.6: FAIL 항목 재번역
      const failedViolations = allViolations.filter((v) => v.verdict === 'FAIL');
      if (failedViolations.length > 0) {
        console.log(`🔄 [API] Step 4.6: FAIL ${failedViolations.length}건 재번역...`);
        const retranslated = await retranslateFailedEntries(failedViolations, translated, userGlossary);

        // 재번역 결과를 translated에 반영
        for (const entry of retranslated) {
          const idx = (translated as any[]).findIndex((t: any) => t.key === entry.key);
          if (idx !== -1) {
            (translated as any[])[idx] = entry;
          }
        }
        console.log(`   재번역 반영: ${retranslated.length}건`);
      }
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

// ===== Glossary 검증 타입 및 함수 =====

interface GlossaryViolation {
  key: string;
  source: string;
  locale: string;
  actual: string;
  expected: string;
  term: string;
  verdict: 'PASS' | 'FAIL';
  reason?: string;
}

// FAIL 항목을 용어집 위반 사유와 함께 EXAONE에 재번역 요청
async function retranslateFailedEntries(
  violations: GlossaryViolation[],
  translated: I18nEntry[],
  glossary: Record<string, Record<string, string>>
): Promise<I18nEntry[]> {
  const failedKeys = new Set(violations.map((v) => v.key));
  const failedEntries = translated.filter((e) => failedKeys.has(e.key));
  if (failedEntries.length === 0) return [];

  const glossaryRules = Object.entries(glossary)
    .map(([en, tr]) => `  "${en}" → ko: "${tr.ko}", ja: "${tr.ja}", zh-CN: "${tr['zh-CN']}"`)
    .join('\n');

  const violationDetails = failedEntries.map((entry, i) => {
    const v = violations.find((vl) => vl.key === entry.key);
    return `${i + 1}. 원문: "${entry.source}"\n   현재 번역 - ko: "${entry.translations.ko || ''}", ja: "${entry.translations.ja || ''}", zh-CN: "${entry.translations['zh-CN'] || ''}"\n   위반 사유: ${v?.reason || '용어집 미준수'}`;
  }).join('\n');

  const prompt = `당신은 전문 번역가입니다. 아래 항목들은 용어집 규칙을 위반하여 재번역이 필요합니다.

용어집 (반드시 준수):
${glossaryRules}

중요 규칙:
1. 용어집에 등록된 용어가 원문에 포함되어 있으면, 번역에서 반드시 용어집의 번역을 사용하세요.
2. 부분 일치도 해당됩니다. 예: "Device Group"에 "Device"가 포함되므로 ko 번역에 반드시 "디바이스"를 사용해야 합니다.
3. 용어집 외의 일반 단어는 자연스럽게 번역하세요.

재번역 대상:
${violationDetails}

위 항목들을 용어집 규칙을 반드시 지켜서 다시 번역하세요. JSON 배열만 응답하세요:
[
  { "index": 1, "ko": "...", "ja": "...", "zh-CN": "..." },
  ...
]`;

  try {
    const apiUrl = process.env.FRIENDLI_API_URL || 'https://api.friendli.ai/dedicated/v1/chat/completions';
    const apiKey = process.env.FRIENDLI_API_KEY || '';
    const model = process.env.FRIENDLI_MODEL || 'depe675tjc2rcpo';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        top_p: 0.95,
        chat_template_kwargs: {
          enable_thinking: false,
          preserve_thinking: false,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`EXAONE retranslate error: ${response.status} - ${errorBody.slice(0, 200)}`);
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const results = JSON.parse(jsonMatch[0]);
    const retranslated: I18nEntry[] = [];

    for (const r of results) {
      const entry = failedEntries[r.index - 1];
      if (!entry) continue;

      const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
      retranslated.push({
        ...entry,
        translations: {
          en: entry.source.trim(),
          ko: clean(r.ko),
          ja: clean(r.ja),
          'zh-CN': clean(r['zh-CN']),
        },
      });
    }

    return retranslated;
  } catch (error) {
    console.error('Retranslate error:', error);
    return [];
  }
}

// EXAONE에 glossary 준수 여부 검증 요청
async function validateGlossaryBatch(
  entries: I18nEntry[],
  glossary: Record<string, Record<string, string>>
): Promise<GlossaryViolation[]> {
  const glossaryRules = Object.entries(glossary)
    .map(([en, tr]) => `  "${en}" → ko: "${tr.ko}", ja: "${tr.ja}", zh-CN: "${tr['zh-CN']}"`)
    .join('\n');

  const items = entries.map((e, i) => {
    const translations = Object.entries(e.translations)
      .filter(([lang]) => lang !== 'en')
      .map(([lang, val]) => `${lang}: "${val}"`)
      .join(', ');
    return `${i + 1}. source: "${e.source}" → ${translations}`;
  }).join('\n');

  const prompt = `당신은 번역 품질 검증자입니다. 아래 번역 결과가 용어집 규칙을 준수했는지 검사하세요.

용어집 (필수 준수):
${glossaryRules}

규칙: 원문(source)에 용어집 용어가 포함되어 있으면, 번역에서 반드시 해당 용어집의 번역을 사용해야 합니다. 부분 일치도 해당됩니다. 예를 들어 "Device Group"에는 "Device"가 포함되므로 한국어 번역에 반드시 "디바이스"가 들어가야 합니다.

검사 대상 번역:
${items}

각 항목에 대해 용어집 준수 여부를 판정하세요. 반드시 JSON 배열만 응답하세요:
[
  { "index": 1, "verdict": "PASS" 또는 "FAIL", "locale": "위반된 언어(ko/ja/zh-CN)", "term": "위반된 용어집 용어", "reason": "간단한 사유" },
  ...
]

통과한 항목은: { "index": 1, "verdict": "PASS" }
locale, term, reason은 FAIL인 경우에만 포함하세요.`;

  try {
    const apiUrl = process.env.FRIENDLI_API_URL || 'https://api.friendli.ai/dedicated/v1/chat/completions';
    const apiKey = process.env.FRIENDLI_API_KEY || '';
    const model = process.env.FRIENDLI_MODEL || 'depe675tjc2rcpo';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        top_p: 0.95,
        chat_template_kwargs: {
          enable_thinking: false,
          preserve_thinking: false,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`EXAONE API error: ${response.status} - ${errorBody.slice(0, 200)}`);
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const results = JSON.parse(jsonMatch[0]);
    const violations: GlossaryViolation[] = [];

    for (const r of results) {
      const entry = entries[r.index - 1];
      if (!entry) continue;

      violations.push({
        key: entry.key,
        source: entry.source,
        locale: r.locale || '',
        actual: r.locale ? (entry.translations[r.locale] || '') : '',
        expected: r.term && r.locale ? (glossary[r.term]?.[r.locale] || '') : '',
        term: r.term || '',
        verdict: r.verdict,
        reason: r.reason || '',
      });
    }

    return violations;
  } catch (error) {
    console.error('Glossary validation error:', error);
    return [];
  }
}

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
