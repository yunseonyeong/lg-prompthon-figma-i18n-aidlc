/**
 * 용어 매칭 유틸 (공용)
 *
 * 리트리버와 검증 계층이 같은 규칙을 써야 합니다.
 * 한쪽만 오탐을 고치면 프롬프트와 검증이 어긋납니다.
 */

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 용어가 단어 단위로 등장하는지 확인.
 *
 * 단순 includes()를 쓰면 "Workspace"에서 "Space"가 잡혀
 * EXAONE에 "Space→공간"을 지시하게 되고 "워크공간" 같은 결과가 나옵니다.
 *
 * \b 대신 lookaround를 쓰는 이유:
 *   \b는 비단어 문자로 끝나는 용어에서 실패합니다.
 *   "C++"의 경우 \bC\+\+\b 는 '+' 뒤에 단어 경계가 없어 매칭되지 않습니다.
 *   (?<!\w)C\+\+(?!\w) 는 정상 동작합니다.
 *
 * 복합어 내부 적용(glossary §8-2)은 유지됩니다.
 *   "Workspace/Group Settings" → Workspace ✓, Group ✓, Space ✗
 */
export function containsTerm(text: string, term: string): boolean {
  if (!term) return false;
  try {
    return new RegExp(`(?<!\\w)${escapeRegExp(term)}(?!\\w)`, 'i').test(text);
  } catch {
    // lookbehind 미지원 환경 대비
    return text.toLowerCase().includes(term.toLowerCase());
  }
}

/**
 * 번역문에 기대 용어가 포함되는지 확인.
 *
 * CJK에는 단어 경계 개념이 없으므로 부분 포함으로 판정합니다.
 * ("워크스페이스/그룹 설정"에서 "워크스페이스"를 찾는 경우)
 */
export function translationContains(text: string, expected: string): boolean {
  return text.toLowerCase().includes(expected.toLowerCase());
}
