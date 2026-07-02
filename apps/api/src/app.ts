import { scoreKeyword, toCsv } from "@asopulse/domain";
import { AppleSearchProvider, type AppStoreProvider } from "@asopulse/providers";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import { registerAuth } from "./auth";
import { demoProject, rankingSignals, trackKeyword, trackedKeywords } from "./store";

export function buildApp(provider: AppStoreProvider = new AppleSearchProvider()) {
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
  void registerAuth(app);

  app.get("/health", async () => ({ status: "ok", service: "asopulse-api", telemetry: false }));
  app.get<{ Querystring: { term?: string; country?: string } }>(
    "/api/v1/apps/search",
    async (request, reply) => {
      const term = request.query.term?.trim() ?? "";
      if (term.length < 2)
        return reply.code(400).send({ error: "term must contain at least 2 characters" });
      return { data: await provider.searchApps(term, request.query.country ?? "US", 25) };
    },
  );
  app.get<{ Querystring: { term?: string; country?: string; appId?: string } }>(
    "/api/v1/keywords/discover",
    async (request, reply) => {
      const term = request.query.term?.trim() ?? "";
      if (term.length < 2)
        return reply.code(400).send({ error: "term must contain at least 2 characters" });
      const results = await provider.searchKeyword(term, request.query.country ?? "US");
      return {
        data: scoreKeyword(term, results, request.query.appId),
        results: results.slice(0, 25),
      };
    },
  );
  app.get("/api/v1/projects/demo/pulse", async () => ({
    project: demoProject,
    keywords: trackedKeywords,
    signals: rankingSignals,
    nextObservationAt: "2026-07-03T06:00:00.000Z",
  }));
  app.get("/api/v1/projects/demo/watchlist", async () => ({ data: trackedKeywords }));
  app.post<{ Body: { keyword?: string; country?: string; appId?: string } }>(
    "/api/v1/projects/demo/watchlist",
    async (request, reply) => {
      const keyword = request.body?.keyword?.trim() ?? "";
      if (keyword.length < 2)
        return reply.code(400).send({ error: "keyword must contain at least 2 characters" });
      const results = await provider.searchKeyword(keyword, request.body.country ?? "US");
      return reply
        .code(201)
        .send({ data: trackKeyword(scoreKeyword(keyword, results, request.body.appId)) });
    },
  );
  app.get("/api/v1/projects/demo/export.csv", async (_request, reply) => {
    const csv = toCsv(
      trackedKeywords.map(({ keyword, rank, competition, opportunity, movement, tags }) => ({
        keyword,
        rank: rank ?? ">200",
        competition,
        opportunity,
        movement,
        tags: tags.join("|"),
      })),
    );
    return reply
      .type("text/csv; charset=utf-8")
      .header("content-disposition", "attachment; filename=asopulse-watchlist.csv")
      .send(csv);
  });
  app.get("/api/v1/projects/demo/backup", async () => ({
    version: 1,
    exportedAt: new Date().toISOString(),
    project: demoProject,
    trackedKeywords,
    signals: rankingSignals,
  }));
  return app;
}
