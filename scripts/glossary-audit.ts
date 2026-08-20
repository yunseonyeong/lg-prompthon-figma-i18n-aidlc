/**
 * 용어집 위반 검사 (npm run glossary:audit)
 *
 * Layer 2(용어집)에 집중한 리포트입니다.
 * 검증 규칙은 src/validation/layers.ts 를 공유합니다.
 * (예전에는 자체 구현을 두어 validate:i18n 과 결과가 어긋났습니다)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadGlossary } from '../src/retrieval/glossary-loader.js';
import { flattenJson, checkLayer2, type Issue, type LocaleBundle } from '../src/validation/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'src', 'locales');

function loadBundle(dir: string): LocaleBundle {
  const bundle: LocaleBundle = {};
  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith('.json')) continue;
    bundle[file.replace(/\.json$/, '')] = flattenJson(
      JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'))
    );
  }
  return bundle;
}

function print(title: string, issues: Issue[]): void {
  if (issues.length === 0) return;
  console.log(`\n${title} (${issues.length}건):`);
  for (const v of issues) {
    console.log(`  [${v.locale}] ${v.key}`);
    console.log(`    규칙: ${v.rule ?? '-'}`);
    if (v.expected) console.log(`    기대: ${v.expected}`);
    if (v.actual) console.log(`    실제: ${v.actual}`);
    console.log();
  }
}

function main(): void {
  console.log('📖 용어집 위반 검사 시작...\n');

  const glossary = loadGlossary();
  const bundle = loadBundle(LOCALES_DIR);

  if (!bundle['en']) {
    console.error('❌ en.json 이 필요합니다.');
    process.exit(1);
  }

  const issues = checkLayer2(bundle, glossary);
  const fails = issues.filter((i) => i.severity === 'FAIL');
  const warns = issues.filter((i) => i.severity === 'WARN');

  console.log('─'.repeat(90));
  console.log(`용어집 항목: ${glossary.entries.length}개 | 제품명: ${glossary.productNames.length}개`);
  console.log(`번역 제외 패턴: ${glossary.excludePatterns.length}개 (Layer 4 담당 — 이 검사에서 제외)`);
  console.log('─'.repeat(90));

  if (issues.length === 0) {
    console.log('\n✅ 위반 없음! 모든 항목이 용어집과 일치합니다.');
  } else {
    print('❌ FAIL', fails);
    print('⚠️  WARN', warns);
  }

  console.log('─'.repeat(90));
  console.log(`\n📊 결과: FAIL=${fails.length}, WARN=${warns.length}, TOTAL=${issues.length}`);

  if (fails.length > 0) {
    console.log('\n❌ 용어집 검사 FAIL — 수정이 필요합니다.');
    process.exit(1);
  } else if (warns.length > 0) {
    console.log('\n⚠️  용어집 검사 WARN — 검토가 필요합니다.');
  } else {
    console.log('\n✅ 용어집 검사 PASS');
  }
}

main();
