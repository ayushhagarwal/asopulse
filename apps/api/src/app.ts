import {
  createWorkspaceService,
  ManualRefreshCooldownError,
  OBSERVATION_QUEUE,
  type ObservationJob,
  type ProjectBackup,
  type ProjectSettings,
} from "@asopulse/core";
import { createDatabase } from "@asopulse/db";
import { AppleSearchProvider, type AppStoreProvider } from "@asopulse/providers";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { type ConnectionOptions, Queue } from "bullmq";
import Fastify from "fastify";
import {
  type AuthStore,
  buildDatabaseAuthStore,
  registerAuth,
  requireSessionUser,
} from "./auth.js";
import { createRateLimitGuard } from "./rate-limit.js";

type WorkspaceService = ReturnType<typeof createWorkspaceService>;
type ObservationQueue = Pick<
  Queue<ObservationJob, unknown, string>,
  "add" | "close" | "removeJobScheduler" | "upsertJobScheduler"
>;

function redisConnection(value: string): ConnectionOptions {
  const url = new URL(value);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
  };
}

function schedulePattern(settings: ProjectSettings) {
  const [hour = "6", minute = "0"] = settings.time.split(":");
  if (settings.frequency === "weekdays") return `${Number(minute)} ${Number(hour)} * * 1-5`;
  if (settings.frequency === "weekly") {
    const cronWeekday = settings.weekday === 7 ? 0 : settings.weekday;
    return `${Number(minute)} ${Number(hour)} * * ${cronWeekday}`;
  }
  return `${Number(minute)} ${Number(hour)} * * *`;
}

async function syncProjectScheduler(
  queue: ObservationQueue | null,
  projectId: string,
  settings: ProjectSettings,
) {
  if (!queue) return;
  const schedulerId = `project:${projectId}`;
  if (!settings.enabled) {
    await queue.removeJobScheduler(schedulerId);
    return;
  }
  await queue.upsertJobScheduler(
    schedulerId,
    { pattern: schedulePattern(settings), tz: settings.timezone },
    {
      name: "observe-project",
      data: { projectId, trigger: "scheduled" },
      opts: { attempts: 4, backoff: { type: "exponential", delay: 30_000 } },
    },
  );
}

function handleRouteError(
  error: unknown,
  reply: { code: (statusCode: number) => { send: (body: { error: string }) => unknown } },
) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message === "Project not found" || message === "Tracked keyword not found") {
    return reply.code(404).send({ error: message });
  }
  if (message.startsWith("Invalid ") || message.startsWith("Unable to create market")) {
    return reply.code(400).send({ error: message });
  }
  if (message === "Unsupported or malformed ASOpulse backup") {
    return reply.code(400).send({ error: message });
  }
  throw error;
}

export function buildApp({
  provider = new AppleSearchProvider(),
  workspace,
  authStore,
  observationQueue,
}: {
  provider?: AppStoreProvider;
  workspace?: WorkspaceService;
  authStore?: AuthStore;
  observationQueue?: ObservationQueue;
} = {}) {
  const sessionSecret = process.env.SESSION_SECRET ?? "development-only-secret-change-me";
  if (
    process.env.NODE_ENV === "production" &&
    (sessionSecret.length < 32 || /development-only|replace-this|change-me/i.test(sessionSecret))
  ) {
    throw new Error(
      "SESSION_SECRET must be a unique value of at least 32 characters in production",
    );
  }
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" });
  void app.register(cors, {
    origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  });
  void app.register(cookie, {
    secret: sessionSecret,
  });
  void app.register(helmet, { contentSecurityPolicy: false });
  void app.register(swagger, { openapi: { info: { title: "ASOpulse API", version: "0.1.0" } } });
  if (process.env.NODE_ENV !== "production" || process.env.API_DOCS_ENABLED === "true") {
    void app.register(swaggerUi, { routePrefix: "/docs" });
  }

  const databaseUrl = process.env.DATABASE_URL;
  const database =
    !workspace || !authStore ? (databaseUrl ? createDatabase(databaseUrl) : null) : null;
  const runtimeWorkspace =
    workspace ?? (database ? createWorkspaceService({ database: database.db, provider }) : null);
  const runtimeAuthStore = authStore ?? (database ? buildDatabaseAuthStore(database.db) : null);
  const runtimeObservationQueue =
    observationQueue ??
    (process.env.REDIS_URL
      ? new Queue<ObservationJob, unknown, string>(OBSERVATION_QUEUE, {
          connection: redisConnection(process.env.REDIS_URL),
        })
      : null);

  if (!runtimeWorkspace || !runtimeAuthStore) {
    throw new Error("DATABASE_URL is required unless explicit app services are provided");
  }

  app.addHook("onClose", async () => {
    if (runtimeObservationQueue && runtimeObservationQueue !== observationQueue) {
      await runtimeObservationQueue.close();
    }
    if (database) await database.close();
  });

  void registerAuth(app, { store: runtimeAuthStore });

  app.get("/health", async () => ({ status: "ok", service: "asopulse-api", telemetry: false }));

  app.get<{ Querystring: { term?: string; country?: string } }>(
    "/api/v1/apps/search",
    { preHandler: createRateLimitGuard({ max: 30, windowMs: 60_000 }) },
    async (request, reply) => {
      const term = request.query.term?.trim() ?? "";
      if (term.length < 2) {
        return reply.code(400).send({ error: "term must contain at least 2 characters" });
      }
      return { data: await provider.searchApps(term, request.query.country ?? "US", 25) };
    },
  );

  app.get<{ Querystring: { term?: string; country?: string; appId?: string } }>(
    "/api/v1/keywords/discover",
    { preHandler: createRateLimitGuard({ max: 30, windowMs: 60_000 }) },
    async (request, reply) => {
      const term = request.query.term?.trim() ?? "";
      if (term.length < 2) {
        return reply.code(400).send({ error: "term must contain at least 2 characters" });
      }
      return runtimeWorkspace.discoverKeyword({
        term,
        ...(request.query.country ? { country: request.query.country } : {}),
        ...(request.query.appId ? { appId: request.query.appId } : {}),
      });
    },
  );

  app.get("/api/v1/projects", async (request, reply) => {
    const user = await requireSessionUser(request, reply, runtimeAuthStore);
    if (!user) return;
    return { data: await runtimeWorkspace.listProjectsForOwner(user.id) };
  });

  app.post<{
    Body: {
      name?: string;
      appId?: string;
      appName?: string;
      storefront?: string;
      iconUrl?: string;
      timezone?: string;
    };
  }>("/api/v1/projects", async (request, reply) => {
    const user = await requireSessionUser(request, reply, runtimeAuthStore);
    if (!user) return;
    const {
      name = "",
      appId = "",
      appName = "",
      storefront,
      iconUrl,
      timezone,
    } = request.body ?? {};
    if (name.trim().length < 2 || appId.trim().length < 1 || appName.trim().length < 2) {
      return reply.code(400).send({ error: "name, appId, and appName are required" });
    }
    const project = await runtimeWorkspace.createProjectForOwner(user.id, {
      name,
      appId,
      appName,
      ...(storefront ? { storefront } : {}),
      ...(iconUrl ? { iconUrl } : {}),
      ...(timezone ? { timezone } : {}),
    });
    await syncProjectScheduler(runtimeObservationQueue, project.id, project.settings);
    return reply.code(201).send({ data: project });
  });

  app.delete<{ Params: { projectId: string } }>(
    "/api/v1/projects/:projectId",
    async (request, reply) => {
      const user = await requireSessionUser(request, reply, runtimeAuthStore);
      if (!user) return;
      try {
        await runtimeWorkspace.getProjectSettings(user.id, request.params.projectId);
        if (runtimeObservationQueue) {
          await runtimeObservationQueue.removeJobScheduler(`project:${request.params.projectId}`);
        }
        return await runtimeWorkspace.deleteProjectForOwner(user.id, request.params.projectId);
      } catch (error) {
        return handleRouteError(error, reply);
      }
    },
  );

  app.post<{ Params: { projectId: string }; Body: { storefront?: string } }>(
    "/api/v1/projects/:projectId/markets",
    async (request, reply) => {
      const user = await requireSessionUser(request, reply, runtimeAuthStore);
      if (!user) return;
      const storefront = request.body?.storefront?.trim() ?? "";
      if (!/^[a-z]{2}$/i.test(storefront)) {
        return reply.code(400).send({ error: "storefront must be a two-letter code" });
      }
      try {
        const result = await runtimeWorkspace.createMarketForProject(
          user.id,
          request.params.projectId,
          storefront,
        );
        await syncProjectScheduler(
          runtimeObservationQueue,
          result.project.id,
          result.project.settings,
        );
        return reply.code(result.created ? 201 : 200).send(result);
      } catch (error) {
        return handleRouteError(error, reply);
      }
    },
  );

  app.get<{ Params: { projectId: string } }>(
    "/api/v1/projects/:projectId/settings",
    async (request, reply) => {
      const user = await requireSessionUser(request, reply, runtimeAuthStore);
      if (!user) return;
      try {
        return {
          data: await runtimeWorkspace.getProjectSettings(user.id, request.params.projectId),
        };
      } catch (error) {
        return handleRouteError(error, reply);
      }
    },
  );

  app.patch<{ Params: { projectId: string }; Body: ProjectSettings }>(
    "/api/v1/projects/:projectId/settings",
    async (request, reply) => {
      const user = await requireSessionUser(request, reply, runtimeAuthStore);
      if (!user) return;
      try {
        const settings = await runtimeWorkspace.updateProjectSettings(
          user.id,
          request.params.projectId,
          request.body,
        );
        await syncProjectScheduler(runtimeObservationQueue, request.params.projectId, settings);
        return { data: settings };
      } catch (error) {
        return handleRouteError(error, reply);
      }
    },
  );

  app.get<{ Params: { projectId: string } }>(
    "/api/v1/projects/:projectId/pulse",
    async (request, reply) => {
      const user = await requireSessionUser(request, reply, runtimeAuthStore);
      if (!user) return;
      try {
        return await runtimeWorkspace.getPulseForProject(user.id, request.params.projectId);
      } catch (error) {
        return handleRouteError(error, reply);
      }
    },
  );

  app.get<{ Params: { projectId: string }; Querystring: { range?: string } }>(
    "/api/v1/projects/:projectId/watchlist",
    async (request, reply) => {
      const user = await requireSessionUser(request, reply, runtimeAuthStore);
      if (!user) return;
      try {
        return await runtimeWorkspace.getWatchlistForProject(
          user.id,
          request.params.projectId,
          request.query.range === "30d" || request.query.range === "90d"
            ? request.query.range
            : "7d",
        );
      } catch (error) {
        return handleRouteError(error, reply);
      }
    },
  );

  app.post<{ Params: { projectId: string }; Body: { keyword?: string } }>(
    "/api/v1/projects/:projectId/watchlist",
    async (request, reply) => {
      const user = await requireSessionUser(request, reply, runtimeAuthStore);
      if (!user) return;
      const keyword = request.body?.keyword?.trim() ?? "";
      if (keyword.length < 2) {
        return reply.code(400).send({ error: "keyword must contain at least 2 characters" });
      }
      try {
        const item = await runtimeWorkspace.trackKeywordForProject(
          user.id,
          request.params.projectId,
          {
            keyword,
          },
        );
        const run = await runtimeWorkspace.createObservationRun(
          user.id,
          request.params.projectId,
          "initial",
          [item.id],
        );
        await runtimeObservationQueue?.add(
          "observe-project",
          {
            projectId: request.params.projectId,
            trackedKeywordIds: [item.id],
            runId: run.id,
            trigger: "initial",
          },
          { attempts: 4, backoff: { type: "exponential", delay: 30_000 } },
        );
        return reply.code(201).send({ data: item, run });
      } catch (error) {
        return handleRouteError(error, reply);
      }
    },
  );

  app.post<{ Params: { projectId: string }; Body: { keywords?: string[] } }>(
    "/api/v1/projects/:projectId/watchlist/batch",
    async (request, reply) => {
      const user = await requireSessionUser(request, reply, runtimeAuthStore);
      if (!user) return;
      const keywords = request.body?.keywords ?? [];
      if (
        !Array.isArray(keywords) ||
        keywords.length === 0 ||
        keywords.length > 100 ||
        !keywords.every((keyword) => typeof keyword === "string" && keyword.trim().length >= 2)
      ) {
        return reply.code(400).send({ error: "keywords must contain between 1 and 100 terms" });
      }
      try {
        const data = await runtimeWorkspace.trackKeywordsForProject(
          user.id,
          request.params.projectId,
          keywords,
        );
        const run = await runtimeWorkspace.createObservationRun(
          user.id,
          request.params.projectId,
          "initial",
          data.map((item) => item.id),
        );
        await runtimeObservationQueue?.add("observe-project", {
          projectId: request.params.projectId,
          trackedKeywordIds: data.map((item) => item.id),
          runId: run.id,
          trigger: "initial",
        });
        return reply.code(202).send({ data, run });
      } catch (error) {
        return handleRouteError(error, reply);
      }
    },
  );

  app.get<{
    Params: { projectId: string; trackedKeywordId: string };
    Querystring: { range?: string };
  }>("/api/v1/projects/:projectId/watchlist/:trackedKeywordId/history", async (request, reply) => {
    const user = await requireSessionUser(request, reply, runtimeAuthStore);
    if (!user) return;
    try {
      return {
        data: await runtimeWorkspace.getKeywordHistoryForProject(
          user.id,
          request.params.projectId,
          request.params.trackedKeywordId,
          request.query.range === "30d" || request.query.range === "90d"
            ? request.query.range
            : "7d",
        ),
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.post<{
    Params: { projectId: string };
    Body: { trackedKeywordIds?: string[] };
  }>(
    "/api/v1/projects/:projectId/observation-runs",
    { preHandler: createRateLimitGuard({ max: 8, windowMs: 15 * 60_000 }) },
    async (request, reply) => {
      const user = await requireSessionUser(request, reply, runtimeAuthStore);
      if (!user) return;
      try {
        const ids = request.body?.trackedKeywordIds;
        if (
          ids !== undefined &&
          (!Array.isArray(ids) || ids.length > 100 || !ids.every((id) => typeof id === "string"))
        ) {
          return reply.code(400).send({ error: "trackedKeywordIds must be an array of ids" });
        }
        const run = await runtimeWorkspace.createObservationRun(
          user.id,
          request.params.projectId,
          "manual",
          ids,
        );
        await runtimeObservationQueue?.add("observe-project", {
          projectId: request.params.projectId,
          ...(ids && ids.length > 0 ? { trackedKeywordIds: ids } : {}),
          runId: run.id,
          trigger: "manual",
        });
        return reply.code(202).send({ data: run });
      } catch (error) {
        if (error instanceof ManualRefreshCooldownError) {
          return reply
            .code(429)
            .send({ error: error.message, retryAfterSeconds: error.retryAfterSeconds });
        }
        return handleRouteError(error, reply);
      }
    },
  );

  app.get<{ Params: { projectId: string } }>(
    "/api/v1/projects/:projectId/observation-runs/latest",
    async (request, reply) => {
      const user = await requireSessionUser(request, reply, runtimeAuthStore);
      if (!user) return;
      try {
        return {
          data: await runtimeWorkspace.getLatestObservationRunForProject(
            user.id,
            request.params.projectId,
          ),
        };
      } catch (error) {
        return handleRouteError(error, reply);
      }
    },
  );

  app.delete<{ Params: { projectId: string; trackedKeywordId: string } }>(
    "/api/v1/projects/:projectId/watchlist/:trackedKeywordId",
    async (request, reply) => {
      const user = await requireSessionUser(request, reply, runtimeAuthStore);
      if (!user) return;
      try {
        return await runtimeWorkspace.deleteTrackedKeywordForProject(
          user.id,
          request.params.projectId,
          request.params.trackedKeywordId,
        );
      } catch (error) {
        return handleRouteError(error, reply);
      }
    },
  );

  app.get<{ Params: { projectId: string } }>(
    "/api/v1/projects/:projectId/export.csv",
    async (request, reply) => {
      const user = await requireSessionUser(request, reply, runtimeAuthStore);
      if (!user) return;
      try {
        const csv = await runtimeWorkspace.exportProjectCsv(user.id, request.params.projectId);
        return reply
          .type("text/csv; charset=utf-8")
          .header("content-disposition", "attachment; filename=asopulse-watchlist.csv")
          .send(csv);
      } catch (error) {
        return handleRouteError(error, reply);
      }
    },
  );

  app.get<{ Params: { projectId: string } }>(
    "/api/v1/projects/:projectId/backup",
    async (request, reply) => {
      const user = await requireSessionUser(request, reply, runtimeAuthStore);
      if (!user) return;
      try {
        return await runtimeWorkspace.backupProject(user.id, request.params.projectId);
      } catch (error) {
        return handleRouteError(error, reply);
      }
    },
  );

  app.post<{ Params: { projectId: string }; Body: ProjectBackup }>(
    "/api/v1/projects/:projectId/restore",
    async (request, reply) => {
      const user = await requireSessionUser(request, reply, runtimeAuthStore);
      if (!user) return;
      try {
        return await runtimeWorkspace.restoreProject(
          user.id,
          request.params.projectId,
          request.body,
        );
      } catch (error) {
        return handleRouteError(error, reply);
      }
    },
  );

  app.get("/api/v1/diagnostics", async () => {
    const health = await runtimeWorkspace.getLatestHealth();
    return {
      api: "healthy",
      worker: health.worker,
      database: health.database,
      telemetry: false,
      lastObservationAt: health.lastObservationAt,
    };
  });

  return app;
}
