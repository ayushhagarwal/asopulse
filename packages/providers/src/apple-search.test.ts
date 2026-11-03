import { describe, expect, test } from "vitest";
import { AppleSearchProvider, MAX_SEARCH_TERM_LENGTH } from "./apple-search.js";

describe("AppleSearchProvider", () => {
  test("normalizes Apple payloads and reuses the cache", async () => {
    let requests = 0;
    const fetcher = async () => {
      requests += 1;
      return new Response(
        JSON.stringify({
          resultCount: 1,
          results: [
            { trackId: 42, trackName: "Clarity", sellerName: "Studio", userRatingCount: 1200 },
          ],
        }),
        { status: 200 },
      );
    };
    const provider = new AppleSearchProvider(fetcher as typeof fetch, 60_000, 0);
    const first = await provider.searchApps("clarity", "us");
    const second = await provider.searchApps("clarity", "US");
    expect(first[0]).toMatchObject({ appId: "42", name: "Clarity", ratingCount: 1200 });
    expect(second).toEqual(first);
    expect(requests).toBe(1);
  });

  test("rejects non-success responses", async () => {
    const provider = new AppleSearchProvider(
      async () => new Response("busy", { status: 429 }),
      0,
      0,
    );
    await expect(provider.searchApps("clarity", "US")).rejects.toThrow("429");
  });

  test("allows observation callers to bypass cached keyword results", async () => {
    let requests = 0;
    const provider = new AppleSearchProvider(
      async () => {
        requests += 1;
        return Response.json({ resultCount: 0, results: [] });
      },
      60_000,
      0,
      60_000,
    );
    await provider.searchKeyword("journal", "US");
    await provider.searchKeyword("journal", "US");
    await provider.searchKeyword("journal", "US", { maxAgeMs: 0 });
    expect(requests).toBe(2);
  });

  test("rejects oversized search terms before calling Apple", async () => {
    const provider = new AppleSearchProvider(
      async () => {
        throw new Error("should not fetch");
      },
      0,
      0,
    );
    await expect(provider.searchApps("a".repeat(MAX_SEARCH_TERM_LENGTH + 1), "US")).rejects.toThrow(
      /too long/,
    );
  });

  test("evicts expired entries and caps the in-memory cache", async () => {
    let now = 1_000_000;
    const realNow = Date.now;
    Date.now = () => now;
    let requests = 0;
    const provider = new AppleSearchProvider(
      async () => {
        requests += 1;
        return Response.json({ resultCount: 0, results: [] });
      },
      1_000,
      0,
      1_000,
      2,
    );
    try {
      await provider.searchApps("one", "US");
      await provider.searchApps("two", "US");
      await provider.searchApps("three", "US");
      await provider.searchApps("one", "US");
      expect(requests).toBe(4);
      now += 1_001;
      await provider.searchApps("three", "US");
      expect(requests).toBe(5);
    } finally {
      Date.now = realNow;
    }
  });
});
