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
    // Ensure nextLock resolves even if prevLock rejects to prevent chain breakage
    this.locks[name] = prevLock.then(() => nextLock).catch(() => nextLock);

    try {
      // Prevent deadlocks if app was backgrounded and a network request hung indefinitely
      const timeoutMs = acquireTimeout && acquireTimeout < 5000 ? acquireTimeout : 3000;
      let timeoutId: any;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('LockTimeout')), timeoutMs);
      });

      await Promise.race([prevLock, timeoutPromise]);
      clearTimeout(timeoutId);
    } catch (err: any) {
      if (err.message === 'LockTimeout') {
        console.warn(`[MemoryLock] Timeout waiting for ${name}, breaking lock to avoid deadlock.`);
        // Proceed without throwing to break the deadlock
      } else {
        throw err;
      }
    }

    try {
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
