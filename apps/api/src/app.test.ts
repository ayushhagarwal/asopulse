import type { ProjectBackup, WatchlistItem } from "@asopulse/core";
import type { KeywordScore } from "@asopulse/domain";
import type { AppStoreProvider } from "@asopulse/providers";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { buildApp } from "./app.js";
import type { AuthStore } from "./auth.js";

const provider: AppStoreProvider = {
  async searchApps() {
    return [
      {
        appId: "1",
        name: "Clarity",
        title: "Clarity",
        developer: "Studio",
        iconUrl: "",
        storeUrl: "",
        description: "",
        genres: ["Lifestyle"],
        averageRating: 4.8,
        ratingCount: 1200,
      },
    ];
  },
  async searchKeyword() {
    return [
      {
        appId: "1",
        name: "Clarity",
        title: "Daily Journal",
        developer: "Studio",
        iconUrl: "",
        storeUrl: "",
        description: "",
        genres: ["Lifestyle"],
        averageRating: 4.8,
        ratingCount: 1200,
      },
    ];
  },
};

const projectId = "project-1";
const ownerId = "owner-1";
const watchlistItem: WatchlistItem = {
  id: "kw-1",
  keyword: "daily journal",
  rank: 12,
  competition: 48,
  opportunity: 82,
  resultCount: 200,
  movement: 4,
  tags: ["core"],
  tracked: true,
  provenance: {
    observedAt: "2026-07-04T06:00:00.000Z",
    confidence: "high",
    methodVersion: "opportunity-1.0.0",
  },
};

const discoveryScore: KeywordScore = {
  keyword: "daily journal",
  rank: 12,
  competition: 48,
  opportunity: 82,
  resultCount: 200,
  provenance: {
    source: "asopulse-derived",
    observedAt: "2026-07-04T06:00:00.000Z",
    confidence: "high",
    methodVersion: "opportunity-1.0.0",
  },
};

const backup: ProjectBackup = {
  version: 2,
  exportedAt: "2026-07-04T06:00:00.000Z",
  project: {
    name: "Clarity",
    appId: "1",
    appName: "Clarity",
    storefront: "US",
  },
  trackedKeywords: [
    {
      keyword: "daily journal",
      enabled: true,
      tags: ["core"],
      observations: [
        {
          rank: 12,
          resultCount: 200,
          competition: 48,
          opportunity: 82,
          methodVersion: "opportunity-1.0.0",
          confidence: "high",
          observedAt: "2026-07-04T06:00:00.000Z",
        },
      ],
    },
  ],
  signals: [],
};

const users = new Map<
  string,
  { id: string; username: string; passwordHash: string; createdAt: string }
>();

const authStore: AuthStore = {
  async createUser(input) {
    const user = {
      id: ownerId,
      username: input.username,
      passwordHash: input.passwordHash,
      createdAt: "2026-07-04T06:00:00.000Z",
    };
    users.set(user.id, user);
    return user;
  },
  async findUserById(id) {
    return users.get(id) ?? null;
  },
  async findUserByUsername(username) {
    return [...users.values()].find((user) => user.username === username) ?? null;
  },
  async hasUsers() {
    return users.size > 0;
  },
};

const workspace = {
  async backupProject() {
    return backup;
  },
  async createJobRun() {
    return {
      id: "job-1",
      jobName: "daily-rank-observation",
      status: "running",
      detail: null,
      startedAt: new Date(),
      finishedAt: null,
    };
  },
  async createProjectForOwner() {
    return {
      id: projectId,
      name: "Clarity",
      appId: "1",
      appName: "Clarity",
      storefront: "US",
      createdAt: "2026-07-04T06:00:00.000Z",
    };
  },
  async discoverKeyword() {
    return {
      data: discoveryScore,
      results: await provider.searchKeyword("daily journal", "US"),
    };
  },
  async deleteTrackedKeywordForProject() {
    return { deleted: true, id: watchlistItem.id };
  },
  async exportProjectCsv() {
    return "keyword,rank\n daily journal,12";
  },
  async finishJobRun() {},
  async getLatestHealth() {
    return {
      database: "healthy",
      worker: "configured",
      lastObservationAt: "2026-07-04T06:00:00.000Z",
      latestJob: null,
    };
  },
  async getPulseForProject() {
    return {
      project: {
        id: projectId,
        name: "Clarity",
        appId: "1",
        appName: "Clarity",
        storefront: "US",
        createdAt: "2026-07-04T06:00:00.000Z",
      },
      keywords: [watchlistItem],
      signals: [],
      series: [],
      timeline: [],
      nextObservationAt: null,
    };
  },
  async getWatchlistForProject() {
    return {
      data: [watchlistItem],
      nextObservationAt: "2026-07-05T06:00:00.000Z",
    };
  },
  async listProjectsForOwner() {
    return [
      {
        id: projectId,
        name: "Clarity",
        appId: "1",
        appName: "Clarity",
        storefront: "US",
        createdAt: "2026-07-04T06:00:00.000Z",
      },
    ];
  },
  async observeAllProjects() {
    return { observedKeywords: 1, generatedSignals: 0, observedAt: "2026-07-04T06:00:00.000Z" };
  },
  async observeProject() {
    return { observedKeywords: 1, generatedSignals: 0, observedAt: "2026-07-04T06:00:00.000Z" };
  },
  async restoreProject() {
    return { importedKeywords: 1, importedObservations: 1, importedSignals: 0 };
  },
  async trackKeywordForProject() {
    return watchlistItem;
  },
} as unknown as NonNullable<Parameters<typeof buildApp>[0]>["workspace"];

const app = buildApp({
  provider,
  ...(workspace ? { workspace } : {}),
  ...(authStore ? { authStore } : {}),
});

let sessionCookie = "";

beforeAll(async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/setup",
    payload: { username: "owner", password: "long-password" },
  });
  const cookie = response.headers["set-cookie"];
  sessionCookie = Array.isArray(cookie) ? (cookie[0] ?? "") : (cookie ?? "");
});

afterAll(() => app.close());

describe("ASOpulse API", () => {
  test("reports health without telemetry", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok", telemetry: false });
  });

  test("reports the authenticated session", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/session",
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      configured: true,
      authenticated: true,
      user: { id: ownerId, username: "owner" },
    });
  });

  test("normalizes app search", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/apps/search?term=clarity" });
    expect(response.json().data[0].appId).toBe("1");
  });

  test("exports the watchlist for the current project", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${projectId}/export.csv`,
      headers: { cookie: sessionCookie },
    });
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.body).toContain("daily journal");
  });

  test("deletes a tracked keyword from the current project", async () => {
    const response = await app.inject({
      method: "DELETE",
      url: `/api/v1/projects/${projectId}/watchlist/${watchlistItem.id}`,
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ deleted: true, id: watchlistItem.id });
  });

  test("rejects unauthenticated project access", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${projectId}/watchlist`,
    });
    expect(response.statusCode).toBe(401);
  });

  test("restores a well-formed backup", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${projectId}/restore`,
      headers: { cookie: sessionCookie },
      payload: backup,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ importedKeywords: 1, importedObservations: 1 });
  });
});
