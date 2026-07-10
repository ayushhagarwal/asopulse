import { describe, expect, test } from "vitest";
import { asHistoryRange, buildDailyHistory } from "./service.js";

describe("daily rank history", () => {
  test("uses one point per local calendar day and keeps the latest same-day observation", () => {
    const history = buildDailyHistory(
      [
        { observedAt: "2026-07-09T05:00:00.000Z", rank: 42 },
        { observedAt: "2026-07-09T18:00:00.000Z", rank: 31 },
        { observedAt: "2026-07-10T06:00:00.000Z", rank: 28 },
      ],
      "7d",
      "UTC",
      new Date("2026-07-10T12:00:00.000Z"),
    );

    expect(history).toHaveLength(7);
    expect(history.at(-2)).toMatchObject({ date: "2026-07-09", rank: 31, observed: true });
    expect(history.at(-1)).toMatchObject({ date: "2026-07-10", rank: 28, observed: true });
  });

  test("preserves missing days and respects timezone day boundaries", () => {
    const history = buildDailyHistory(
      [{ observedAt: "2026-07-09T20:00:00.000Z", rank: 75 }],
      "7d",
      "Asia/Kolkata",
      new Date("2026-07-10T12:00:00.000Z"),
    );

    expect(history.at(-1)).toMatchObject({ date: "2026-07-10", rank: 75, observed: true });
    expect(history.at(-2)).toMatchObject({ date: "2026-07-09", rank: null, observed: false });
  });

  test("returns complete range domains", () => {
    expect(buildDailyHistory([], "30d", "UTC")).toHaveLength(30);
    expect(buildDailyHistory([], "90d", "UTC")).toHaveLength(90);
    expect(asHistoryRange("unexpected")).toBe("7d");
  });
});
