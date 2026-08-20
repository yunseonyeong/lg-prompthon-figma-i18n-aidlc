/**
 * Layer 0: 사전 차단 (축적된 피드백 기반)
 *
 * 4계층 검증을 돌리기 전에, 이미 알고 있는 것부터 걸러냅니다.
 * 이 계층이 자가발전의 실체입니다 — 라운드가 지날수록 여기서 걸리는 비율이
 * 올라가고, 실제 검증(Layer 1~4)에 도달하는 항목 수가 줄어듭니다.
 *
 * 세 가지를 봅니다.
 *   ① 회귀(regression)       확정된 번역이 다른 값으로 바뀌어 왔다
 *   ② 재발(recurrence)       과거 거부된 번역이 또 왔다
 *   ③ 제외 미수정(unfixed)   추출 제외 확정 항목이 또 왔다
 *
 * ①이 특히 중요합니다. LLM은 같은 입력에도 출력이 흔들리므로,
 * 2라운드에서 통과한 번역이 3라운드에서 망가질 수 있습니다.
 * 이를 잡지 못하면 "개선"이 아니라 "요동"이 됩니다.
 */
import type {
  ConfirmedEntry,
  ExclusionEntry,
  RejectedEntry,
} from '../retrieval/feedback-store.js';
import { makeId } from '../retrieval/feedback-store.js';
import { ASSIGNEES, type Issue, type LocaleBundle } from './types.js';
import { TARGET_LOCALES } from './layers.js';

export interface FeedbackState {
  confirmed: Record<string, ConfirmedEntry>;
  rejected: Record<string, RejectedEntry[]>;
  exclusions: Record<string, ExclusionEntry>;
}

export interface PreBlockResult {
  issues: Issue[];
  /** 확정본과 값이 동일해 검증을 건너뛸 수 있는 id 집합 */
  skipIds: Set<string>;
  counts: {
    regressions: number;
    recurrences: number;
    unfixedExclusions: number;
    matchedConfirmed: number;
  };
}

export function checkPreBlock(
  bundle: LocaleBundle,
  feedback: FeedbackState
): PreBlockResult {
  const issues: Issue[] = [];
  const skipIds = new Set<string>();
  const counts = {
    regressions: 0,
    recurrences: 0,
    unfixedExclusions: 0,
    matchedConfirmed: 0,
  };

  const en = bundle['en'] ?? {};

  // ── ① 회귀 + 확정 일치 ──
  for (const [id, entry] of Object.entries(feedback.confirmed)) {
    const current = bundle[entry.locale]?.[entry.key];
    if (current === undefined) continue; // key 자체가 없으면 Layer 1이 잡는다

    if (current === entry.translation) {
      // 확정본과 동일 → 재검증 불필요
      skipIds.add(id);
      counts.matchedConfirmed++;
    } else {
      counts.regressions++;
      issues.push({
        layer: 0,
        severity: 'FAIL',
        key: entry.key,
        locale: entry.locale,
        blockKind: 'regression',
        message:
          `회귀: R${entry.confirmedAtRound}에서 확정된 번역이 변경됨. ` +
          `확정 "${entry.translation}" → 현재 "${current}"`,
        assignee: ASSIGNEES.devA,
        rule: `confirmed@R${entry.confirmedAtRound}`,
        actual: current,
        expected: entry.translation,
      });
    }
  }

  // ── ② 재발 ──
  for (const [id, history] of Object.entries(feedback.rejected)) {
    const first = history[0];
    if (!first) continue;
    const current = bundle[first.locale]?.[first.key];
    if (current === undefined) continue;

    const hit = history.find((h) => h.wrong === current);
    if (hit) {
      counts.recurrences++;
      issues.push({
        layer: 0,
        severity: 'FAIL',
        key: first.key,
        locale: first.locale,
        blockKind: 'recurrence',
        message:
          `재발: R${hit.round}에서 거부된 번역이 다시 제출됨 "${hit.wrong}" — ${hit.reason}` +
          (hit.correct ? ` (기대 "${hit.correct}")` : ''),
        assignee: ASSIGNEES.devA,
        rule: `rejected@R${hit.round}`,
        actual: current,
        expected: hit.correct,
      });
      // 재발한 항목은 확정 후보에서 제외되도록 skip하지 않는다
      skipIds.delete(id);
    }
  }

  // ── ③ 제외 미수정 ──
  for (const exclusion of Object.values(feedback.exclusions)) {
    // 원문이 여전히 존재하면 추출 필터가 수정되지 않은 것
    if (!(exclusion.key in en)) continue;

    const translated = TARGET_LOCALES.filter((loc) => {
      const tv = bundle[loc]?.[exclusion.key];
      return tv !== undefined && tv !== en[exclusion.key];
    });

    if (translated.length > 0) {
      counts.unfixedExclusions++;
      issues.push({
        layer: 0,
        severity: 'FAIL',
        key: exclusion.key,
        locale: translated.join(','),
        blockKind: 'unfixed-exclusion',
        message:
          `추출 제외 미수정: R${exclusion.round}에 반송한 항목이 여전히 번역됨 ` +
          `("${exclusion.sourceText}") — ${exclusion.reason}`,
        assignee: ASSIGNEES.devAExtract,
        rule: 'glossary §9',
        actual: translated.map((l) => bundle[l][exclusion.key]).join(' / '),
        expected: exclusion.sourceText,
      });
    }
  }

  return { issues, skipIds, counts };
}

/** 확정 후보 판정: 문제가 없는 (key, locale) 조합을 추린다 */
export function selectConfirmable(
  bundle: LocaleBundle,
  issues: Issue[],
  round: number,
  alreadyConfirmed: Record<string, ConfirmedEntry>
): Record<string, ConfirmedEntry> {
  const en = bundle['en'] ?? {};

  // 문제가 하나라도 있는 id는 확정 대상에서 제외
  const problematic = new Set<string>();
  for (const issue of issues) {
    if (issue.severity === 'INFO') continue; // 원문 오타는 번역 확정을 막지 않는다
    // locale이 콤마로 여러 개인 경우(사전차단 ③) 모두 제외
    for (const loc of issue.locale.split(',')) {
      problematic.add(makeId(issue.key, loc.trim()));
    }
  }

  const result: Record<string, ConfirmedEntry> = {};

  for (const [key, sourceText] of Object.entries(en)) {
    for (const locale of TARGET_LOCALES) {
      const translation = bundle[locale]?.[key];
      if (translation === undefined) continue;

      const id = makeId(key, locale);
      if (problematic.has(id)) continue;

      // 이미 확정된 항목은 라운드 정보를 유지한다
      const prev = alreadyConfirmed[id];
      if (prev && prev.translation === translation) {
        result[id] = prev;
        continue;
      }

      result[id] = {
        key,
        locale,
        sourceText,
        translation,
        confirmedAtRound: round,
        verifiedBy: ['layer1', 'layer2', 'layer3', 'layer4'],
      };
    }
  }

  return result;
}

/** FAIL 이슈를 거부 이력으로 변환 */
export function collectRejections(
  issues: Issue[],
  round: number
): Record<string, RejectedEntry[]> {
  const out: Record<string, RejectedEntry[]> = {};

  for (const issue of issues) {
    if (issue.severity !== 'FAIL') continue;
    // 사전 차단은 이미 기록된 이력이므로 다시 쌓지 않는다
    if (issue.layer === 0) continue;
    // 구조적 결함(key 누락 등)은 번역문이 없어 금지 목록의 의미가 없다
    if (issue.actual === undefined) continue;

    for (const loc of issue.locale.split(',')) {
      const locale = loc.trim();
      if (locale === 'en') continue;
      const id = makeId(issue.key, locale);
      out[id] ??= [];
      out[id].push({
        key: issue.key,
        locale,
        wrong: issue.actual,
        reason: `${issue.message}${issue.rule ? ` [${issue.rule}]` : ''}`,
        layer: issue.layer,
        round,
        correct: issue.expected,
      });
    }
  }

  return out;
}

/** Layer 4 이슈를 제외 확정 목록으로 변환 */
export function collectExclusions(
  bundle: LocaleBundle,
  issues: Issue[],
  round: number
): Record<string, ExclusionEntry> {
  const en = bundle['en'] ?? {};
  const out: Record<string, ExclusionEntry> = {};

  for (const issue of issues) {
    if (issue.layer !== 4) continue;
    if (out[issue.key]) continue;
    out[issue.key] = {
      key: issue.key,
      sourceText: en[issue.key] ?? '',
      reason: issue.rule ?? 'glossary §9',
      round,
    };
  }

  return out;
}

/** 기존 거부 이력에 새 이력을 병합 (중복 제거) */
export function mergeRejected(
  existing: Record<string, RejectedEntry[]>,
  incoming: Record<string, RejectedEntry[]>
): Record<string, RejectedEntry[]> {
  const merged: Record<string, RejectedEntry[]> = { ...existing };

  for (const [id, entries] of Object.entries(incoming)) {
    const list = merged[id] ? [...merged[id]] : [];
    for (const e of entries) {
      // 같은 번역문 + 같은 계층은 중복으로 보고 쌓지 않는다
      const dup = list.some((x) => x.wrong === e.wrong && x.layer === e.layer);
      if (!dup) list.push(e);
    }
    merged[id] = list;
  }

  return merged;
}
