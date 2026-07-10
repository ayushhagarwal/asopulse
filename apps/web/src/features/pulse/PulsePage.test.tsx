import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { router } from "../../router";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("renders the Pulse workspace", async () => {
  globalThis.fetch = vi.fn(async (input) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.endsWith("/api/v1/auth/session")) {
      return Response.json({
        configured: true,
        authenticated: true,
        user: { id: "owner-1", username: "owner" },
      });
    }
    if (url.endsWith("/api/v1/projects")) {
      return Response.json({
        data: [
          {
            id: "project-1",
            name: "Clarity",
            appId: "1",
            appName: "Clarity",
            storefront: "US",
            createdAt: "2026-07-04T06:00:00.000Z",
          },
        ],
      });
    }
    if (url.endsWith("/api/v1/projects/project-1/pulse")) {
      return Response.json({
        project: {
          id: "project-1",
          name: "Clarity",
          appId: "1",
          appName: "Clarity",
          storefront: "US",
          createdAt: "2026-07-04T06:00:00.000Z",
        },
        keywords: [
          {
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
            sparkline: [
              { date: "2026-07-01", rank: 18, observed: true },
              { date: "2026-07-02", rank: 16, observed: true },
              { date: "2026-07-03", rank: 14, observed: true },
              { date: "2026-07-04", rank: 12, observed: true },
            ],
            refreshState: "fresh",
          },
        ],
        signals: [],
        series: [{ keyword: "daily journal", color: "#0b4f2d", values: [18, 16, 14, 12] }],
        timeline: [
          { label: "Jul 1", observedAt: "2026-07-01T06:00:00.000Z" },
          { label: "Jul 2", observedAt: "2026-07-02T06:00:00.000Z" },
          { label: "Jul 3", observedAt: "2026-07-03T06:00:00.000Z" },
          { label: "Jul 4", observedAt: "2026-07-04T06:00:00.000Z" },
        ],
        nextObservationAt: "2026-07-05T06:00:00.000Z",
      });
    }
    return new Response(null, { status: 404 });
  }) as typeof fetch;

  await router.navigate({ to: "/pulse" });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  expect(await screen.findByRole("heading", { name: "Pulse" })).toBeInTheDocument();
  expect(await screen.findByRole("heading", { name: "Top movers" })).toBeInTheDocument();
});
