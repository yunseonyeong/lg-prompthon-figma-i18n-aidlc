/**
 * Layer 3 검출력 셀프테스트 (npm run validate:layer3:selftest)
 *
 * 결함을 주입해 EXAONE 역검증이 실제로 잡는지 확인합니다.
 * 한 번도 발화하지 않는 검증기는 쓸모가 없으므로, 규칙 변경 시 이 스크립트로
 * 검출력을 확인합니다.
 *
 * ⚠️ API를 호출하므로 결과가 실행마다 조금씩 다를 수 있습니다.
 *    문맥 오역(mistranslation) 케이스는 재현되어야 하고,
 *    문체 문제(awkward)는 검출되지 않는 것이 정상입니다.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadGlossary } from '../src/retrieval/glossary-loader.js';
import { flattenJson, type LocaleBundle } from '../src/validation/index.js';
import { verifyContextWithExaone } from '../src/validation/layer3-exaone.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function loadBundle(): LocaleBundle {
  const dir = path.join(ROOT, 'src', 'locales');
  const b: LocaleBundle = {};
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.json')) continue;
    b[f.replace(/\.json$/, '')] = flattenJson(
      JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'))
    );
  }
  return b;
}

interface Injection {
  key: string;
  locale: string;
  wrong: string;
  label: string;
  /** mistranslation = 반드시 검출 / awkward = 검출 안 되는 것이 정상 */
  kind: 'mistranslation' | 'awkward';
}

const INJECTIONS: Injection[] = [
  {
    key: 'console.setting.group.label.vertical_type',
    locale: 'ko',
    wrong: '세로 유형 *',
    label: '명세 지목 결함: Vertical Type → 세로 유형 (화면 방향으로 오역)',
    kind: 'mistranslation',
  },
  {
    key: 'console.setting.group.button.extend',
    locale: 'ko',
    wrong: '확장',
    label: '도메인 트랩: 라이선스 연장을 화면 확장으로 오역',
    kind: 'mistranslation',
  },
  {
    key: 'console.setting.group.label.time_zone',
    locale: 'ko',
    wrong: '시간 지역',
    label: '문체 문제: 시간대 → 시간 지역 (문맥 오역은 아님)',
    kind: 'awkward',
  },
];

async function main() {
  const glossary = loadGlossary();
  const bundle = loadBundle();

  console.log('🧪 Layer 3 검출력 셀프테스트\n');

  const injected: LocaleBundle = JSON.parse(JSON.stringify(bundle));
  for (const inj of INJECTIONS) {
    const before = injected[inj.locale]?.[inj.key];
    if (before === undefined) {
      console.log(`  ⚠️  key 없음, 주입 생략: ${inj.key}`);
      continue;
    }
    injected[inj.locale][inj.key] = inj.wrong;
    console.log(`  주입 [${inj.locale}] ${inj.key}`);
    console.log(`       "${before}" → "${inj.wrong}"`);
  }

  console.log('\n  판정 요청 중...\n');
  const r = await verifyContextWithExaone(injected, glossary);

  for (const n of r.notes) console.log(`  ⚠️  ${n}`);
  if (!r.called) {
    console.log('\n❌ EXAONE 호출 실패 — API 키/네트워크를 확인하세요.');
    process.exit(1);
  }

  console.log('─'.repeat(88));
  console.log(
    `  호출 ${r.calls}회 / ${r.totalTokens} tokens / 검출 ${r.issues.length}건 / 용어집 우선 억제 ${r.suppressed}건`
  );
  console.log('─'.repeat(88));

  let required = 0;
  let requiredHit = 0;

  for (const inj of INJECTIONS) {
    const hit = r.issues.some((i) => i.key === inj.key && i.locale === inj.locale);
    if (inj.kind === 'mistranslation') {
      required++;
      if (hit) requiredHit++;
      console.log(`  ${hit ? '✅' : '❌'} ${inj.label}`);
    } else {
      console.log(`  ${hit ? '△ (검출됨 — 과검출)' : '✅ (미검출 = 정상)'} ${inj.label}`);
    }
  }

  const extra = r.issues.filter(
    (i) => !INJECTIONS.some((inj) => inj.key === i.key && inj.locale === i.locale)
  );
  if (extra.length > 0) {
    console.log(`\n  주입하지 않은 항목도 ${extra.length}건 검출:`);
    for (const i of extra.slice(0, 5)) {
      console.log(`    [${i.locale}] ${i.key}`);
      console.log(`       ${i.message.slice(0, 140)}`);
    }
  }

  console.log('\n' + '─'.repeat(88));
  console.log(`  문맥 오역 검출률: ${requiredHit}/${required}`);
  console.log('─'.repeat(88) + '\n');

  process.exit(requiredHit === required ? 0 : 1);
}

main().catch((e) => {
  console.error('❌ 실패:', e);
  process.exit(1);
});
