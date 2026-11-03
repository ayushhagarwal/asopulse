import type { StoreApp } from "@asopulse/domain";

type AppleResult = {
  trackId?: number;
  trackName?: string;
  sellerName?: string;
  artworkUrl100?: string;
  trackViewUrl?: string;
  description?: string;
  genres?: string[];
  averageUserRating?: number;
  userRatingCount?: number;
};

type AppleResponse = { resultCount: number; results: AppleResult[] };
type CacheEntry = { expiresAt: number; value: StoreApp[] };

export const MAX_SEARCH_TERM_LENGTH = 100;
const DEFAULT_MAX_CACHE_ENTRIES = 256;

export type AppStoreProvider = {
  searchApps(term: string, country: string, limit?: number): Promise<StoreApp[]>;
  searchKeyword(
    term: string,
    country: string,
    options?: { maxAgeMs?: number },
  ): Promise<StoreApp[]>;
};

export class AppleSearchProvider implements AppStoreProvider {
  private readonly cache = new Map<string, CacheEntry>();
  private nextRequestAt = 0;

  constructor(
    private readonly fetcher: typeof fetch = fetch,
    private readonly appCacheMs = 7 * 24 * 60 * 60 * 1000,
    private readonly minimumRequestGapMs = 3_100,
    private readonly keywordCacheMs = 15 * 60 * 1000,
    private readonly maxCacheEntries = DEFAULT_MAX_CACHE_ENTRIES,
  ) {}

  async searchApps(term: string, country: string, limit = 25): Promise<StoreApp[]> {
    return this.request(term, country, Math.min(200, Math.max(1, limit)), this.appCacheMs);
  }

  async searchKeyword(
    term: string,
    country: string,
    options?: { maxAgeMs?: number },
  ): Promise<StoreApp[]> {
    return this.request(term, country, 200, options?.maxAgeMs ?? this.keywordCacheMs);
  }

  private async request(
    term: string,
    country: string,
    limit: number,
    maxAgeMs: number,
  ): Promise<StoreApp[]> {
    const normalizedCountry = /^[a-z]{2}$/i.test(country) ? country.toUpperCase() : "US";
    const normalizedTerm = term.trim();
    if (normalizedTerm.length < 2) return [];
    if (normalizedTerm.length > MAX_SEARCH_TERM_LENGTH) {
      throw new Error("Search term is too long");
    }
    const key = `${normalizedCountry}:${limit}:${normalizedTerm.toLowerCase()}`;
    this.evictExpired();
    const cached = this.cache.get(key);
    if (maxAgeMs > 0 && cached) {
      if (cached.expiresAt > Date.now()) return cached.value;
      this.cache.delete(key);
    }

    const waitMs = Math.max(0, this.nextRequestAt - Date.now());
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    this.nextRequestAt = Date.now() + this.minimumRequestGapMs;

    const url = new URL("https://itunes.apple.com/search");
    url.searchParams.set("term", normalizedTerm);
    url.searchParams.set("country", normalizedCountry);
    url.searchParams.set("entity", "software");
    url.searchParams.set("limit", String(limit));
    const response = await this.fetcher(url, {
      headers: { "User-Agent": "ASOpulse/0.1" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Apple Search API responded with ${response.status}`);
    const payload = (await response.json()) as AppleResponse;
    const value = payload.results.flatMap((result): StoreApp[] => {
      if (!result.trackId || !result.trackName) return [];
      return [
        {
          appId: String(result.trackId),
          name: result.trackName,
          title: result.trackName,
          developer: result.sellerName ?? "Unknown developer",
          iconUrl: result.artworkUrl100 ?? "",
          storeUrl: result.trackViewUrl ?? "",
          description: result.description ?? "",
          genres: result.genres ?? [],
          averageRating: result.averageUserRating ?? 0,
          ratingCount: result.userRatingCount ?? 0,
        },
      ];
    });
    if (maxAgeMs > 0) this.remember(key, { expiresAt: Date.now() + maxAgeMs, value });
    return value;
  }

  private evictExpired(now = Date.now()) {
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) this.cache.delete(key);
    }
  }

  private remember(key: string, entry: CacheEntry) {
    this.evictExpired();
    if (this.cache.has(key)) this.cache.delete(key);
    this.cache.set(key, entry);
    const limit = Math.max(1, this.maxCacheEntries);
    while (this.cache.size > limit) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
  }
}
