import type { KeywordScore, MetricProvenance, StoreApp } from "./types.js";

export const SCORING_METHOD_VERSION = "opportunity-1.0.0";

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const normalizeLog = (value: number, ceiling: number) =>
  Math.min(1, Math.log10(value + 1) / Math.log10(ceiling + 1));

export function scoreKeyword(
  keyword: string,
  results: StoreApp[],
  targetAppId?: string,
  observedAt = new Date().toISOString(),
): KeywordScore {
  const normalizedKeyword = keyword.trim().toLowerCase();
  const exactTitleMatches = results.filter(
    (app) => app.title.toLowerCase().trim() === normalizedKeyword,
  ).length;
  const titleMatches = results.filter((app) =>
    app.title.toLowerCase().includes(normalizedKeyword),
  ).length;
  const averageAuthority =
    results.length === 0
      ? 0
      : results.reduce((sum, app) => sum + normalizeLog(app.ratingCount, 1_000_000), 0) /
        results.length;
  const topTenAuthority =
    results.slice(0, 10).reduce((sum, app) => sum + normalizeLog(app.ratingCount, 1_000_000), 0) /
    Math.max(1, Math.min(10, results.length));
  const saturation =
    results.length === 0 ? 0 : (exactTitleMatches * 1.5 + titleMatches) / results.length;
  const competition = clamp(saturation * 42 + averageAuthority * 28 + topTenAuthority * 30);
  const rankIndex = targetAppId ? results.findIndex((app) => app.appId === targetAppId) : -1;
  const rank = rankIndex === -1 ? null : rankIndex + 1;
  const positionPotential = rank === null ? 45 : Math.max(0, Math.min(100, rank * 1.25));
  const opportunity = clamp((100 - competition) * 0.72 + positionPotential * 0.28);
  const provenance: MetricProvenance = {
    source: "asopulse-derived",
    observedAt,
    confidence: results.length >= 50 ? "high" : results.length >= 20 ? "medium" : "low",
    methodVersion: SCORING_METHOD_VERSION,
  };
  return {
    keyword: normalizedKeyword,
    rank,
    competition,
    opportunity,
    resultCount: results.length,
    provenance,
  };
}
