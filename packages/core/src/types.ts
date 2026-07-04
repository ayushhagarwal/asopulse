import type { RankingSignal } from "@asopulse/domain";

export type UserRecord = {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: Date | string;
};

export type ProjectRecord = {
  id: string;
  ownerId: string;
  name: string;
  appId: string;
  appName: string;
  storefront: string;
  createdAt: Date | string;
};

export type ProjectSummary = {
  id: string;
  name: string;
  appId: string;
  appName: string;
  storefront: string;
  createdAt: string;
};

export type WatchlistItem = {
  id: string;
  keyword: string;
  rank: number | null;
  competition: number;
  opportunity: number;
  resultCount: number;
  movement: number;
  tags: string[];
  tracked: true;
  provenance: {
    observedAt: string;
    confidence: string;
    methodVersion: string;
  };
};

export type PulseSeries = {
  keyword: string;
  color: string;
  values: Array<number | null>;
};

export type TimelinePoint = {
  label: string;
  observedAt: string;
};

export type ProjectPulse = {
  project: ProjectSummary;
  keywords: WatchlistItem[];
  signals: Array<RankingSignal & { id: string; createdAt: string }>;
  series: PulseSeries[];
  timeline: TimelinePoint[];
  nextObservationAt: string | null;
};

export type ProjectBackup = {
  version: 2;
  exportedAt: string;
  project: {
    name: string;
    appId: string;
    appName: string;
    storefront: string;
  };
  trackedKeywords: Array<{
    keyword: string;
    enabled: boolean;
    tags: string[];
    observations: Array<{
      rank: number | null;
      resultCount: number;
      competition: number;
      opportunity: number;
      methodVersion: string;
      confidence: string;
      observedAt: string;
    }>;
  }>;
  signals: Array<RankingSignal & { createdAt: string }>;
};

export type BackupImportResult = {
  importedKeywords: number;
  importedObservations: number;
  importedSignals: number;
};

export type ObservationRunResult = {
  observedKeywords: number;
  generatedSignals: number;
  observedAt: string;
};
