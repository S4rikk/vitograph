import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { defaultLocale, locales, type Locale } from './config';

// Explicit mapping — Turbopack cannot resolve dynamic imports with variables
const messageImports: Record<Locale, () => Promise<{ default: Record<string, unknown> }>> = {
  ru: () => import('./messages/ru.json'),
  en: () => import('./messages/en.json'),
  de: () => import('./messages/de.json'),
  fr: () => import('./messages/fr.json'),
  es: () => import('./messages/es.json'),
  pt: () => import('./messages/pt.json'),
  zh: () => import('./messages/zh.json'),
  ja: () => import('./messages/ja.json'),
  ko: () => import('./messages/ko.json'),
  tr: () => import('./messages/tr.json'),
  ar: () => import('./messages/ar.json'),
};

export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get('NEXT_LOCALE')?.value;
  const locale: Locale = raw && (locales as readonly string[]).includes(raw)
    ? (raw as Locale)
    : defaultLocale;

  return {
    locale,
    messages: (await messageImports[locale]()).default,
  };
});
