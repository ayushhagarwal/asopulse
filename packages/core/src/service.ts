import {
  type createDatabase,
  jobRuns,
  projects,
  rankObservations,
  signals,
  trackedKeywords,
} from "@asopulse/db";
import {
  deriveRankingSignal,
  formatRank,
  type RankingSignal,
  scoreKeyword,
  toCsv,
} from "@asopulse/domain";
import type { AppStoreProvider } from "@asopulse/providers";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type {
  BackupImportResult,
  HistoryRange,
  KeywordHistory,
  ObservationRunResult,
  ObservationRunSummary,
  ProjectBackup,
  ProjectPulse,
  ProjectRecord,
  ProjectSettings,
  ProjectSummary,
  WatchlistItem,
} from "./types.js";

type DatabaseClient = ReturnType<typeof createDatabase>["db"];

export class ManualRefreshCooldownError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Manual refresh is cooling down");
  }
}

const SERIES_COLORS = ["#0b4f2d", "#289746", "#92bf6d"] as const;
const DEFAULT_STOREFRONT = "US";
const RANGE_DAYS: Record<HistoryRange, number> = { "7d": 7, "30d": 30, "90d": 90 };
const MANUAL_REFRESH_COOLDOWN_MS = 15 * 60 * 1000;

const asIso = (value: Date | string) =>
  (typeof value === "string" ? new Date(value) : value).toISOString();

const asConfidence = (value: string) => (value === "high" || value === "medium" ? value : "low");

const normalizeStorefront = (value?: string) =>
  /^[a-z]{2}$/i.test(value ?? "")
    ? (value?.toUpperCase() ?? DEFAULT_STOREFRONT)
    : DEFAULT_STOREFRONT;

function isValidTimezone(value?: string): boolean {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function projectSummary(project: ProjectRecord): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    appId: project.appId,
    appName: project.appName,
    storefront: project.storefront,
    iconUrl: project.iconUrl,
    settings: {
      enabled: project.scheduleEnabled,
      frequency: asScheduleFrequency(project.scheduleFrequency),
      time: project.scheduleTime,
      timezone: project.scheduleTimezone,
      weekday: project.scheduleWeekday,
    },
    createdAt: asIso(project.createdAt),
  };
}

function asScheduleFrequency(value: string): ProjectSettings["frequency"] {
  return value === "weekdays" || value === "weekly" ? value : "daily";
}

export function asHistoryRange(value?: string): HistoryRange {
  return value === "30d" || value === "90d" ? value : "7d";
}

function dateKey(value: Date | string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dayDomain(range: HistoryRange, timezone: string, now = new Date()): string[] {
  const today = dateKey(now, timezone);
  const cursor = new Date(`${today}T12:00:00.000Z`);
  return Array.from({ length: RANGE_DAYS[range] }, (_, offset) => {
    const day = new Date(cursor);
    day.setUTCDate(cursor.getUTCDate() - (RANGE_DAYS[range] - offset - 1));
    return day.toISOString().slice(0, 10);
  });
}

function dayLabel(day: string, range: HistoryRange) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(range === "90d" ? { year: "2-digit" as const } : {}),
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00.000Z`));
}

export function buildDailyHistory(
  entries: Array<{ observedAt: string; rank: number | null }>,
  range: HistoryRange,
  timezone: string,
  now = new Date(),
) {
  const latestByDay = new Map<string, { observedAt: string; rank: number | null }>();
  for (const entry of entries) {
    const key = dateKey(entry.observedAt, timezone);
    const current = latestByDay.get(key);
    if (!current || current.observedAt < entry.observedAt) latestByDay.set(key, entry);
  }
  return dayDomain(range, timezone, now).map((day) => ({
    date: day,
    label: dayLabel(day, range),
    rank: latestByDay.get(day)?.rank ?? null,
    observed: latestByDay.has(day),
  }));
}

function movementAcrossRange(
  keyword: string,
  history: Array<{ rank: number | null; observed: boolean }>,
): number | null {
  const observed = history.filter((point) => point.observed);
  if (observed.length < 2) return null;
  const previous = observed[0];
  const current = observed[observed.length - 1];
  if (!previous || !current) return null;
  return deriveRankingSignal(keyword, previous.rank, current.rank)?.movement ?? 0;
}

function zonedDateTimeToUtc(day: string, time: string, timezone: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  let candidate = new Date(
    Date.UTC(year ?? 1970, (month ?? 1) - 1, date ?? 1, hour ?? 0, minute ?? 0),
  );
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(candidate);
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    const represented = Date.UTC(
      value("year"),
      value("month") - 1,
      value("day"),
      value("hour"),
      value("minute"),
      value("second"),
    );
    const offset = represented - candidate.getTime();
    candidate = new Date(
      Date.UTC(year ?? 1970, (month ?? 1) - 1, date ?? 1, hour ?? 0, minute ?? 0) - offset,
    );
  }
  return candidate;
}

function nextObservationAtForProject(project: ProjectRecord, now = new Date()): string | null {
  if (!project.scheduleEnabled) return null;
  const today = dateKey(now, project.scheduleTimezone);
  const cursor = new Date(`${today}T12:00:00.000Z`);
  for (let offset = 0; offset < 8; offset += 1) {
    const localDay = new Date(cursor);
    localDay.setUTCDate(cursor.getUTCDate() + offset);
    const day = localDay.toISOString().slice(0, 10);
    const weekday = localDay.getUTCDay() === 0 ? 7 : localDay.getUTCDay();
    const frequency = asScheduleFrequency(project.scheduleFrequency);
    if (frequency === "weekdays" && weekday > 5) continue;
    if (frequency === "weekly" && weekday !== project.scheduleWeekday) continue;
    const candidate = zonedDateTimeToUtc(day, project.scheduleTime, project.scheduleTimezone);
    if (candidate > now) return candidate.toISOString();
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asSignalPayload(value: Record<string, unknown>): RankingSignal | null {
  const { kind, keyword, previousRank, currentRank, movement } = value;
  if (
    typeof kind !== "string" ||
    typeof keyword !== "string" ||
    typeof movement !== "number" ||
    !["gain", "loss", "entered", "left"].includes(kind)
  ) {
    return null;
  }
  const normalizedPrevious = typeof previousRank === "number" ? previousRank : null;
  const normalizedCurrent = typeof currentRank === "number" ? currentRank : null;
  return {
    kind: kind as RankingSignal["kind"],
    keyword,
    previousRank: normalizedPrevious,
    currentRank: normalizedCurrent,
    movement,
  };
}

function assertBackup(value: unknown): asserts value is ProjectBackup {
  if (
    !isRecord(value) ||
    (value.version !== 2 && value.version !== 3) ||
    !isRecord(value.project)
  ) {
    throw new Error("Unsupported or malformed ASOpulse backup");
  }
  if (
    typeof value.project.name !== "string" ||
    typeof value.project.appId !== "string" ||
    typeof value.project.appName !== "string" ||
    typeof value.project.storefront !== "string" ||
    !Array.isArray(value.trackedKeywords) ||
    !Array.isArray(value.signals)
  ) {
    throw new Error("Unsupported or malformed ASOpulse backup");
  }
  for (const item of value.trackedKeywords) {
    if (
      !isRecord(item) ||
      typeof item.keyword !== "string" ||
      typeof item.enabled !== "boolean" ||
      !Array.isArray(item.tags) ||
      !Array.isArray(item.observations)
    ) {
      throw new Error("Unsupported or malformed ASOpulse backup");
    }
  }
}

export function createWorkspaceService({
  database,
  provider,
}: {
  database: DatabaseClient;
  provider: AppStoreProvider;
}) {
  async function listProjectsForOwner(ownerId: string): Promise<ProjectSummary[]> {
    const rows = await database
      .select()
      .from(projects)
      .where(eq(projects.ownerId, ownerId))
      .orderBy(asc(projects.createdAt));
    return rows.map(projectSummary);
  }

  async function createProjectForOwner(
    ownerId: string,
    input: {
      name: string;
      appId: string;
      appName: string;
      storefront?: string;
      iconUrl?: string;
      timezone?: string;
    },
  ): Promise<ProjectSummary> {
    const normalizedStorefront = normalizeStorefront(input.storefront);
    const [existing] = await database
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.ownerId, ownerId),
          eq(projects.appId, input.appId.trim()),
          eq(projects.storefront, normalizedStorefront),
        ),
      )
      .limit(1);
    if (existing) return projectSummary(existing);
    const [created] = await database
      .insert(projects)
      .values({
        ownerId,
        name: input.name.trim(),
        appId: input.appId.trim(),
        appName: input.appName.trim(),
        storefront: normalizedStorefront,
        iconUrl: input.iconUrl?.trim() ?? "",
        scheduleTimezone: isValidTimezone(input.timezone) ? (input.timezone ?? "UTC") : "UTC",
      })
      .returning();
    if (!created) throw new Error("Unable to create project");
    return projectSummary(created);
  }

  async function requireOwnedProject(ownerId: string, projectId: string) {
    const [project] = await database
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)));
    if (!project) throw new Error("Project not found");
    return project;
  }

  async function getProjectById(projectId: string) {
    const [project] = await database.select().from(projects).where(eq(projects.id, projectId));
    if (!project) throw new Error("Project not found");
    return project;
  }

  async function listTrackedKeywordState(projectId: string) {
    const rows = await database
      .select({
        trackedKeywordId: trackedKeywords.id,
        keyword: trackedKeywords.keyword,
        enabled: trackedKeywords.enabled,
        tags: trackedKeywords.tags,
        createdAt: trackedKeywords.createdAt,
        observationId: rankObservations.id,
        rank: rankObservations.rank,
        resultCount: rankObservations.resultCount,
        competition: rankObservations.competition,
        opportunity: rankObservations.opportunity,
        methodVersion: rankObservations.methodVersion,
        confidence: rankObservations.confidence,
        observedAt: rankObservations.observedAt,
      })
      .from(trackedKeywords)
      .leftJoin(rankObservations, eq(rankObservations.trackedKeywordId, trackedKeywords.id))
      .where(eq(trackedKeywords.projectId, projectId))
      .orderBy(asc(trackedKeywords.createdAt), desc(rankObservations.observedAt));

    const grouped = new Map<
      string,
      {
        id: string;
        keyword: string;
        enabled: boolean;
        tags: string[];
        createdAt: string;
        observations: Array<{
          rank: number | null;
          resultCount: number;
          competition: number;
          opportunity: number;
          methodVersion: string;
          confidence: string;
          observedAt: string;
        }>;
      }
    >();

    for (const row of rows) {
      const current = grouped.get(row.trackedKeywordId) ?? {
        id: row.trackedKeywordId,
        keyword: row.keyword,
        enabled: row.enabled,
        tags: row.tags,
        createdAt: asIso(row.createdAt),
        observations: [],
      };
      if (
        row.observationId &&
        row.resultCount !== null &&
        row.competition !== null &&
        row.opportunity !== null &&
        row.methodVersion !== null &&
        row.confidence !== null &&
        row.observedAt !== null
      ) {
        current.observations.push({
          rank: row.rank,
          resultCount: row.resultCount,
          competition: row.competition,
          opportunity: row.opportunity,
          methodVersion: row.methodVersion,
          confidence: row.confidence,
          observedAt: asIso(row.observedAt),
        });
      }
      grouped.set(row.trackedKeywordId, current);
    }

    return [...grouped.values()];
  }

  async function buildWatchlist(
    projectId: string,
    range: HistoryRange = "7d",
    timezone = "UTC",
  ): Promise<WatchlistItem[]> {
    const tracked = await listTrackedKeywordState(projectId);
    return tracked
      .filter((item) => item.enabled)
      .map((item) => {
        const latest = item.observations[0];
        const history = buildDailyHistory(item.observations, range, timezone);
        const sparkline = buildDailyHistory(item.observations, "7d", timezone).map(
          ({ date, rank, observed }) => ({ date, rank, observed }),
        );
        return {
          id: item.id,
          keyword: item.keyword,
          rank: latest?.rank ?? null,
          competition: latest?.competition ?? 0,
          opportunity: latest?.opportunity ?? 0,
          resultCount: latest?.resultCount ?? 0,
          movement: movementAcrossRange(item.keyword, history),
          tags: item.tags,
          tracked: true as const,
          provenance: {
            observedAt: latest?.observedAt ?? item.createdAt,
            confidence: latest?.confidence ?? "low",
            methodVersion: latest?.methodVersion ?? "pending",
          },
          sparkline,
          refreshState: latest ? ("fresh" as const) : ("pending" as const),
        };
      })
      .sort(
        (left, right) =>
          right.opportunity - left.opportunity || left.keyword.localeCompare(right.keyword),
      );
  }

  async function persistObservation(
    projectId: string,
    keywordId: string,
    keyword: string,
    appId: string,
    storefront: string,
    maxAgeMs = 0,
  ) {
    const observedAt = new Date().toISOString();
    const results = await provider.searchKeyword(keyword, storefront, { maxAgeMs });
    const score = scoreKeyword(keyword, results, appId, observedAt);

    const [latestObservation] = await database
      .select({
        rank: rankObservations.rank,
      })
      .from(rankObservations)
      .where(eq(rankObservations.trackedKeywordId, keywordId))
      .orderBy(desc(rankObservations.observedAt))
      .limit(1);

    const [createdObservation] = await database
      .insert(rankObservations)
      .values({
        trackedKeywordId: keywordId,
        rank: score.rank,
        resultCount: score.resultCount,
        competition: score.competition,
        opportunity: score.opportunity,
        methodVersion: score.provenance.methodVersion,
        confidence: score.provenance.confidence,
        observedAt: new Date(score.provenance.observedAt),
      })
      .returning();

    const signal = deriveRankingSignal(keyword, latestObservation?.rank ?? null, score.rank);
    if (signal) {
      await database.insert(signals).values({
        projectId,
        trackedKeywordId: keywordId,
        kind: signal.kind,
        payload: signal,
      });
    }

    return { score, signal, createdObservation };
  }

  async function trackKeywordForProject(
    ownerId: string,
    projectId: string,
    input: { keyword: string },
  ): Promise<WatchlistItem> {
    const project = await requireOwnedProject(ownerId, projectId);
    const normalizedKeyword = input.keyword.trim().toLowerCase();
    let [existing] = await database
      .select()
      .from(trackedKeywords)
      .where(
        and(
          eq(trackedKeywords.projectId, project.id),
          eq(trackedKeywords.keyword, normalizedKeyword),
        ),
      )
      .limit(1);

    if (!existing) {
      [existing] = await database
        .insert(trackedKeywords)
        .values({
          projectId: project.id,
          keyword: normalizedKeyword,
          enabled: true,
          tags: [],
        })
        .returning();
    }

    if (!existing) throw new Error("Unable to create tracked keyword");

    const watchlist = await buildWatchlist(project.id, "7d", project.scheduleTimezone);
    const match = watchlist.find((item) => item.id === existing.id);
    if (!match) throw new Error("Unable to read tracked keyword");
    return match;
  }

  async function trackKeywordsForProject(ownerId: string, projectId: string, keywords: string[]) {
    const normalized = [
      ...new Set(
        keywords
          .map((keyword) => keyword.trim().toLowerCase())
          .filter((keyword) => keyword.length >= 2),
      ),
    ];
    const items: WatchlistItem[] = [];
    for (const keyword of normalized) {
      items.push(await trackKeywordForProject(ownerId, projectId, { keyword }));
    }
    return items;
  }

  async function deleteTrackedKeywordForProject(
    ownerId: string,
    projectId: string,
    trackedKeywordId: string,
  ) {
    await requireOwnedProject(ownerId, projectId);
    const [existing] = await database
      .select({ id: trackedKeywords.id })
      .from(trackedKeywords)
      .where(
        and(eq(trackedKeywords.id, trackedKeywordId), eq(trackedKeywords.projectId, projectId)),
      )
      .limit(1);

    if (!existing) throw new Error("Tracked keyword not found");

    await database.delete(trackedKeywords).where(eq(trackedKeywords.id, trackedKeywordId));

    return { deleted: true as const, id: trackedKeywordId };
  }

  async function getWatchlistForProject(
    ownerId: string,
    projectId: string,
    range: HistoryRange = "7d",
  ) {
    const project = await requireOwnedProject(ownerId, projectId);
    return {
      data: await buildWatchlist(projectId, range, project.scheduleTimezone),
      nextObservationAt: nextObservationAtForProject(project),
    };
  }

  async function getKeywordHistoryForProject(
    ownerId: string,
    projectId: string,
    trackedKeywordId: string,
    range: HistoryRange,
  ): Promise<KeywordHistory> {
    const project = await requireOwnedProject(ownerId, projectId);
    const tracked = await listTrackedKeywordState(project.id);
    const item = tracked.find((keyword) => keyword.id === trackedKeywordId && keyword.enabled);
    if (!item) throw new Error("Tracked keyword not found");
    const daily = buildDailyHistory(item.observations, range, project.scheduleTimezone);
    const latest = item.observations[0];
    return {
      keywordId: item.id,
      keyword: item.keyword,
      range,
      timeline: daily.map(({ date, label, rank, observed }) => ({ date, label, rank, observed })),
      currentRank: latest?.rank ?? null,
      movement: movementAcrossRange(item.keyword, daily),
      lastObservedAt: latest?.observedAt ?? null,
    };
  }

  async function getProjectSettings(ownerId: string, projectId: string): Promise<ProjectSettings> {
    const project = await requireOwnedProject(ownerId, projectId);
    return projectSummary(project).settings;
  }

  async function updateProjectSettings(
    ownerId: string,
    projectId: string,
    input: ProjectSettings,
  ): Promise<ProjectSettings> {
    await requireOwnedProject(ownerId, projectId);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) throw new Error("Invalid schedule time");
    if (!isValidTimezone(input.timezone)) throw new Error("Invalid schedule timezone");
    if (!["daily", "weekdays", "weekly"].includes(input.frequency)) {
      throw new Error("Invalid schedule frequency");
    }
    if (!Number.isInteger(input.weekday) || input.weekday < 1 || input.weekday > 7) {
      throw new Error("Invalid schedule weekday");
    }
    const [updated] = await database
      .update(projects)
      .set({
        scheduleEnabled: input.enabled,
        scheduleFrequency: input.frequency,
        scheduleTime: input.time,
        scheduleTimezone: input.timezone,
        scheduleWeekday: input.weekday,
      })
      .where(eq(projects.id, projectId))
      .returning();
    if (!updated) throw new Error("Project not found");
    return projectSummary(updated).settings;
  }

  async function createMarketForProject(ownerId: string, projectId: string, storefront: string) {
    const source = await requireOwnedProject(ownerId, projectId);
    const normalized = normalizeStorefront(storefront);
    const [existing] = await database
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.ownerId, ownerId),
          eq(projects.appId, source.appId),
          eq(projects.storefront, normalized),
        ),
      )
      .limit(1);
    if (existing) return { project: projectSummary(existing), created: false as const };

    const sourceKeywords = await database
      .select()
      .from(trackedKeywords)
      .where(and(eq(trackedKeywords.projectId, source.id), eq(trackedKeywords.enabled, true)));
    return database.transaction(async (transaction) => {
      const [created] = await transaction
        .insert(projects)
        .values({
          ownerId,
          name: source.name,
          appId: source.appId,
          appName: source.appName,
          storefront: normalized,
          iconUrl: source.iconUrl,
          scheduleEnabled: source.scheduleEnabled,
          scheduleFrequency: source.scheduleFrequency,
          scheduleTime: source.scheduleTime,
          scheduleTimezone: source.scheduleTimezone,
          scheduleWeekday: source.scheduleWeekday,
        })
        .returning();
      if (!created) throw new Error("Unable to create market");
      if (sourceKeywords.length > 0) {
        await transaction.insert(trackedKeywords).values(
          sourceKeywords.map((keyword) => ({
            projectId: created.id,
            keyword: keyword.keyword,
            enabled: true,
            tags: keyword.tags,
          })),
        );
      }
      return { project: projectSummary(created), created: true as const };
    });
  }

  async function discoverKeyword(input: { term: string; country?: string; appId?: string }) {
    const results = await provider.searchKeyword(input.term, normalizeStorefront(input.country));
    return {
      data: scoreKeyword(input.term, results, input.appId),
      results: results.slice(0, 25),
    };
  }

  async function getPulseForProject(ownerId: string, projectId: string): Promise<ProjectPulse> {
    const project = await requireOwnedProject(ownerId, projectId);
    const keywords = await buildWatchlist(project.id, "7d", project.scheduleTimezone);
    const tracked = await listTrackedKeywordState(project.id);
    const signalRows = await database
      .select()
      .from(signals)
      .where(eq(signals.projectId, project.id))
      .orderBy(desc(signals.createdAt))
      .limit(8);

    const domain = dayDomain("7d", project.scheduleTimezone);
    const timeline = domain.map((day) => ({
      observedAt: day,
      label: dayLabel(day, "7d"),
    }));
    const series = tracked
      .filter((item) => item.observations.length > 0)
      .slice(0, SERIES_COLORS.length)
      .map((item, index) => ({
        keyword: item.keyword,
        color: SERIES_COLORS[index] ?? SERIES_COLORS[0],
        values: buildDailyHistory(item.observations, "7d", project.scheduleTimezone).map(
          (point) => point.rank,
        ),
      }));

    return {
      project: projectSummary(project),
      keywords,
      signals: signalRows.flatMap((row) => {
        const payload = isRecord(row.payload) ? asSignalPayload(row.payload) : null;
        return payload ? [{ ...payload, id: row.id, createdAt: asIso(row.createdAt) }] : [];
      }),
      series,
      timeline,
      nextObservationAt: nextObservationAtForProject(project),
    };
  }

  async function exportProjectCsv(ownerId: string, projectId: string) {
    const project = await requireOwnedProject(ownerId, projectId);
    const rows = await buildWatchlist(projectId, "7d", project.scheduleTimezone);
    return toCsv(
      rows.map(({ keyword, rank, competition, opportunity, movement, tags }) => ({
        keyword,
        rank: formatRank(rank),
        competition,
        opportunity,
        movement,
        tags: tags.join("|"),
      })),
    );
  }

  async function backupProject(ownerId: string, projectId: string): Promise<ProjectBackup> {
    const project = await requireOwnedProject(ownerId, projectId);
    const tracked = await listTrackedKeywordState(project.id);
    const signalRows = await database
      .select()
      .from(signals)
      .where(eq(signals.projectId, project.id))
      .orderBy(asc(signals.createdAt));

    return {
      version: 3,
      exportedAt: new Date().toISOString(),
      project: {
        name: project.name,
        appId: project.appId,
        appName: project.appName,
        storefront: project.storefront,
        iconUrl: project.iconUrl,
        settings: projectSummary(project).settings,
      },
      trackedKeywords: tracked.map((item) => ({
        keyword: item.keyword,
        enabled: item.enabled,
        tags: item.tags,
        observations: item.observations,
      })),
      signals: signalRows.flatMap((row) => {
        const payload = isRecord(row.payload) ? asSignalPayload(row.payload) : null;
        return payload ? [{ ...payload, createdAt: asIso(row.createdAt) }] : [];
      }),
    };
  }

  async function restoreProject(
    ownerId: string,
    projectId: string,
    value: unknown,
  ): Promise<BackupImportResult> {
    assertBackup(value);
    const project = await requireOwnedProject(ownerId, projectId);
    return database.transaction(async (transaction) => {
      await transaction
        .update(projects)
        .set({
          name: value.project.name,
          appId: value.project.appId,
          appName: value.project.appName,
          storefront: normalizeStorefront(value.project.storefront),
          iconUrl: value.project.iconUrl?.trim() ?? project.iconUrl,
          scheduleEnabled: value.project.settings?.enabled ?? project.scheduleEnabled,
          scheduleFrequency: value.project.settings?.frequency ?? project.scheduleFrequency,
          scheduleTime: value.project.settings?.time ?? project.scheduleTime,
          scheduleTimezone: value.project.settings?.timezone ?? project.scheduleTimezone,
          scheduleWeekday: value.project.settings?.weekday ?? project.scheduleWeekday,
        })
        .where(eq(projects.id, project.id));

      await transaction.delete(signals).where(eq(signals.projectId, project.id));
      await transaction.delete(trackedKeywords).where(eq(trackedKeywords.projectId, project.id));

      const keywordMap = new Map<string, string>();
      let importedObservations = 0;

      for (const item of value.trackedKeywords) {
        const [createdKeyword] = await transaction
          .insert(trackedKeywords)
          .values({
            projectId: project.id,
            keyword: item.keyword.trim().toLowerCase(),
            enabled: item.enabled,
            tags: item.tags.filter((tag): tag is string => typeof tag === "string"),
          })
          .returning();
        if (!createdKeyword) throw new Error("Unable to restore tracked keyword");
        keywordMap.set(createdKeyword.keyword, createdKeyword.id);
        if (item.observations.length > 0) {
          await transaction.insert(rankObservations).values(
            item.observations.map((observation) => ({
              trackedKeywordId: createdKeyword.id,
              rank: typeof observation.rank === "number" ? observation.rank : null,
              resultCount: observation.resultCount,
              competition: observation.competition,
              opportunity: observation.opportunity,
              methodVersion: observation.methodVersion,
              confidence: asConfidence(observation.confidence),
              observedAt: new Date(observation.observedAt),
            })),
          );
          importedObservations += item.observations.length;
        }
      }

      if (value.signals.length > 0) {
        await transaction.insert(signals).values(
          value.signals.map((signal) => ({
            projectId: project.id,
            trackedKeywordId: keywordMap.get(signal.keyword) ?? null,
            kind: signal.kind,
            payload: {
              kind: signal.kind,
              keyword: signal.keyword,
              previousRank: signal.previousRank,
              currentRank: signal.currentRank,
              movement: signal.movement,
            },
            createdAt: new Date(signal.createdAt),
          })),
        );
      }

      return {
        importedKeywords: value.trackedKeywords.length,
        importedObservations,
        importedSignals: value.signals.length,
      };
    });
  }

  async function createJobRun(jobName: string, detail?: string) {
    const [created] = await database
      .insert(jobRuns)
      .values({
        jobName,
        status: "running",
        detail,
      })
      .returning();
    if (!created) throw new Error("Unable to create job run");
    return created;
  }

  async function createObservationRun(
    ownerId: string,
    projectId: string,
    trigger: "manual" | "scheduled" | "initial",
    trackedKeywordIds?: string[],
  ): Promise<ObservationRunSummary> {
    await requireOwnedProject(ownerId, projectId);
    const requestedIds = trackedKeywordIds ? [...new Set(trackedKeywordIds)] : undefined;
    if (requestedIds && requestedIds.length > 0) {
      const owned = await database
        .select({ id: trackedKeywords.id })
        .from(trackedKeywords)
        .where(
          and(
            eq(trackedKeywords.projectId, projectId),
            eq(trackedKeywords.enabled, true),
            inArray(trackedKeywords.id, requestedIds),
          ),
        );
      if (owned.length !== requestedIds.length)
        throw new Error("Invalid tracked keyword selection");
    }
    if (trigger === "manual") {
      const [latestManual] = await database
        .select({ startedAt: jobRuns.startedAt })
        .from(jobRuns)
        .where(and(eq(jobRuns.projectId, projectId), eq(jobRuns.trigger, "manual")))
        .orderBy(desc(jobRuns.startedAt))
        .limit(1);
      if (latestManual) {
        const eligibleAt = new Date(latestManual.startedAt).getTime() + MANUAL_REFRESH_COOLDOWN_MS;
        if (eligibleAt > Date.now()) {
          throw new ManualRefreshCooldownError(Math.ceil((eligibleAt - Date.now()) / 1000));
        }
      }
    }
    const requestedCount =
      requestedIds?.length ??
      (
        await database
          .select({ id: trackedKeywords.id })
          .from(trackedKeywords)
          .where(and(eq(trackedKeywords.projectId, projectId), eq(trackedKeywords.enabled, true)))
      ).length;
    const [created] = await database
      .insert(jobRuns)
      .values({
        jobName: "rank-observation",
        projectId,
        trigger,
        status: "queued",
        requestedCount,
      })
      .returning();
    if (!created) throw new Error("Unable to create observation run");
    return observationRunSummary(created);
  }

  async function createSystemObservationRun(
    projectId: string,
    trigger: "scheduled" | "initial" = "scheduled",
    trackedKeywordIds?: string[],
  ): Promise<ObservationRunSummary> {
    await getProjectById(projectId);
    const requestedCount =
      trackedKeywordIds?.length ??
      (
        await database
          .select({ id: trackedKeywords.id })
          .from(trackedKeywords)
          .where(and(eq(trackedKeywords.projectId, projectId), eq(trackedKeywords.enabled, true)))
      ).length;
    const [created] = await database
      .insert(jobRuns)
      .values({
        jobName: "rank-observation",
        projectId,
        trigger,
        status: "queued",
        requestedCount,
      })
      .returning();
    if (!created) throw new Error("Unable to create observation run");
    return observationRunSummary(created);
  }

  async function listScheduledProjects() {
    const rows = await database
      .select()
      .from(projects)
      .where(eq(projects.scheduleEnabled, true))
      .orderBy(asc(projects.createdAt));
    return rows.map(projectSummary);
  }

  function observationRunSummary(run: typeof jobRuns.$inferSelect): ObservationRunSummary {
    const nextEligibleManualAt =
      run.trigger === "manual"
        ? new Date(new Date(run.startedAt).getTime() + MANUAL_REFRESH_COOLDOWN_MS).toISOString()
        : null;
    return {
      id: run.id,
      projectId: run.projectId,
      trigger: run.trigger === "manual" || run.trigger === "initial" ? run.trigger : "scheduled",
      status:
        run.status === "queued" ||
        run.status === "running" ||
        run.status === "partial" ||
        run.status === "failed"
          ? run.status
          : "completed",
      requestedCount: run.requestedCount,
      observedCount: run.observedCount,
      failedCount: run.failedCount,
      failures: run.failures,
      startedAt: asIso(run.startedAt),
      finishedAt: run.finishedAt ? asIso(run.finishedAt) : null,
      nextEligibleManualAt,
    };
  }

  async function startObservationRun(jobRunId: string) {
    await database.update(jobRuns).set({ status: "running" }).where(eq(jobRuns.id, jobRunId));
  }

  async function finishObservationRun(jobRunId: string, result: ObservationRunResult) {
    const failedCount = result.failedKeywords.length;
    const [updated] = await database
      .update(jobRuns)
      .set({
        status:
          failedCount === 0 ? "completed" : result.observedKeywords === 0 ? "failed" : "partial",
        observedCount: result.observedKeywords,
        failedCount,
        failures: result.failedKeywords,
        detail: `${result.observedKeywords} keywords observed, ${failedCount} failed`,
        finishedAt: new Date(),
      })
      .where(eq(jobRuns.id, jobRunId))
      .returning();
    return updated ? observationRunSummary(updated) : null;
  }

  async function getLatestObservationRunForProject(
    ownerId: string,
    projectId: string,
  ): Promise<ObservationRunSummary | null> {
    await requireOwnedProject(ownerId, projectId);
    const [latest] = await database
      .select()
      .from(jobRuns)
      .where(eq(jobRuns.projectId, projectId))
      .orderBy(desc(jobRuns.startedAt))
      .limit(1);
    return latest ? observationRunSummary(latest) : null;
  }

  async function finishJobRun(jobRunId: string, status: "completed" | "failed", detail?: string) {
    await database
      .update(jobRuns)
      .set({ status, detail, finishedAt: new Date() })
      .where(eq(jobRuns.id, jobRunId));
  }

  async function observeProject(
    projectId: string,
    trackedKeywordIds?: string[],
  ): Promise<ObservationRunResult> {
    const project = await getProjectById(projectId);
    const conditions = [
      eq(trackedKeywords.projectId, project.id),
      eq(trackedKeywords.enabled, true),
    ];
    if (trackedKeywordIds && trackedKeywordIds.length > 0) {
      conditions.push(inArray(trackedKeywords.id, trackedKeywordIds));
    }
    const tracked = await database
      .select()
      .from(trackedKeywords)
      .where(and(...conditions))
      .orderBy(asc(trackedKeywords.createdAt));

    let generatedSignals = 0;
    let observedKeywords = 0;
    const failedKeywords: Array<{ keyword: string; message: string }> = [];
    for (const item of tracked) {
      try {
        const { signal } = await persistObservation(
          project.id,
          item.id,
          item.keyword,
          project.appId,
          project.storefront,
          0,
        );
        observedKeywords += 1;
        if (signal) generatedSignals += 1;
      } catch (error) {
        failedKeywords.push({
          keyword: item.keyword,
          message: error instanceof Error ? error.message : "Unknown observation failure",
        });
      }
    }

    return {
      observedKeywords,
      generatedSignals,
      failedKeywords,
      observedAt: new Date().toISOString(),
    };
  }

  async function observeAllProjects() {
    const allProjects = await database
      .select({ id: projects.id })
      .from(projects)
      .orderBy(asc(projects.createdAt));
    let observedKeywords = 0;
    let generatedSignals = 0;
    const failedKeywords: Array<{ keyword: string; message: string }> = [];
    const observedAt = new Date().toISOString();
    for (const project of allProjects) {
      const result = await observeProject(project.id);
      observedKeywords += result.observedKeywords;
      generatedSignals += result.generatedSignals;
      failedKeywords.push(...result.failedKeywords);
    }
    return { observedKeywords, generatedSignals, failedKeywords, observedAt };
  }

  async function getLatestHealth() {
    const [latestObservation] = await database
      .select({ observedAt: rankObservations.observedAt })
      .from(rankObservations)
      .orderBy(desc(rankObservations.observedAt))
      .limit(1);
    const [latestJob] = await database
      .select()
      .from(jobRuns)
      .orderBy(desc(jobRuns.startedAt))
      .limit(1);
    return {
      database: "healthy",
      worker:
        latestJob?.status === "completed"
          ? "healthy"
          : latestJob?.status === "failed" || latestJob?.status === "partial"
            ? "degraded"
            : "configured",
      lastObservationAt: latestObservation ? asIso(latestObservation.observedAt) : null,
      latestJob,
    };
  }

  return {
    backupProject,
    createMarketForProject,
    createObservationRun,
    createSystemObservationRun,
    createJobRun,
    createProjectForOwner,
    discoverKeyword,
    exportProjectCsv,
    finishJobRun,
    finishObservationRun,
    getKeywordHistoryForProject,
    getLatestHealth,
    getLatestObservationRunForProject,
    getProjectSettings,
    getPulseForProject,
    getWatchlistForProject,
    listProjectsForOwner,
    listScheduledProjects,
    observeAllProjects,
    observeProject,
    startObservationRun,
    restoreProject,
    deleteTrackedKeywordForProject,
    trackKeywordForProject,
    trackKeywordsForProject,
    updateProjectSettings,
  };
}
