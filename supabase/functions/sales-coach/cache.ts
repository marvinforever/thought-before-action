// ============================================
// IN-MEMORY RESPONSE CACHE
// TTL-based cache for expensive database queries
// ============================================

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class QueryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTtlMs: number;

  constructor(defaultTtlMs = 5 * 60 * 1000) { // 5 minutes default
    this.defaultTtlMs = defaultTtlMs;
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);
    this.store.set(key, { value, expiresAt });
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /** Run a DB query only if its result isn't cached; otherwise return cached result. */
  async getOrFetch<T>(key: string, fetcher: () => Promise<T>, ttlMs?: number): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      console.log(`[Cache] HIT  ${key}`);
      return cached;
    }
    console.log(`[Cache] MISS ${key}`);
    const result = await fetcher();
    this.set(key, result, ttlMs);
    return result;
  }

  /** Evict all expired entries (call periodically to avoid unbounded growth). */
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }

  get size(): number {
    return this.store.size;
  }
}

// Module-level singleton — persists for the lifetime of the edge function instance.
export const queryCache = new QueryCache();

// ============================================
// CACHE KEY HELPERS
// ============================================

/** Key for a rep's full customer summary (used in Pareto & rep-list queries). */
export function repSummaryKey(companyId: string, repFirstName: string): string {
  return `rep_summary:${companyId}:${repFirstName.toLowerCase().trim()}`;
}

/** Key for a customer's purchase summary (used in gatherContext). */
export function customerSummaryKey(companyId: string, namePattern: string): string {
  return `customer_summary:${companyId}:${namePattern.toLowerCase().trim()}`;
}

/** Key for a rep-name existence check (fast validation query). */
export function repExistsKey(companyId: string, repFirstName: string): string {
  return `rep_exists:${companyId}:${repFirstName.toLowerCase().trim()}`;
}
