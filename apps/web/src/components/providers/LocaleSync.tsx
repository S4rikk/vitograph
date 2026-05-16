"use client";

import { useEffect } from 'react';
import { useLocale } from 'next-intl';

export default function LocaleSync({ profileLocale }: { profileLocale: string | null }) {
  const currentLocale = useLocale();

  useEffect(() => {
    if (profileLocale && profileLocale !== currentLocale) {
      const lastSynced = sessionStorage.getItem('vitograph_last_synced_locale');
      if (lastSynced !== profileLocale) {
        document.cookie = `NEXT_LOCALE=${profileLocale}; path=/; max-age=31536000; SameSite=Lax`;
        sessionStorage.setItem('vitograph_last_synced_locale', profileLocale);
        window.location.reload();
      }
    }
  }, [profileLocale, currentLocale]);

  return null;
}
