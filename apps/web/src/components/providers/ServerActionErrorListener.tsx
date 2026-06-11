'use client';

import { useEffect } from 'react';

/**
 * Global listener that catches unhandled errors and promise rejections
 * containing "Failed to find Server Action". Reloads the page to fetch the
 * latest production bundle/cache.
 */
export default function ServerActionErrorListener() {
  useEffect(() => {
    const handleActionError = (message: string) => {
      if (message && message.includes('Failed to find Server Action')) {
        const now = Date.now();
        const lastReload = sessionStorage.getItem('last_action_reload');
        if (lastReload && now - Number(lastReload) < 10000) {
          console.error('[ServerActionErrorListener] Reload loop detected. Not reloading.');
          return;
        }
        sessionStorage.setItem('last_action_reload', String(now));
        console.warn('Failed to find Server Action. Reloading page to fetch latest bundle...');
        window.location.reload();
      }
    };

    const handleError = (event: ErrorEvent) => {
      handleActionError(event.message || (event.error as Error)?.message);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      handleActionError(message);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return null;
}
