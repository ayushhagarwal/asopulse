import { afterEach, expect, test, vi } from "vitest";
import { apiRequest } from "./api";

afterEach(() => {
  vi.restoreAllMocks();
});

test("does not send a JSON content type for requests without a body", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ deleted: true, id: "keyword-1" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );

  await apiRequest("/projects/project-1/watchlist/keyword-1", { method: "DELETE" });

  const requestInit = fetchMock.mock.calls[0]?.[1];
  expect(new Headers(requestInit?.headers).has("content-type")).toBe(false);
});

test("sends a JSON content type when a request has a body", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ data: {} }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );

  await apiRequest("/projects", { method: "POST", body: JSON.stringify({ name: "Pulse" }) });

  const requestInit = fetchMock.mock.calls[0]?.[1];
  expect(new Headers(requestInit?.headers).get("content-type")).toBe("application/json");
});
