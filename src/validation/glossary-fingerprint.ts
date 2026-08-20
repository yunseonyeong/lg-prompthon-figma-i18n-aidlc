/**
 * 용어집 지문 (fingerprint)
 *
 * 확정 번역(confirmed)은 "그 시점의 용어집 기준으로 통과했다"는 기록입니다.
 * 용어집이 개정되면 그 판정은 더 이상 유효하지 않습니다.
 *
 * 실제로 발생한 문제:
 *   용어집이 `Device → 장치` 에서 `Device → 디바이스` 로 개정됐는데,
 *   "장치"로 확정된 항목이 계속 검증에서 건너뛰어져 위반이 가려졌습니다.
 *   118건이 스킵되고 있었습니다.
 *
 * 지문이 달라지면 그 라운드는 **전수 재검증**합니다. 확정 데이터를 지우지 않고
 * 스킵만 해제하므로, 여전히 통과하는 항목은 그대로 유지되고 새 기준을 위반하는
 * 항목만 드러납니다.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { GlossaryData } from '../retrieval/glossary-loader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const FINGERPRINT_FILE = path.join(ROOT, 'data', 'feedback', '.glossary-fingerprint');

/**
 * 판정에 영향을 주는 값만으로 지문을 만든다.
 * Context 열은 사람이 읽는 설명이라 바뀌어도 판정이 달라지지 않으므로 제외한다.
 */
export function glossaryFingerprint(glossary: GlossaryData): string {
  const material = [
    ...glossary.entries
      .map((e) => `${e.english}|${e.ko}|${e.ja}|${e.zhCN}`)
      .sort(),
    '--products--',
    ...[...glossary.productNames].sort(),
    '--exclusions--',
    ...[...glossary.excludePatterns].sort(),
  ].join('\n');

  return crypto.createHash('sha256').update(material).digest('hex').slice(0, 16);
}

export function readFingerprint(): string | null {
  try {
    if (!fs.existsSync(FINGERPRINT_FILE)) return null;
    return fs.readFileSync(FINGERPRINT_FILE, 'utf-8').trim() || null;
  } catch {
    return null;
  }
}

export function writeFingerprint(fp: string): void {
  fs.mkdirSync(path.dirname(FINGERPRINT_FILE), { recursive: true });
  fs.writeFileSync(FINGERPRINT_FILE, fp + '\n', 'utf-8');
}

export interface FingerprintCheck {
  current: string;
  previous: string | null;
  /** 용어집이 바뀌었는가 (최초 실행은 false) */
  changed: boolean;
  /** 이 라운드에서 확정 스킵을 해제해야 하는가 */
  forceRevalidate: boolean;
  message?: string;
}

export function checkFingerprint(glossary: GlossaryData): FingerprintCheck {
  const current = glossaryFingerprint(glossary);
  const previous = readFingerprint();

  if (previous === null) {
    return { current, previous, changed: false, forceRevalidate: false };
  }
  if (previous === current) {
    return { current, previous, changed: false, forceRevalidate: false };
  }

  return {
    current,
    previous,
    changed: true,
    forceRevalidate: true,
    message:
      `용어집이 변경되었습니다 (${previous} → ${current}). ` +
      `기존 확정 번역은 이전 기준으로 판정된 것이라 이 라운드는 전수 재검증합니다.`,
  };
}

export const FINGERPRINT_PATH = FINGERPRINT_FILE;
