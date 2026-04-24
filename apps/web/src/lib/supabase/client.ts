import { createBrowserClient } from "@supabase/ssr";

// Dummy lock to completely bypass navigator.locks which hangs in Capacitor Android WebViews
const dummyLock = async (name: string, acquireTimeout: number, fn: () => Promise<any>) => {
  return await fn();
};

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        lock: dummyLock,
      },
    }
  );
}
