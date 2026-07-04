import { createWorkspaceService, type ProjectBackup } from "@asopulse/core";
import { createDatabase } from "@asopulse/db";
import { AppleSearchProvider, type AppStoreProvider } from "@asopulse/providers";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import {
  type AuthStore,
  buildDatabaseAuthStore,
  registerAuth,
  requireSessionUser,
} from "./auth.js";

type WorkspaceService = ReturnType<typeof createWorkspaceService>;

function handleRouteError(
  error: unknown,
  reply: { code: (statusCode: number) => { send: (body: { error: string }) => unknown } },
) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message === "Project not found") return reply.code(404).send({ error: message });
  if (message === "Unsupported or malformed ASOpulse backup") {
    return reply.code(400).send({ error: message });
  }
  throw error;
}

export function buildApp({
  provider = new AppleSearchProvider(),
  workspace,
  authStore,
}: {
  provider?: AppStoreProvider;
  workspace?: WorkspaceService;
  authStore?: AuthStore;
} = {}) {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" });
  void app.register(cors, {
    origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  });
  void app.register(cookie, {
    secret: process.env.SESSION_SECRET ?? "development-only-secret-change-me",
  });
  void app.register(swagger, { openapi: { info: { title: "ASOpulse API", version: "0.1.0" } } });
  void app.register(swaggerUi, { routePrefix: "/docs" });

  const databaseUrl = process.env.DATABASE_URL;
  const database =
    !workspace || !authStore ? (databaseUrl ? createDatabase(databaseUrl) : null) : null;
  const runtimeWorkspace =
    workspace ?? (database ? createWorkspaceService({ database: database.db, provider }) : null);
  const runtimeAuthStore = authStore ?? (database ? buildDatabaseAuthStore(database.db) : null);

  if (!runtimeWorkspace || !runtimeAuthStore) {
    throw new Error("DATABASE_URL is required unless explicit app services are provided");
  }

  app.addHook("onClose", async () => {
    if (database) await database.close();
  });

  void registerAuth(app, { store: runtimeAuthStore });

  app.get("/health", async () => ({ status: "ok", service: "asopulse-api", telemetry: false }));

  app.get<{ Querystring: { term?: string; country?: string } }>(
    "/api/v1/apps/search",
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
    Body: { name?: string; appId?: string; appName?: string; storefront?: string };
  }>("/api/v1/projects", async (request, reply) => {
    const user = await requireSessionUser(request, reply, runtimeAuthStore);
    if (!user) return;
    const { name = "", appId = "", appName = "", storefront } = request.body ?? {};
    if (name.trim().length < 2 || appId.trim().length < 1 || appName.trim().length < 2) {
      return reply.code(400).send({ error: "name, appId, and appName are required" });
    }
    const project = await runtimeWorkspace.createProjectForOwner(user.id, {
      name,
      appId,
      appName,
      ...(storefront ? { storefront } : {}),
    });
    return reply.code(201).send({ data: project });
  });

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

  app.get<{ Params: { projectId: string } }>(
    "/api/v1/projects/:projectId/watchlist",
    async (request, reply) => {
      const user = await requireSessionUser(request, reply, runtimeAuthStore);
      if (!user) return;
      try {
        return await runtimeWorkspace.getWatchlistForProject(user.id, request.params.projectId);
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
        return reply.code(201).send({ data: item });
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
