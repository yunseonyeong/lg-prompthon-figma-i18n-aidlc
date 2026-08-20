/**
 * Vectra 인덱스 초기화 스크립트
 * data/translation-memory/ 와 data/glossary-index/ 를 생성합니다.
 */
import { LocalIndex } from 'vectra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const INDEXES = [
  {
    name: 'translation-memory',
    path: path.join(ROOT, 'data', 'translation-memory'),
    metadata_indexed: ['locale', 'domain', 'key', 'sourceText'],
  },
  {
    name: 'glossary-index',
    path: path.join(ROOT, 'data', 'glossary-index'),
    metadata_indexed: ['term', 'locale', 'context', 'category'],
  },
];

async function initIndexes() {
  console.log('🔧 Vectra 인덱스 초기화 시작...\n');

  for (const idx of INDEXES) {
    const index = new LocalIndex(idx.path);
    const exists = await index.isIndexCreated();

    if (exists) {
      console.log(`  ✅ ${idx.name} — 이미 존재 (${idx.path})`);
    } else {
      await index.createIndex({
        version: 1,
        metadata_config: { indexed: idx.metadata_indexed },
      });
      console.log(`  ✅ ${idx.name} — 생성 완료 (${idx.path})`);
    }

    const stats = await index.getIndexStats();
    console.log(`     items: ${stats.items}, version: ${stats.version}\n`);
  }

  console.log('🎉 Vectra 인덱스 초기화 완료!');
}

initIndexes().catch((err) => {
  console.error('❌ 초기화 실패:', err);
  process.exit(1);
});
