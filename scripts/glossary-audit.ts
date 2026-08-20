/**
 * 용어집 위반 검사 스크립트 (npm run glossary:audit)
 *
 * src/locales/*.json을 스캔하여 domain-glossary.md 위반 사항을 검출합니다.
 * - 등록 용어의 번역 불일치
 * - 제품명 번역 금지 위반
 * - 복합어 내부 용어 위반 (규칙 2)
 * - ON/OFF 표기 혼용 (규칙 6)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadGlossary, buildGlossaryMap, type GlossaryEntry } from '../src/retrieval/glossary-loader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'src', 'locales');

interface Violation {
  severity: 'FAIL' | 'WARN';
  layer: string;
  key: string;
  locale: string;
  expected: string;
  actual: string;
  rule: string;
}

/**
 * JSON 객체를 flat key-value로 변환
 */
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

/**
 * 값에 용어가 포함되어 있는지 확인 (복합어 내부까지)
 */
function findTermInValue(value: string, term: string): boolean {
  return value.toLowerCase().includes(term.toLowerCase());
}

async function audit() {
  console.log('📖 용어집 위반 검사 시작...\n');

  const glossary = loadGlossary();
  const glossaryMap = buildGlossaryMap(glossary.entries);
  const violations: Violation[] = [];

  // locale 파일 로드
  const localeFiles: { locale: string; data: Record<string, string> }[] = [];
  for (const file of fs.readdirSync(LOCALES_DIR)) {
    if (!file.endsWith('.json')) continue;
    const locale = file.replace('.json', '');
    const data = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, file), 'utf-8'));
    localeFiles.push({ locale, data: flattenJson(data) });
  }

  const enFile = localeFiles.find((f) => f.locale === 'en');
  if (!enFile) {
    console.error('❌ en.json이 없습니다.');
    process.exit(1);
  }

  // 1. 제품명 번역 금지 검사 (§7)
  for (const productName of glossary.productNames) {
    for (const { locale, data } of localeFiles) {
      if (locale === 'en') continue;
      for (const [key, value] of Object.entries(data)) {
        const enValue = enFile.data[key];
        if (enValue && enValue.includes(productName) && value !== enValue) {
          // en에 제품명이 있는데 번역본이 다르면 위반
          violations.push({
            severity: 'FAIL',
            layer: 'Layer 2 (용어집)',
            key,
            locale,
            expected: productName + ' (원문 유지)',
            actual: value,
            rule: '§7 제품명 번역 금지',
          });
        }
      }
    }
  }

  // 2. 등록 용어 번역 일치 검사
  for (const [key, value] of Object.entries(enFile.data)) {
    // en value에서 용어 탐지
    for (const [termLower, entry] of glossaryMap) {
      if (!findTermInValue(value, entry.english)) continue;

      // 각 locale에서 해당 번역이 올바른지 확인
      for (const { locale, data } of localeFiles) {
        if (locale === 'en') continue;
        const translatedValue = data[key];
        if (!translatedValue) continue;

        let expectedTerm = '';
        if (locale === 'ko') expectedTerm = entry.ko;
        else if (locale === 'ja') expectedTerm = entry.ja;
        else if (locale === 'zh-CN') expectedTerm = entry.zhCN;

        if (!expectedTerm) continue;

        // 번역본에 기대 용어가 포함되어야 함
        if (!findTermInValue(translatedValue, expectedTerm)) {
          // 제품명은 별도 규칙으로 처리했으므로 skip
          if (glossary.productNames.some((p) => p.toLowerCase() === termLower)) continue;

          violations.push({
            severity: 'WARN',
            layer: 'Layer 2 (용어집)',
            key,
            locale,
            expected: `"${entry.english}" → "${expectedTerm}"`,
            actual: translatedValue,
            rule: '§1 등록 용어 번역 필수',
          });
        }
      }
    }
  }

  // 3. ON/OFF 표기 검사 (§6, ko만)
  const koFile = localeFiles.find((f) => f.locale === 'ko');
  if (koFile) {
    for (const [key, value] of Object.entries(koFile.data)) {
      // 버튼 컨텍스트에서 "끔" 사용 시 위반
      if (key.includes('button') && value === '끔') {
        violations.push({
          severity: 'WARN',
          layer: 'Layer 2 (용어집)',
          key,
          locale: 'ko',
          expected: '끄기 (동작 버튼) 또는 꺼짐 (상태)',
          actual: value,
          rule: '§6 ON/OFF 표기 규칙',
        });
      }
    }
  }

  // 결과 출력
  console.log('─'.repeat(90));
  console.log(`용어집 항목: ${glossary.entries.length}개 | 제품명: ${glossary.productNames.length}개`);
  console.log('─'.repeat(90));

  const fails = violations.filter((v) => v.severity === 'FAIL');
  const warns = violations.filter((v) => v.severity === 'WARN');

  if (violations.length === 0) {
    console.log('\n✅ 위반 없음! 모든 항목이 용어집과 일치합니다.');
  } else {
    if (fails.length > 0) {
      console.log(`\n❌ FAIL (${fails.length}건):`);
      for (const v of fails) {
        console.log(`  [${v.locale}] ${v.key}`);
        console.log(`    규칙: ${v.rule}`);
        console.log(`    기대: ${v.expected}`);
        console.log(`    실제: ${v.actual}\n`);
      }
    }

    if (warns.length > 0) {
      console.log(`\n⚠️  WARN (${warns.length}건):`);
      for (const v of warns) {
        console.log(`  [${v.locale}] ${v.key}`);
        console.log(`    규칙: ${v.rule}`);
        console.log(`    기대: ${v.expected}`);
        console.log(`    실제: ${v.actual}\n`);
      }
    }
  }

  console.log('─'.repeat(90));
  console.log(`\n📊 결과: FAIL=${fails.length}, WARN=${warns.length}, TOTAL=${violations.length}`);

  if (fails.length > 0) {
    console.log('\n❌ 용어집 검사 FAIL — 수정이 필요합니다.');
    process.exit(1);
  } else if (warns.length > 0) {
    console.log('\n⚠️  용어집 검사 WARN — 검토가 필요합니다.');
  } else {
    console.log('\n✅ 용어집 검사 PASS');
  }
}

audit().catch((err) => {
  console.error('❌ 검사 실패:', err);
  process.exit(1);
});
