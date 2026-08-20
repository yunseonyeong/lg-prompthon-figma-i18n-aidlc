/**
 * i18n 4계층 검증 (npm run validate:i18n)
 *
 * 무상태 검증입니다. 축적된 피드백을 쓰지 않고 현재 locale만 봅니다.
 * 누적 루프(회귀/재발 차단, 확정 관리)가 필요하면 npm run round:check 를 쓰세요.
 *
 * 검증 규칙은 src/validation/layers.ts 를 공유합니다.
 * (규칙이 두 곳에 중복되면 반드시 어긋납니다)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadGlossary } from '../src/retrieval/glossary-loader.js';
import {
  flattenJson,
  runAllLayers,
  LAYER_NAMES,
  type Issue,
  type Layer,
  type LocaleBundle,
} from '../src/validation/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'src', 'locales');

function loadBundle(dir: string): LocaleBundle {
  const bundle: LocaleBundle = {};
  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith('.json')) continue;
    const locale = file.replace(/\.json$/, '');
    bundle[locale] = flattenJson(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8')));
  }
  return bundle;
}

function main(): void {
  console.log('🔍 i18n 4계층 검증 시작...\n');

  if (!fs.existsSync(path.join(LOCALES_DIR, 'en.json'))) {
    console.error('❌ src/locales/en.json 이 필요합니다.');
    process.exit(1);
  }

  const bundle = loadBundle(LOCALES_DIR);
  const glossary = loadGlossary();
  const issues = runAllLayers(bundle, glossary);

  const byLayer = new Map<Layer, Issue[]>();
  for (const i of issues) {
    const list = byLayer.get(i.layer) ?? [];
    list.push(i);
    byLayer.set(i.layer, list);
  }

  console.log('═'.repeat(90));
  console.log('  i18n 4계층 검증 결과');
  console.log('═'.repeat(90));

  for (const layer of [1, 2, 3, 4] as Layer[]) {
    const li = byLayer.get(layer) ?? [];
    const f = li.filter((i) => i.severity === 'FAIL').length;
    const w = li.filter((i) => i.severity === 'WARN').length;
    const info = li.filter((i) => i.severity === 'INFO').length;
    const status = f > 0 ? '❌ FAIL' : w > 0 ? '⚠️  WARN' : '✅ PASS';
    console.log(`\n${status} | ${LAYER_NAMES[layer]} (FAIL=${f}, WARN=${w}, INFO=${info})`);

    for (const issue of li.slice(0, 10)) {
      const icon = issue.severity === 'FAIL' ? '❌' : issue.severity === 'WARN' ? '⚠️ ' : 'ℹ️ ';
      console.log(`  ${icon} [${issue.locale}] ${issue.key}`);
      console.log(`     ${issue.message}`);
      console.log(`     → 담당: ${issue.assignee}`);
    }
    if (li.length > 10) console.log(`  ... 외 ${li.length - 10}건`);
  }

  const totalFail = issues.filter((i) => i.severity === 'FAIL').length;
  const totalWarn = issues.filter((i) => i.severity === 'WARN').length;
  const totalInfo = issues.filter((i) => i.severity === 'INFO').length;

  console.log('\n' + '═'.repeat(90));
  console.log(`  총계: FAIL=${totalFail}, WARN=${totalWarn}, INFO=${totalInfo}`);
  console.log('═'.repeat(90));

  // 리포트 생성
  const lines: string[] = [
    '# i18n 검증 리포트',
    '',
    `생성일시: ${new Date().toISOString()}`,
    '',
    '## 요약',
    '',
    '| 계층 | FAIL | WARN | INFO | 상태 |',
    '|------|------|------|------|------|',
  ];
  for (const layer of [1, 2, 3, 4] as Layer[]) {
    const li = byLayer.get(layer) ?? [];
    const f = li.filter((i) => i.severity === 'FAIL').length;
    const w = li.filter((i) => i.severity === 'WARN').length;
    const info = li.filter((i) => i.severity === 'INFO').length;
    lines.push(`| ${LAYER_NAMES[layer]} | ${f} | ${w} | ${info} | ${f > 0 ? 'FAIL' : w > 0 ? 'WARN' : 'PASS'} |`);
  }
  lines.push('', '## 상세', '');
  for (const issue of issues) {
    lines.push(`- **[${issue.severity}]** ${LAYER_NAMES[issue.layer]} | [${issue.locale}] \`${issue.key}\``);
    lines.push(`  - ${issue.message}`);
    lines.push(`  - 담당: ${issue.assignee}${issue.rule ? ` / 규칙: ${issue.rule}` : ''}`);
  }
  fs.writeFileSync(path.join(ROOT, 'i18n-report.md'), lines.join('\n'), 'utf-8');
  console.log(`\n📄 리포트 저장: i18n-report.md`);

  // Layer 4 → Dev-A 반송
  const layer4 = issues.filter((i) => i.layer === 4);
  if (layer4.length > 0) {
    const en = bundle['en'] ?? {};
    const seen = new Set<string>();
    const ex: string[] = [
      '# 추출 필터 수정 요청 (Dev-A 반송)',
      '',
      `생성일시: ${new Date().toISOString()}`,
      '',
      '> 아래 항목은 번역 대상이 아닙니다. 추출 필터에서 제외해 주세요.',
      '> 번역을 고쳐서 해결하면 안 됩니다 (검증 명세 Layer 4).',
      '',
      '| Key | EN 원문 | 사유 |',
      '|-----|---------|------|',
    ];
    for (const i of layer4) {
      if (seen.has(i.key)) continue;
      seen.add(i.key);
      ex.push(`| \`${i.key}\` | ${en[i.key] ?? ''} | 번역 제외 대상 (glossary §9) |`);
    }
    fs.writeFileSync(path.join(ROOT, 'extraction-issues.md'), ex.join('\n'), 'utf-8');
    console.log('📄 추출 이슈 저장: extraction-issues.md');
  }

  if (totalFail > 0) {
    console.log('\n❌ 검증 FAIL — 수정 후 재실행하세요.');
    process.exit(1);
  } else if (totalWarn > 0) {
    console.log('\n⚠️  검증 WARN — 검토가 필요합니다.');
  } else {
    console.log('\n✅ 검증 PASS');
  }
}

main();
