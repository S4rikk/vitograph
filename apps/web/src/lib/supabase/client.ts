import { createBrowserClient } from "@supabase/ssr";

// Fallback memory lock for Capacitor Android where navigator.locks hangs
class MemoryLock {
  private locks: Record<string, Promise<void>> = {};

  async acquire(name: string, acquireTimeout: number, fn: () => Promise<any>): Promise<any> {
    const prevLock = this.locks[name] || Promise.resolve();
    let releaseLock: () => void;
    const nextLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    this.locks[name] = prevLock.then(() => nextLock);

    try {
      await prevLock;
      return await fn();
    } finally {
      releaseLock!();
    }
  }
}

const memoryLock = new MemoryLock();

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        lock: memoryLock.acquire.bind(memoryLock),
      },
    }
  );
}
