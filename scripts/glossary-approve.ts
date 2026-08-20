/**
 * 용어집 승인 게이트 (npm run glossary:approve)
 *
 * US-2.2 수용 기준: "사람이 승인해야만 용어집에 등록된다"
 * 자동 등재를 하지 않고, 제안 목록을 보여주고 승인/거부를 받습니다.
 *
 * 사용법:
 *   npm run glossary:approve                    # 제안 목록 확인
 *   npm run glossary:approve -- --approve "Filter" "Report"
 *   npm run glossary:approve -- --reject "Label"
 *   npm run glossary:approve -- --approve-all   # 전체 승인 (데모용)
 *   npm run glossary:approve -- --write         # 승인된 것을 용어집에 반영
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadProposals, saveProposals, type TermProposal } from '../src/validation/glossary-growth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const GLOSSARY_FILE = path.join(ROOT, 'requirements', 'domain-glossary.md');

interface Args {
  approve: string[];
  reject: string[];
  approveAll: boolean;
  write: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const args: Args = { approve: [], reject: [], approveAll: false, write: false };
  let mode: 'approve' | 'reject' | null = null;

  for (const a of argv) {
    if (a === '--approve') { mode = 'approve'; continue; }
    if (a === '--reject') { mode = 'reject'; continue; }
    if (a === '--approve-all') { args.approveAll = true; mode = null; continue; }
    if (a === '--write') { args.write = true; mode = null; continue; }
    if (a.startsWith('--')) { mode = null; continue; }
    if (mode === 'approve') args.approve.push(a);
    else if (mode === 'reject') args.reject.push(a);
  }
  return args;
}

function show(proposals: Record<string, TermProposal>): void {
  const list = Object.values(proposals);
  const proposed = list.filter((p) => p.status === 'proposed');
  const approved = list.filter((p) => p.status === 'approved');
  const rejected = list.filter((p) => p.status === 'rejected');

  console.log('═'.repeat(92));
  console.log(`  용어집 제안 — 대기 ${proposed.length} / 승인 ${approved.length} / 거부 ${rejected.length}`);
  console.log('═'.repeat(92));

  if (proposed.length === 0) {
    console.log('\n대기 중인 제안이 없습니다.');
    console.log('npm run round:check 를 실행하면 신규 용어 후보가 발굴됩니다.\n');
    return;
  }

  console.log(`\n${'English'.padEnd(30)} ${'ko'.padEnd(18)} ${'횟수'.padEnd(6)} 근거`);
  console.log('─'.repeat(92));
  for (const p of proposed.sort((a, b) => b.occurrences - a.occurrences)) {
    console.log(
      `${p.english.slice(0, 29).padEnd(30)} ${(p.ko || '-').slice(0, 17).padEnd(18)} ` +
      `${String(p.occurrences).padEnd(6)} ${p.evidence[0] ?? ''}`
    );
  }
  console.log('─'.repeat(92));
  console.log('\n승인: npm run glossary:approve -- --approve "용어1" "용어2"');
  console.log('거부: npm run glossary:approve -- --reject "용어1"');
  console.log('반영: npm run glossary:approve -- --write\n');
}

/** 승인된 제안을 domain-glossary.md 에 추가 */
function writeToGlossary(proposals: Record<string, TermProposal>): number {
  const approved = Object.values(proposals).filter((p) => p.status === 'approved');
  if (approved.length === 0) {
    console.log('반영할 승인 항목이 없습니다.');
    return 0;
  }

  let content = fs.readFileSync(GLOSSARY_FILE, 'utf-8');

  // 이미 반영된 항목은 건너뛴다
  const toAdd = approved.filter((p) => !new RegExp(`\\|\\s*${p.english}\\s*\\|`, 'i').test(content));
  if (toAdd.length === 0) {
    console.log('승인 항목이 이미 모두 반영되어 있습니다.');
    return 0;
  }

  const SECTION = '## 11. 자동 발굴 용어 (승인 완료)';
  const rows = toAdd
    .map((p) => `| ${p.english} | ${p.context} | ${p.ko} | ${p.ja} | ${p['zh-CN']} |`)
    .join('\n');

  if (content.includes(SECTION)) {
    // 기존 섹션 끝에 append
    content = content.replace(
      new RegExp(`(${SECTION}[\\s\\S]*?)(\\n\\n|$)`),
      (_m, body: string, tail: string) => `${body}\n${rows}${tail}`
    );
  } else {
    content = content.trimEnd() + '\n\n' +
      `${SECTION}\n\n` +
      '검증 루프가 발굴하고 사람이 승인한 용어입니다.\n\n' +
      '| English | Context | ko | ja | zh-CN |\n' +
      '|---------|---------|-----|-----|-------|\n' +
      rows + '\n';
  }

  fs.writeFileSync(GLOSSARY_FILE, content, 'utf-8');
  return toAdd.length;
}

function main(): void {
  const args = parseArgs();
  const proposals = loadProposals();

  if (Object.keys(proposals).length === 0) {
    console.log('\n제안 파일이 없습니다. npm run round:check 를 먼저 실행하세요.\n');
    return;
  }

  let changed = 0;

  if (args.approveAll) {
    for (const p of Object.values(proposals)) {
      if (p.status === 'proposed') { p.status = 'approved'; changed++; }
    }
    console.log(`✅ ${changed}건 승인`);
  }

  for (const term of args.approve) {
    const p = proposals[term] ?? Object.values(proposals).find(
      (x) => x.english.toLowerCase() === term.toLowerCase()
    );
    if (!p) { console.log(`⚠️  제안에 없는 용어: "${term}"`); continue; }
    p.status = 'approved';
    changed++;
    console.log(`✅ 승인: "${p.english}"`);
  }

  for (const term of args.reject) {
    const p = proposals[term] ?? Object.values(proposals).find(
      (x) => x.english.toLowerCase() === term.toLowerCase()
    );
    if (!p) { console.log(`⚠️  제안에 없는 용어: "${term}"`); continue; }
    p.status = 'rejected';
    changed++;
    console.log(`🚫 거부: "${p.english}"`);
  }

  if (changed > 0) saveProposals(proposals);

  if (args.write) {
    const n = writeToGlossary(proposals);
    if (n > 0) {
      console.log(`\n📝 domain-glossary.md 에 ${n}건 반영`);
      console.log('   → npm run glossary:index 로 인덱스를 갱신하세요.');
    }
    return;
  }

  if (changed === 0) show(proposals);
  else console.log('\n반영: npm run glossary:approve -- --write\n');
}

main();
