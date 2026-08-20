/**
 * Layer 3 문맥 적합성 EXAONE 역검증 (npm run validate:layer3)
 *
 * validate:i18n 과 분리된 이유는 검증 명세의 요구입니다.
 *   "Layer 1/2/4는 API 없이 동작해야 한다. CI에서 빠르게 돌릴 수 있어야 하고,
 *    API 장애 시에도 기본 검증은 되어야 한다."
 *
 * 사용법:
 *   npm run validate:layer3
 *   npm run validate:layer3 -- --md     # layer3-report.md 생성
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadGlossary } from '../src/retrieval/glossary-loader.js';
import { flattenJson, type LocaleBundle } from '../src/validation/index.js';
import { verifyContextWithExaone, loadFrames, LAYER3_CONFIG } from '../src/validation/layer3-exaone.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'src', 'locales');

function loadBundle(): LocaleBundle {
  const bundle: LocaleBundle = {};
  for (const file of fs.readdirSync(LOCALES_DIR).sort()) {
    if (!file.endsWith('.json')) continue;
    bundle[file.replace(/\.json$/, '')] = flattenJson(
      JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, file), 'utf-8'))
    );
  }
  return bundle;
}

async function main() {
  const writeMd = process.argv.includes('--md');

  console.log('🧠 Layer 3 문맥 적합성 검증 (EXAONE 역검증)\n');

  if (!fs.existsSync(path.join(LOCALES_DIR, 'en.json'))) {
    console.error('❌ src/locales/en.json 이 필요합니다.');
    process.exit(1);
  }

  const bundle = loadBundle();
  const glossary = loadGlossary();
  const frames = loadFrames();

  console.log(`  모델   : ${LAYER3_CONFIG.model}`);
  console.log(`  프레임 : ${frames.length}개`);
  console.log(`  용어집 : ${glossary.entries.length}개\n`);
  console.log('  판정 요청 중... (프레임별 배치)\n');

  const t0 = Date.now();
  const result = await verifyContextWithExaone(bundle, glossary);
  const ms = Date.now() - t0;

  for (const n of result.notes) console.log(`  ⚠️  ${n}`);

  if (!result.called) {
    console.log('\n❌ EXAONE 호출이 수행되지 않았습니다.');
    console.log('   규칙 기반 Layer 3 검사는 npm run validate:i18n 에 포함되어 있습니다.');
    process.exit(1);
  }

  console.log('─'.repeat(90));
  console.log(
    `  호출 ${result.calls}회 / ${result.totalTokens} tokens / ${(ms / 1000).toFixed(1)}s`
  );
  console.log('─'.repeat(90));

  if (result.issues.length === 0) {
    console.log('\n✅ 문맥 부적합 없음');
  } else {
    console.log(`\n⚠️  문맥 부적합 ${result.issues.length}건\n`);
    for (const i of result.issues) {
      console.log(`  [${i.locale}] ${i.key}`);
      console.log(`     ${i.message}`);
      if (i.expected) console.log(`     기대: ${i.expected}`);
      console.log(`     → 담당: ${i.assignee}`);
      console.log();
    }
  }

  console.log('─'.repeat(90));
  console.log('  ℹ️  LLM 판정이라 재실행 시 결과가 달라질 수 있습니다.');
  console.log('     확정(confirmed) 판정에는 반영되지 않습니다. 사람이 검토할 자료입니다.');
  console.log('─'.repeat(90));

  if (writeMd) {
    const lines = [
      '# Layer 3 문맥 적합성 검증 리포트 (EXAONE 역검증)',
      '',
      `생성일시: ${new Date().toISOString()}`,
      `모델: ${LAYER3_CONFIG.model} / 호출 ${result.calls}회 / ${result.totalTokens} tokens`,
      '',
      '> LLM 판정입니다. 재실행 시 결과가 달라질 수 있으며 확정 판정에는 반영되지 않습니다.',
      '',
    ];
    if (result.issues.length === 0) {
      lines.push('문맥 부적합이 발견되지 않았습니다.');
    } else {
      lines.push('| Locale | Key | 현재 | 기대 | 사유 |', '|--------|-----|------|------|------|');
      for (const i of result.issues) {
        const reason = i.message.replace(/^문맥 부적합 \(EXAONE\): /, '').replace(/\|/g, '\\|');
        lines.push(
          `| ${i.locale} | \`${i.key}\` | ${i.actual ?? ''} | ${i.expected ?? '-'} | ${reason} |`
        );
      }
    }
    if (result.notes.length > 0) {
      lines.push('', '## 비고', '', ...result.notes.map((n) => `- ${n}`));
    }
    const out = path.join(ROOT, 'layer3-report.md');
    fs.writeFileSync(out, lines.join('\n'), 'utf-8');
    console.log(`\n📄 ${path.relative(ROOT, out)} 생성`);
  }

  console.log();
}

main().catch((e) => {
  console.error('❌ 실패:', e);
  process.exit(1);
});
