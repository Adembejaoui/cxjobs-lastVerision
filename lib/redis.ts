interface CacheEntry {
  value: string;
  expiresAt: number;
}

class InMemoryCache {
  private store = new Map<string, CacheEntry>();
  private timers = new Map<string, NodeJS.Timeout>();

  get(key: string): string | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  setex(key: string, ttlSeconds: number, value: string): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { value, expiresAt });

    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key)!);
    }

    const timer = setTimeout(() => {
      this.store.delete(key);
      this.timers.delete(key);
    }, ttlSeconds * 1000);

    this.timers.set(key, timer);
  }

  del(key: string): void {
    this.store.delete(key);
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key)!);
      this.timers.delete(key);
    }
  }
}

const globalCache = globalThis as unknown as { __cxCache?: InMemoryCache };

export function getCache(): InMemoryCache {
  if (!globalCache.__cxCache) {
    globalCache.__cxCache = new InMemoryCache();
  }
  return globalCache.__cxCache;
}

export async function getCachedDashboardStats(key: string): Promise<string | null> {
  return getCache().get(key);
}

export async function setCachedDashboardStats(
  key: string,
  value: string,
  ttlSeconds: number
): Promise<void> {
  getCache().setex(key, ttlSeconds, value);
}

export async function invalidateCache(key: string): Promise<void> {
  getCache().del(key);
}
