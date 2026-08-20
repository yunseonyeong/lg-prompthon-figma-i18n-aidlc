/**
 * 라운드 실행기 코어
 *
 * 한 라운드의 흐름:
 *   ① 사전 차단 (Layer 0)  — 회귀/재발/제외미수정
 *   ② 4계층 검증           — 확정 항목은 건너뜀
 *   ③ 판정 기록            — confirmed / rejected / exclusions
 *   ④ 용어집 제안          — 자동 등재하지 않음 (사람 승인 게이트)
 *   ⑤ 지표 append
 *
 * 파일 I/O는 runRound()에서만 하고 판정 로직은 순수 함수로 분리했습니다.
 */
import { loadGlossary, type GlossaryData } from '../retrieval/glossary-loader.js';
import {
  loadConfirmed,
  saveConfirmed,
  loadRejected,
  saveRejected,
  loadExclusions,
  saveExclusions,
  appendRound,
  nextRoundNumber,
  type RoundMetrics,
} from '../retrieval/feedback-store.js';
import { runAllLayers } from './layers.js';
import {
  checkPreBlock,
  selectConfirmable,
  collectRejections,
  collectExclusions,
  mergeRejected,
  type FeedbackState,
} from './preblock.js';
import {
  discoverTermCandidates,
  findTermConflicts,
  loadProposals,
  saveProposals,
  findRepeatedViolations,
  type TermConflict,
} from './glossary-growth.js';
import type { Issue, LocaleBundle } from './types.js';

export interface RoundResult {
  round: number;
  issues: Issue[];
  metrics: RoundMetrics;
  repeatedViolations: Array<{ term: string; count: number; keys: string[] }>;
  newProposals: number;
  /** 이번 라운드에 새로 확정된 항목 수 */
  newlyConfirmed: number;
  /** 기존 용어와 충돌해 제안되지 않은 후보 (US-2.2 충돌 알림) */
  conflicts: TermConflict[];
}

export interface RoundOptions {
  /** 저장소에 쓰지 않고 결과만 계산 */
  dryRun?: boolean;
  /** 라운드 번호 강제 지정 */
  round?: number;
  glossary?: GlossaryData;
  feedback?: FeedbackState;
}

/**
 * 판정 로직 (순수 함수).
 * 저장소 상태와 번역 묶음을 받아 다음 상태를 계산합니다.
 */
export function evaluateRound(
  bundle: LocaleBundle,
  glossary: GlossaryData,
  feedback: FeedbackState,
  round: number
): {
  issues: Issue[];
  nextConfirmed: ReturnType<typeof selectConfirmable>;
  nextRejected: ReturnType<typeof mergeRejected>;
  nextExclusions: FeedbackState['exclusions'];
  metrics: RoundMetrics;
  repeatedViolations: ReturnType<typeof findRepeatedViolations>;
} {
  // ① 사전 차단
  const pre = checkPreBlock(bundle, feedback);

  // ② 4계층 검증 — 확정본과 동일한 항목은 건너뜀
  const layerIssues = runAllLayers(bundle, glossary, { skipKeys: pre.skipIds });

  const issues = [...pre.issues, ...layerIssues];

  // ③ 판정
  const nextConfirmed = selectConfirmable(bundle, issues, round, feedback.confirmed);
  const nextRejected = mergeRejected(feedback.rejected, collectRejections(issues, round));
  const nextExclusions = {
    ...feedback.exclusions,
    ...collectExclusions(bundle, issues, round),
  };

  // 지표
  const en = bundle['en'] ?? {};
  const targetCount = Object.keys(en).length * 3; // ko/ja/zh-CN
  const skipped = pre.skipIds.size;

  const metrics: RoundMetrics = {
    round,
    at: new Date().toISOString(),
    checked: Math.max(0, targetCount - skipped),
    skipped,
    fail: issues.filter((i) => i.severity === 'FAIL').length,
    warn: issues.filter((i) => i.severity === 'WARN').length,
    regressions: pre.counts.regressions,
    recurrences: pre.counts.recurrences,
    confirmedTotal: Object.keys(nextConfirmed).length,
    glossaryTerms: glossary.entries.length,
  };

  return {
    issues,
    nextConfirmed,
    nextRejected,
    nextExclusions,
    metrics,
    repeatedViolations: findRepeatedViolations(issues),
  };
}

/** 한 라운드 실행 (파일 I/O 포함) */
export function runRound(bundle: LocaleBundle, options: RoundOptions = {}): RoundResult {
  const glossary = options.glossary ?? loadGlossary();
  const feedback: FeedbackState =
    options.feedback ?? {
      confirmed: loadConfirmed(),
      rejected: loadRejected(),
      exclusions: loadExclusions(),
    };

  const round = options.round ?? nextRoundNumber();
  const prevConfirmedCount = Object.keys(feedback.confirmed).length;

  const result = evaluateRound(bundle, glossary, feedback, round);

  // ④ 용어집 제안
  let newProposals = 0;
  if (!options.dryRun) {
    const existing = loadProposals();
    const updated = discoverTermCandidates(bundle, glossary, round, existing);
    newProposals = Object.keys(updated).length - Object.keys(existing).length;
    saveProposals(updated);
  }

  // ⑤ 저장
  if (!options.dryRun) {
    saveConfirmed(result.nextConfirmed);
    saveRejected(result.nextRejected);
    saveExclusions(result.nextExclusions);
    appendRound(result.metrics);
  }

  return {
    round,
    issues: result.issues,
    metrics: result.metrics,
    repeatedViolations: result.repeatedViolations,
    newProposals,
    newlyConfirmed: Math.max(0, result.metrics.confirmedTotal - prevConfirmedCount),
    conflicts: findTermConflicts(bundle, glossary),
  };
}
