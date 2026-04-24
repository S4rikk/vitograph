import { createBrowserClient } from "@supabase/ssr";

// Dummy lock to completely bypass navigator.locks which hangs in Capacitor Android WebViews
const dummyLock = async (name: string, acquireTimeout: number, fn: () => Promise<any>) => {
  return await fn();
};

export function createClient() {
  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        lock: dummyLock,
      },
    }
  );

  // Android Capacitor Cookie Wipe Fix:
  // Capacitor Android WebViews often destroy cookies when the app is force-closed.
  // We mirror the session to localStorage, and if the cookie is missing on startup, we restore it.
  if (typeof window !== "undefined") {
    const STORAGE_KEY = `vitograph_capacitor_session_backup`;

    // 1. Restore from backup if auth cookie is missing but backup exists
    const hasAuthCookie = document.cookie.includes('-auth-token=');
    if (!hasAuthCookie) {
      const backup = localStorage.getItem(STORAGE_KEY);
      if (backup) {
        try {
          const parsed = JSON.parse(backup);
          if (parsed.access_token && parsed.refresh_token) {
            console.warn("[CapacitorFix] Restoring lost session from localStorage backup...");
            // Restore session. This will automatically write the cookies back via SSR adapter.
            client.auth.setSession({
              access_token: parsed.access_token,
              refresh_token: parsed.refresh_token,
            });
          }
        } catch (e) {
          console.error("[CapacitorFix] Failed to parse session backup", e);
        }
      }
    }

    // 2. Keep the backup updated whenever auth state changes
    // We only attach the listener once per client instance (singleton in browsers usually)
    if (!(window as any).__supabase_session_synced) {
      (window as any).__supabase_session_synced = true;
      client.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          if (session) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            }));
          }
        } else if (event === 'SIGNED_OUT') {
          localStorage.removeItem(STORAGE_KEY);
        }
      });
    }
  }

  return client;
}
