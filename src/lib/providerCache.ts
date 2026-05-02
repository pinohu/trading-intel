import type { ProviderQuote } from "@/lib/providers";

type CacheEntry = {
  quote: ProviderQuote;
  expiresAt: number;
};

const quoteCache = new Map<string, CacheEntry>();

export function getCachedQuote(key: string) {
  const entry = quoteCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    quoteCache.delete(key);
    return null;
  }
  return entry.quote;
}

export function setCachedQuote(key: string, quote: ProviderQuote, ttlMs = 15_000) {
  quoteCache.set(key, {
    quote,
    expiresAt: Date.now() + ttlMs,
  });
}

export function quoteCacheStats() {
  const now = Date.now();
  let live = 0;
  for (const [key, entry] of quoteCache.entries()) {
    if (entry.expiresAt <= now) {
      quoteCache.delete(key);
    } else {
      live += 1;
    }
  }
  return { liveEntries: live };
}
