import { describe, expect, it } from "vitest";
import {
  codeLineFromOffset,
  codeLineRangeContains,
  codeLineRangeLabel,
  selectedCodeLineRangeFromOffsets,
} from "../../src/lib/editor/code-line-range";

describe("code line range", () => {
  const text = [
    "line 1",
    "line 2",
    "line 3",
    "line 4",
    "line 5",
    "line 6",
    "line 7",
    "line 8",
    "line 9",
    "line 10",
    "line 11",
    "line 12",
  ].join("\n");

  function lineStartOffset(line: number) {
    return text.split("\n").slice(0, line - 1).join("\n").length + (line > 1 ? 1 : 0);
  }

  it("maps code offsets to one-based line numbers", () => {
    expect(codeLineFromOffset(text, lineStartOffset(1))).toBe(1);
    expect(codeLineFromOffset(text, lineStartOffset(9))).toBe(9);
    expect(codeLineFromOffset(text, text.length + 100)).toBe(12);
  });

  it("creates an inclusive line range from a text selection", () => {
    const range = selectedCodeLineRangeFromOffsets(
      text,
      lineStartOffset(9),
      lineStartOffset(12),
    );

    expect(range).toEqual({ fromLine: 9, toLine: 11 });
    expect(range && codeLineRangeLabel(range)).toBe("9-11번 줄");
  });

  it("keeps a single-line selection as a single line label", () => {
    const range = selectedCodeLineRangeFromOffsets(
      text,
      lineStartOffset(10),
      lineStartOffset(10) + "line 10".length,
    );

    expect(range).toEqual({ fromLine: 10, toLine: 10 });
    expect(range && codeLineRangeLabel(range)).toBe("10번 줄");
  });

  it("detects whether the clicked line belongs to the selected range", () => {
    const range = { fromLine: 9, toLine: 11 };

    expect(codeLineRangeContains(range, 9)).toBe(true);
    expect(codeLineRangeContains(range, 10)).toBe(true);
    expect(codeLineRangeContains(range, 12)).toBe(false);
  });
});
