import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { locales, type Locale } from './config';

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

function negotiateLocale(header: string | null): string {
  if (!header) return 'en';

  const parts = header.split(',').map(part => {
    const trimmed = part.trim();
    if (!trimmed) return { lang: '', q: 0 };
    const [lang, qStr] = trimmed.split(';q=');
    return {
      lang: lang.trim().split('-')[0].toLowerCase(),
      q: qStr ? parseFloat(qStr) : 1.0,
    };
  }).filter(p => p.lang.length > 0);

  parts.sort((a, b) => b.q - a.q);

  for (const { lang } of parts) {
    if ((locales as readonly string[]).includes(lang)) {
      return lang;
    }
  }

  return 'en';
}

export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get('NEXT_LOCALE')?.value;
  
  let locale: Locale;
  if (raw && (locales as readonly string[]).includes(raw)) {
    locale = raw as Locale;
  } else {
    const headersList = await headers();
    const acceptLanguage = headersList.get('accept-language');
    locale = negotiateLocale(acceptLanguage) as Locale;
  }

  return {
    locale,
    messages: (await messageImports[locale]()).default,
  };
});
