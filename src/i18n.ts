/**
 * i18next 설정
 *
 * ## 번역을 번들에 박지 않는 이유
 *
 * 이전에는 locale JSON을 static import했다.
 *
 *   import en from './locales/en.json';   // ← 빌드 시점에 번들로 들어감
 *
 * 두 가지 문제가 있었다.
 *   1) 파이프라인 실행 여부와 무관하게 초기 화면부터 기존 번역이 출력된다.
 *      백지 상태에서 시작하는 데모가 불가능하고, 파이프라인이 만든 결과인지
 *      번들에 박힌 옛 값인지 구분할 수 없다.
 *   2) locale 파일을 지우면 Vite가 모듈을 못 찾아 빌드가 깨진다.
 *      (실측: "Could not resolve ./locales/en.json from src/i18n.ts")
 *
 * 그래서 리소스를 비운 상태로 초기화하고 런타임에 API에서 받아 주입한다.
 * 번역이 없으면 키가 그대로 노출되어 "아직 생성되지 않음"이 화면에 드러난다.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { fetchLocale } from './api/client';

export const LANGUAGES = ['en', 'ko', 'ja', 'zh-CN'] as const;
export type Language = (typeof LANGUAGES)[number];

i18n.use(initReactI18next).init({
  resources: {},
  lng: 'en',
  // en으로 폴백하면 ko 리소스가 없을 때 영문이 나와 "번역된 것"처럼 보인다.
  // 미로드 상태를 감추지 않기 위해 폴백을 끈다.
  fallbackLng: false,
  interpolation: { escapeValue: false },
  // 키가 없으면 키 문자열을 그대로 보여준다.
  // 마지막 세그먼트만 노출하면 실제 번역으로 오해될 수 있다.
  parseMissingKeyHandler: (key) => key,
});

export interface LocaleLoadResult {
  loaded: Language[];
  failed: Language[];
  /** 언어별 키 개수 */
  counts: Partial<Record<Language, number>>;
}

function countLeaves(obj: unknown): number {
  if (typeof obj !== 'object' || obj === null) return 1;
  return Object.values(obj as Record<string, unknown>).reduce<number>(
    (n, v) => n + countLeaves(v),
    0
  );
}

/**
 * API에서 locale을 받아 i18next에 주입한다.
 *
 * 파이프라인이 방금 쓴 파일을 읽으므로 재빌드 없이 최신 번역이 반영된다.
 * 실패해도 throw하지 않는다 — 어떤 언어가 로드됐는지 결과로 알려준다.
 */
export async function loadLocalesFromApi(): Promise<LocaleLoadResult> {
  const settled = await Promise.allSettled(
    LANGUAGES.map(async (lang) => ({ lang, resources: await fetchLocale(lang) }))
  );

  const loaded: Language[] = [];
  const failed: Language[] = [];
  const counts: Partial<Record<Language, number>> = {};

  for (let i = 0; i < settled.length; i++) {
    const r = settled[i];
    if (r.status === 'fulfilled') {
      const { lang, resources } = r.value;
      // deep=true, overwrite=true — 파이프라인 산출물이 항상 우선
      i18n.addResourceBundle(lang, 'translation', resources, true, true);
      loaded.push(lang);
      counts[lang] = countLeaves(resources);
    } else {
      failed.push(LANGUAGES[i]);
    }
  }

  if (loaded.length > 0) {
    // 이미 렌더된 트리에 새 리소스를 반영
    await i18n.changeLanguage(i18n.language);
  }

  return { loaded, failed, counts };
}

export default i18n;
