/**
 * 상태 통계 (npm run stats)
 *
 * 에이전트 spawn 훅에서 호출해 환경이 제대로 준비됐는지 한 줄로 보고합니다.
 * grep 근사치를 쓰면 실제 파서 결과와 어긋나므로 loadGlossary()를 그대로 씁니다.
 *
 * 예전 훅은 존재하지 않는 경로를 cat 해서 "0 terms loaded"를 출력하고 있었고,
 * 그 상태로 에이전트가 용어집 없이 리뷰를 수행했습니다.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadGlossary } from '../src/retrieval/glossary-loader.js';
import { loadConfirmed, loadRejected, loadRounds } from '../src/retrieval/feedback-store.js';
import { loadProposals } from '../src/validation/glossary-growth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function main(): void {
  const parts: string[] = [];

  // 용어집
  try {
    const g = loadGlossary();
    parts.push(`glossary ${g.entries.length} terms + ${g.productNames.length} product names`);
  } catch {
    parts.push('glossary MISSING (requirements/domain-glossary.md)');
  }

  // locale
  const localesDir = path.join(ROOT, 'src', 'locales');
  const locales = fs.existsSync(localesDir)
    ? fs.readdirSync(localesDir).filter((f) => f.endsWith('.json'))
    : [];
  parts.push(`locales ${locales.length}`);

  // 인덱스
  const tm = path.join(ROOT, 'data', 'translation-memory');
  const gi = path.join(ROOT, 'data', 'glossary-index');
  const indexReady = fs.existsSync(tm) && fs.existsSync(gi);
  parts.push(
    indexReady ? 'vectra ready' : 'vectra MISSING (npm run init:vectra && npm run reindex)'
  );

  // 누적 상태
  const rounds = loadRounds();
  const confirmed = Object.keys(loadConfirmed()).length;
  const rejected = Object.values(loadRejected()).reduce((s, v) => s + v.length, 0);
  const pending = Object.values(loadProposals()).filter((p) => p.status === 'proposed').length;

  parts.push(`rounds ${rounds.length}`);
  parts.push(`confirmed ${confirmed}`);
  parts.push(`rejected ${rejected}`);
  parts.push(`pending proposals ${pending}`);

  console.log(parts.join(' | '));
}

main();
