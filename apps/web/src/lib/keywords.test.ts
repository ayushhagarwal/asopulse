import { expect, test } from "vitest";
import { parseKeywordInput } from "./keywords";

test("splits keyword input on commas and line breaks", () => {
  expect(parseKeywordInput("calcium tracker, digestive health\nbowel habit")).toEqual([
    "calcium tracker",
    "digestive health",
    "bowel habit",
  ]);
});

test("deduplicates and trims keyword input", () => {
  expect(parseKeywordInput("  Sleep  , sleep\n\n")).toEqual(["sleep"]);
});
