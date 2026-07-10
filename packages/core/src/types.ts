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
  iconUrl: string;
  scheduleEnabled: boolean;
  scheduleFrequency: string;
  scheduleTime: string;
  scheduleTimezone: string;
  scheduleWeekday: number;
  createdAt: Date | string;
};

export type ScheduleFrequency = "daily" | "weekdays" | "weekly";

export type ProjectSettings = {
  enabled: boolean;
  frequency: ScheduleFrequency;
  time: string;
  timezone: string;
  weekday: number;
};

export type ProjectSummary = {
  id: string;
  name: string;
  appId: string;
  appName: string;
  storefront: string;
  iconUrl: string;
  settings: ProjectSettings;
  createdAt: string;
};

export type WatchlistItem = {
  id: string;
  keyword: string;
  rank: number | null;
  competition: number;
  opportunity: number;
  resultCount: number;
  movement: number | null;
  tags: string[];
  tracked: true;
  provenance: {
    observedAt: string;
    confidence: string;
    methodVersion: string;
  };
  sparkline: Array<{ date: string; rank: number | null; observed: boolean }>;
  refreshState: "pending" | "fresh";
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
  version: 2 | 3;
  exportedAt: string;
  project: {
    name: string;
    appId: string;
    appName: string;
    storefront: string;
    iconUrl?: string;
    settings?: ProjectSettings;
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
  failedKeywords: Array<{ keyword: string; message: string }>;
  observedAt: string;
};

export type HistoryRange = "7d" | "30d" | "90d";

export type KeywordHistory = {
  keywordId: string;
  keyword: string;
  range: HistoryRange;
  timeline: Array<{ date: string; label: string; rank: number | null; observed: boolean }>;
  currentRank: number | null;
  movement: number | null;
  lastObservedAt: string | null;
};

export type ObservationRunSummary = {
  id: string;
  projectId: string | null;
  trigger: "manual" | "scheduled" | "initial";
  status: "queued" | "running" | "completed" | "partial" | "failed";
  requestedCount: number;
  observedCount: number;
  failedCount: number;
  failures: Array<{ keyword: string; message: string }>;
  startedAt: string;
  finishedAt: string | null;
  nextEligibleManualAt: string | null;
};

export const OBSERVATION_QUEUE = "asopulse-observations";
export type ObservationJob = {
  projectId: string;
  trackedKeywordIds?: string[];
  runId?: string;
  trigger?: "manual" | "scheduled" | "initial";
};
