// ============================================
// IN-MEMORY RESPONSE CACHE + TIMEOUT UTILITIES
// TTL-based cache for expensive database queries
// ============================================

// ============================================
// TIMEOUT UTILITIES
// ============================================

/** Thrown when a query exceeds its allowed duration. */
export class QueryTimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`Query "${label}" timed out after ${ms}ms`);
    this.name = "QueryTimeoutError";
  }
}

/**
 * Race a promise against a deadline.
 * Throws QueryTimeoutError if the promise doesn't resolve within `ms` milliseconds.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new QueryTimeoutError(label, ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ============================================
// CACHE
// ============================================

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_QUERY_TIMEOUT_MS = 10_000; // 10 seconds

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

  /**
   * Run a DB query only if its result isn't cached; otherwise return cached result.
   * Automatically wraps the fetcher with a 10-second timeout.
   * Throws QueryTimeoutError if the fetch exceeds the deadline.
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs?: number,
    timeoutMs = DEFAULT_QUERY_TIMEOUT_MS
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      console.log(`[Cache] HIT  ${key}`);
      return cached;
    }
    console.log(`[Cache] MISS ${key}`);
    const result = await withTimeout(fetcher(), timeoutMs, key);
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

// ============================================
// USER-FACING TIMEOUT MESSAGE
// ============================================

/** Standard user-facing message when a DB query times out. */
export const TIMEOUT_USER_MESSAGE =
  "Query taking longer than expected, hold tight. If this takes longer than 30 seconds, try again.";
