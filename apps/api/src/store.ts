import { randomUUID } from "node:crypto";
import type { KeywordScore, RankingSignal } from "@asopulse/domain";

export type TrackedKeyword = KeywordScore & {
  id: string;
  movement: number;
  tags: string[];
  tracked: true;
};
export type Project = {
  id: string;
  name: string;
  appId: string;
  appName: string;
  storefront: string;
};

const now = "2026-07-02T06:00:00.000Z";
export const demoProject: Project = {
  id: "demo",
  name: "Clarity",
  appId: "demo-clarity",
  appName: "Clarity — Daily Journal",
  storefront: "US",
};
export const trackedKeywords: TrackedKeyword[] = [
  {
    id: "daily-journal",
    keyword: "daily journal",
    rank: 12,
    competition: 48,
    opportunity: 82,
    resultCount: 200,
    movement: 8,
    tags: ["core"],
    tracked: true,
    provenance: {
      source: "asopulse-derived",
      observedAt: now,
      confidence: "high",
      methodVersion: "opportunity-1.0.0",
    },
  },
  {
    id: "journal-prompts",
    keyword: "journal prompts",
    rank: 18,
    competition: 38,
    opportunity: 76,
    resultCount: 200,
    movement: 3,
    tags: ["ideas"],
    tracked: true,
    provenance: {
      source: "asopulse-derived",
      observedAt: now,
      confidence: "high",
      methodVersion: "opportunity-1.0.0",
    },
  },
  {
    id: "mood-diary",
    keyword: "mood diary",
    rank: 27,
    competition: 42,
    opportunity: 71,
    resultCount: 200,
    movement: 5,
    tags: ["mood"],
    tracked: true,
    provenance: {
      source: "asopulse-derived",
      observedAt: now,
      confidence: "high",
      methodVersion: "opportunity-1.0.0",
    },
  },
  {
    id: "gratitude-journal",
    keyword: "gratitude journal",
    rank: 31,
    competition: 35,
    opportunity: 69,
    resultCount: 200,
    movement: -2,
    tags: ["core"],
    tracked: true,
    provenance: {
      source: "asopulse-derived",
      observedAt: now,
      confidence: "high",
      methodVersion: "opportunity-1.0.0",
    },
  },
];

export const rankingSignals: RankingSignal[] = [
  { kind: "gain", keyword: "daily journal", previousRank: 20, currentRank: 12, movement: 8 },
  { kind: "gain", keyword: "journal prompts", previousRank: 21, currentRank: 18, movement: 3 },
  { kind: "loss", keyword: "gratitude journal", previousRank: 29, currentRank: 31, movement: -2 },
];

export function trackKeyword(score: KeywordScore): TrackedKeyword {
  const existing = trackedKeywords.find((item) => item.keyword === score.keyword);
  if (existing) return existing;
  const item: TrackedKeyword = { ...score, id: randomUUID(), movement: 0, tags: [], tracked: true };
  trackedKeywords.push(item);
  return item;
}
