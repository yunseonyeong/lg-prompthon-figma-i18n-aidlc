/**
 * 자가발전 루프 시뮬레이션 (npm run round:simulate)
 *
 * Dev-A가 반송을 받아 수정하는 과정을 재현해 루프가 실제로 개선되는지 확인합니다.
 * src/locales 를 건드리지 않고 임시 디렉토리에 사본을 만들어 검증합니다.
 *
 * 시나리오:
 *   R1  현재 상태 그대로
 *   R2  추출 필터 수정 (Layer 4) + 제품명 원문 유지 (Layer 2 FAIL)
 *   R3  용어집 위반 수정 (Layer 2 WARN)
 *   R4  회귀 발생 — 확정된 번역이 흔들린 경우를 잡아내는지 확인
 *
 * 사용법: npm run round:simulate
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadGlossary } from '../src/retrieval/glossary-loader.js';
import { flattenJson, runRound, type LocaleBundle } from '../src/validation/index.js';
import {
  loadRounds,
  loadConfirmed,
  loadRejected,
  loadExclusions,
  FEEDBACK_PATHS,
} from '../src/retrieval/feedback-store.js';
import { PROPOSAL_PATH } from '../src/validation/glossary-growth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LOCALES = path.join(ROOT, 'src', 'locales');
const LOCALE_FILES = ['en.json', 'ko.json', 'ja.json', 'zh-CN.json'];

type Raw = Record<string, unknown>;

function readRaw(dir: string, file: string): Raw {
  return JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
}

/** dot 경로로 중첩 객체 값 설정 */
function setPath(obj: Raw, dotted: string, value: string): void {
  const parts = dotted.split('.');
  let cur: Raw = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const next = cur[parts[i]];
    if (typeof next !== 'object' || next === null) return;
    cur = next as Raw;
  }
  cur[parts[parts.length - 1]] = value;
}

function toBundle(dir: string): LocaleBundle {
  const bundle: LocaleBundle = {};
  for (const f of LOCALE_FILES) {
    bundle[f.replace('.json', '')] = flattenJson(readRaw(dir, f));
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
}

interface Snapshot {
  label: string;
  dir: string;
}

/** 임시 디렉토리에 locale 사본 생성 */
function makeSnapshot(label: string, mutate: (raws: Record<string, Raw>) => void): Snapshot {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-round-'));
  const raws: Record<string, Raw> = {};
  for (const f of LOCALE_FILES) raws[f] = readRaw(LOCALES, f);
  mutate(raws);
  for (const f of LOCALE_FILES) {
    fs.writeFileSync(path.join(dir, f), JSON.stringify(raws[f], null, 2), 'utf-8');
  }
  return { label, dir };
}

function main(): void {
  console.log('═'.repeat(92));
  console.log('  자가발전 루프 시뮬레이션');
  console.log('═'.repeat(92));
  console.log('\nsrc/locales 는 수정하지 않고 임시 사본으로 검증합니다.\n');

  resetState();
  const glossary = loadGlossary();

  // 기준 상태에서 문제 항목 목록 확보 (dry-run)
  const base = toBundle(LOCALES);
  const probe = runRound(base, { dryRun: true, round: 0, glossary });
  const en = base['en'];

  const layer4Keys = [...new Set(probe.issues.filter((i) => i.layer === 4).map((i) => i.key))];
  const productKeys = [
    ...new Set(
      probe.issues
        .filter((i) => i.layer === 2 && i.severity === 'FAIL')
        .map((i) => i.key)
    ),
  ];
  const warnKeys = [
    ...new Set(
      probe.issues
        .filter((i) => i.layer === 2 && i.severity === 'WARN')
        .map((i) => i.key)
    ),
  ];

  console.log(`문제 항목: Layer4 ${layer4Keys.length}개 key / 제품명 ${productKeys.length}개 key / WARN ${warnKeys.length}개 key\n`);

  const snapshots: Snapshot[] = [];

  // R1: 현재 상태
  snapshots.push(makeSnapshot('R1 현재 상태', () => {}));

  // R2: Layer 4 + 제품명 수정 (원문 유지)
  const fixExtraction = (raws: Record<string, Raw>) => {
    for (const key of [...layer4Keys, ...productKeys]) {
      const source = en[key];
      if (source === undefined) continue;
      for (const f of ['ko.json', 'ja.json', 'zh-CN.json']) setPath(raws[f], key, source);
    }
  };
  snapshots.push(makeSnapshot('R2 추출필터+제품명 수정', fixExtraction));

  // R3: 용어집 위반까지 수정
  const fixGlossary = (raws: Record<string, Raw>) => {
    fixExtraction(raws);
    // SSO 표기: 용어집 등록 번역을 포함시킴
    const ssoKey = warnKeys.find((k) => k.includes('single_signon'));
    if (ssoKey) {
      setPath(raws['ko.json'], ssoKey, '싱글 사인온(SSO)을 켜고 선택한 인증 유형의 세부 정보를 설정하세요.');
      setPath(raws['ja.json'], ssoKey, 'シングルサインオン(SSO)をオンにし、選択した認証タイプの詳細を設定してください。');
      setPath(raws['zh-CN.json'], ssoKey, '将单点登录(SSO)开启，并设置所选认证类型的详细信息。');
    }
    // ON/OFF 표기
    const offKey = warnKeys.find((k) => k.endsWith('button.off'));
    if (offKey) setPath(raws['ko.json'], offKey, '끄기');
  };
  snapshots.push(makeSnapshot('R3 용어집 위반 수정', fixGlossary));

  // R4: 회귀 — 확정된 번역이 흔들린 상황
  snapshots.push(
    makeSnapshot('R4 회귀 발생 (확정본 변경)', (raws) => {
      fixGlossary(raws);
      // 확정되었던 번역을 임의로 변경
      setPath(raws['ko.json'], 'console.setting.group.button.save', '저장하기');
      setPath(raws['ko.json'], 'console.setting.group.button.delete', '지우기');
    })
  );

  // R5: 재발 — 과거 거부된 번역이 다시 제출된 상황
  //     (LLM이 같은 오역을 또 생성한 경우)
  snapshots.push(
    makeSnapshot('R5 재발 (거부된 번역 재제출)', (raws) => {
      fixGlossary(raws);
      // R1에서 거부된 제품명 오역을 그대로 되돌린다
      const artKey = productKeys.find((k) => k.includes('art_lounge'));
      if (artKey) setPath(raws['ko.json'], artKey, '아트 라운지');
    })
  );

  // 라운드 실행
  for (const snap of snapshots) {
    const bundle = toBundle(snap.dir);
    const r = runRound(bundle, { glossary });
    const m = r.metrics;
    console.log(
      `R${String(m.round).padEnd(2)} ${snap.label.padEnd(26)} ` +
      `검증 ${String(m.checked).padStart(4)} / 건너뜀 ${String(m.skipped).padStart(4)} / ` +
      `FAIL ${String(m.fail).padStart(3)} / WARN ${String(m.warn).padStart(3)} / ` +
      `회귀 ${String(m.regressions).padStart(2)} / 재발 ${String(m.recurrences).padStart(2)} / ` +
      `확정 ${String(m.confirmedTotal).padStart(4)}`
    );
  }

  // 정리
  for (const s of snapshots) fs.rmSync(s.dir, { recursive: true, force: true });

  const rounds = loadRounds();
  console.log('\n' + '─'.repeat(92));
  console.log('  검증');
  console.log('─'.repeat(92));

  const r1 = rounds[0];
  const r3 = rounds[2];
  const r4 = rounds[3];
  const r5 = rounds[4];

  const checks: Array<[string, boolean, string]> = [
    [
      'FAIL 감소',
      r3.fail < r1.fail,
      `R1 ${r1.fail} → R3 ${r3.fail}`,
    ],
    [
      '검증 대상 감소 (확정 누적 효과)',
      r3.checked < r1.checked,
      `R1 ${r1.checked} → R3 ${r3.checked}`,
    ],
    [
      '확정 번역 증가',
      r3.confirmedTotal > r1.confirmedTotal,
      `R1 ${r1.confirmedTotal} → R3 ${r3.confirmedTotal}`,
    ],
    [
      '회귀 검출',
      r4.regressions > 0,
      `R4에서 ${r4.regressions}건 검출`,
    ],
    [
      '재발 검출',
      r5.recurrences > 0,
      `R5에서 ${r5.recurrences}건 검출`,
    ],
    [
      'WARN 비증가 (오탐 없음)',
      r3.warn <= r1.warn,
      `R1 ${r1.warn} → R3 ${r3.warn}`,
    ],
  ];

  let allPass = true;
  for (const [name, ok, detail] of checks) {
    console.log(`  ${ok ? '✅' : '❌'} ${name.padEnd(34)} ${detail}`);
    if (!ok) allPass = false;
  }

  console.log('\n' + '─'.repeat(92));
  console.log('  누적 학습 데이터');
  console.log('─'.repeat(92));
  console.log(`  확정 번역 : ${Object.keys(loadConfirmed()).length}건`);
  console.log(`  거부 이력 : ${Object.values(loadRejected()).reduce((s, v) => s + v.length, 0)}건`);
  console.log(`  추출 제외 : ${Object.keys(loadExclusions()).length}건`);

  console.log('\n' + '═'.repeat(92));
  console.log(allPass ? '  ✅ 자가발전 루프 정상 동작' : '  ❌ 일부 검증 실패');
  console.log('═'.repeat(92) + '\n');

  process.exit(allPass ? 0 : 1);
}

main();
