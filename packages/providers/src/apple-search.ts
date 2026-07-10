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
    const key = `${normalizedCountry}:${limit}:${normalizedTerm.toLowerCase()}`;
    const cached = this.cache.get(key);
    if (maxAgeMs > 0 && cached && cached.expiresAt > Date.now()) return cached.value;

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
    if (maxAgeMs > 0) this.cache.set(key, { expiresAt: Date.now() + maxAgeMs, value });
    return value;
  }
}
