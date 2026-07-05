import { describe, expect, it } from "vitest";
import { STOREFRONTS, storefrontName } from "./storefronts";

describe("storefront catalog", () => {
  it("includes the primary ASO markets", () => {
    const codes = new Set(STOREFRONTS.map(({ code }) => code));

    for (const code of ["US", "JP", "ES", "FR", "DE", "KR", "BR", "TR"]) {
      expect(codes.has(code)).toBe(true);
    }
  });

  it("uses a readable name and safely falls back to the code", () => {
    expect(storefrontName("JP")).toBe("Japan");
    expect(storefrontName("XX")).toBe("XX");
  });
});
