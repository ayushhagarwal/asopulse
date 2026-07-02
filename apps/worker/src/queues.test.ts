import { expect, test } from "vitest";
import { OBSERVATION_QUEUE } from "./queues";

test("uses a stable observation queue name", () => {
  expect(OBSERVATION_QUEUE).toBe("asopulse-observations");
});
