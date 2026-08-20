/**
 * i18n 검증 모듈 — 공개 진입점
 */
export * from './types.js';
export { containsTerm, translationContains } from '../retrieval/text-match.js';
export {
  flattenJson,
  extractPlaceholders,
  isExcludedSource,
  checkLayer1,
  checkLayer2,
  checkLayer3,
  checkLayer4,
  checkSourceQuality,
  runAllLayers,
  TARGET_LOCALES,
  type RunOptions,
} from './layers.js';
export {
  checkPreBlock,
  selectConfirmable,
  collectRejections,
  collectExclusions,
  mergeRejected,
  type FeedbackState,
  type PreBlockResult,
} from './preblock.js';
export {
  discoverTermCandidates,
  findTermConflicts,
  findRepeatedViolations,
  loadProposals,
  saveProposals,
  PROPOSAL_PATH,
  type TermProposal,
  type TermConflict,
} from './glossary-growth.js';
export {
  findEscalations,
  escalationsToIssues,
  escalatedIds,
  renderEscalationReport,
  MAX_RETRIES,
  type Escalation,
} from './escalation.js';
export {
  runRound,
  evaluateRound,
  type RoundResult,
  type RoundOptions,
} from './round.js';
