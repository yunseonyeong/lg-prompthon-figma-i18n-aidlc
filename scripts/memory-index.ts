/**
 * 번역 메모리 인덱싱 스크립트 (npm run memory:index)
 *
 * src/locales/*.json 의 번역 항목을 Vectra translation-memory 인덱스에 저장합니다.
 * 임베딩: multilingual-e5-small (교차언어 검색 지원)
 *
 * 임베딩 텍스트에 영문 원문과 번역문을 함께 넣어, 한국어로 검색해도
 * 해당 항목이 걸리도록 합니다.
 */
import { LocalIndex } from 'vectra';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { embedDocuments, activeBackend, describeBackend, EMBED_MODEL_ID, EMBED_DIM } from '../src/retrieval/embedder.js';
import { writeIndexMeta } from '../src/retrieval/index-meta.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'src', 'locales');
const INDEX_PATH = path.join(ROOT, 'data', 'translation-memory');

interface TranslationMemoryMeta {
  [key: string]: string;
  key: string;
  sourceText: string;
  locale: string;
  translation: string;
  domain: string;
}

function flattenJson(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      Object.assign(result, flattenJson(v as Record<string, unknown>, fullKey));
    } else if (typeof v === 'string') {
      result[fullKey] = v;
    }
  }
  return result;
}

function extractDomain(key: string): string {
  const parts = key.split('.');
  return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : parts[0];
}

async function indexMemory() {
  console.log('📝 번역 메모리 인덱싱 시작...\n');

  const enPath = path.join(LOCALES_DIR, 'en.json');
  if (!fs.existsSync(enPath)) {
    console.error('❌ src/locales/en.json 파일이 없습니다.');
    process.exit(1);
  }

  const enFlat = flattenJson(JSON.parse(fs.readFileSync(enPath, 'utf-8')));

  const locales = ['ko', 'ja', 'zh-CN'];
  const localeData: Record<string, Record<string, string>> = {};
  for (const locale of locales) {
    const p = path.join(LOCALES_DIR, `${locale}.json`);
    if (fs.existsSync(p)) {
      localeData[locale] = flattenJson(JSON.parse(fs.readFileSync(p, 'utf-8')));
    }
  }

  // 인덱싱 대상 구성
  const pending: Array<{ id: string; text: string; metadata: TranslationMemoryMeta }> = [];
  for (const [key, sourceText] of Object.entries(enFlat)) {
    const domain = extractDomain(key);
    for (const locale of locales) {
      const translation = localeData[locale]?.[key];
      if (!translation) continue;

      pending.push({
        id: `${key}::${locale}`,
        // 원문 + 번역을 함께 임베딩 → 교차언어 검색 가능
        text: `${sourceText} / ${translation}`,
        metadata: { key, sourceText, locale, translation, domain },
      });
    }
  }

  console.log(`  🔢 대상 ${pending.length}건 임베딩 중... (최초 실행 시 모델 다운로드)`);
  const t0 = Date.now();
  const vectors = await embedDocuments(pending.map((p) => p.text));
  console.log(`  ✅ 임베딩 완료 (${((Date.now() - t0) / 1000).toFixed(1)}s, ${describeBackend()})`);

  // 인덱스 재생성 (기존 벡터와 혼용 방지를 위해 통째로 다시 만듦)
  const index = new LocalIndex<TranslationMemoryMeta>(INDEX_PATH);
  if (await index.isIndexCreated()) {
    await index.deleteIndex();
  }
  await index.createIndex({
    version: 1,
    metadata_config: { indexed: ['locale', 'domain', 'key', 'sourceText'] },
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
  console.log(`  📊 인덱스 총 항목: ${stats.items}\n`);
  console.log('🎉 번역 메모리 인덱싱 완료!');
}

indexMemory().catch((err) => {
  console.error('❌ 인덱싱 실패:', err);
  process.exit(1);
});
