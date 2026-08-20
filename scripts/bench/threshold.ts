/**
 * 유사도 임계값 실증 (npm run bench:threshold)
 *
 * RAG에서 유사 사례를 few-shot으로 주입할 때, 관련 없는 항목이 섞이면
 * 번역 품질이 오히려 떨어집니다. 임계값을 정하려면
 * "정답의 점수 분포"와 "오답의 점수 분포"가 어디서 갈리는지 봐야 합니다.
 *
 * 출력: 임계값별 precision / recall / 통과 건수
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TEST_CASES } from './testset.js';
import { embedDocuments, embedQuery, describeBackend } from '../../src/retrieval/embedder.js';
import { cosineSimilarity } from '../../src/retrieval/embeddings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

function flattenJson(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      Object.assign(out, flattenJson(v as Record<string, unknown>, key));
    } else if (typeof v === 'string') out[key] = v;
  }
  return out;
}

async function main() {
  const localesDir = path.join(ROOT, 'src', 'locales');
  const en = flattenJson(JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf-8')));
  const ko = flattenJson(JSON.parse(fs.readFileSync(path.join(localesDir, 'ko.json'), 'utf-8')));

  const seen = new Set<string>();
  const corpus: Array<{ sourceText: string; embedText: string }> = [];
  for (const [key, sourceText] of Object.entries(en)) {
    if (seen.has(sourceText)) continue;
    seen.add(sourceText);
    corpus.push({
      sourceText,
      embedText: ko[key] ? `${sourceText} / ${ko[key]}` : sourceText,
    });
  }

  const corpusTexts = new Set(corpus.map((c) => c.sourceText));
  const cases = TEST_CASES.filter((tc) => corpusTexts.has(tc.expected));

  const docVecs = await embedDocuments(corpus.map((c) => c.embedText));
  console.log(`\n임베딩: ${describeBackend()}`);
  console.log(`코퍼스 ${corpus.length}건 / 테스트 ${cases.length}건\n`);

  // 각 쿼리의 1위 점수를 정답/오답으로 나눠 수집
  const correctScores: number[] = [];
  const wrongScores: number[] = [];

  for (const tc of cases) {
    const qv = await embedQuery(tc.query);
    const ranked = corpus
      .map((c, i) => ({ text: c.sourceText, score: cosineSimilarity(qv, docVecs[i]) }))
      .sort((a, b) => b.score - a.score);

    const top = ranked[0];
    if (top.text === tc.expected) correctScores.push(top.score);
    else wrongScores.push(top.score);
  }

  const stat = (xs: number[]) => {
    if (xs.length === 0) return 'n/a';
    const s = [...xs].sort((a, b) => a - b);
    return `min ${s[0].toFixed(4)} / 중앙 ${s[Math.floor(s.length / 2)].toFixed(4)} / max ${s[s.length - 1].toFixed(4)}`;
  };

  console.log('▶ 1위가 정답인 경우의 점수 분포');
  console.log(`   ${stat(correctScores)}  (${correctScores.length}건)`);
  console.log('▶ 1위가 오답인 경우의 점수 분포');
  console.log(`   ${stat(wrongScores)}  (${wrongScores.length}건)\n`);

  console.log('─'.repeat(72));
  console.log(`${'임계값'.padEnd(10)} ${'정답통과'.padEnd(10)} ${'오답통과'.padEnd(10)} ${'precision'.padEnd(11)} recall`);
  console.log('─'.repeat(72));

  for (const th of [0.0, 0.70, 0.75, 0.80, 0.82, 0.84, 0.85, 0.86, 0.88, 0.90]) {
    const tp = correctScores.filter((s) => s >= th).length;
    const fp = wrongScores.filter((s) => s >= th).length;
    const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
    const recall = correctScores.length === 0 ? 0 : tp / correctScores.length;
    console.log(
      `${th.toFixed(2).padEnd(10)} ${String(tp).padEnd(10)} ${String(fp).padEnd(10)} ` +
      `${(precision * 100).toFixed(1).padStart(5)}%      ${(recall * 100).toFixed(1).padStart(5)}%`
    );
  }
  console.log('─'.repeat(72));
  console.log('\nprecision = 통과한 것 중 정답 비율 (few-shot 주입 시 노이즈가 적은가)');
  console.log('recall    = 정답 중 통과한 비율 (쓸만한 사례를 놓치지 않는가)\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
