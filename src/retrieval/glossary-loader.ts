/**
 * domain-glossary.md 파서
 * 마크다운 테이블에서 용어를 추출합니다.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

export interface GlossaryEntry {
  english: string;
  context: string;
  ko: string;
  ja: string;
  zhCN: string;
  category: string;
}

export interface GlossaryData {
  entries: GlossaryEntry[];
  productNames: string[];       // 번역 금지 제품명 (§7)
  excludePatterns: string[];    // 번역 제외 대상 (§9)
}

/**
 * domain-glossary.md 파일을 파싱하여 용어 목록 반환
 */
export function loadGlossary(glossaryPath?: string): GlossaryData {
  const filePath = glossaryPath || path.join(ROOT, 'requirements', 'domain-glossary.md');
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `용어집을 찾을 수 없습니다: ${filePath}\n` +
      `  이 파일은 검증과 리트리버의 기준입니다. git에 포함되어 있어야 합니다.\n` +
      `  복구: git checkout requirements/domain-glossary.md`
    );
  }
  const content = fs.readFileSync(filePath, 'utf-8');

  const entries: GlossaryEntry[] = [];
  let currentCategory = '';

  // 섹션별 파싱
  //
  // \r?\n 으로 분리해야 한다. '\n'만으로 자르면 CRLF 파일에서 각 줄 끝에 \r이 남고,
  // 구분선 정규식(/^\|[\s-|]+\|$/)의 $ 앵커가 매치되지 않아 headerSkipped가
  // 영원히 false로 남는다 → 테이블 행이 0건 파싱된다.
  // (git core.autocrlf 환경에서 체크아웃하면 이 파일이 CRLF가 된다)
  const lines = content.split(/\r?\n/);
  let inTable = false;
  let headerSkipped = false;

  for (const line of lines) {
    // 카테고리 헤더 감지
    const h2Match = line.match(/^##\s+\d+\.\s+(.+)/);
    if (h2Match) {
      currentCategory = h2Match[1].trim();
      inTable = false;
      headerSkipped = false;
      continue;
    }

    // 테이블 시작 감지
    if (line.startsWith('| English')) {
      inTable = true;
      headerSkipped = false;
      continue;
    }

    // 구분선 건너뛰기
    if (line.match(/^\|[\s-|]+\|$/)) {
      headerSkipped = true;
      continue;
    }

    // 테이블 행 파싱
    if (inTable && headerSkipped && line.startsWith('|')) {
      const cols = line.split('|').map((c) => c.trim()).filter(Boolean);
      if (cols.length >= 5) {
        entries.push({
          english: cols[0],
          context: cols[1],
          ko: cols[2],
          ja: cols[3],
          zhCN: cols[4],
          category: currentCategory,
        });
      }
    }

    // 테이블 끝 감지
    if (inTable && !line.startsWith('|') && line.trim() !== '') {
      inTable = false;
    }
  }

  // §7: 제품명 (번역 금지)
  const productNamesMatch = content.match(/`Art Lounge`.*?`Business Cloud`/s);
  const productNames = productNamesMatch
    ? productNamesMatch[0].match(/`([^`]+)`/g)?.map((m) => m.replace(/`/g, '')) || []
    : ['Art Lounge', 'Hotel Mobile App', 'CreateBoard Lab', 'Enterprise Content', 'Content Pro', 'LG Electronics', 'LGEBN', 'Business Cloud'];

  // §9: 번역 제외 대상 (더미/샘플 패턴)
  const excludePatterns = [
    'Text Text', 'Description Description', 'supporting text',
    'Label', 'Button', 'Title Title',
    'Business A', 'Workspace A1', 'Device N', 'User N', 'workspace 1-1-1',
    'MagokJungang', 'A101 bldg',
    'FileName_sample',
    'Spec Out', 'Deleted', 'Modified',
    'LGEBN', 'YYYY.MM.DD', 'N.N.N',
  ];

  return { entries, productNames, excludePatterns };
}

/**
 * 영어 용어 → GlossaryEntry 매핑 (빠른 조회용)
 */
export function buildGlossaryMap(entries: GlossaryEntry[]): Map<string, GlossaryEntry> {
  const map = new Map<string, GlossaryEntry>();
  for (const entry of entries) {
    map.set(entry.english.toLowerCase(), entry);
  }
  return map;
}
