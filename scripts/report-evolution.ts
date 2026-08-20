/**
 * 자가발전 추이 리포트 (npm run report:evolution)
 *
 * rounds.jsonl 의 라운드별 지표를 표와 그래프로 출력합니다.
 * "검증이 진행되면서 품질이 향상된다"는 주장의 증거물입니다.
 *
 * 사용법:
 *   npm run report:evolution           # 콘솔 출력
 *   npm run report:evolution -- --md   # evolution-report.md 생성
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadRounds, loadConfirmed, loadRejected, loadExclusions, type RoundMetrics } from '../src/retrieval/feedback-store.js';
import { loadProposals } from '../src/validation/glossary-growth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/** 값 배열을 막대 그래프 문자열로 */
function sparkbar(values: number[], width = 40): string[] {
  const max = Math.max(...values, 1);
  return values.map((v) => {
    const n = Math.round((v / max) * width);
    return '█'.repeat(n) + '░'.repeat(width - n);
  });
}

function pct(from: number, to: number): string {
  if (from === 0) return to === 0 ? '0%' : 'n/a';
  const d = ((to - from) / from) * 100;
  return `${d >= 0 ? '+' : ''}${d.toFixed(0)}%`;
}

function renderConsole(rounds: RoundMetrics[]): void {
  console.log('═'.repeat(94));
  console.log('  자가발전 추이 리포트');
  console.log('═'.repeat(94));

  if (rounds.length === 0) {
    console.log('\n라운드 이력이 없습니다. npm run round:check 를 실행하세요.\n');
    return;
  }

  // 표
  console.log(
    `\n${'R'.padEnd(4)} ${'검증대상'.padEnd(10)} ${'건너뜀'.padEnd(9)} ${'FAIL'.padEnd(7)} ` +
    `${'WARN'.padEnd(7)} ${'회귀'.padEnd(6)} ${'재발'.padEnd(6)} ${'에스컬'.padEnd(7)} ${'확정누적'.padEnd(10)} 용어집`
  );
  console.log('─'.repeat(94));
  for (const r of rounds) {
    console.log(
      `${String(r.round).padEnd(4)} ${String(r.checked).padEnd(10)} ${String(r.skipped).padEnd(9)} ` +
      `${String(r.fail).padEnd(7)} ${String(r.warn).padEnd(7)} ${String(r.regressions).padEnd(6)} ` +
      `${String(r.recurrences).padEnd(6)} ${String(r.escalations ?? 0).padEnd(7)} ${String(r.confirmedTotal).padEnd(10)} ${r.glossaryTerms}`
    );
  }
  console.log('─'.repeat(94));

  // 그래프
  const failBars = sparkbar(rounds.map((r) => r.fail));
  const checkedBars = sparkbar(rounds.map((r) => r.checked));
  const confirmedBars = sparkbar(rounds.map((r) => r.confirmedTotal));

  console.log('\n▶ FAIL 추이 (낮을수록 좋음)');
  rounds.forEach((r, i) => console.log(`  R${r.round}  ${failBars[i]}  ${r.fail}`));

  console.log('\n▶ 검증 대상 추이 (확정이 쌓이면 줄어듦)');
  rounds.forEach((r, i) => console.log(`  R${r.round}  ${checkedBars[i]}  ${r.checked}`));

  console.log('\n▶ 확정 번역 누적 (높을수록 좋음)');
  rounds.forEach((r, i) => console.log(`  R${r.round}  ${confirmedBars[i]}  ${r.confirmedTotal}`));

  // 요약
  if (rounds.length >= 2) {
    const first = rounds[0];
    const last = rounds[rounds.length - 1];
    console.log('\n' + '─'.repeat(94));
    console.log(`  R${first.round} → R${last.round} 변화`);
    console.log('─'.repeat(94));
    console.log(`  FAIL       ${first.fail} → ${last.fail}  (${pct(first.fail, last.fail)})`);
    console.log(`  WARN       ${first.warn} → ${last.warn}  (${pct(first.warn, last.warn)})`);
    console.log(`  검증 대상  ${first.checked} → ${last.checked}  (${pct(first.checked, last.checked)})`);
    console.log(`  확정 누적  ${first.confirmedTotal} → ${last.confirmedTotal}`);
    console.log(`  용어집     ${first.glossaryTerms} → ${last.glossaryTerms}개`);

    const totalRegressions = rounds.reduce((s, r) => s + r.regressions, 0);
    const totalRecurrences = rounds.reduce((s, r) => s + r.recurrences, 0);
    console.log(`\n  누적 회귀 차단 ${totalRegressions}건 / 재발 차단 ${totalRecurrences}건`);
  }

  // 저장소 현황
  const confirmed = Object.keys(loadConfirmed()).length;
  const rejected = Object.values(loadRejected()).reduce((s, v) => s + v.length, 0);
  const exclusions = Object.keys(loadExclusions()).length;
  const proposals = Object.values(loadProposals());

  console.log('\n' + '─'.repeat(94));
  console.log('  누적 학습 데이터');
  console.log('─'.repeat(94));
  console.log(`  확정 번역   : ${confirmed}건`);
  console.log(`  거부 이력   : ${rejected}건`);
  console.log(`  추출 제외   : ${exclusions}건`);
  console.log(`  용어 제안   : 대기 ${proposals.filter((p) => p.status === 'proposed').length} / ` +
    `승인 ${proposals.filter((p) => p.status === 'approved').length}`);
  console.log('═'.repeat(94) + '\n');
}

function renderMarkdown(rounds: RoundMetrics[]): void {
  const lines: string[] = [
    '# 자가발전 추이 리포트',
    '',
    `생성일시: ${new Date().toISOString()}`,
    '',
  ];

  if (rounds.length === 0) {
    lines.push('라운드 이력이 없습니다.');
  } else {
    lines.push(
      '## 라운드별 지표',
      '',
      '| Round | 검증 대상 | 확정 건너뜀 | FAIL | WARN | 회귀 | 재발 | 에스컬레이션 | 확정 누적 | 용어집 |',
      '|-------|-----------|-------------|------|------|------|------|--------------|-----------|--------|'
    );
    for (const r of rounds) {
      lines.push(
        `| ${r.round} | ${r.checked} | ${r.skipped} | ${r.fail} | ${r.warn} | ` +
        `${r.regressions} | ${r.recurrences} | ${r.escalations ?? 0} | ${r.confirmedTotal} | ${r.glossaryTerms} |`
      );
    }

    if (rounds.length >= 2) {
      const f = rounds[0];
      const l = rounds[rounds.length - 1];
      lines.push(
        '',
        '## 변화',
        '',
        '| 지표 | 시작 | 현재 | 변화 |',
        '|------|------|------|------|',
        `| FAIL | ${f.fail} | ${l.fail} | ${pct(f.fail, l.fail)} |`,
        `| WARN | ${f.warn} | ${l.warn} | ${pct(f.warn, l.warn)} |`,
        `| 검증 대상 | ${f.checked} | ${l.checked} | ${pct(f.checked, l.checked)} |`,
        `| 확정 누적 | ${f.confirmedTotal} | ${l.confirmedTotal} | — |`,
        `| 용어집 | ${f.glossaryTerms} | ${l.glossaryTerms} | — |`,
        '',
        `누적 회귀 차단 ${rounds.reduce((s, r) => s + r.regressions, 0)}건, ` +
        `재발 차단 ${rounds.reduce((s, r) => s + r.recurrences, 0)}건`
      );
    }

    lines.push(
      '',
      '## 해석',
      '',
      '- **검증 대상**이 줄어드는 것은 확정 번역이 쌓여 재검증이 불필요해졌다는 의미입니다.',
      '- **회귀**는 확정된 번역이 다시 바뀐 경우입니다. LLM 출력 흔들림을 잡아낸 횟수입니다.',
      '- **재발**은 과거 거부된 번역이 다시 제출된 경우입니다. 축적된 금지 목록이 작동한 횟수입니다.',
      '- 회귀/재발 차단이 없으면 라운드를 반복해도 품질이 우연에 좌우됩니다.'
    );
  }

  const out = path.join(ROOT, 'evolution-report.md');
  fs.writeFileSync(out, lines.join('\n'), 'utf-8');
  console.log(`📄 ${path.relative(ROOT, out)} 생성`);
}

function main(): void {
  const rounds = loadRounds();
  const md = process.argv.includes('--md');

  renderConsole(rounds);
  if (md) renderMarkdown(rounds);
}

main();
