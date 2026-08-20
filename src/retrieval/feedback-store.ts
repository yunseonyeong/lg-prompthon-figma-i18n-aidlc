/**
 * 피드백 저장소
 *
 * 검증 결과를 라운드에 걸쳐 축적하여 자가발전 루프의 상태를 보관합니다.
 * 정확 조회가 목적이므로 벡터가 아닌 평문 JSON을 씁니다.
 * (key+locale로 정확히 찾아야 하는 데이터에 유사도 검색을 쓰면
 *  다른 항목이 1위로 올라오는 사고가 납니다)
 *
 * ─ confirmed.json  : 검증 통과한 확정 번역. 회귀 검출과 재사용의 기준
 * ─ rejected.json   : 거부된 번역 + 사유. 같은 실수 재발을 막는 금지 목록
 * ─ exclusions.json : Layer 4 번역 제외 확정 항목
 * ─ rounds.jsonl    : 라운드별 지표 (append only)
 *
 * 파일이 없어도 동작해야 합니다(최초 실행). 모든 read는 빈 값을 반환합니다.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const FEEDBACK_DIR = path.join(ROOT, 'data', 'feedback');

const FILES = {
  confirmed: path.join(FEEDBACK_DIR, 'confirmed.json'),
  rejected: path.join(FEEDBACK_DIR, 'rejected.json'),
  exclusions: path.join(FEEDBACK_DIR, 'exclusions.json'),
  rounds: path.join(FEEDBACK_DIR, 'rounds.jsonl'),
} as const;

/** 확정 번역 1건. id는 `${key}::${locale}` */
export interface ConfirmedEntry {
  key: string;
  locale: string;
  sourceText: string;
  translation: string;
  confirmedAtRound: number;
  /** 통과한 검증 계층 */
  verifiedBy: string[];
}

/** 거부된 번역 1건 */
export interface RejectedEntry {
  key: string;
  locale: string;
  /** 거부된 번역문 */
  wrong: string;
  reason: string;
  layer: number;
  round: number;
  /** 올바른 번역이 확정된 경우 */
  correct?: string;
}

/** 번역 제외 확정 항목 (Layer 4) */
export interface ExclusionEntry {
  key: string;
  sourceText: string
  reason: string;
  round: number;
}

/** 라운드 지표 */
export interface RoundMetrics {
  round: number;
  at: string;
  /** 검증을 실제로 수행한 항목 수 */
  checked: number;
  /** 확정되어 검증을 건너뛴 항목 수 */
  skipped: number;
  fail: number;
  warn: number;
  /** 회귀: 확정본과 달라진 항목 수 */
  regressions: number;
  /** 재발: 과거 거부된 번역이 다시 나온 항목 수 */
  recurrences: number;
  confirmedTotal: number;
  glossaryTerms: number;
}

function ensureDir(): void {
  fs.mkdirSync(FEEDBACK_DIR, { recursive: true });
}

function readJson<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown): void {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

export function makeId(key: string, locale: string): string {
  return `${key}::${locale}`;
}

// ── confirmed ──────────────────────────────────────────

export function loadConfirmed(): Record<string, ConfirmedEntry> {
  return readJson<Record<string, ConfirmedEntry>>(FILES.confirmed, {});
}

export function saveConfirmed(data: Record<string, ConfirmedEntry>): void {
  writeJson(FILES.confirmed, data);
}

// ── rejected ───────────────────────────────────────────

/** id → 거부 이력 배열 (같은 항목이 여러 번 거부될 수 있음) */
export function loadRejected(): Record<string, RejectedEntry[]> {
  return readJson<Record<string, RejectedEntry[]>>(FILES.rejected, {});
}

export function saveRejected(data: Record<string, RejectedEntry[]>): void {
  writeJson(FILES.rejected, data);
}

// ── exclusions ─────────────────────────────────────────

export function loadExclusions(): Record<string, ExclusionEntry> {
  return readJson<Record<string, ExclusionEntry>>(FILES.exclusions, {});
}

export function saveExclusions(data: Record<string, ExclusionEntry>): void {
  writeJson(FILES.exclusions, data);
}

// ── rounds ─────────────────────────────────────────────

export function loadRounds(): RoundMetrics[] {
  try {
    if (!fs.existsSync(FILES.rounds)) return [];
    return fs
      .readFileSync(FILES.rounds, 'utf-8')
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as RoundMetrics);
  } catch {
    return [];
  }
}

/** 라운드 지표 추가 (append — 기존 이력을 덮어쓰지 않음) */
export function appendRound(metrics: RoundMetrics): void {
  ensureDir();
  fs.appendFileSync(FILES.rounds, JSON.stringify(metrics) + '\n', 'utf-8');
}

/** 다음 라운드 번호 */
export function nextRoundNumber(): number {
  const rounds = loadRounds();
  return rounds.length === 0 ? 1 : Math.max(...rounds.map((r) => r.round)) + 1;
}

export const FEEDBACK_PATHS = FILES;
