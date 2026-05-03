import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { locales, defaultLocale } from "./i18n/config";

/**
 * Next.js 16 proxy (replaces middleware.ts).
 *
 * Execution order:
 * 1. Detect locale from Accept-Language → set NEXT_LOCALE cookie
 * 2. Run Supabase auth session refresh + route protection
 */
export async function proxy(request: NextRequest) {
  // ── Step 1: Locale detection (lightweight, no async) ──
  const existingLocale = request.cookies.get('NEXT_LOCALE')?.value;
  const needsLocaleCookie = !existingLocale || !(locales as readonly string[]).includes(existingLocale);

  // ── Step 2: Supabase auth (session refresh + route protection) ──
  const response = await updateSession(request);

  // ── Step 3: Attach locale cookie to the response from Supabase ──
  // We do this AFTER updateSession because updateSession may create a new response
  if (needsLocaleCookie) {
    const acceptLang = request.headers.get('Accept-Language') || '';
    const detected = negotiateLocale(acceptLang);
    response.cookies.set('NEXT_LOCALE', detected, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
  }

  return response;
}

/**
 * Simple Accept-Language negotiation.
 * Parses "ru-RU,ru;q=0.9,en-US;q=0.8" → matches against supported locales.
 */
function negotiateLocale(header: string): string {
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

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
