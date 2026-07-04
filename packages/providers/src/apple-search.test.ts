import { describe, expect, test } from "vitest";
import { AppleSearchProvider } from "./apple-search.js";

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
});
