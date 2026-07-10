import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { type WorkspaceProject, WorkspaceProvider } from "../../lib/workspace";
import { WatchlistPage } from "./WatchlistPage";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const project: WorkspaceProject = {
  id: "project-1",
  name: "Clarity",
  appId: "1",
  appName: "Clarity",
  storefront: "US",
  iconUrl: "",
  settings: {
    enabled: true,
    frequency: "daily",
    time: "06:00",
    timezone: "UTC",
    weekday: 1,
  },
  createdAt: "2026-07-04T06:00:00.000Z",
};

test("opens a focused keyword history drawer from the table", async () => {
  globalThis.fetch = vi.fn(async (input) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes("/observation-runs/latest")) return Response.json({ data: null });
    if (url.includes("/watchlist/kw-1/history")) {
      return Response.json({
        data: {
          keywordId: "kw-1",
          keyword: "daily journal",
          range: "30d",
          timeline: [
            { date: "2026-07-03", label: "Jul 3", rank: 18, observed: true },
            { date: "2026-07-04", label: "Jul 4", rank: 12, observed: true },
          ],
          currentRank: 12,
          movement: 6,
          lastObservedAt: "2026-07-04T06:00:00.000Z",
        },
      });
    }
    if (url.includes("/watchlist?range=")) {
      return Response.json({
        data: [
          {
            id: "kw-1",
            keyword: "daily journal",
            rank: 12,
            competition: 48,
            opportunity: 82,
            movement: 6,
            tags: ["core"],
            provenance: {
              observedAt: "2026-07-04T06:00:00.000Z",
              confidence: "high",
              methodVersion: "opportunity-1.0.0",
            },
            sparkline: [
              { date: "2026-07-03", rank: 18, observed: true },
              { date: "2026-07-04", rank: 12, observed: true },
            ],
            refreshState: "fresh",
          },
        ],
        nextObservationAt: "2026-07-05T06:00:00.000Z",
      });
    }
    return new Response(null, { status: 404 });
  }) as typeof fetch;

  render(
    <QueryClientProvider client={new QueryClient()}>
      <WorkspaceProvider projects={[project]} user={{ id: "owner-1", username: "owner" }}>
        <WatchlistPage />
      </WorkspaceProvider>
    </QueryClientProvider>,
  );

  expect(await screen.findByRole("heading", { name: "Tracked keywords" })).toBeInTheDocument();
  const keywordButton = await screen.findByRole("button", {
    name: "Open daily journal rank history",
  });
  fireEvent.click(keywordButton);
  expect(await screen.findByRole("heading", { name: "daily journal" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "daily journal 30D rank history" })).toBeInTheDocument();
});
