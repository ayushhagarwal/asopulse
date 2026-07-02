import { describe, expect, test } from "vitest";
import {
  deriveRankingSignal,
  findObservedRank,
  formatRank,
  type StoreApp,
  scoreKeyword,
  toCsv,
} from "./index";

const app = (id: string, title: string, ratingCount: number): StoreApp => ({
  appId: id,
  name: title,
  title,
  developer: "Studio",
  iconUrl: "",
  storeUrl: "",
  description: "",
  genres: [],
  averageRating: 4.5,
  ratingCount,
});

describe("rank observations", () => {
  test("returns a one-based rank and an explicit ceiling", () => {
    expect(findObservedRank("b", ["a", "b", "c"])).toBe(2);
    expect(findObservedRank("x", ["a", "b", "c"])).toBeNull();
    expect(formatRank(null)).toBe(">200");
  });

  test("derives movement in the direction users expect", () => {
    expect(deriveRankingSignal("journal", 20, 12)?.movement).toBe(8);
    expect(deriveRankingSignal("journal", 12, 17)?.kind).toBe("loss");
  });
});

test("scores only observable result properties", () => {
  const results = [
    app("1", "Daily Journal", 500_000),
    app("2", "Journal Notes", 10_000),
    app("3", "Calm", 200),
  ];
  const score = scoreKeyword("daily journal", results, "1", "2026-07-02T00:00:00.000Z");
  expect(score.rank).toBe(1);
  expect(score.competition).toBeGreaterThan(0);
  expect(score.provenance.methodVersion).toBe("opportunity-1.0.0");
});

test("exports standards-compliant CSV", () => {
  expect(toCsv([{ keyword: "journal, diary", rank: 12 }])).toContain('"journal, diary"');
});
