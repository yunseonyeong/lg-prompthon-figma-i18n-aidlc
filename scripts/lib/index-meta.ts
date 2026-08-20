/**
 * 인덱스 임베딩 메타 관리
 *
 * 서로 다른 임베딩 방식으로 만든 벡터가 한 인덱스에 섞이면 검색 결과가 무의미해집니다.
 * (해시 벡터와 E5 벡터는 좌표계가 다름)
 *
 * 각 인덱스 폴더에 .embedder.json 을 남겨 어떤 방식으로 만들었는지 기록하고,
 * 검색 시 현재 백엔드와 다르면 경고합니다.
 */
import fs from 'fs';
import path from 'path';
import type { Backend } from './embedder.js';

const META_FILE = '.embedder.json';

export interface IndexMeta {
  backend: Backend;
  model: string;
  dim: number;
  items: number;
  indexedAt: string;
}

export function writeIndexMeta(indexPath: string, meta: IndexMeta): void {
  fs.mkdirSync(indexPath, { recursive: true });
  fs.writeFileSync(path.join(indexPath, META_FILE), JSON.stringify(meta, null, 2), 'utf-8');
}

export function readIndexMeta(indexPath: string): IndexMeta | null {
  const p = path.join(indexPath, META_FILE);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as IndexMeta;
  } catch {
    return null;
  }
}

/**
 * 인덱스가 현재 백엔드와 호환되는지 확인.
 * 불일치 시 경고를 출력하고 false를 반환합니다.
 */
export function assertCompatible(indexPath: string, current: Backend): boolean {
  const meta = readIndexMeta(indexPath);

  if (!meta) {
    console.warn(
      `⚠️  인덱스에 임베딩 메타가 없습니다 (${path.basename(indexPath)}).\n` +
      `   구버전 인덱스일 수 있습니다. 재인덱싱을 권장합니다.`
    );
    return false;
  }

  if (meta.backend !== current) {
    console.warn(
      `⚠️  임베딩 방식 불일치! 검색 결과가 부정확합니다.\n` +
      `   인덱스: ${meta.backend} (${meta.model})\n` +
      `   현재:   ${current}\n` +
      `   → npm run reindex 로 재생성하세요.`
    );
    return false;
  }

  return true;
}
