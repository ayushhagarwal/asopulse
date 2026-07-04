import type { RankingSignal } from "./types.js";

export const RANK_CEILING = 200;

export function findObservedRank(appId: string, resultIds: string[]): number | null {
  const index = resultIds.indexOf(appId);
  return index === -1 ? null : index + 1;
}

export function formatRank(rank: number | null): string {
  return rank === null ? `>${RANK_CEILING}` : String(rank);
}

export function deriveRankingSignal(
  keyword: string,
  previousRank: number | null,
  currentRank: number | null,
): RankingSignal | null {
  if (previousRank === currentRank) return null;
  if (previousRank === null && currentRank !== null) {
    return {
      kind: "entered",
      keyword,
      previousRank,
      currentRank,
      movement: RANK_CEILING - currentRank + 1,
    };
  }
  if (previousRank !== null && currentRank === null) {
    return {
      kind: "left",
      keyword,
      previousRank,
      currentRank,
      movement: previousRank - RANK_CEILING - 1,
    };
  }
  const movement = (previousRank ?? 0) - (currentRank ?? 0);
  return { kind: movement > 0 ? "gain" : "loss", keyword, previousRank, currentRank, movement };
}
