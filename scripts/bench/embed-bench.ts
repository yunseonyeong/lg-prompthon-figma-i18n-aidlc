/**
 * 임베딩 모델 벤치마크 (npm run bench:embed)
 *
 * 여러 임베딩 모델을 동일한 테스트셋으로 평가하여 비교합니다.
 * 지표: Recall@1, Recall@3, MRR, 인덱싱 시간, 쿼리 시간, 모델 크기
 *
 * 사용법:
 *   npm run bench:embed                 # 전체 모델 비교
 *   npm run bench:embed -- --only hash  # 특정 모델만
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TEST_CASES, type TestCase } from './testset.js';
import { textToVector as hashVector, cosineSimilarity } from '../../src/retrieval/embeddings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

// ─────────────────────────────────────────────
// 코퍼스 로드: en.json의 모든 텍스트가 검색 대상
// ─────────────────────────────────────────────
function flattenJson(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      Object.assign(out, flattenJson(v as Record<string, unknown>, key));
    } else if (typeof v === 'string') {
      out[key] = v;
    }
  }
  return out;
}

interface CorpusDoc {
  key: string;
  sourceText: string;
  ko: string;
  /** 임베딩 대상 텍스트 (영문 원문 + 한국어 번역을 함께 넣어 교차언어 검색 지원) */
  embedText: string;
}

function loadCorpus(): CorpusDoc[] {
  const localesDir = path.join(ROOT, 'src', 'locales');
  const en = flattenJson(JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf-8')));
  const ko = flattenJson(JSON.parse(fs.readFileSync(path.join(localesDir, 'ko.json'), 'utf-8')));

  const seen = new Set<string>();
  const docs: CorpusDoc[] = [];
  for (const [key, sourceText] of Object.entries(en)) {
    if (seen.has(sourceText)) continue; // 중복 원문 제거
    seen.add(sourceText);
    docs.push({
      key,
      sourceText,
      ko: ko[key] ?? '',
      embedText: ko[key] ? `${sourceText} / ${ko[key]}` : sourceText,
    });
  }
  return docs;
}

// ─────────────────────────────────────────────
// 임베딩 제공자 인터페이스
// ─────────────────────────────────────────────
interface EmbeddingProvider {
  name: string;
  dim: number | null;
  /** 문서용 임베딩 (E5는 'passage: ' prefix 필요) */
  embedDocs(texts: string[]): Promise<number[][]>;
  /** 쿼리용 임베딩 (E5는 'query: ' prefix 필요) */
  embedQuery(text: string): Promise<number[]>;
}

/** 현행 해시 기반 (베이스라인) */
const hashProvider: EmbeddingProvider = {
  name: 'hash-local (현행)',
  dim: 384,
  async embedDocs(texts) { return texts.map(hashVector); },
  async embedQuery(text) { return hashVector(text); },
};

/** transformers.js ONNX 모델 */
function onnxProvider(
  name: string,
  modelId: string,
  opts: { queryPrefix?: string; docPrefix?: string } = {}
): EmbeddingProvider {
  let extractor: any = null;
  let dim: number | null = null;

  async function init() {
    if (extractor) return;
    const { pipeline, env } = await import('@huggingface/transformers');
    env.allowLocalModels = false;
    extractor = await pipeline('feature-extraction', modelId, { dtype: 'q8' });
  }

  async function embed(texts: string[]): Promise<number[][]> {
    await init();
    const out = await extractor(texts, { pooling: 'mean', normalize: true });
    const arr = out.tolist() as number[][];
    dim = arr[0]?.length ?? null;
    return arr;
  }

  return {
    name,
    get dim() { return dim; },
    async embedDocs(texts) {
      return embed(texts.map((t) => (opts.docPrefix ?? '') + t));
    },
    async embedQuery(text) {
      const r = await embed([(opts.queryPrefix ?? '') + text]);
      return r[0];
    },
  } as EmbeddingProvider;
}

// ─────────────────────────────────────────────
// 평가
// ─────────────────────────────────────────────
interface Result {
  provider: string;
  dim: number | null;
  recall1: number;
  recall3: number;
  mrr: number;
  indexMs: number;
  queryMs: number;
  byCategory: Record<string, { hit1: number; total: number }>;
  failures: Array<{ q: string; expected: string; got: string }>;
}

async function evaluate(provider: EmbeddingProvider, corpus: CorpusDoc[], cases: TestCase[]): Promise<Result> {
  const t0 = Date.now();
  const docVecs = await provider.embedDocs(corpus.map((d) => d.embedText));
  const indexMs = Date.now() - t0;

  let hit1 = 0;
  let hit3 = 0;
  let mrrSum = 0;
  const byCategory: Record<string, { hit1: number; total: number }> = {};
  const failures: Array<{ q: string; expected: string; got: string }> = [];

  const tq = Date.now();
  for (const tc of cases) {
    const qv = await provider.embedQuery(tc.query);
    const scored = corpus
      .map((d, i) => ({ doc: d, score: cosineSimilarity(qv, docVecs[i]) }))
      .sort((a, b) => b.score - a.score);

    const rank = scored.findIndex((s) => s.doc.sourceText === tc.expected);
    byCategory[tc.category] ??= { hit1: 0, total: 0 };
    byCategory[tc.category].total++;

    if (rank === 0) { hit1++; byCategory[tc.category].hit1++; }
    if (rank >= 0 && rank < 3) hit3++;
    if (rank >= 0) mrrSum += 1 / (rank + 1);
    if (rank !== 0) {
      failures.push({ q: tc.query, expected: tc.expected, got: scored[0].doc.sourceText });
    }
  }
  const queryMs = Math.round((Date.now() - tq) / cases.length);

  const n = cases.length;
  return {
    provider: provider.name,
    dim: provider.dim,
    recall1: hit1 / n,
    recall3: hit3 / n,
    mrr: mrrSum / n,
    indexMs,
    queryMs,
    byCategory,
    failures,
  };
}

// ─────────────────────────────────────────────
// 실행
// ─────────────────────────────────────────────
async function main() {
  const onlyArg = process.argv.indexOf('--only');
  const only = onlyArg >= 0 ? process.argv[onlyArg + 1] : null;

  const corpus = loadCorpus();

  // 정답이 코퍼스에 실재하는지 검증 — 없는 정답은 어떤 모델도 맞출 수 없음
  const corpusTexts = new Set(corpus.map((d) => d.sourceText));
  const invalid = TEST_CASES.filter((tc) => !corpusTexts.has(tc.expected));
  if (invalid.length > 0) {
    console.log(`⚠️  코퍼스에 없는 정답 ${invalid.length}건 — 평가에서 제외합니다:`);
    for (const tc of invalid) {
      console.log(`   "${tc.query}" → "${tc.expected}" (en.json에 없음)`);
    }
    console.log();
  }
  const cases = TEST_CASES.filter((tc) => corpusTexts.has(tc.expected));

  console.log(`📚 코퍼스: ${corpus.length}건 (중복 원문 제거 후)`);
  console.log(`🧪 테스트: ${cases.length}건 (전체 ${TEST_CASES.length}건 중 유효)\n`);

  const providers: EmbeddingProvider[] = [
    hashProvider,
    onnxProvider('e5-small (384d)', 'Xenova/multilingual-e5-small', {
      queryPrefix: 'query: ',
      docPrefix: 'passage: ',
    }),
    onnxProvider('paraphrase-MiniLM (384d)', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2'),
    onnxProvider('e5-base (768d)', 'Xenova/multilingual-e5-base', {
      queryPrefix: 'query: ',
      docPrefix: 'passage: ',
    }),
  ];

  const results: Result[] = [];
  for (const p of providers) {
    if (only && !p.name.toLowerCase().includes(only.toLowerCase())) continue;
    process.stdout.write(`⏳ ${p.name} 평가 중...`);
    try {
      const r = await evaluate(p, corpus, cases);
      results.push(r);
      console.log(` 완료 (R@1=${(r.recall1 * 100).toFixed(0)}%)`);
    } catch (e) {
      console.log(` ❌ 실패: ${(e as Error).message.slice(0, 120)}`);
    }
  }

  if (results.length === 0) {
    console.log('\n결과 없음');
    return;
  }

  // 종합 표
  console.log('\n' + '═'.repeat(96));
  console.log('  종합 결과');
  console.log('═'.repeat(96));
  console.log(
    `${'모델'.padEnd(28)} ${'차원'.padEnd(6)} ${'R@1'.padEnd(7)} ${'R@3'.padEnd(7)} ${'MRR'.padEnd(7)} ${'인덱싱'.padEnd(10)} 쿼리`
  );
  console.log('─'.repeat(96));
  for (const r of results) {
    console.log(
      `${r.provider.padEnd(28)} ${String(r.dim ?? '?').padEnd(6)} ` +
      `${(r.recall1 * 100).toFixed(0).padStart(3)}%   ` +
      `${(r.recall3 * 100).toFixed(0).padStart(3)}%   ` +
      `${r.mrr.toFixed(3)}   ` +
      `${(r.indexMs + 'ms').padEnd(10)} ${r.queryMs}ms`
    );
  }

  // 카테고리별
  const cats = ['exact', 'typo', 'synonym', 'paraphrase', 'cross-lingual', 'domain-trap'];
  console.log('\n' + '═'.repeat(96));
  console.log('  카테고리별 Recall@1');
  console.log('═'.repeat(96));
  console.log(`${'모델'.padEnd(28)} ${cats.map((c) => c.slice(0, 9).padEnd(10)).join('')}`);
  console.log('─'.repeat(96));
  for (const r of results) {
    const cells = cats.map((c) => {
      const v = r.byCategory[c];
      return v ? `${v.hit1}/${v.total}`.padEnd(10) : '-'.padEnd(10);
    });
    console.log(`${r.provider.padEnd(28)} ${cells.join('')}`);
  }

  // 실패 사례
  for (const r of results) {
    if (r.failures.length === 0) continue;
    console.log(`\n▼ ${r.provider} 실패 ${r.failures.length}건`);
    for (const f of r.failures.slice(0, 8)) {
      console.log(`   "${f.q}" → 기대: "${f.expected}" / 실제 1위: "${f.got}"`);
    }
    if (r.failures.length > 8) console.log(`   ... 외 ${r.failures.length - 8}건`);
  }

  console.log();
}

main().catch((e) => { console.error(e); process.exit(1); });
