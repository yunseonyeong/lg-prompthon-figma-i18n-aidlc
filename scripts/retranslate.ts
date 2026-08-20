/**
 * 피드백 반영 재번역 (npm run retranslate)
 *
 * FAIL 항목을 EXAONE으로 재번역하고 재검증합니다. 최대 3회 시도 후에도
 * 통과하지 못하면 에스컬레이션합니다 (US-2.4).
 *
 * ⚠️ src/locales 를 수정하지 않습니다. Dev-A의 산출물이기 때문입니다.
 *    통과한 번역만 retranslation-patch.json 으로 내보내고 적용은 Dev-A가 합니다.
 *
 * 사용법:
 *   npm run retranslate                # 재번역 + 패치 생성
 *   npm run retranslate -- --dry-run   # 파일 생성 없이 결과만
 *   npm run retranslate -- --max 1     # 시도 횟수 제한
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadGlossary } from '../src/retrieval/glossary-loader.js';
import { loadRejected } from '../src/retrieval/feedback-store.js';
import { flattenJson, type LocaleBundle } from '../src/validation/index.js';
import { findEscalations, escalatedIds, MAX_RETRIES } from '../src/validation/escalation.js';
import {
  retranslate,
  renderPatchJson,
  RETRANSLATE_CONFIG,
} from '../src/validation/retranslate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'src', 'locales');

function loadBundle(): LocaleBundle {
  const b: LocaleBundle = {};
  for (const f of fs.readdirSync(LOCALES_DIR).sort()) {
    if (!f.endsWith('.json')) continue;
    b[f.replace(/\.json$/, '')] = flattenJson(
      JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, f), 'utf-8'))
    );
  }
  return b;
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const maxIdx = argv.indexOf('--max');
  const maxAttempts = maxIdx >= 0 ? parseInt(argv[maxIdx + 1], 10) : MAX_RETRIES;

  console.log('🔁 피드백 반영 재번역 (US-2.4)\n');

  if (!fs.existsSync(path.join(LOCALES_DIR, 'en.json'))) {
    console.error('❌ src/locales/en.json 이 필요합니다.');
    process.exit(1);
  }

  const bundle = loadBundle();
  const glossary = loadGlossary();
  const rejected = loadRejected();
  const escalations = findEscalations(bundle, rejected);
  const excluded = escalatedIds(escalations);

  console.log(`  모델          : ${RETRANSLATE_CONFIG.model}`);
  console.log(`  최대 시도     : ${maxAttempts}회`);
  console.log(`  거부 이력     : ${Object.keys(rejected).length}건`);
  console.log(`  에스컬레이션  : ${escalations.length}건 (재번역 제외)`);
  console.log();

  const t0 = Date.now();
  const result = await retranslate(bundle, glossary, rejected, excluded, { maxAttempts });
  const ms = Date.now() - t0;

  for (const n of result.notes) console.log(`  · ${n}`);

  if (!result.called && result.patch.length === 0) {
    console.log('\n⚠️  재번역이 수행되지 않았습니다.');
    if (result.notes.some((n) => n.includes('API_KEY'))) process.exit(1);
    process.exit(0);
  }

  console.log('\n' + '─'.repeat(92));
  console.log(
    `  시도 ${result.attempts}회 / 호출 ${result.calls}회 / ${result.totalTokens} tokens / ${(ms / 1000).toFixed(1)}s`
  );
  console.log('─'.repeat(92));

  if (result.patch.length > 0) {
    console.log(`\n✅ 재검증 통과 ${result.patch.length}건\n`);
    for (const p of result.patch.slice(0, 15)) {
      console.log(`  [${p.locale}] ${p.key}  (시도 ${p.attempt})`);
      console.log(`     "${p.before}" → "${p.after}"`);
    }
    if (result.patch.length > 15) console.log(`  ... 외 ${result.patch.length - 15}건`);
  } else {
    console.log('\n  통과한 재번역이 없습니다.');
  }

  if (result.unresolved.length > 0) {
    console.log(`\n⚠️  ${result.attempts}회 시도 후에도 미해결 ${result.unresolved.length}건\n`);
    for (const u of result.unresolved.slice(0, 10)) {
      console.log(`  [${u.locale}] ${u.key}`);
      console.log(`     원문 "${u.sourceText}" / 마지막 시도 "${u.lastTried}"`);
      if (u.remainingIssues[0]) console.log(`     ${u.remainingIssues[0].slice(0, 120)}`);
    }
    if (result.unresolved.length > 10) {
      console.log(`  ... 외 ${result.unresolved.length - 10}건`);
    }
    console.log(`\n  → 다음 라운드에서 ${MAX_RETRIES}회 도달 시 에스컬레이션됩니다.`);
  }

  if (!dryRun && result.patch.length > 0) {
    const out = path.join(ROOT, 'retranslation-patch.json');
    fs.writeFileSync(out, renderPatchJson(result), 'utf-8');
    console.log(`\n📄 ${path.relative(ROOT, out)} 생성`);
    console.log('   Dev-A가 적용합니다. src/locales 는 수정하지 않았습니다.');
  } else if (dryRun) {
    console.log('\n(dry-run: 파일 생성 안 함)');
  }

  console.log();
}

main().catch((e) => {
  console.error('❌ 실패:', e);
  process.exit(1);
});
