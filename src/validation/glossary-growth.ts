/**
 * 용어집 자동 성장 (US-2.2)
 *
 * Layer 2/3 위반이 반복되는 표현을 감지해 용어집 등록 후보로 제안합니다.
 * 용어집에 등재되면 다음 라운드부터 결정론적으로 걸리므로,
 * 이 채널이 자가발전에서 가장 확실한 개선 경로입니다.
 *
 * ⚠️ 자동 등재하지 않습니다. US-2.2 수용 기준이
 *    "사람이 승인해야만 용어집에 등록된다"이므로 제안까지만 합니다.
 *    (npm run glossary:approve 로 승인)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { GlossaryData } from '../retrieval/glossary-loader.js';
import { containsTerm } from '../retrieval/text-match.js';
import type { Issue, LocaleBundle } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PROPOSAL_FILE = path.join(ROOT, 'data', 'feedback', 'glossary-proposals.json');

export interface TermProposal {
  english: string;
  /** 어느 화면/기능에서 쓰이는지 */
  context: string;
  ko: string;
  ja: string;
  'zh-CN': string;
  /** 제안 근거: 위반이 발생한 key 목록 */
  evidence: string[];
  /** 위반 횟수 */
  occurrences: number;
  firstSeenRound: number;
  status: 'proposed' | 'approved' | 'rejected';
}

export function loadProposals(): Record<string, TermProposal> {
  try {
    if (!fs.existsSync(PROPOSAL_FILE)) return {};
    return JSON.parse(fs.readFileSync(PROPOSAL_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

export function saveProposals(data: Record<string, TermProposal>): void {
  fs.mkdirSync(path.dirname(PROPOSAL_FILE), { recursive: true });
  fs.writeFileSync(PROPOSAL_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/** 최소 등장 횟수 — 1회성 오역을 용어로 승격시키지 않기 위한 하한 */
const MIN_OCCURRENCES = 2;

/**
 * 미등록 표현 후보 추출.
 *
 * en.json에서 다음 조건을 만족하는 원문을 후보로 본다.
 *  - 용어집에 등록되지 않았다
 *  - 번역 제외 대상이 아니다
 *  - 여러 key에서 반복 등장한다 (같은 표현이 화면 곳곳에 쓰임 = 용어 성격)
 */
export function discoverTermCandidates(
  bundle: LocaleBundle,
  glossary: GlossaryData,
  round: number,
  existing: Record<string, TermProposal>
): Record<string, TermProposal> {
  const en = bundle['en'] ?? {};
  const proposals: Record<string, TermProposal> = { ...existing };

  // 원문 → 등장 key 목록
  const bySource = new Map<string, string[]>();
  for (const [key, value] of Object.entries(en)) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    // 제외 대상은 용어가 아니다
    if (glossary.excludePatterns.some((p) => trimmed.includes(p))) continue;
    // 너무 긴 문장은 용어가 아니라 문장
    if (trimmed.split(/\s+/).length > 4) continue;
    // 필수 표시(*)와 콜론 제거
    const norm = trimmed.replace(/\s*\*\s*$/, '').replace(/\s*:\s*$/, '');
    if (!norm) continue;

    const list = bySource.get(norm) ?? [];
    list.push(key);
    bySource.set(norm, list);
  }

  const registered = new Set(glossary.entries.map((e) => e.english.toLowerCase()));
  const productNames = new Set(glossary.productNames.map((p) => p.toLowerCase()));

  for (const [source, keys] of bySource) {
    const lower = source.toLowerCase();
    if (registered.has(lower) || productNames.has(lower)) continue;

    // 이미 등록된 용어를 포함하는 복합어는 별도 등재 필요성이 낮다
    const coveredByExisting = glossary.entries.some(
      (e) => e.english && e.english.toLowerCase() !== lower && containsTerm(source, e.english)
    );
    if (coveredByExisting) continue;

    if (keys.length < MIN_OCCURRENCES) continue;

    const key = source;
    const prev = proposals[key];
    if (prev && prev.status !== 'proposed') continue; // 승인/거부된 건 재제안하지 않는다

    proposals[key] = {
      english: source,
      context: `${keys.length}개 key에서 반복 등장`,
      ko: bundle['ko']?.[keys[0]] ?? '',
      ja: bundle['ja']?.[keys[0]] ?? '',
      'zh-CN': bundle['zh-CN']?.[keys[0]] ?? '',
      evidence: keys.slice(0, 5),
      occurrences: keys.length,
      firstSeenRound: prev?.firstSeenRound ?? round,
      status: 'proposed',
    };
  }

  return proposals;
}

/**
 * 위반 기반 제안: Layer 2/3에서 반복 위반이 발생한 용어를 우선 후보로 승격.
 * 이미 용어집에 있으나 계속 어겨지는 경우는 용어집 문제가 아니라 프롬프트 문제이므로
 * 별도로 표시한다.
 */
export function findRepeatedViolations(issues: Issue[]): Array<{
  term: string;
  count: number;
  keys: string[];
}> {
  const counter = new Map<string, Set<string>>();

  for (const issue of issues) {
    if (issue.layer !== 2 && issue.layer !== 3) continue;
    // message에서 용어 추출: 용어 불일치: "Workspace" → ...
    const m = issue.message.match(/"([^"]+)"/);
    if (!m) continue;
    const term = m[1];
    const set = counter.get(term) ?? new Set<string>();
    set.add(issue.key);
    counter.set(term, set);
  }

  return [...counter.entries()]
    .map(([term, keys]) => ({ term, count: keys.size, keys: [...keys] }))
    .filter((x) => x.count >= MIN_OCCURRENCES)
    .sort((a, b) => b.count - a.count);
}

export const PROPOSAL_PATH = PROPOSAL_FILE;
