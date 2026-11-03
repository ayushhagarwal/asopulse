import type { ProjectBackup, WatchlistItem } from "@asopulse/core";
import type { KeywordScore } from "@asopulse/domain";
import type { AppStoreProvider } from "@asopulse/providers";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { assertExposedServerSessionSecret, buildApp } from "./app.js";
import type { AuthStore } from "./auth.js";

const previousSessionSecret = process.env.SESSION_SECRET;
const previousSetupToken = process.env.SETUP_TOKEN;
process.env.SESSION_SECRET ??= "test-session-secret-0123456789abcdef";
const setupToken = "test-setup-token";
process.env.SETUP_TOKEN = setupToken;

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
  sparkline: [{ date: "2026-07-04", rank: 12, observed: true }],
  refreshState: "fresh",
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
const sessions = new Map<string, { userId: string; expiresAt: number }>();

const authStore: AuthStore = {
  async createFirstUser(input) {
    if (users.size > 0) return null;
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
  async createSession(userId) {
    const sessionId = `session-${sessions.size + 1}-${userId}`;
    sessions.set(sessionId, { userId, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
    return sessionId;
  },
  async findSessionUser(sessionId) {
    const session = sessions.get(sessionId);
    if (!session || session.expiresAt <= Date.now()) return null;
    return users.get(session.userId) ?? null;
  },
  async deleteSession(sessionId) {
    sessions.delete(sessionId);
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
  async createMarketForProject() {
    return {
      created: true,
      project: {
        id: "project-in",
        name: "Clarity",
        appId: "1",
        appName: "Clarity",
        storefront: "IN",
        iconUrl: "",
        settings: {
          enabled: true,
          frequency: "daily",
          time: "06:00",
          timezone: "UTC",
          weekday: 1,
        },
        createdAt: "2026-07-04T06:00:00.000Z",
      },
    };
  },
  async createObservationRun() {
    return {
      id: "run-1",
      projectId,
      trigger: "manual",
      status: "queued",
      requestedCount: 1,
      observedCount: 0,
      failedCount: 0,
      failures: [],
      startedAt: "2026-07-04T06:00:00.000Z",
      finishedAt: null,
      nextEligibleManualAt: "2026-07-04T06:15:00.000Z",
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
  async deleteProjectForOwner() {
    return { deleted: true, id: projectId };
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
  async getLatestObservationRunForProject() {
    return null;
  },
  async getKeywordHistoryForProject() {
    return {
      keywordId: "kw-1",
      keyword: "daily journal",
      range: "30d",
      timeline: [{ date: "2026-07-04", label: "Jul 4", rank: 12, observed: true }],
      currentRank: 12,
      movement: 4,
      lastObservedAt: "2026-07-04T06:00:00.000Z",
    };
  },
  async getProjectSettings() {
    return {
      enabled: true,
      frequency: "daily",
      time: "06:00",
      timezone: "UTC",
      weekday: 1,
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
  async trackKeywordsForProject() {
    return [watchlistItem];
  },
  async updateProjectSettings() {
    return {
      enabled: true,
      frequency: "weekdays",
      time: "08:30",
      timezone: "Asia/Kolkata",
      weekday: 1,
    };
  },
} as unknown as NonNullable<Parameters<typeof buildApp>[0]>["workspace"];

const app = buildApp({
  provider,
  ...(workspace ? { workspace } : {}),
  ...(authStore ? { authStore } : {}),
});

let sessionCookie = "";

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

beforeAll(async () => {
  delete process.env.SETUP_TOKEN;
  const unconfigured = await app.inject({
    method: "POST",
    url: "/api/v1/auth/setup",
    payload: { username: "owner", password: "long-password", setupToken },
  });
  expect(unconfigured.statusCode).toBe(503);
  process.env.SETUP_TOKEN = setupToken;

  const missing = await app.inject({
    method: "POST",
    url: "/api/v1/auth/setup",
    payload: { username: "owner", password: "long-password" },
  });
  expect(missing.statusCode).toBe(401);

  const wrong = await app.inject({
    method: "POST",
    url: "/api/v1/auth/setup",
    payload: { username: "owner", password: "long-password", setupToken: "wrong-setup-token" },
  });
  expect(wrong.statusCode).toBe(401);
  expect(await authStore.hasUsers()).toBe(false);

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/setup",
    payload: { username: "owner", password: "long-password", setupToken },
  });
  expect(response.statusCode).toBe(201);
  sessionCookie = headerValue(response.headers["set-cookie"]);
});

afterAll(async () => {
  await app.close();
  if (previousSetupToken === undefined) delete process.env.SETUP_TOKEN;
  else process.env.SETUP_TOKEN = previousSetupToken;
  if (previousSessionSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = previousSessionSecret;
});

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

  test("rejects app search without a session", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/apps/search?term=clarity" });
    expect(response.statusCode).toBe(401);
  });

  test("normalizes app search for an authenticated session", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/apps/search?term=clarity",
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data[0].appId).toBe("1");
  });

  test("rejects oversized authenticated searches", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/apps/search?term=${"a".repeat(101)}`,
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(400);
  });

  test("rejects keyword discovery without a session", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/keywords/discover?term=journal",
    });
    expect(response.statusCode).toBe(401);
  });

  test("discovers keywords for an authenticated session", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/keywords/discover?term=journal",
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.keyword).toBe("daily journal");
  });

  test("rejects diagnostics without a session", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/diagnostics" });
    expect(response.statusCode).toBe(401);
  });

  test("returns diagnostics for an authenticated session", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/diagnostics",
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ api: "healthy", database: "healthy" });
  });

  test("keeps setup disabled after the owner exists", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/setup",
      payload: { username: "other", password: "long-password", setupToken },
    });
    expect(response.statusCode).toBe(409);
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

  test("deletes an owned app workspace", async () => {
    const response = await app.inject({
      method: "DELETE",
      url: `/api/v1/projects/${projectId}`,
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ deleted: true, id: projectId });
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

  test("returns range-aware keyword history", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${projectId}/watchlist/${watchlistItem.id}/history?range=30d`,
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ keyword: "daily journal", range: "30d" });
  });

  test("persists project observation settings", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/projects/${projectId}/settings`,
      headers: { cookie: sessionCookie },
      payload: {
        enabled: true,
        frequency: "weekdays",
        time: "08:30",
        timezone: "Asia/Kolkata",
        weekday: 1,
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({ frequency: "weekdays", time: "08:30" });
  });

  test("queues a manual observation run", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${projectId}/observation-runs`,
      headers: { cookie: sessionCookie },
      payload: { trackedKeywordIds: [watchlistItem.id] },
    });
    expect(response.statusCode).toBe(202);
    expect(response.json().data).toMatchObject({ id: "run-1", status: "queued" });
  });

  test("creates an isolated sibling market", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${projectId}/markets`,
      headers: { cookie: sessionCookie },
      payload: { storefront: "IN" },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ created: true, project: { storefront: "IN" } });
  });

  test("logout clears the cookie with the same flags and revokes the session", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const login = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { username: "owner", password: "long-password" },
      });
      expect(login.statusCode).toBe(200);
      const setCookie = headerValue(login.headers["set-cookie"]);
      expect(setCookie).toMatch(/HttpOnly/i);
      expect(setCookie).toMatch(/SameSite=Strict/i);
      expect(setCookie).toMatch(/Path=\//i);
      expect(setCookie).toMatch(/Secure/i);
      const logout = await app.inject({
        method: "POST",
        url: "/api/v1/auth/logout",
        headers: { cookie: setCookie },
      });
      expect(logout.statusCode).toBe(200);
      const cleared = headerValue(logout.headers["set-cookie"]);
      expect(cleared).toMatch(/HttpOnly/i);
      expect(cleared).toMatch(/SameSite=Strict/i);
      expect(cleared).toMatch(/Path=\//i);
      expect(cleared).toMatch(/Secure/i);
      const again = await app.inject({
        method: "GET",
        url: "/api/v1/projects",
        headers: { cookie: setCookie },
      });
      expect(again.statusCode).toBe(401);
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
  });

  test("rate limits forwarded clients separately from one another", async () => {
    const isolated = buildApp({
      provider,
      ...(workspace ? { workspace } : {}),
      ...(authStore ? { authStore } : {}),
    });
    try {
      let limited = await isolated.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        headers: { "x-forwarded-for": "203.0.113.10" },
        payload: { username: "missing", password: "incorrect-password" },
      });
      for (let attempt = 1; attempt < 11; attempt += 1) {
        limited = await isolated.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          headers: { "x-forwarded-for": "203.0.113.10" },
          payload: { username: "missing", password: "incorrect-password" },
        });
      }
      const other = await isolated.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        headers: { "x-forwarded-for": "203.0.113.11" },
        payload: { username: "missing", password: "incorrect-password" },
      });
      expect(limited.statusCode).toBe(429);
      expect(other.statusCode).toBe(401);
    } finally {
      await isolated.close();
    }
  });

  test("ignores a spoofed forwarded address from an untrusted peer", async () => {
    const isolated = buildApp({
      provider,
      ...(workspace ? { workspace } : {}),
      ...(authStore ? { authStore } : {}),
    });
    try {
      let limited = await isolated.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        remoteAddress: "198.51.100.20",
        headers: { "x-forwarded-for": "203.0.113.10" },
        payload: { username: "missing", password: "incorrect-password" },
      });
      for (let attempt = 1; attempt < 11; attempt += 1) {
        limited = await isolated.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          remoteAddress: "198.51.100.20",
          headers: { "x-forwarded-for": "203.0.113.10" },
          payload: { username: "missing", password: "incorrect-password" },
        });
      }
      const spoofed = await isolated.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        remoteAddress: "198.51.100.20",
        headers: { "x-forwarded-for": "203.0.113.99" },
        payload: { username: "missing", password: "incorrect-password" },
      });
      expect(limited.statusCode).toBe(429);
      expect(spoofed.statusCode).toBe(429);
    } finally {
      await isolated.close();
    }
  });

  test("rate limits repeated login failures", async () => {
    let response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { username: "missing", password: "incorrect-password" },
    });
    for (let attempt = 1; attempt < 11; attempt += 1) {
      response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { username: "missing", password: "incorrect-password" },
      });
    }
    expect(response.statusCode).toBe(429);
  });

  test("rejects placeholder session secrets in production", () => {
    if (!workspace || !authStore) throw new Error("Test services are required");
    const previousNodeEnv = process.env.NODE_ENV;
    const previousSecret = process.env.SESSION_SECRET;
    process.env.NODE_ENV = "production";
    process.env.SESSION_SECRET = "replace-this-before-exposing-the-service";
    expect(() => buildApp({ provider, workspace, authStore })).toThrow(/SESSION_SECRET/);
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previousSecret;
  });

  test("rejects a missing or built-in session secret outside production", () => {
    if (!workspace || !authStore) throw new Error("Test services are required");
    const previousNodeEnv = process.env.NODE_ENV;
    const previousSecret = process.env.SESSION_SECRET;
    process.env.NODE_ENV = "development";
    delete process.env.SESSION_SECRET;
    expect(() => buildApp({ provider, workspace, authStore })).toThrow(/SESSION_SECRET/);
    expect(() => assertExposedServerSessionSecret()).toThrow(/SESSION_SECRET/);
    process.env.SESSION_SECRET = "development-only-secret-change-me";
    expect(() => buildApp({ provider, workspace, authStore })).toThrow(/SESSION_SECRET/);
    expect(() => assertExposedServerSessionSecret()).toThrow(/SESSION_SECRET/);
    process.env.SESSION_SECRET = "unique-local-session-secret-0123456789abcdef";
    expect(() => assertExposedServerSessionSecret()).not.toThrow();
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previousSecret;
  });
});
