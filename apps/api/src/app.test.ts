import type { AppStoreProvider } from "@asopulse/providers";
import { afterAll, describe, expect, test } from "vitest";
import { buildApp } from "./app";

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
const app = buildApp(provider);
afterAll(() => app.close());

describe("ASOpulse API", () => {
  test("reports health without telemetry", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok", telemetry: false });
  });
  test("normalizes app search", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/apps/search?term=clarity" });
    expect(response.json().data[0].appId).toBe("1");
  });
  test("exports the watchlist", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/projects/demo/export.csv" });
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.body).toContain("daily journal");
  });
  test("rejects malformed backup imports", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/projects/import",
      payload: { version: 99 },
    });
    expect(response.statusCode).toBe(400);
  });
});
