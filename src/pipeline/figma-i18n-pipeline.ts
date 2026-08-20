/**
 * Figma i18n Pipeline
 * 
 * US-1.1: Figma 텍스트 추출
 * US-1.2: UX 흐름 문맥 분석
 * US-1.3: i18n Key 자동 생성
 * US-1.4: EXAONE 문맥 기반 번역
 * US-1.5: Locale JSON 출력
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
// Dev-B 검증 루프가 축적한 컨텍스트를 번역 직전에 주입한다 (docs/retriever-integration.md)
import { initRetriever, retrieveForBatch, retrieverStatus } from '../retrieval/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ===== 환경변수 로드 =====
// ~/.hermes/.env 를 먼저 깔고 프로젝트 .env 로 덮어쓴다.
// (해커톤 환경에서 FRIENDLI_API_KEY가 ~/.hermes/.env에 발급되어 있음)
//
// override: true 가 필요한 이유 — dotenv 기본 동작은 이미 프로세스 환경에 있는
// 값을 덮어쓰지 않는다. 셸에 placeholder 가 export 되어 있으면 .env 에 진짜
// 키를 넣어도 무시되고 "Invalid token" 이 난다.
dotenv.config({ path: path.join(os.homedir(), '.hermes', '.env'), override: true, quiet: true });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true, quiet: true });

// ===== 설정 =====
const CONFIG = {
  figmaApiKey: process.env.FIGMA_API_KEY || '',
  // 기본값은 실제 작업 대상 파일. targetFrameIds와 짝을 맞춰야 한다.
  figmaFileKey: process.env.FIGMA_FILE_KEY || 'zdG3CHXVU6TzD4cc28o5Yb',
  // EXAONE via Friendli API (Hermes Agent)
  friendliApiUrl:
    process.env.FRIENDLI_API_URL || 'https://api.friendli.ai/dedicated/v1/chat/completions',
  friendliApiKey: process.env.FRIENDLI_API_KEY || '',
  friendliModel: process.env.FRIENDLI_MODEL || 'depe675tjc2rcpo',
  outputDir: path.resolve(__dirname, '../locales'),
  languages: ['en', 'ko', 'ja', 'zh-CN'],
  // i18n key의 최상위 prefix (예: console.setting.group.title.xxx)
  keyPrefix: 'console',
  // 번역 프롬프트에 전달할 도메인 설명. 구체적일수록 문맥 번역 품질이 올라간다.
  domainDescription:
    'LG Business Cloud console — a B2B admin console for managing business sites, workspaces, device groups, users, roles and licenses',
  // 특정 프레임만 추출 (빈 배열이면 전체 추출)
  targetFrameIds: [
    '15682:100905', // Settings 관련 - UI 텍스트 풍부, 테이블 적음
  ],
};

// ===== Types =====
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
  role: TextRole;
}

type TextRole = 'title' | 'button' | 'label' | 'description' | 'status' | 'placeholder' | 'message';

interface I18nEntry {
  key: string;
  source: string;
  context: string;
  role: TextRole;
  translations: Record<string, string>;
  contextOnly: boolean; // true면 번역 대상이 아닌 문맥 참고용
}

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  characters?: string;
  children?: FigmaNode[];
  style?: {
    fontSize?: number;
    fontWeight?: number;
  };
}

// ===== US-1.1: Figma 텍스트 추출 =====
export async function extractTextsFromFigma(fileKey: string): Promise<TextNode[]> {
  const response = await fetch(
    `https://api.figma.com/v1/files/${fileKey}`,
    {
      headers: { 'X-Figma-Token': CONFIG.figmaApiKey },
    }
  );

  if (!response.ok) {
    throw new Error(`Figma API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const pages = data.document.children;

  // Scenario 페이지를 우선 사용 (없으면 첫 번째 페이지)
  const targetPage = pages.find((p: FigmaNode) => p.name === 'Scenario') || pages[0];

  // 특정 프레임만 추출 (targetFrameIds가 지정된 경우)
  let targetNodes: FigmaNode[];
  if (CONFIG.targetFrameIds.length > 0) {
    targetNodes = findNodesByIds(targetPage, CONFIG.targetFrameIds);
    console.log(`   대상 프레임: ${targetNodes.length}개 (ID: ${CONFIG.targetFrameIds.join(', ')})`);
  } else {
    targetNodes = [targetPage];
  }

  const textNodes: TextNode[] = [];
  for (const node of targetNodes) {
    traverseNodes(node, '', textNodes);
  }

  // 필터링: placeholder 텍스트, 숫자만 있는 것, UX 시나리오 설명 테이블 제외
  return textNodes.filter((node) => {
    if (!node.text || node.text.trim() === '') return false;
    if (/^[\d\s.*-]+$/.test(node.text)) return false; // 숫자/기호만
    if (node.text.toLowerCase().includes('lorem ipsum')) return false;
    if (isScenarioDescriptionTable(node)) return false; // UX 시나리오 설명 테이블 제외
    if (!isTranslatableUIText(node.text)) return false; // 한글 설명/긴 텍스트 제외
    return true;
  });
}

/**
 * UX 시나리오 설명 테이블 판별
 * 
 * 프레임 내에 Table 구조로 작성되어 있고,
 * No., Classification, Description 3개 컬럼으로 구성된 테이블은
 * UX 시나리오 세부 설명이므로 번역 대상이 아님 (문맥 참고용으로만 활용)
 */
function isScenarioDescriptionTable(node: TextNode): boolean {
  const pathLower = node.path.toLowerCase();

  // Table 구조 안에 있는 텍스트인지 확인
  if (!pathLower.includes('table')) return false;

  // Table/.Row 패턴 안에 있으면 시나리오 설명 테이블로 판단
  if (pathLower.includes('table/') && pathLower.includes('row')) return true;

  // 컬럼 헤더 텍스트 자체도 제외
  const headerTexts = ['no', 'no.', 'classification', 'description'];
  if (headerTexts.includes(node.text.toLowerCase().trim())) return true;

  return false;
}

function traverseNodes(node: FigmaNode, parentPath: string, results: TextNode[]): void {
  const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;

  if (node.type === 'TEXT' && node.characters) {
    const frameName = extractFrameName(currentPath);
    results.push({
      id: node.id,
      name: node.name,
      // Figma 텍스트에 선행/후행 공백이 포함된 경우가 많아 정규화한다.
      text: node.characters.trim(),
      path: currentPath,
      frameName,
      style: {
        fontSize: node.style?.fontSize || null,
        fontWeight: node.style?.fontWeight || null,
      },
      role: inferRole(node),
    });
  }

  if (node.children) {
    for (const child of node.children) {
      traverseNodes(child, currentPath, results);
    }
  }
}

function extractFrameName(path: string): string {
  const parts = path.split('/');
  // 페이지 다음의 첫 번째 프레임 이름
  return parts.length > 1 ? parts[1] : parts[0];
}

/**
 * Figma 트리에서 특정 ID를 가진 노드를 찾아 반환
 */
function findNodesByIds(root: FigmaNode, ids: string[]): FigmaNode[] {
  const results: FigmaNode[] = [];
  const idSet = new Set(ids);

  function search(node: FigmaNode): void {
    if (idSet.has(node.id)) {
      results.push(node);
    }
    if (node.children) {
      for (const child of node.children) {
        search(child);
      }
    }
  }

  search(root);
  return results;
}

// ===== US-1.2: UX 흐름 문맥 분석 =====
function inferRole(node: FigmaNode): TextRole {
  const fontSize = node.style?.fontSize || 0;
  const fontWeight = node.style?.fontWeight || 400;
  const name = node.name?.toLowerCase() || '';

  // 이름 기반 추론
  if (name.includes('button') || name.includes('btn') || name.includes('cta')) return 'button';
  if (name.includes('title') || name.includes('heading') || name.includes('header')) return 'title';
  if (name.includes('label')) return 'label';
  if (name.includes('placeholder') || name.includes('hint')) return 'placeholder';
  if (name.includes('status')) return 'status';
  if (name.includes('message') || name.includes('error') || name.includes('toast')) return 'message';

  // 스타일 기반 추론
  if (fontSize >= 20 || (fontWeight >= 700 && fontSize >= 12)) return 'title';
  if (fontWeight >= 600 && fontSize >= 9) return 'label';

  return 'label'; // 기본값
}

/**
 * UX 흐름 문맥 분석
 * 
 * 프레임 경로에서 기능 영역(feature)을 추론한다.
 * 예: "Console_Setting_Group@User/body/..." → "setting.group"
 */
export function analyzeContext(textNodes: TextNode[]): Map<string, string> {
  const frameContexts = new Map<string, string>();

  for (const node of textNodes) {
    if (!frameContexts.has(node.frameName)) {
      const feature = inferFeature(node.frameName);
      frameContexts.set(node.frameName, feature);
    }
  }

  return frameContexts;
}

/**
 * 프레임 이름에서 기능 영역을 추론
 * 
 * 패턴:
 * - "Console_Setting_Group@User" → "setting.group"
 * - "Console_Commons_Settings_APIKey" → "settings.api_key"
 * - "IAM > User Tab" → "iam.user"
 */
function inferFeature(frameName: string): string {
  let name = frameName;

  // 공통 접두사 제거
  name = name.replace(/^Console_?/i, '');
  name = name.replace(/^Commons_?/i, '');

  // @이후 제거 (역할 정보)
  name = name.replace(/@.*$/, '');

  // 특수문자를 구분자로 변환
  name = name
    .replace(/[>\-_\s]+/g, '.')
    .replace(/[^a-zA-Z0-9.]/g, '')
    .toLowerCase();

  // 연속 dot 정리
  name = name.replace(/\.+/g, '.').replace(/^\.|\.$/, '');

  // 너무 긴 경우 앞 2단계만
  const parts = name.split('.');
  if (parts.length > 3) {
    name = parts.slice(0, 3).join('.');
  }

  return name || 'common';
}

/**
 * 텍스트가 UI 번역 대상인지 판별
 * 
 * 한글로 된 UX 시나리오 설명은 번역 대상이 아님.
 * UI에 표시되는 영어 텍스트만 번역 대상.
 */
function isTranslatableUIText(text: string): boolean {
  // 순수 한글 텍스트 (UI가 아닌 시나리오 설명)
  const koreanRatio = (text.match(/[\uAC00-\uD7A3]/g) || []).length / text.length;
  if (koreanRatio > 0.5) return false;

  // "~시", "~하는", "~경우" 등 한글 서술형은 설명 텍스트
  if (/[가-힣]{2,}.*(시|때|경우|처리|제공|노출|기능|화면|진입|선택)/.test(text)) return false;

  // 너무 긴 텍스트는 설명일 가능성 높음 (UI 텍스트는 보통 짧음)
  if (text.length > 100) return false;

  // 구분자만 있는 텍스트
  if (/^[>\|\-\/\s]+$/.test(text)) return false;

  // 단일 문자 (의미 없음)
  if (text.length <= 1) return false;

  // 날짜/시간 패턴
  if (/^\d{4}[.\-/]\d{2}[.\-/]\d{2}/.test(text)) return false;
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(text)) return false;

  // 버전 번호 패턴
  if (/^[vV]?\d+\.\d+(\.\d+)?$/.test(text.trim())) return false;
  if (/^N\.N\.N$/.test(text.trim())) return false;

  // 반복 placeholder 패턴 (TextText, XXXX 등)
  if (/^(.)\1{3,}$/.test(text.replace(/\s/g, ''))) return false;
  if (/^(Text){2,}$/i.test(text.replace(/\s/g, ''))) return false;

  // 순수 샘플 데이터 패턴 (workspace 1-1-1-1 등)
  if (/^(workspace|group)\s+[\d\-]+$/i.test(text.trim())) return false;

  // 변수 placeholder ({Company name}, {{userName}} 등) - 런타임에 값이 주입되므로 번역 불필요
  if (/^\{\{?.*\}\}?$/.test(text.trim())) return false;

  // 파일 크기 / 해상도 표기 (831 x 632, 2,789 KB)
  if (/^\d+[\d,]*\s*(x|×)\s*\d+/.test(text.trim())) return false;
  if (/^\d+[\d,.]*\s*(KB|MB|GB|B)$/i.test(text.trim())) return false;

  // 카운터 표기 (1 / 100, (n))
  if (/^\d+\s*\/\s*\d+$/.test(text.trim())) return false;
  if (/^\(n\)$/i.test(text.trim())) return false;

  // 날짜 포맷 플레이스홀더 (YYYY.MM.DD)
  if (/^[YMDHhms][YMDHhms.:\-/\s]*$/.test(text.trim())) return false;

  // 대문자 약어 코드 (LGEBN 등) - 고유명사/코드값
  if (/^[A-Z]{3,}$/.test(text.trim())) return false;

  return true;
}

// ===== US-1.3: i18n Key 자동 생성 =====
export function generateI18nKey(node: TextNode, frameContexts: Map<string, string>): string {
  const domain = CONFIG.keyPrefix;
  const feature = frameContexts.get(node.frameName) || 'common';
  const role = node.role;
  const identifier = generateIdentifier(node.text);

  return `${domain}.${feature}.${role}.${identifier}`;
}

/**
 * 텍스트에서 i18n key의 identifier 부분을 생성한다 (camelCase).
 *
 * 처리 순서가 중요하다. 구분자를 먼저 공백으로 바꾸지 않으면
 * 단어가 붙어버린다: "Workspace/Group" → "workspacegroup" (X)
 */
function generateIdentifier(text: string): string {
  // 1. 구분자를 공백으로 치환 (제거하면 단어가 붙는다)
  const separated = text.replace(/[/\-_+:,.()[\]{}|&*'"`~!?<>@#$%^=;\\]/g, ' ');

  // 2. 영숫자와 공백만 남김
  const cleaned = separated.replace(/[^a-zA-Z0-9\s]/g, ' ');

  // 3. 토큰화
  const rawTokens = cleaned.split(/\s+/).filter(Boolean);

  // 4. 숫자만으로 된 토큰은 앞 토큰에 붙인다 (UTC 09 00 → utc0900)
  const tokens: string[] = [];
  for (const tok of rawTokens) {
    if (/^\d+$/.test(tok) && tokens.length > 0) {
      tokens[tokens.length - 1] += tok;
    } else {
      tokens.push(tok);
    }
  }

  // 5. 최대 4단어까지 사용 (3단어로는 구분이 부족한 사례가 있었다)
  const picked = tokens.slice(0, 4);
  if (picked.length === 0) return 'unknown';

  // 6. camelCase 조립
  return picked
    .map((tok, i) => {
      const lower = tok.toLowerCase();
      if (i === 0) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

// ===== US-1.4: EXAONE 문맥 기반 번역 =====

/**
 * 배치 간 용어 일관성을 위한 누적 용어 사전
 * 
 * 배치 단위로 번역하면 같은 단어가 배치마다 다르게 번역될 수 있다.
 * (예: Workspace → "워크스페이스" vs "작업 공간")
 * 이를 막기 위해 번역된 핵심 용어를 누적하여 다음 배치 프롬프트에 주입한다.
 */
const CONSISTENCY_TERMS = [
  'Workspace',
  'Business Site',
  'Group',
  'Device',
  'Settings',
  'Player',
  'Content',
  'Schedule',
  'Channel',
  'License',
  'Console',
];

function buildRunningGlossary(
  translated: I18nEntry[]
): Record<string, Record<string, string>> {
  const running: Record<string, Record<string, string>> = {};

  for (const entry of translated) {
    // 단독으로 등장한 핵심 용어만 수집 (예: "Device" 텍스트 자체)
    const source = entry.source.trim();
    const matchedTerm = CONSISTENCY_TERMS.find(
      (term) => term.toLowerCase() === source.toLowerCase()
    );
    if (matchedTerm && entry.translations.ko && entry.translations.ko !== source) {
      running[matchedTerm] = {
        ko: entry.translations.ko,
        ja: entry.translations.ja || '',
        'zh-CN': entry.translations['zh-CN'] || '',
      };
    }
  }

  return running;
}

export async function translateWithExaone(
  entries: I18nEntry[],
  glossary: Record<string, Record<string, string>>,
  contextEntries: I18nEntry[] = []
): Promise<I18nEntry[]> {
  const results: I18nEntry[] = [];

  // 핵심 용어를 먼저 번역하여 기준을 확립 (일관성 앵커)
  const anchorEntries = entries.filter((e) =>
    CONSISTENCY_TERMS.some((t) => t.toLowerCase() === e.source.trim().toLowerCase())
  );
  const restEntries = entries.filter((e) => !anchorEntries.includes(e));

  let runningGlossary = { ...glossary };

  if (anchorEntries.length > 0) {
    console.log(`   앵커 용어 우선 번역: ${anchorEntries.length}개`);
    const anchorsTranslated = await translateBatch(anchorEntries, runningGlossary, contextEntries);
    results.push(...anchorsTranslated);
    // 앵커 번역 결과를 용어집에 병합 → 이후 배치가 이를 따르도록 강제
    runningGlossary = { ...runningGlossary, ...buildRunningGlossary(anchorsTranslated) };
  }

  // 나머지를 배치 처리 (누적 용어집 주입)
  const batchSize = 10;
  for (let i = 0; i < restEntries.length; i += batchSize) {
    const batch = restEntries.slice(i, i + batchSize);
    const translated = await translateBatch(batch, runningGlossary, contextEntries);
    results.push(...translated);
    // 배치 결과에서 새 용어 발견 시 누적
    runningGlossary = { ...runningGlossary, ...buildRunningGlossary(translated) };
  }

  return results;
}

async function translateBatch(
  entries: I18nEntry[],
  glossary: Record<string, Record<string, string>>,
  contextEntries: I18nEntry[] = []
): Promise<I18nEntry[]> {
  // ── Dev-B 컨텍스트 검색 (US-2.3/2.4 연동) ──
  // 실패해도 throw하지 않는다. 리트리버 때문에 파이프라인이 죽으면 안 된다.
  const ctx = await retrieveForBatch(
    entries.map((e) => ({ key: e.key, source: e.source, context: e.context, role: e.role }))
  );

  // 이미 검증을 통과한 항목은 재번역하지 않는다 (회귀 원천 차단 + API 비용 절감)
  for (const e of entries) {
    const c = ctx.confirmed[e.key];
    if (c) {
      e.translations = {
        en: e.source.trim(),
        ko: c.ko ?? '',
        ja: c.ja ?? '',
        'zh-CN': c['zh-CN'] ?? '',
      };
    }
  }
  const targets = entries.filter((e) => !ctx.confirmed[e.key]);
  if (targets.length === 0) {
    console.log(`      ↳ 전량 확정 재사용 (${entries.length}건) — API 호출 생략`);
    return entries;
  }
  if (ctx.stats.confirmedCount > 0 || ctx.stats.forbiddenCount > 0 || ctx.stats.similarCount > 0) {
    console.log(
      `      ↳ 리트리버: 확정 ${ctx.stats.confirmedCount} / 금지 ${ctx.stats.forbiddenCount} / 유사 ${ctx.stats.similarCount}`
    );
  }

  const glossaryContext = Object.entries(glossary)
    .map(([en, translations]) => `  "${en}" → ko: "${translations.ko}", ja: "${translations.ja}", zh-CN: "${translations['zh-CN']}"`)
    .join('\n');

  const textsToTranslate = targets
    .map((e, i) => `${i + 1}. "${e.source}" (context: ${e.context}, role: ${e.role})`)
    .join('\n');

  // description 텍스트를 문맥 참고 정보로 제공 (번역 대상 아님)
  const contextInfo = contextEntries.length > 0
    ? `\nUX SCENARIO CONTEXT (for reference only, do NOT translate these):\n${contextEntries.slice(0, 20).map((e) => `- [${e.context}] "${e.source}"`).join('\n')}`
    : '';

  const prompt = `You are a professional translator for the following product UI:
${CONFIG.domainDescription}
Translate the following UI texts into Korean (ko), Japanese (ja), and Chinese Simplified (zh-CN).

CRITICAL RULES:
1. GLOSSARY IS MANDATORY. If a glossary term appears anywhere in the text — including inside a longer phrase — you MUST use the glossary translation for that part.
   Example: glossary has "Workspace" -> "워크스페이스".
   Then "Workspace/Group Settings" MUST be "워크스페이스/그룹 설정" (NOT "작업 공간/그룹 설정").
2. Be internally consistent: the same English term must map to the same translation across all items in this response.
3. Consider the UX context provided for each text.
4. Keep translations concise and appropriate for UI elements (buttons, labels, titles).
5. Preserve placeholders exactly as-is: {0}, {{name}}, {Company name} must NOT be translated.
6. Do NOT translate product codes, acronyms, or proper nouns (e.g. SSO, API, LGEBN).
${contextInfo}

DOMAIN GLOSSARY:
${glossaryContext}
${ctx.promptBlock ? '\n' + ctx.promptBlock + '\n' : ''}
TEXTS TO TRANSLATE:
${textsToTranslate}

Respond ONLY with a JSON array, no explanation:
[
  { "index": 1, "ko": "...", "ja": "...", "zh-CN": "..." },
  ...
]`;

  try {
    const response = await fetch(CONFIG.friendliApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${CONFIG.friendliApiKey}`,
      },
      body: JSON.stringify({
        model: CONFIG.friendliModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2, // 번역은 일관성이 중요하므로 낮게
        top_p: 0.95,
        presence_penalty: 0.0,
        chat_template_kwargs: {
          enable_thinking: false, // 번역 작업에는 thinking 불필요 (응답 속도 우선)
          preserve_thinking: false,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`EXAONE API error: ${response.status} - ${errorBody.slice(0, 200)}`);
      return entries; // 실패 시 원본 반환
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // JSON 파싱
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return entries;

    const translations = JSON.parse(jsonMatch[0]);

    // 인덱스는 targets 기준이다 (확정 재사용 항목은 요청에서 제외됨)
    targets.forEach((entry, idx) => {
      const t = translations.find((tr: any) => tr.index === idx + 1);
      if (t) {
        // 모델 응답에 선행/후행 공백이 섞이는 경우가 있어 정규화한다.
        const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
        entry.translations = {
          en: entry.source.trim(),
          ko: clean(t.ko),
          ja: clean(t.ja),
          'zh-CN': clean(t['zh-CN']),
        };
      }
    });
    return entries;
  } catch (error) {
    console.error('Translation error:', error);
    return entries;
  }
}

// ===== US-1.5: Locale JSON 출력 =====
export function generateLocaleFiles(entries: I18nEntry[]): Record<string, object> {
  const locales: Record<string, any> = {};

  for (const lang of CONFIG.languages) {
    locales[lang] = {};
  }

  for (const entry of entries) {
    const keyParts = entry.key.split('.');

    for (const lang of CONFIG.languages) {
      let current = locales[lang];
      for (let i = 0; i < keyParts.length - 1; i++) {
        if (!current[keyParts[i]]) current[keyParts[i]] = {};
        current = current[keyParts[i]];
      }
      current[keyParts[keyParts.length - 1]] = entry.translations[lang] || entry.source;
    }
  }

  return locales;
}

export function writeLocaleFiles(locales: Record<string, object>): void {
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  for (const [lang, data] of Object.entries(locales)) {
    const filePath = path.join(CONFIG.outputDir, `${lang}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`✅ Generated: ${filePath}`);
  }
}

// ===== Components Map (Dev-C 연동용) =====

interface ComponentMapEntry {
  type: TextRole;
  key: string;
  originalText: string;
}

interface ComponentMapFrame {
  frame: string;
  frameId: string;
  children: ComponentMapEntry[];
}

/**
 * Components Map 생성
 *
 * Figma 프레임 구조를 유지하면서, 텍스트를 i18n key로 대체한 매핑 파일.
 * Dev-C가 이 파일을 참고하여 React 컴포넌트를 생성한다.
 */
export function generateComponentsMap(
  textNodes: TextNode[],
  entries: I18nEntry[]
): ComponentMapFrame[] {
  // source + context → entry 매핑
  const entryMap = new Map<string, I18nEntry>();
  for (const entry of entries) {
    entryMap.set(`${entry.source}|||${entry.context}`, entry);
  }

  // 프레임별 그룹핑
  const frameMap = new Map<string, { frameId: string; children: ComponentMapEntry[] }>();

  for (const node of textNodes) {
    const lookupKey = `${node.text}|||${node.frameName} > ${node.role}`;
    const entry = entryMap.get(lookupKey);
    if (!entry) continue;

    if (!frameMap.has(node.frameName)) {
      frameMap.set(node.frameName, { frameId: node.id.split(';')[0], children: [] });
    }

    frameMap.get(node.frameName)!.children.push({
      type: node.role,
      key: entry.key,
      originalText: node.text,
    });
  }

  const result: ComponentMapFrame[] = [];
  for (const [frameName, data] of frameMap) {
    result.push({
      frame: frameName,
      frameId: data.frameId,
      children: data.children,
    });
  }

  return result;
}

export function writeComponentsMap(componentsMap: ComponentMapFrame[]): void {
  const outputPath = path.resolve(CONFIG.outputDir, '..', 'components-map.json');
  fs.writeFileSync(outputPath, JSON.stringify(componentsMap, null, 2), 'utf-8');
  console.log(`✅ Generated: ${outputPath}`);
}

// ===== 용어집 등록 제안 (Dev-B 연동용, US-2.2) =====

/**
 * 도메인 용어가 아닌 일반 UI 단어 (제안 대상에서 제외)
 */
const GENERIC_WORDS = new Set([
  'name', 'time', 'last', 'update', 'button', 'off', 'on', 'delete', 'edit',
  'search', 'add', 'create', 'change', 'save', 'cancel', 'close', 'open',
  'description', 'address', 'data', 'zone', 'count', 'list', 'information',
  'label', 'text', 'title', 'value', 'type', 'status', 'date', 'number',
  'user', 'all', 'new', 'view', 'select', 'total', 'and', 'the', 'for',
  'asia', 'pacific', 'seoul', 'korea', 'basic', 'dark', 'period',
]);

/**
 * 번역 결과에서 도메인 용어를 발견하여 용어집 등록 제안 리포트를 생성한다.
 * 
 * 요구사항(Q6=A): AI가 자동 추출/제안하고 사람(Dev-B)이 승인한다.
 * 따라서 이 함수는 domain-glossary.md를 직접 수정하지 않고 제안 파일만 만든다.
 * 
 * 전략: 단일 일반 단어보다 복합어(2-gram)를 우선 제안한다.
 * 도메인 용어는 보통 "Business Site", "Art Lounge"처럼 복합 개념이다.
 */
export function generateGlossaryProposal(
  translated: I18nEntry[],
  existingGlossary: Record<string, Record<string, string>>
): string {
  const candidates = new Map<string, { count: number; samples: I18nEntry[] }>();

  const addCandidate = (term: string, entry: I18nEntry) => {
    const existing = candidates.get(term);
    if (existing) {
      existing.count += 1;
      if (existing.samples.length < 3) existing.samples.push(entry);
    } else {
      candidates.set(term, { count: 1, samples: [entry] });
    }
  };

  for (const entry of translated) {
    // 대문자로 시작하는 연속 단어 시퀀스를 추출
    const tokens = entry.source.split(/[\s/,:()*]+/).filter(Boolean);
    const capitalized = tokens.map((t) => /^[A-Z][a-zA-Z]{1,}$/.test(t));

    // 2-gram 복합어 (예: "Business Site", "Art Lounge")
    for (let i = 0; i < tokens.length - 1; i++) {
      if (capitalized[i] && capitalized[i + 1]) {
        addCandidate(`${tokens[i]} ${tokens[i + 1]}`, entry);
      }
    }

    // 단일 단어는 일반 단어가 아닌 경우만 (예: "Signage", "Workspace")
    for (let i = 0; i < tokens.length; i++) {
      if (!capitalized[i]) continue;
      if (GENERIC_WORDS.has(tokens[i].toLowerCase())) continue;
      if (tokens[i].length < 4) continue;
      addCandidate(tokens[i], entry);
    }
  }

  // 2회 이상 등장 + 용어집 미등록 항목만 제안
  const proposals = [...candidates.entries()]
    .filter(([term, data]) => {
      if (data.count < 2) return false;
      if (existingGlossary[term]) return false;
      // 복합어의 모든 구성 단어가 일반 단어면 제외 (예: "Last Update")
      const words = term.split(' ');
      if (words.length > 1 && words.every((w) => GENERIC_WORDS.has(w.toLowerCase()))) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      // 복합어 우선, 그다음 빈도순
      const aMulti = a[0].includes(' ') ? 1 : 0;
      const bMulti = b[0].includes(' ') ? 1 : 0;
      if (aMulti !== bMulti) return bMulti - aMulti;
      return b[1].count - a[1].count;
    });

  const lines: string[] = [];
  lines.push('# 용어집 등록 제안 (Dev-A → Dev-B)');
  lines.push('');
  lines.push(`생성 시각: ${new Date().toISOString()}`);
  lines.push(`대상 Figma File: ${CONFIG.figmaFileKey}`);
  lines.push(`대상 Frame: ${CONFIG.targetFrameIds.join(', ') || '전체'}`);
  lines.push('');
  lines.push('2회 이상 반복 등장했으나 용어집에 미등록된 용어 후보입니다.');
  lines.push('복합어를 우선 정렬했습니다. 검토 후 `requirements/domain-glossary.md` 등록 여부를 결정해주세요.');
  lines.push('');
  lines.push('| English | 빈도 | 현재 ko 번역 | 예시 원문 | 등록 |');
  lines.push('|---------|------|--------------|-----------|------|');

  const escape = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();

  for (const [term, data] of proposals) {
    const sample = data.samples[0];
    lines.push(
      `| ${term} | ${data.count} | ${escape(sample.translations.ko || '')} | ${escape(sample.source)} | ☐ |`
    );
  }

  lines.push('');
  lines.push(`총 ${proposals.length}개 용어 제안`);
  lines.push('');
  lines.push('## 참고: 이미 용어집에 등록된 용어');
  lines.push('');
  const existing = Object.keys(existingGlossary);
  lines.push(existing.length > 0 ? existing.join(', ') : '(없음)');

  return lines.join('\n');
}

export function writeGlossaryProposal(content: string): void {
  const outputPath = path.resolve(CONFIG.outputDir, '..', '..', 'glossary-proposal.md');
  fs.writeFileSync(outputPath, content, 'utf-8');
  console.log(`✅ Generated: ${outputPath}`);
}

// ===== 메인 파이프라인 =====
export async function runPipeline(fileKey?: string): Promise<void> {
  const targetFileKey = fileKey || CONFIG.figmaFileKey;

  console.log('🚀 Figma i18n Pipeline 시작');
  console.log(`   File Key: ${targetFileKey}`);
  console.log('');

  // Step 1: Figma 텍스트 추출
  console.log('📄 Step 1: Figma 텍스트 추출...');
  const textNodes = await extractTextsFromFigma(targetFileKey);
  console.log(`   추출된 텍스트 노드: ${textNodes.length}개`);

  // 가드: 추출 결과가 비어있으면 중단한다.
  // 잘못된 File Key / Frame ID로 실행했을 때 기존 산출물을 빈 값으로 덮어쓰는 것을 방지.
  // (Dev-B/Dev-C가 이 산출물을 입력으로 사용하므로 유실되면 작업이 막힌다)
  if (textNodes.length === 0) {
    console.error('');
    console.error('❌ 추출된 텍스트가 0개입니다. 산출물을 덮어쓰지 않고 중단합니다.');
    console.error('');
    console.error('확인할 항목:');
    console.error(`   - FIGMA_FILE_KEY: ${targetFileKey}`);
    console.error(`   - targetFrameIds: ${CONFIG.targetFrameIds.join(', ') || '(전체)'}`);
    console.error('   → File Key와 Frame ID가 서로 맞는지 확인하세요.');
    console.error('     (다른 파일의 Frame ID를 지정하면 0개가 됩니다)');
    process.exitCode = 1;
    return;
  }

  // Step 2: 문맥 분석
  console.log('🔍 Step 2: UX 흐름 문맥 분석...');
  const frameContexts = analyzeContext(textNodes);
  console.log(`   분석된 프레임: ${frameContexts.size}개`);

  // Step 3: i18n Key 생성
  console.log('🔑 Step 3: i18n Key 생성...');
  const entries: I18nEntry[] = textNodes.map((node) => ({
    key: generateI18nKey(node, frameContexts),
    source: node.text,
    context: `${node.frameName} > ${node.role}`,
    role: node.role,
    translations: { en: node.text },
    contextOnly: false, // 테이블 필터링은 추출 단계에서 이미 처리됨
  }));

  const translationTargets = entries;
  console.log(`   생성된 Key: ${entries.length}개 (번역 대상: ${translationTargets.length}개)`);

  // Step 4: EXAONE 번역
  console.log('🌐 Step 4: EXAONE 문맥 기반 번역...');
  // Dev-B 저장소/인덱스 로드 (1회). 없으면 축소 모드로 조용히 동작한다.
  await initRetriever();
  const rs = retrieverStatus();
  console.log(
    `   리트리버: 용어 ${rs.glossaryTerms} / 확정 ${rs.confirmed} / 거부 ${rs.rejected} / 벡터검색 ${rs.vectorReady ? 'ON' : 'OFF'}`
  );
  for (const note of rs.notes) console.log(`     ⚠️  ${note}`);
  const glossary = loadGlossary();
  const translated = await translateWithExaone(translationTargets, glossary);
  console.log(`   번역 완료: ${translated.length}개`);

  // Step 5: Locale JSON 출력
  console.log('💾 Step 5: Locale JSON 출력...');
  if (translated.length === 0) {
    console.error('❌ 번역 결과가 0개입니다. 산출물을 덮어쓰지 않고 중단합니다.');
    process.exitCode = 1;
    return;
  }
  const locales = generateLocaleFiles(translated);
  writeLocaleFiles(locales);

  // Step 6: Components Map 출력 (Dev-C 연동용)
  console.log('🗺️  Step 6: Components Map 생성...');
  const componentsMap = generateComponentsMap(textNodes, translated);
  writeComponentsMap(componentsMap);
  console.log(`   프레임 수: ${componentsMap.length}개`);

  // Step 7: 용어집 등록 제안 (Dev-B 연동용)
  console.log('📖 Step 7: 용어집 등록 제안 생성...');
  const proposal = generateGlossaryProposal(translated, glossary);
  writeGlossaryProposal(proposal);

  console.log('');
  console.log('✅ Pipeline 완료!');
  console.log('');
  console.log('📦 산출물:');
  console.log(`   - src/locales/{en,ko,ja,zh-CN}.json (다국어 번역)`);
  console.log(`   - src/components-map.json (Dev-C 컴포넌트 생성용)`);
  console.log(`   - glossary-proposal.md (Dev-B 용어집 검토용)`);
}

// 용어집 로드
function loadGlossary(): Record<string, Record<string, string>> {
  // requirements/domain-glossary.md에서 파싱
  const glossaryPath = path.resolve(__dirname, '../../requirements/domain-glossary.md');

  if (!fs.existsSync(glossaryPath)) {
    console.warn('⚠️ domain-glossary.md not found, proceeding without glossary');
    return {};
  }

  const content = fs.readFileSync(glossaryPath, 'utf-8');
  const glossary: Record<string, Record<string, string>> = {};

  // 마크다운 테이블 파싱
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

// CLI 실행
const isMainModule = process.argv[1]?.endsWith('figma-i18n-pipeline.ts');
if (isMainModule) {
  const fileKey = process.argv[2] || CONFIG.figmaFileKey;
  runPipeline(fileKey).catch(console.error);
}
