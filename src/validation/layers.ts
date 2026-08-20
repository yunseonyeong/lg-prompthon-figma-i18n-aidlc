/**
 * 4계층 검증 규칙 (순수 함수)
 *
 * 파일 I/O를 하지 않으므로 테스트와 재사용이 쉽습니다.
 * validate-i18n(무상태 리포트)과 round-check(누적 루프)가 같은 함수를 씁니다.
 * 규칙이 두 곳에 중복되면 반드시 어긋나기 때문입니다.
 */
import type { GlossaryData, GlossaryEntry } from '../retrieval/glossary-loader.js';
import { ASSIGNEES, type Issue, type LocaleBundle } from './types.js';
import { containsTerm, translationContains } from '../retrieval/text-match.js';

export const TARGET_LOCALES = ['ko', 'ja', 'zh-CN'] as const;

// ─────────────────────────────────────────────────────────
// 공용 유틸
// ─────────────────────────────────────────────────────────

/** 중첩 JSON을 flat key/value로 */
export function flattenJson(
  obj: Record<string, unknown>,
  prefix = ''
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      Object.assign(out, flattenJson(v as Record<string, unknown>, key));
    } else if (typeof v === 'string') {
      out[key] = v;
    }
  }
  return out;
}

// 용어 매칭은 리트리버와 규칙을 공유한다 (src/retrieval/text-match.ts)
export { containsTerm, translationContains } from '../retrieval/text-match.js';

/**
 * 단수/복수 판정용 정규화.
 * 용어집 §7("단수/복수는 한국어에서 구분하지 않는다")에 따라
 * Device / Devices 를 같은 것으로 본다.
 */
export function normalizeForNumber(text: string): string {
  return text
    .trim()
    .replace(/\s*\*\s*$/, '')
    .toLowerCase()
    .replace(/(ies)$/, 'y')
    .replace(/(ses|xes|zes|ches|shes)$/, '')
    .replace(/s$/, '');
}

/** placeholder 추출 ({0}, {{name}}, %s 등) */
export function extractPlaceholders(text: string): string[] {
  return text.match(/\{\{?[\w\s]+\}?\}|%[sd]|%\d+\$[sd]/g) ?? [];
}

function expectedFor(entry: GlossaryEntry, locale: string): string {
  if (locale === 'ko') return entry.ko;
  if (locale === 'ja') return entry.ja;
  if (locale === 'zh-CN') return entry.zhCN;
  return '';
}

// ─────────────────────────────────────────────────────────
// Layer 1: 구조적 결함 → Dev-A
// ─────────────────────────────────────────────────────────

export function checkLayer1(bundle: LocaleBundle): Issue[] {
  const issues: Issue[] = [];
  const en = bundle['en'];
  if (!en) return issues;

  const enKeys = Object.keys(en);
  const targets = Object.keys(bundle).filter((l) => l !== 'en');

  for (const locale of targets) {
    const target = bundle[locale];

    // key 누락
    for (const key of enKeys) {
      if (!(key in target)) {
        issues.push({
          layer: 1,
          severity: 'FAIL',
          key,
          locale,
          message: `Key 누락: en에 있으나 ${locale}에 없음`,
          assignee: ASSIGNEES.devA,
          rule: 'key 구조 동일',
        });
      }
    }

    // 초과 key
    for (const key of Object.keys(target)) {
      if (!(key in en)) {
        issues.push({
          layer: 1,
          severity: 'FAIL',
          key,
          locale,
          message: `초과 key: ${locale}에만 존재`,
          assignee: ASSIGNEES.devA,
          rule: 'key 구조 동일',
        });
      }
    }

    // placeholder 손실
    for (const key of enKeys) {
      const targetValue = target[key];
      if (!targetValue) continue;
      const enPH = extractPlaceholders(en[key]);
      const tPH = extractPlaceholders(targetValue);
      for (const ph of enPH) {
        if (!tPH.includes(ph)) {
          issues.push({
            layer: 1,
            severity: 'FAIL',
            key,
            locale,
            message: `Placeholder 손실: "${ph}"`,
            assignee: ASSIGNEES.devA,
            rule: 'placeholder 보존',
            actual: targetValue,
            expected: en[key],
          });
        }
      }
    }
  }

  return issues;
}

// ─────────────────────────────────────────────────────────
// Layer 2: 용어집 위반 → Dev-A / Dev-B
// ─────────────────────────────────────────────────────────

export function checkLayer2(bundle: LocaleBundle, glossary: GlossaryData): Issue[] {
  const issues: Issue[] = [];
  const en = bundle['en'];
  if (!en) return issues;

  const targets = Object.keys(bundle).filter((l) => l !== 'en');
  const productNameSet = new Set(glossary.productNames.map((p) => p.toLowerCase()));

  for (const [key, enValue] of Object.entries(en)) {
    // 번역 제외 대상(§9)은 번역 대상이 아니므로 용어집 규칙을 적용하지 않는다.
    // 이를 빼먹으면 추출 필터를 수정해 원문을 되돌린 순간
    // "용어 불일치"로 잡히는 오탐이 발생한다.
    if (isExcludedSource(enValue, glossary.excludePatterns)) continue;

    // 제품명 번역 금지 (§7)
    for (const product of glossary.productNames) {
      if (!containsTerm(enValue, product)) continue;
      for (const locale of targets) {
        const tv = bundle[locale][key];
        if (!tv) continue;
        if (tv !== enValue && !tv.includes(product)) {
          issues.push({
            layer: 2,
            severity: 'FAIL',
            key,
            locale,
            message: `제품명 번역 금지 위반: "${product}" → "${tv}"`,
            assignee: ASSIGNEES.devA,
            rule: 'glossary §7',
            actual: tv,
            expected: product,
          });
        }
      }
    }

    // 등록 용어 번역 일치 (§1, §8-2)
    for (const entry of glossary.entries) {
      if (!entry.english) continue;
      if (productNameSet.has(entry.english.toLowerCase())) continue; // 제품명은 위에서 처리
      if (!containsTerm(enValue, entry.english)) continue;

      for (const locale of targets) {
        const tv = bundle[locale][key];
        if (!tv) continue;
        const expected = expectedFor(entry, locale);
        if (!expected) continue;

        if (!translationContains(tv, expected)) {
          issues.push({
            layer: 2,
            severity: 'WARN',
            key,
            locale,
            message: `용어 불일치: "${entry.english}" → 기대 "${expected}"`,
            assignee: ASSIGNEES.devAB,
            rule: 'glossary §1',
            actual: tv,
            expected,
          });
        }
      }
    }
  }

  // L2-03: 서로 다른 원문이 같은 번역으로 매핑됨
  // 검증 명세의 알려진 결함: Settings / Setting 둘 다 "설정"
  //
  // ⚠️ 용어집 §7과 충돌하지 않도록 단수/복수 변형은 제외한다.
  //    "단수/복수는 한국어에서 구분하지 않는다. Device/Devices 모두 장치."
  //    즉 Device/Devices → 장치 는 규정된 동작이며 결함이 아니다.
  for (const locale of targets) {
    const byTranslation = new Map<string, Array<{ key: string; source: string }>>();
    for (const [key, enValue] of Object.entries(en)) {
      if (isExcludedSource(enValue, glossary.excludePatterns)) continue;
      const tv = bundle[locale][key];
      if (!tv) continue;
      const list = byTranslation.get(tv) ?? [];
      list.push({ key, source: enValue });
      byTranslation.set(tv, list);
    }

    for (const [translation, items] of byTranslation) {
      const distinctSources = [...new Set(items.map((i) => i.source))];
      if (distinctSources.length < 2) continue;
      // 용어집 §7 예외: 등재된 용어의 단수/복수 변형은 같은 번역이 규정된 동작이다.
      //   "단수/복수는 한국어에서 구분하지 않는다. Device/Devices 모두 장치."
      // 단, 등재되지 않은 표현(Settings/Setting)은 서로 다른 의미일 수 있어
      // 검증 명세가 L2-03 결함으로 지목한다. 등재 여부로 구분한다.
      const bases = new Set(distinctSources.map(normalizeForNumber));
      if (bases.size === 1) {
        const base = [...bases][0];
        const isRegisteredEntity = glossary.entries.some(
          (e) => e.english && normalizeForNumber(e.english) === base
        );
        if (isRegisteredEntity) continue;
      }
      // 첫 항목에만 보고 (같은 내용을 N번 반복하지 않는다)
      issues.push({
        layer: 2,
        severity: 'WARN',
        key: items[0].key,
        locale,
        message:
          `동일 번역 중복: 서로 다른 원문 ${distinctSources.map((s) => `"${s}"`).join(', ')} ` +
          `이 모두 "${translation}" 으로 번역됨`,
        assignee: ASSIGNEES.devAB,
        rule: 'L2-03 (검증 명세)',
        actual: translation,
      });
    }
  }

  // ON/OFF 표기 (§6) — 한국어만
  const ko = bundle['ko'];
  if (ko) {
    for (const [key, value] of Object.entries(ko)) {
      if (key.includes('button') && value === '끔') {
        issues.push({
          layer: 2,
          severity: 'WARN',
          key,
          locale: 'ko',
          message: 'ON/OFF 표기 위반: 버튼은 "끄기", 상태는 "꺼짐"',
          assignee: ASSIGNEES.devB,
          rule: 'glossary §6',
          actual: value,
          expected: '끄기',
        });
      }
    }
  }

  return issues;
}

// ─────────────────────────────────────────────────────────
// Layer 3: 문맥 오역 → Dev-B → Dev-A
// ─────────────────────────────────────────────────────────

/** 도메인에서 오역이 반복되는 지점을 규칙화 */
const CONTEXT_TRAPS: Array<{
  en: RegExp;
  locale: string;
  wrong: RegExp;
  correct: string;
  note: string;
}> = [
  {
    en: /\bextend\b/i,
    locale: 'ko',
    wrong: /확장/,
    correct: '연장',
    note: '라이선스 유효기간 연장 (화면 확장 아님)',
  },
  {
    en: /\bwithdraw\b/i,
    locale: 'ko',
    wrong: /탈퇴/,
    correct: '회수',
    note: '할당 라이선스 회수 (계정 탈퇴 아님)',
  },
  {
    en: /\bvertical\b/i,
    locale: 'ko',
    wrong: /세로|수직/,
    correct: '산업 분야',
    note: '업종 분류 (화면 방향 아님)',
  },
  {
    en: /\bplayer\b/i,
    locale: 'ko',
    wrong: /플레이어/,
    correct: '재생 장치',
    note: 'Signage 도메인의 재생 장치',
  },
];

export function checkLayer3(bundle: LocaleBundle, glossary?: GlossaryData): Issue[] {
  const issues: Issue[] = [];
  const en = bundle['en'];
  if (!en) return issues;

  for (const [key, enValue] of Object.entries(en)) {
    if (glossary && isExcludedSource(enValue, glossary.excludePatterns)) continue;
    for (const trap of CONTEXT_TRAPS) {
      if (!trap.en.test(enValue)) continue;
      const tv = bundle[trap.locale]?.[key];
      if (!tv) continue;
      if (trap.wrong.test(tv)) {
        issues.push({
          layer: 3,
          severity: 'FAIL',
          key,
          locale: trap.locale,
          message: `문맥 오역: "${enValue}" → "${tv}" (기대 "${trap.correct}" — ${trap.note})`,
          assignee: ASSIGNEES.devBtoA,
          rule: 'glossary §3, §5',
          actual: tv,
          expected: trap.correct,
        });
      }
    }
  }

  return issues;
}

// ─────────────────────────────────────────────────────────
// Layer 4: 번역 제외 대상 → Dev-A (추출 필터)
// ─────────────────────────────────────────────────────────

/** 원문이 번역 대상이 아닌지 판정 (glossary §9) */
export function isExcludedSource(enValue: string, patterns: string[]): boolean {
  return patterns.some((p) => enValue.includes(p));
}

export function checkLayer4(bundle: LocaleBundle, glossary: GlossaryData): Issue[] {
  const issues: Issue[] = [];
  const en = bundle['en'];
  if (!en) return issues;

  const targets = Object.keys(bundle).filter((l) => l !== 'en');

  for (const [key, enValue] of Object.entries(en)) {
    if (!isExcludedSource(enValue, glossary.excludePatterns)) continue;

    const translated = targets.filter((loc) => {
      const tv = bundle[loc][key];
      return tv !== undefined && tv !== enValue;
    });

    if (translated.length > 0) {
      for (const locale of translated) {
        issues.push({
          layer: 4,
          severity: 'FAIL',
          key,
          locale,
          message: `번역 제외 대상이 번역됨: "${enValue}" → "${bundle[locale][key]}"`,
          assignee: ASSIGNEES.devAExtract,
          rule: 'glossary §9',
          actual: bundle[locale][key],
          expected: enValue,
        });
      }
    } else {
      // 번역되지 않았어도 애초에 추출되면 안 됐던 항목이다.
      // 번역 여부로 통과시키면 추출 필터가 고쳐지지 않아 매 라운드 재등장한다.
      // (검증 명세의 알려진 결함 12건 중 FileName_sample_00123.jpg 가 이 경우)
      issues.push({
        layer: 4,
        severity: 'FAIL',
        key,
        locale: 'en',
        message: `번역 제외 대상이 추출됨 (번역은 안 됨): "${enValue}" — key 자체를 제거해야 함`,
        assignee: ASSIGNEES.devAExtract,
        rule: 'glossary §9',
        actual: enValue,
        expected: '(추출 제외)',
      });
    }
  }

  return issues;
}

// ─────────────────────────────────────────────────────────
// 부가: 원문 품질 → 디자이너
// ─────────────────────────────────────────────────────────

const SOURCE_TYPOS: Array<{ wrong: string; right: string }> = [
  { wrong: 'detailes', right: 'details' },
  // 검증 명세의 알려진 결함: Thema 2건 (Theme 오타)
  { wrong: 'thema', right: 'theme' },
  { wrong: 'recieve', right: 'receive' },
  { wrong: 'occured', right: 'occurred' },
  { wrong: 'seperate', right: 'separate' },
  { wrong: 'sucessful', right: 'successful' },
];

/**
 * 문장 조각 — 단독으로 의미가 성립하지 않는 원문.
 *
 * 검증 명세의 알려진 결함: `is required`
 * UI에서 다른 텍스트와 조합되어 쓰이는 조각이라 그대로 번역하면
 * 어순이 다른 언어에서 문장이 깨진다. placeholder 로 만들어야 한다.
 */
const FRAGMENT_PATTERNS: Array<{ re: RegExp; note: string }> = [
  { re: /^is\s+required$/i, note: '주어가 없는 조각. "{field} is required" 형태의 placeholder 필요' },
  { re: /^(and|or|of|to|for|with)$/i, note: '전치사/접속사 단독' },
  { re: /^(please|must)\b/i, note: '동사 없는 지시문 조각 가능성' },
];

export function checkSourceQuality(bundle: LocaleBundle): Issue[] {
  const issues: Issue[] = [];
  const en = bundle['en'];
  if (!en) return issues;

  for (const [key, enValue] of Object.entries(en)) {
    for (const t of SOURCE_TYPOS) {
      if (enValue.toLowerCase().includes(t.wrong)) {
        issues.push({
          layer: 3,
          severity: 'INFO',
          key,
          locale: 'en',
          message: `원문 오타: "${t.wrong}" → "${t.right}"`,
          assignee: ASSIGNEES.designer,
          rule: '원문 품질',
          actual: enValue,
        });
      }
    }

    const trimmed = enValue.trim();
    for (const f of FRAGMENT_PATTERNS) {
      if (f.re.test(trimmed)) {
        issues.push({
          layer: 3,
          severity: 'INFO',
          key,
          locale: 'en',
          message: `문장 조각: "${trimmed}" — ${f.note}`,
          assignee: ASSIGNEES.designer,
          rule: '원문 품질',
          actual: enValue,
        });
        break;
      }
    }
  }

  return issues;
}

// ─────────────────────────────────────────────────────────
// 전체 실행
// ─────────────────────────────────────────────────────────

export interface RunOptions {
  /** 이 key들은 검증을 건너뜁니다 (이미 확정된 항목) */
  skipKeys?: Set<string>;
}

/** 4계층 + 부가 검사를 모두 실행 */
export function runAllLayers(
  bundle: LocaleBundle,
  glossary: GlossaryData,
  options: RunOptions = {}
): Issue[] {
  const issues = [
    ...checkLayer1(bundle),
    ...checkLayer2(bundle, glossary),
    ...checkLayer3(bundle, glossary),
    ...checkLayer4(bundle, glossary),
    ...checkSourceQuality(bundle),
  ];

  if (options.skipKeys && options.skipKeys.size > 0) {
    const skip = options.skipKeys;
    return issues.filter((i) => !skip.has(`${i.key}::${i.locale}`));
  }
  return issues;
}
