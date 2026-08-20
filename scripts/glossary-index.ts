/**
 * 용어집 인덱싱 스크립트 (npm run glossary:index)
 *
 * requirements/domain-glossary.md 의 용어를 Vectra glossary-index 에 저장합니다.
 * 임베딩: multilingual-e5-small
 *
 * 용도: 신규 텍스트가 등장했을 때 의미가 가까운 기존 용어를 찾아
 * 번역 재사용을 제안하거나, 미등록 용어 후보를 발굴합니다.
 */
import { LocalIndex } from 'vectra';
import path from 'path';
import { fileURLToPath } from 'url';
import { embedDocuments, activeBackend, describeBackend, EMBED_MODEL_ID, EMBED_DIM } from '../src/retrieval/embedder.js';
import { writeIndexMeta } from '../src/retrieval/index-meta.js';
import { loadGlossary } from '../src/retrieval/glossary-loader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(ROOT, 'data', 'glossary-index');

interface GlossaryMeta {
  [key: string]: string;
  term: string;
  locale: string;
  translation: string;
  context: string;
  category: string;
}

async function indexGlossary() {
  console.log('📖 용어집 인덱싱 시작...\n');

  const { entries } = loadGlossary();
  const locales: Array<{ code: string; field: 'ko' | 'ja' | 'zhCN' }> = [
    { code: 'ko', field: 'ko' },
    { code: 'ja', field: 'ja' },
    { code: 'zh-CN', field: 'zhCN' },
  ];

  const pending: Array<{ id: string; text: string; metadata: GlossaryMeta }> = [];
  for (const entry of entries) {
    for (const { code, field } of locales) {
      const translation = entry[field];
      if (!translation) continue;

      pending.push({
        id: `${entry.english}::${code}`,
        // 영어 용어 + 문맥 설명 + 번역어를 함께 임베딩
        text: `${entry.english} / ${translation} / ${entry.context}`,
        metadata: {
          term: entry.english,
          locale: code,
          translation,
          context: entry.context,
          category: entry.category,
        },
      });
    }
  }

  console.log(`  🔢 대상 ${pending.length}건 임베딩 중...`);
  const t0 = Date.now();
  const vectors = await embedDocuments(pending.map((p) => p.text));
  console.log(`  ✅ 임베딩 완료 (${((Date.now() - t0) / 1000).toFixed(1)}s, ${describeBackend()})`);

  const index = new LocalIndex<GlossaryMeta>(INDEX_PATH);
  if (await index.isIndexCreated()) {
    await index.deleteIndex();
  }
  await index.createIndex({
    version: 1,
    metadata_config: { indexed: ['term', 'locale', 'context', 'category'] },
  });

  await index.beginUpdate();
  for (let i = 0; i < pending.length; i++) {
    await index.upsertItem({
      id: pending[i].id,
      vector: vectors[i],
      metadata: pending[i].metadata,
    });
  }
  await index.endUpdate();

  const backend = activeBackend();
  writeIndexMeta(INDEX_PATH, {
    backend: backend ?? 'hash-fallback',
    model: backend === 'e5-small' ? EMBED_MODEL_ID : 'hash-local',
    dim: vectors[0]?.length ?? EMBED_DIM,
    items: pending.length,
    indexedAt: new Date().toISOString(),
  });

  const stats = await index.getIndexStats();
  console.log(`  ✅ 용어 ${entries.length}개 × ${locales.length}개 언어 = ${pending.length}건`);
  console.log(`  📊 인덱스 총 항목: ${stats.items}\n`);
  console.log('🎉 용어집 인덱싱 완료!');
}

indexGlossary().catch((err) => {
  console.error('❌ 인덱싱 실패:', err);
  process.exit(1);
});
