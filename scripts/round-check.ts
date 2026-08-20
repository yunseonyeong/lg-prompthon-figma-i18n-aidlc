/**
 * 라운드 검증 실행기 (npm run round:check)
 *
 * 사전 차단 → 4계층 검증 → 판정 기록 → 지표 append 를 한 번에 수행합니다.
 * 검증이 진행될수록 확정 항목이 쌓여 다음 라운드의 검증 대상이 줄어듭니다.
 *
 * 사용법:
 *   npm run round:check                        # 기본 (src/locales)
 *   npm run round:check -- --locales <dir>     # 다른 디렉토리로 검증
 *   npm run round:check -- --dry-run           # 저장하지 않고 결과만
 *   npm run round:check -- --reset             # 누적 상태 초기화 후 R1부터
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { flattenJson, LAYER_NAMES, runRound, type Issue, type Layer, type LocaleBundle } from '../src/validation/index.js';
import { FEEDBACK_PATHS, loadRounds } from '../src/retrieval/feedback-store.js';
import { PROPOSAL_PATH } from '../src/validation/glossary-growth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

interface Args {
  localesDir: string;
  dryRun: boolean;
  reset: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let localesDir = path.join(ROOT, 'src', 'locales');
  let dryRun = false;
  let reset = false;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--locales' && argv[i + 1]) localesDir = path.resolve(argv[++i]);
    else if (argv[i] === '--dry-run') dryRun = true;
    else if (argv[i] === '--reset') reset = true;
  }
  return { localesDir, dryRun, reset };
}

function loadBundle(dir: string): LocaleBundle {
  if (!fs.existsSync(dir)) {
    console.error(`❌ locale 디렉토리가 없습니다: ${dir}`);
    process.exit(1);
  }
  const bundle: LocaleBundle = {};
  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith('.json')) continue;
    const locale = file.replace(/\.json$/, '');
    bundle[locale] = flattenJson(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8')));
  }
  if (!bundle['en']) {
    console.error('❌ en.json 이 필요합니다.');
    process.exit(1);
  }
  return bundle;
}

function resetState(): void {
  for (const p of [
    FEEDBACK_PATHS.confirmed,
    FEEDBACK_PATHS.rejected,
    FEEDBACK_PATHS.exclusions,
    FEEDBACK_PATHS.rounds,
    PROPOSAL_PATH,
  ]) {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  console.log('🧹 누적 상태를 초기화했습니다.\n');
}

function groupByLayer(issues: Issue[]): Map<Layer, Issue[]> {
  const m = new Map<Layer, Issue[]>();
  for (const i of issues) {
    const list = m.get(i.layer) ?? [];
    list.push(i);
    m.set(i.layer, list);
  }
  return m;
}

function writeReports(round: number, issues: Issue[], bundle: LocaleBundle): void {
  // 전체 리포트
  const byLayer = groupByLayer(issues);
  const lines: string[] = [
    `# i18n 검증 리포트 (Round ${round})`,
    '',
    `생성일시: ${new Date().toISOString()}`,
    '',
    '## 계층별 요약',
    '',
    '| 계층 | FAIL | WARN | INFO | 상태 |',
    '|------|------|------|------|------|',
  ];

  for (const layer of [0, 1, 2, 3, 4] as Layer[]) {
    const li = byLayer.get(layer) ?? [];
    const f = li.filter((i) => i.severity === 'FAIL').length;
    const w = li.filter((i) => i.severity === 'WARN').length;
    const info = li.filter((i) => i.severity === 'INFO').length;
    const st = f > 0 ? 'FAIL' : w > 0 ? 'WARN' : 'PASS';
    lines.push(`| ${LAYER_NAMES[layer]} | ${f} | ${w} | ${info} | ${st} |`);
  }

  lines.push('', '## 상세', '');
  for (const layer of [0, 1, 2, 3, 4] as Layer[]) {
    const li = byLayer.get(layer) ?? [];
    if (li.length === 0) continue;
    lines.push(`### ${LAYER_NAMES[layer]}`, '');
    for (const i of li) {
      lines.push(`- **[${i.severity}]** [${i.locale}] \`${i.key}\``);
      lines.push(`  - ${i.message}`);
      lines.push(`  - 담당: ${i.assignee}${i.rule ? ` / 규칙: ${i.rule}` : ''}`);
    }
    lines.push('');
  }

  fs.writeFileSync(path.join(ROOT, 'i18n-report.md'), lines.join('\n'), 'utf-8');

  // Layer 4 + 사전차단 제외미수정 → Dev-A 반송
  const extraction = issues.filter(
    (i) => i.layer === 4 || i.blockKind === 'unfixed-exclusion'
  );
  if (extraction.length > 0) {
    const en = bundle['en'] ?? {};
    const seen = new Set<string>();
    const ex: string[] = [
      `# 추출 필터 수정 요청 (Dev-A 반송) — Round ${round}`,
      '',
      `생성일시: ${new Date().toISOString()}`,
      '',
      '> 아래 항목은 번역 대상이 아닙니다. 추출 필터에서 제외해 주세요.',
      '> 번역을 고쳐서 해결하면 안 됩니다 (검증 명세 Layer 4).',
      '',
      '| Key | EN 원문 | 상태 |',
      '|-----|---------|------|',
    ];
    for (const i of extraction) {
      if (seen.has(i.key)) continue;
      seen.add(i.key);
      const status = i.blockKind === 'unfixed-exclusion' ? '⚠️ 이전 라운드 반송, 미수정' : '신규';
      ex.push(`| \`${i.key}\` | ${en[i.key] ?? ''} | ${status} |`);
    }
    fs.writeFileSync(path.join(ROOT, 'extraction-issues.md'), ex.join('\n'), 'utf-8');
  }
}

function main(): void {
  const args = parseArgs();
  if (args.reset) resetState();

  const bundle = loadBundle(args.localesDir);
  const prevRounds = loadRounds();

  console.log('═'.repeat(88));
  console.log(`  라운드 검증 시작${args.dryRun ? ' (dry-run)' : ''}`);
  console.log('═'.repeat(88));
  console.log(`locale 경로 : ${path.relative(ROOT, args.localesDir) || '.'}`);
  console.log(`이전 라운드 : ${prevRounds.length}회`);

  const result = runRound(bundle, { dryRun: args.dryRun });
  const m = result.metrics;
  const byLayer = groupByLayer(result.issues);

  console.log(`\n▶ Round ${result.round}\n`);

  // 계층별 결과
  for (const layer of [0, 1, 2, 3, 4] as Layer[]) {
    const li = byLayer.get(layer) ?? [];
    const f = li.filter((i) => i.severity === 'FAIL').length;
    const w = li.filter((i) => i.severity === 'WARN').length;
    const info = li.filter((i) => i.severity === 'INFO').length;
    const icon = f > 0 ? '❌' : w > 0 ? '⚠️ ' : '✅';
    console.log(`${icon} ${LAYER_NAMES[layer]}  FAIL=${f} WARN=${w} INFO=${info}`);

    for (const i of li.slice(0, 5)) {
      const sev = i.severity === 'FAIL' ? '❌' : i.severity === 'WARN' ? '⚠️ ' : 'ℹ️ ';
      console.log(`     ${sev} [${i.locale}] ${i.key}`);
      console.log(`        ${i.message}`);
      console.log(`        → ${i.assignee}`);
    }
    if (li.length > 5) console.log(`     ... 외 ${li.length - 5}건`);
  }

  // 지표
  console.log('\n' + '─'.repeat(88));
  console.log('  라운드 지표');
  console.log('─'.repeat(88));
  console.log(`  검증 수행     : ${m.checked}건`);
  console.log(`  확정 건너뜀   : ${m.skipped}건`);
  console.log(`  FAIL / WARN   : ${m.fail} / ${m.warn}`);
  console.log(`  회귀          : ${m.regressions}건`);
  console.log(`  재발          : ${m.recurrences}건`);
  console.log(`  확정 누적     : ${m.confirmedTotal}건 (이번 라운드 신규 ${result.newlyConfirmed}건)`);
  console.log(`  용어집        : ${m.glossaryTerms}개`);

  if (result.repeatedViolations.length > 0) {
    console.log('\n▶ 반복 위반 용어 (용어집 보강 대상)');
    for (const rv of result.repeatedViolations.slice(0, 8)) {
      console.log(`  "${rv.term}" — ${rv.count}개 key에서 위반`);
    }
  }

  if (!args.dryRun && result.newProposals > 0) {
    console.log(`\n▶ 신규 용어 제안 ${result.newProposals}건 — npm run glossary:approve 로 검토`);
  }

  if (!args.dryRun) {
    writeReports(result.round, result.issues, bundle);
    console.log('\n📄 i18n-report.md 갱신');
    if (result.issues.some((i) => i.layer === 4 || i.blockKind === 'unfixed-exclusion')) {
      console.log('📄 extraction-issues.md 갱신 (Dev-A 반송)');
    }
  } else {
    console.log('\n(dry-run: 저장하지 않음)');
  }

  // 이전 라운드 대비
  const prev = prevRounds[prevRounds.length - 1];
  if (prev) {
    const dFail = m.fail - prev.fail;
    const dChecked = m.checked - prev.checked;
    console.log('\n▶ 이전 라운드 대비');
    console.log(`  FAIL     ${prev.fail} → ${m.fail}  (${dFail >= 0 ? '+' : ''}${dFail})`);
    console.log(`  검증대상 ${prev.checked} → ${m.checked}  (${dChecked >= 0 ? '+' : ''}${dChecked})`);
  }

  console.log('\n' + '═'.repeat(88));
  if (m.fail > 0) {
    console.log(`  결과: FAIL ${m.fail}건 — 수정 후 다음 라운드를 실행하세요.`);
  } else if (m.warn > 0) {
    console.log(`  결과: WARN ${m.warn}건 — 검토가 필요합니다.`);
  } else {
    console.log('  결과: 전체 통과 ✅');
  }
  console.log('═'.repeat(88) + '\n');

  process.exit(m.fail > 0 ? 1 : 0);
}

main();
