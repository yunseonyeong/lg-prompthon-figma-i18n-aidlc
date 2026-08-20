/**
 * 에스컬레이션 판정 (US-2.4)
 *
 * 수용 기준: "최대 3회 재시도 후에도 FAIL이면 사람에게 에스컬레이션"
 * 검증 명세: "재시도 상한: 3회. 초과 시 사람에게 에스컬레이션."
 *
 * 재시도 횟수는 이미 축적된 데이터로 계산합니다.
 * `rejected[id]`는 그 항목이 거부된 이력의 배열이므로 길이가 곧 시도 횟수입니다.
 *
 * 자동 루프를 무한히 돌리지 않는 것이 목적입니다. 같은 항목이 3번 고쳐지지
 * 않았다면 규칙이나 원문에 문제가 있는 것이고, 사람이 봐야 합니다.
 */
import type { RejectedEntry } from '../retrieval/feedback-store.js';
import { ASSIGNEES, type Issue, type LocaleBundle } from './types.js';

/** 재시도 상한 — 이 횟수만큼 거부되면 자동 재번역을 멈춘다 */
export const MAX_RETRIES = 3;

export interface Escalation {
  key: string;
  locale: string;
  sourceText: string;
  /** 현재 번역 (없을 수 있음) */
  current?: string;
  /** 시도 횟수 = 거부 이력 수 */
  attempts: number;
  /** 거부된 번역들 */
  attemptedTranslations: string[];
  /** 반복된 사유 (중복 제거) */
  reasons: string[];
  /** 마지막 거부 라운드 */
  lastRound: number;
  /** 최초 거부 라운드 */
  firstRound: number;
  /** 관련 계층 */
  layers: number[];
  assignee: string;
}

/**
 * 3회 이상 거부된 항목을 에스컬레이션 대상으로 판정.
 *
 * 이미 해결된 항목(현재 번역이 거부 목록에 없음)은 제외합니다.
 * 과거에 3번 틀렸어도 지금 맞으면 사람이 볼 필요가 없습니다.
 */
export function findEscalations(
  bundle: LocaleBundle,
  rejected: Record<string, RejectedEntry[]>
): Escalation[] {
  const en = bundle['en'] ?? {};
  const out: Escalation[] = [];

  for (const [, history] of Object.entries(rejected)) {
    const first = history[0];
    if (!first) continue;

    // 재시도 횟수 = 거부 발생 총 횟수.
    // 같은 오역이 반복 제출되어도 시도 1회로 세면 상한에 영원히 도달하지 않는다.
    const attempts = history.reduce((sum, h) => sum + (h.occurrences ?? 1), 0);
    if (attempts < MAX_RETRIES) continue;

    const current = bundle[first.locale]?.[first.key];

    // 현재 번역이 거부 목록에 없으면 해결된 것으로 본다
    const stillBroken =
      current === undefined || history.some((h) => h.wrong === current);
    if (!stillBroken) continue;

    const rounds = history.flatMap((h) => [h.round, h.lastRound ?? h.round]);
    out.push({
      key: first.key,
      locale: first.locale,
      sourceText: en[first.key] ?? first.wrong,
      current,
      attempts,
      attemptedTranslations: [...new Set(history.map((h) => h.wrong))],
      reasons: [...new Set(history.map((h) => h.reason))],
      firstRound: Math.min(...rounds),
      lastRound: Math.max(...rounds),
      layers: [...new Set(history.map((h) => h.layer))].sort(),
      assignee: ASSIGNEES.devA,
    });
  }

  return out.sort((a, b) => b.attempts - a.attempts);
}

/** 에스컬레이션을 Issue로 변환 (리포트에 함께 싣기 위함) */
export function escalationsToIssues(escalations: Escalation[]): Issue[] {
  return escalations.map((e) => ({
    layer: 0,
    severity: 'FAIL',
    key: e.key,
    locale: e.locale,
    message:
      `에스컬레이션: ${e.attempts}회 재시도 후에도 미해결 (R${e.firstRound}~R${e.lastRound}). ` +
      `시도된 번역: ${e.attemptedTranslations.map((t) => `"${t}"`).join(', ')} — 사람 판단 필요`,
    assignee: `사람 검토 (${e.assignee})`,
    rule: `US-2.4 재시도 상한 ${MAX_RETRIES}회`,
    actual: e.current,
  }));
}

/**
 * 자동 재번역 대상에서 제외할 id 집합.
 * 상한을 넘긴 항목을 계속 재번역하면 같은 실패를 반복하며 토큰만 소모합니다.
 */
export function escalatedIds(escalations: Escalation[]): Set<string> {
  return new Set(escalations.map((e) => `${e.key}::${e.locale}`));
}

/** 에스컬레이션 리포트 마크다운 */
export function renderEscalationReport(escalations: Escalation[]): string {
  const lines: string[] = [
    '# 에스컬레이션 — 사람 검토 필요',
    '',
    `생성일시: ${new Date().toISOString()}`,
    '',
    `재시도 상한 ${MAX_RETRIES}회를 초과한 항목입니다 (US-2.4).`,
    '자동 재번역으로 해결되지 않았으므로 규칙이나 원문 자체를 봐야 합니다.',
    '',
  ];

  if (escalations.length === 0) {
    lines.push('현재 에스컬레이션 대상이 없습니다.');
    return lines.join('\n') + '\n';
  }

  lines.push(
    `## 대상 ${escalations.length}건`,
    '',
    '| Key | Locale | 시도 | 원문 | 현재 | 라운드 |',
    '|-----|--------|------|------|------|--------|'
  );
  for (const e of escalations) {
    lines.push(
      `| \`${e.key}\` | ${e.locale} | ${e.attempts}회 | ${e.sourceText} | ` +
        `${e.current ?? '-'} | R${e.firstRound}~R${e.lastRound} |`
    );
  }

  lines.push('', '## 상세', '');
  for (const e of escalations) {
    lines.push(`### \`${e.key}\` [${e.locale}]`, '');
    lines.push(`- 원문: ${e.sourceText}`);
    lines.push(`- 현재 번역: ${e.current ?? '(없음)'}`);
    lines.push(`- 시도 횟수: ${e.attempts} (R${e.firstRound}~R${e.lastRound})`);
    lines.push(`- 관련 계층: ${e.layers.map((l) => `Layer ${l}`).join(', ')}`);
    lines.push(`- 시도된 번역:`);
    for (const t of e.attemptedTranslations) lines.push(`  - "${t}"`);
    lines.push(`- 거부 사유:`);
    for (const r of e.reasons) lines.push(`  - ${r}`);
    lines.push('');
    lines.push('검토 포인트: 같은 항목이 반복 실패하면 보통 아래 중 하나입니다.');
    lines.push('  1. 용어집에 등재해야 하는 용어가 빠져 있다');
    lines.push('  2. 원문 자체가 모호하거나 문장 조각이다 (디자이너 확인)');
    lines.push('  3. 검증 규칙이 과하게 엄격하다 (규칙 조정)');
    lines.push('');
  }

  return lines.join('\n') + '\n';
}
