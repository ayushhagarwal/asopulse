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
import { and, asc, desc, eq } from "drizzle-orm";
import type {
  BackupImportResult,
  ObservationRunResult,
  ProjectBackup,
  ProjectPulse,
  ProjectRecord,
  ProjectSummary,
  PulseSeries,
  TimelinePoint,
  WatchlistItem,
} from "./types.js";

type DatabaseClient = ReturnType<typeof createDatabase>["db"];

const SERIES_COLORS = ["#0b4f2d", "#289746", "#92bf6d"] as const;
const DEFAULT_STOREFRONT = "US";
const DEFAULT_SCHEDULE = "0 6 * * *";

const asIso = (value: Date | string) =>
  (typeof value === "string" ? new Date(value) : value).toISOString();

const asConfidence = (value: string) => (value === "high" || value === "medium" ? value : "low");

const normalizeStorefront = (value?: string) =>
  /^[a-z]{2}$/i.test(value ?? "")
    ? (value?.toUpperCase() ?? DEFAULT_STOREFRONT)
    : DEFAULT_STOREFRONT;

function projectSummary(project: ProjectRecord): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    appId: project.appId,
    appName: project.appName,
    storefront: project.storefront,
    createdAt: asIso(project.createdAt),
  };
}

function parseNextObservationAt(schedule = DEFAULT_SCHEDULE, now = new Date()): string | null {
  const match = /^0\s+(\d{1,2})\s+\*\s+\*\s+\*$/.exec(schedule.trim());
  if (!match) return null;
  const target = new Date(now);
  target.setUTCMinutes(0, 0, 0);
  target.setUTCHours(Number(match[1]));
  if (target <= now) target.setUTCDate(target.getUTCDate() + 1);
  return target.toISOString();
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
  if (!isRecord(value) || value.version !== 2 || !isRecord(value.project)) {
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

function buildMovement(previousRank: number | null, currentRank: number | null, keyword: string) {
  return deriveRankingSignal(keyword, previousRank, currentRank)?.movement ?? 0;
}

function createSeries(
  timeline: TimelinePoint[],
  keywordHistory: Array<{
    keyword: string;
    entries: Array<{ observedAt: string; rank: number | null }>;
  }>,
): PulseSeries[] {
  const timelineIndex = new Map(timeline.map((point, index) => [point.observedAt, index]));
  return keywordHistory.slice(0, SERIES_COLORS.length).map((item, index) => {
    const values = new Array<number | null>(timeline.length).fill(null);
    for (const entry of item.entries) {
      const timelinePosition = timelineIndex.get(entry.observedAt);
      if (timelinePosition !== undefined) values[timelinePosition] = entry.rank;
    }
    return { keyword: item.keyword, color: SERIES_COLORS[index] ?? SERIES_COLORS[0], values };
  });
}

export function createWorkspaceService({
  database,
  provider,
  trackingSchedule = process.env.TRACKING_SCHEDULE ?? DEFAULT_SCHEDULE,
}: {
  database: DatabaseClient;
  provider: AppStoreProvider;
  trackingSchedule?: string;
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
    input: { name: string; appId: string; appName: string; storefront?: string },
  ): Promise<ProjectSummary> {
    const [created] = await database
      .insert(projects)
      .values({
        ownerId,
        name: input.name.trim(),
        appId: input.appId.trim(),
        appName: input.appName.trim(),
        storefront: normalizeStorefront(input.storefront),
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

  async function buildWatchlist(projectId: string): Promise<WatchlistItem[]> {
    const tracked = await listTrackedKeywordState(projectId);
    return tracked
      .filter((item) => item.enabled)
      .map((item) => {
        const latest = item.observations[0];
        const previous = item.observations[1];
        return {
          id: item.id,
          keyword: item.keyword,
          rank: latest?.rank ?? null,
          competition: latest?.competition ?? 0,
          opportunity: latest?.opportunity ?? 0,
          resultCount: latest?.resultCount ?? 0,
          movement: buildMovement(previous?.rank ?? null, latest?.rank ?? null, item.keyword),
          tags: item.tags,
          tracked: true as const,
          provenance: {
            observedAt: latest?.observedAt ?? item.createdAt,
            confidence: latest?.confidence ?? "low",
            methodVersion: latest?.methodVersion ?? "pending",
          },
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
  ) {
    const observedAt = new Date().toISOString();
    const results = await provider.searchKeyword(keyword, storefront);
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

    await persistObservation(
      project.id,
      existing.id,
      existing.keyword,
      project.appId,
      project.storefront,
    );

    const watchlist = await buildWatchlist(project.id);
    const match = watchlist.find((item) => item.id === existing.id);
    if (!match) throw new Error("Unable to read tracked keyword");
    return match;
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

  async function getWatchlistForProject(ownerId: string, projectId: string) {
    await requireOwnedProject(ownerId, projectId);
    return {
      data: await buildWatchlist(projectId),
      nextObservationAt: parseNextObservationAt(trackingSchedule),
    };
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
    const keywords = await buildWatchlist(project.id);
    const tracked = await listTrackedKeywordState(project.id);
    const signalRows = await database
      .select()
      .from(signals)
      .where(eq(signals.projectId, project.id))
      .orderBy(desc(signals.createdAt))
      .limit(8);

    const groupedTimeline = [
      ...new Set(
        tracked.flatMap((item) => item.observations.map((observation) => observation.observedAt)),
      ),
    ]
      .sort((left, right) => left.localeCompare(right))
      .slice(-7);

    const timeline: TimelinePoint[] = groupedTimeline.map((observedAt) => ({
      observedAt,
      label: new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(new Date(observedAt)),
    }));

    const series = createSeries(
      timeline,
      tracked
        .filter((item) => item.observations.length > 0)
        .map((item) => ({
          keyword: item.keyword,
          entries: item.observations
            .slice()
            .sort((left, right) => left.observedAt.localeCompare(right.observedAt))
            .map((observation) => ({
              observedAt: observation.observedAt,
              rank: observation.rank,
            })),
        })),
    );

    return {
      project: projectSummary(project),
      keywords,
      signals: signalRows.flatMap((row) => {
        const payload = isRecord(row.payload) ? asSignalPayload(row.payload) : null;
        return payload ? [{ ...payload, id: row.id, createdAt: asIso(row.createdAt) }] : [];
      }),
      series,
      timeline,
      nextObservationAt: parseNextObservationAt(trackingSchedule),
    };
  }

  async function exportProjectCsv(ownerId: string, projectId: string) {
    await requireOwnedProject(ownerId, projectId);
    const rows = await buildWatchlist(projectId);
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
      version: 2,
      exportedAt: new Date().toISOString(),
      project: {
        name: project.name,
        appId: project.appId,
        appName: project.appName,
        storefront: project.storefront,
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

  async function finishJobRun(jobRunId: string, status: "completed" | "failed", detail?: string) {
    await database
      .update(jobRuns)
      .set({ status, detail, finishedAt: new Date() })
      .where(eq(jobRuns.id, jobRunId));
  }

  async function observeProject(projectId: string): Promise<ObservationRunResult> {
    const project = await getProjectById(projectId);
    const tracked = await database
      .select()
      .from(trackedKeywords)
      .where(and(eq(trackedKeywords.projectId, project.id), eq(trackedKeywords.enabled, true)))
      .orderBy(asc(trackedKeywords.createdAt));

    let generatedSignals = 0;
    for (const item of tracked) {
      const { signal } = await persistObservation(
        project.id,
        item.id,
        item.keyword,
        project.appId,
        project.storefront,
      );
      if (signal) generatedSignals += 1;
    }

    return {
      observedKeywords: tracked.length,
      generatedSignals,
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
    const observedAt = new Date().toISOString();
    for (const project of allProjects) {
      const result = await observeProject(project.id);
      observedKeywords += result.observedKeywords;
      generatedSignals += result.generatedSignals;
    }
    return { observedKeywords, generatedSignals, observedAt };
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
      .where(eq(jobRuns.jobName, "daily-rank-observation"))
      .orderBy(desc(jobRuns.startedAt))
      .limit(1);
    return {
      database: "healthy",
      worker:
        latestJob?.status === "completed"
          ? "healthy"
          : latestJob?.status === "failed"
            ? "degraded"
            : "configured",
      lastObservationAt: latestObservation ? asIso(latestObservation.observedAt) : null,
      latestJob,
    };
  }

  return {
    backupProject,
    createJobRun,
    createProjectForOwner,
    discoverKeyword,
    exportProjectCsv,
    finishJobRun,
    getLatestHealth,
    getPulseForProject,
    getWatchlistForProject,
    listProjectsForOwner,
    observeAllProjects,
    observeProject,
    restoreProject,
    deleteTrackedKeywordForProject,
    trackKeywordForProject,
  };
}
