/**
 * 번역 메모리 검색 스크립트 (npm run memory:search)
 *
 * 사용법: npm run memory:search -- "검색할 텍스트" [--locale ko] [--top 5] [--min 0.85]
 *
 * 유사한 번역 이력을 검색하여 참고 번역을 제안합니다.
 * 임베딩: multilingual-e5-small (한국어로 검색해도 영문 원문이 걸림)
 *
 * ⚠️ E5는 코사인 유사도가 0.7~1.0에 몰리는 특성이 있습니다(모델 카드 FAQ).
 *    절대값이 아니라 상대 순위로 판단해야 하며, --min 임계값은 실측 기준을 씁니다.
 */
import { LocalIndex } from 'vectra';
import path from 'path';
import { fileURLToPath } from 'url';
import { embedQuery, activeBackend, describeBackend } from '../src/retrieval/embedder.js';
import { assertCompatible } from '../src/retrieval/index-meta.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(ROOT, 'data', 'translation-memory');

interface TranslationMemoryMeta {
  [key: string]: string;
  key: string;
  sourceText: string;
  locale: string;
  translation: string;
  domain: string;
}

function parseArgs(): { query: string; locale?: string; topK: number; min: number } {
  const args = process.argv.slice(2);
  let query = '';
  let locale: string | undefined;
  let topK = 5;
  let min = 0;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--locale' && args[i + 1]) locale = args[++i];
    else if (args[i] === '--top' && args[i + 1]) topK = parseInt(args[++i], 10);
    else if (args[i] === '--min' && args[i + 1]) min = parseFloat(args[++i]);
    else if (!args[i].startsWith('--')) query = args[i];
  }

  if (!query) {
    console.error('사용법: npm run memory:search -- "검색 텍스트" [--locale ko] [--top 5] [--min 0.85]');
    process.exit(1);
  }
  return { query, locale, topK, min };
}

async function searchMemory() {
  const { query, locale, topK, min } = parseArgs();

  const index = new LocalIndex<TranslationMemoryMeta>(INDEX_PATH);
  if (!(await index.isIndexCreated())) {
    console.error('❌ 번역 메모리 인덱스가 없습니다. 먼저 npm run memory:index를 실행하세요.');
    process.exit(1);
  }

  const vector = await embedQuery(query);
  assertCompatible(INDEX_PATH, activeBackend() ?? 'hash-fallback');

  console.log(`\n🔍 "${query}"  (${describeBackend()})`);
  if (locale) console.log(`   필터: locale=${locale}`);
  if (min > 0) console.log(`   임계값: ${min}`);

  const filter = locale ? { locale: { $eq: locale } } : undefined;
  let results = await index.queryItems(vector, query, topK, filter);
  const beforeCut = results.length;
  if (min > 0) results = results.filter((r) => r.score >= min);

  if (results.length === 0) {
    console.log(`\n  결과 없음${beforeCut > 0 ? ` (임계값 ${min} 미달로 ${beforeCut}건 제외)` : ''}`);
    return;
  }

  console.log('─'.repeat(96));
  for (let i = 0; i < results.length; i++) {
    const { item, score } = results[i];
    const m = item.metadata;
    console.log(
      `${String(i + 1).padStart(2)}. ${score.toFixed(4)}  [${m.locale.padEnd(5)}] ` +
      `"${m.sourceText}" → "${m.translation}"`
    );
    console.log(`    ${m.key}`);
  }
  console.log('─'.repeat(96));
  console.log(`✅ ${results.length}건${beforeCut > results.length ? ` (${beforeCut - results.length}건 임계값 미달 제외)` : ''}\n`);
}

searchMemory().catch((err) => {
  console.error('❌ 검색 실패:', err);
  process.exit(1);
});
