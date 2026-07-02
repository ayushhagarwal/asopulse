export type StorefrontCode = Uppercase<string>;

export type MetricProvenance = {
  source: "apple-search-api" | "asopulse-observation" | "asopulse-derived";
  observedAt: string;
  confidence: "high" | "medium" | "low";
  methodVersion: string;
};

export type StoreApp = {
  appId: string;
  name: string;
  developer: string;
  iconUrl: string;
  storeUrl: string;
  title: string;
  description: string;
  genres: string[];
  averageRating: number;
  ratingCount: number;
};

export type KeywordScore = {
  keyword: string;
  rank: number | null;
  competition: number;
  opportunity: number;
  resultCount: number;
  provenance: MetricProvenance;
};

export type RankingSignal = {
  kind: "gain" | "loss" | "entered" | "left";
  keyword: string;
  previousRank: number | null;
  currentRank: number | null;
  movement: number;
};
