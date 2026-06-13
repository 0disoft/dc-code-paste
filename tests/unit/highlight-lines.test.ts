import { describe, expect, it } from "vitest";
import {
  highlightedLineIndexes,
  maxHighlightLineNumber,
  normalizeHighlightLines,
} from "../../src/lib/highlighter/highlight-lines";

describe("highlight lines", () => {
  it("normalizes comma and range based line specs", () => {
    expect(normalizeHighlightLines(" 2, 4-6 / 6-4 / x / 0 ")).toBe("2,4-6");
  });

  it("creates zero-based indexes clamped to the rendered line count", () => {
    expect([...highlightedLineIndexes("2,4-8", 5)]).toEqual([1, 3, 4]);
  });

  it("caps accidental huge line ranges before expanding them", () => {
    expect(normalizeHighlightLines("1-100000,100001")).toBe(`1-${maxHighlightLineNumber}`);
    expect(highlightedLineIndexes("1-100000", maxHighlightLineNumber + 5).size).toBe(
      maxHighlightLineNumber,
    );
  });
});
