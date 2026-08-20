/**
 * i18n 4계층 검증 스크립트 (npm run validate:i18n)
 *
 * Layer 1: 구조적 결함 (key 불일치, placeholder 손실)       → Dev-A 수정
 * Layer 2: 용어집 위반 (복합어 내부까지)                    → Dev-A / Dev-B
 * Layer 3: 문맥 오역 (주변 필드 함께 판정)                  → Dev-B → Dev-A
 * Layer 4: 번역 대상이 아닌 텍스트                         → Dev-A 추출 필터
 * 부가:   원문 오타/문장 조각                              → 디자이너
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadGlossary, buildGlossaryMap } from '../src/retrieval/glossary-loader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'src', 'locales');

interface Issue {
  layer: 1 | 2 | 3 | 4;
  severity: 'FAIL' | 'WARN' | 'INFO';
  key: string;
  locale: string;
  message: string;
  assignee: string;
}

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
 * placeholder 패턴 추출 ({0}, {{name}}, %s, %d 등)
 */
function extractPlaceholders(text: string): string[] {
  const patterns = text.match(/\{\{?\w+\}?\}|%[sd]|%\d+\$[sd]/g);
  return patterns || [];
}

async function validate() {
  console.log('🔍 i18n 4계층 검증 시작...\n');

  const glossary = loadGlossary();
  const glossaryMap = buildGlossaryMap(glossary.entries);
  const issues: Issue[] = [];

  // locale 파일 로드
  const locales: string[] = [];
  const localeData: Record<string, Record<string, string>> = {};

  for (const file of fs.readdirSync(LOCALES_DIR).sort()) {
    if (!file.endsWith('.json')) continue;
    const locale = file.replace('.json', '');
    locales.push(locale);
    const raw = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, file), 'utf-8'));
    localeData[locale] = flattenJson(raw);
  }

  if (!localeData['en']) {
    console.error('❌ en.json 필수');
    process.exit(1);
  }

  const enKeys = Object.keys(localeData['en']);
  const targetLocales = locales.filter((l) => l !== 'en');

  // ═══════════════════════════════════════════════════════════
  // Layer 1: 구조적 결함
  // ═══════════════════════════════════════════════════════════
  for (const locale of targetLocales) {
    const targetKeys = Object.keys(localeData[locale]);

    // 1-1. en에 있는데 target에 없는 key
    for (const key of enKeys) {
      if (!(key in localeData[locale])) {
        issues.push({
          layer: 1, severity: 'FAIL', key, locale,
          message: `Key 누락: en에 존재하지만 ${locale}에 없음`,
          assignee: 'Dev-A',
        });
      }
    }

    // 1-2. target에 있는데 en에 없는 key
    for (const key of targetKeys) {
      if (!(key in localeData['en'])) {
        issues.push({
          layer: 1, severity: 'FAIL', key, locale,
          message: `초과 key: ${locale}에만 존재 (en에 없음)`,
          assignee: 'Dev-A',
        });
      }
    }

    // 1-3. Placeholder 손실
    for (const key of enKeys) {
      const enValue = localeData['en'][key];
      const targetValue = localeData[locale]?.[key];
      if (!targetValue) continue;

      const enPH = extractPlaceholders(enValue);
      const targetPH = extractPlaceholders(targetValue);

      for (const ph of enPH) {
        if (!targetPH.includes(ph)) {
          issues.push({
            layer: 1, severity: 'FAIL', key, locale,
            message: `Placeholder 손실: "${ph}" 이 ${locale}에서 누락됨`,
            assignee: 'Dev-A',
          });
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Layer 2: 용어집 위반
  // ═══════════════════════════════════════════════════════════
  for (const key of enKeys) {
    const enValue = localeData['en'][key];

    // 제품명 번역 금지 검사
    for (const productName of glossary.productNames) {
      if (enValue.includes(productName)) {
        for (const locale of targetLocales) {
          const targetValue = localeData[locale]?.[key];
          if (targetValue && targetValue !== enValue && !targetValue.includes(productName)) {
            issues.push({
              layer: 2, severity: 'FAIL', key, locale,
              message: `제품명 번역 금지 위반: "${productName}" → "${targetValue}" (원문 유지 필요)`,
              assignee: 'Dev-A',
            });
          }
        }
      }
    }

    // 등록 용어 검사
    for (const [, entry] of glossaryMap) {
      if (!enValue.toLowerCase().includes(entry.english.toLowerCase())) continue;

      for (const locale of targetLocales) {
        const targetValue = localeData[locale]?.[key];
        if (!targetValue) continue;

        let expected = '';
        if (locale === 'ko') expected = entry.ko;
        else if (locale === 'ja') expected = entry.ja;
        else if (locale === 'zh-CN') expected = entry.zhCN;
        if (!expected) continue;

        if (!targetValue.toLowerCase().includes(expected.toLowerCase())) {
          // 제품명은 위에서 별도 처리
          if (glossary.productNames.some((p) => p === entry.english)) continue;

          issues.push({
            layer: 2, severity: 'WARN', key, locale,
            message: `용어 불일치: "${entry.english}" → 기대 "${expected}", 실제 "${targetValue}"`,
            assignee: 'Dev-A / Dev-B',
          });
        }
      }
    }

    // ON/OFF 표기 (ko)
    const koValue = localeData['ko']?.[key];
    if (koValue && key.includes('button') && koValue === '끔') {
      issues.push({
        layer: 2, severity: 'WARN', key, locale: 'ko',
        message: `ON/OFF 표기 위반: 버튼은 "끄기", 상태는 "꺼짐" (현재: "끔")`,
        assignee: 'Dev-B',
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Layer 3: 문맥 오역 (간단 휴리스틱)
  // ═══════════════════════════════════════════════════════════
  // "Extend" 가 "확장"으로 번역된 경우 (라이선스 맥락에서는 "연장")
  for (const key of enKeys) {
    const enValue = localeData['en'][key];
    if (enValue.toLowerCase().includes('extend') && key.includes('license')) {
      const koValue = localeData['ko']?.[key];
      if (koValue && koValue.includes('확장')) {
        issues.push({
          layer: 3, severity: 'FAIL', key, locale: 'ko',
          message: `문맥 오역: 라이선스 맥락에서 "Extend" → "연장" (현재: "확장")`,
          assignee: 'Dev-B → Dev-A',
        });
      }
    }
    // "Withdraw" 가 "탈퇴"로 번역된 경우 (라이선스 맥락에서는 "회수")
    if (enValue.toLowerCase().includes('withdraw')) {
      const koValue = localeData['ko']?.[key];
      if (koValue && koValue.includes('탈퇴')) {
        issues.push({
          layer: 3, severity: 'FAIL', key, locale: 'ko',
          message: `문맥 오역: 라이선스 맥락에서 "Withdraw" → "회수" (현재: "탈퇴")`,
          assignee: 'Dev-B → Dev-A',
        });
      }
    }
    // "Vertical" 이 "세로"로 번역된 경우 (비즈니스 맥락에서는 "산업 분야")
    if (enValue.toLowerCase().includes('vertical') && !enValue.toLowerCase().includes('vertical bar')) {
      const koValue = localeData['ko']?.[key];
      if (koValue && koValue.includes('세로')) {
        issues.push({
          layer: 3, severity: 'FAIL', key, locale: 'ko',
          message: `문맥 오역: 비즈니스 맥락에서 "Vertical" → "산업 분야" (현재: "세로")`,
          assignee: 'Dev-B → Dev-A',
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Layer 4: 번역 대상이 아닌 텍스트
  // ═══════════════════════════════════════════════════════════
  for (const key of enKeys) {
    const enValue = localeData['en'][key];

    // 더미/샘플 데이터 검출
    const isExcluded = glossary.excludePatterns.some((pattern) =>
      enValue.includes(pattern)
    );

    if (isExcluded) {
      // 번역되어 있으면 위반 (en과 다르면)
      for (const locale of targetLocales) {
        const targetValue = localeData[locale]?.[key];
        if (targetValue && targetValue !== enValue) {
          issues.push({
            layer: 4, severity: 'FAIL', key, locale,
            message: `번역 제외 대상이 번역됨: "${enValue}" → "${targetValue}" (원문 유지 또는 제거 필요)`,
            assignee: 'Dev-A (추출 필터)',
          });
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 부가: 원문 오타 검출
  // ═══════════════════════════════════════════════════════════
  for (const key of enKeys) {
    const enValue = localeData['en'][key];
    // 간단한 오타 패턴
    if (enValue.includes('detailes')) {
      issues.push({
        layer: 3, severity: 'INFO', key, locale: 'en',
        message: `원문 오타: "detailes" → "details"`,
        assignee: '디자이너',
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 결과 출력
  // ═══════════════════════════════════════════════════════════
  const layerNames = {
    1: 'Layer 1: 구조적 결함',
    2: 'Layer 2: 용어집 위반',
    3: 'Layer 3: 문맥 오역',
    4: 'Layer 4: 번역 제외 대상',
  };

  console.log('═'.repeat(90));
  console.log('  i18n 4계층 검증 결과');
  console.log('═'.repeat(90));

  for (const layer of [1, 2, 3, 4] as const) {
    const layerIssues = issues.filter((i) => i.layer === layer);
    const fails = layerIssues.filter((i) => i.severity === 'FAIL');
    const warns = layerIssues.filter((i) => i.severity === 'WARN');
    const infos = layerIssues.filter((i) => i.severity === 'INFO');

    const status = fails.length > 0 ? '❌ FAIL' : warns.length > 0 ? '⚠️  WARN' : '✅ PASS';
    console.log(`\n${status} | ${layerNames[layer]} (FAIL=${fails.length}, WARN=${warns.length}, INFO=${infos.length})`);

    if (layerIssues.length > 0) {
      for (const issue of layerIssues.slice(0, 10)) { // 최대 10건만 출력
        const icon = issue.severity === 'FAIL' ? '❌' : issue.severity === 'WARN' ? '⚠️ ' : 'ℹ️ ';
        console.log(`  ${icon} [${issue.locale}] ${issue.key}`);
        console.log(`     ${issue.message}`);
        console.log(`     → 담당: ${issue.assignee}`);
      }
      if (layerIssues.length > 10) {
        console.log(`  ... 외 ${layerIssues.length - 10}건`);
      }
    }
  }

  // 요약
  const totalFail = issues.filter((i) => i.severity === 'FAIL').length;
  const totalWarn = issues.filter((i) => i.severity === 'WARN').length;
  const totalInfo = issues.filter((i) => i.severity === 'INFO').length;

  console.log('\n' + '═'.repeat(90));
  console.log(`  총계: FAIL=${totalFail}, WARN=${totalWarn}, INFO=${totalInfo}`);
  console.log('═'.repeat(90));

  // i18n-report.md 생성
  const reportPath = path.join(ROOT, 'i18n-report.md');
  const reportLines = [
    '# i18n 검증 리포트',
    '',
    `생성일시: ${new Date().toISOString()}`,
    '',
    `## 요약`,
    '',
    `| 계층 | FAIL | WARN | INFO | 상태 |`,
    `|------|------|------|------|------|`,
  ];

  for (const layer of [1, 2, 3, 4] as const) {
    const li = issues.filter((i) => i.layer === layer);
    const f = li.filter((i) => i.severity === 'FAIL').length;
    const w = li.filter((i) => i.severity === 'WARN').length;
    const info = li.filter((i) => i.severity === 'INFO').length;
    const st = f > 0 ? 'FAIL' : w > 0 ? 'WARN' : 'PASS';
    reportLines.push(`| ${layerNames[layer]} | ${f} | ${w} | ${info} | ${st} |`);
  }

  reportLines.push('', '## 상세', '');

  for (const issue of issues) {
    reportLines.push(`- **[${issue.severity}]** Layer ${issue.layer} | [${issue.locale}] \`${issue.key}\``);
    reportLines.push(`  - ${issue.message}`);
    reportLines.push(`  - 담당: ${issue.assignee}`);
  }

  fs.writeFileSync(reportPath, reportLines.join('\n'), 'utf-8');
  console.log(`\n📄 리포트 저장: ${reportPath}`);

  // Layer 4 이슈만 extraction-issues.md로 분리
  const layer4Issues = issues.filter((i) => i.layer === 4);
  if (layer4Issues.length > 0) {
    const extractionPath = path.join(ROOT, 'extraction-issues.md');
    const extLines = [
      '# 추출 필터 수정 요청 (Dev-A 반송)',
      '',
      `생성일시: ${new Date().toISOString()}`,
      '',
      '> 아래 항목들은 번역 대상이 아닌 텍스트입니다.',
      '> 추출 필터에서 제외해 주세요. (검증 명세 Layer 4)',
      '',
      '| Key | EN 원문 | 사유 |',
      '|-----|---------|------|',
    ];

    const seen = new Set<string>();
    for (const issue of layer4Issues) {
      if (seen.has(issue.key)) continue;
      seen.add(issue.key);
      const enValue = localeData['en'][issue.key] || '';
      extLines.push(`| \`${issue.key}\` | ${enValue} | 번역 제외 대상 (§9) |`);
    }

    fs.writeFileSync(extractionPath, extLines.join('\n'), 'utf-8');
    console.log(`📄 추출 이슈 저장: ${extractionPath}`);
  }

  // 종료 코드
  if (totalFail > 0) {
    console.log('\n❌ 검증 FAIL — 수정 후 재실행하세요.');
    process.exit(1);
  } else if (totalWarn > 0) {
    console.log('\n⚠️  검증 WARN — 검토가 필요합니다.');
  } else {
    console.log('\n✅ 검증 PASS — 모든 항목 통과!');
  }
}

validate().catch((err) => {
  console.error('❌ 검증 실패:', err);
  process.exit(1);
});
