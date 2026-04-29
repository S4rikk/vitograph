export const locales = ['ru', 'en', 'de', 'fr', 'es', 'pt', 'zh', 'ja', 'ko', 'tr', 'ar'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'ru';

/** Human-readable names for language selector UI */
export const localeNames: Record<Locale, string> = {
  ru: 'Русский',
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  pt: 'Português',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  tr: 'Türkçe',
  ar: 'العربية',
};
