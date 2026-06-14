export type CodeLineRange = {
  fromLine: number;
  toLine: number;
};

function codeLineCount(text: string) {
  return Math.max(1, text.split("\n").length);
}

function clampOffset(text: string, offset: number) {
  if (!Number.isFinite(offset)) {
    return 0;
  }

  return Math.max(0, Math.min(text.length, Math.trunc(offset)));
}

export function codeLineFromOffset(text: string, offset: number) {
  const clampedOffset = clampOffset(text, offset);
  let line = 1;

  for (let index = 0; index < clampedOffset; index += 1) {
    if (text[index] === "\n") {
      line += 1;
    }
  }

  return Math.max(1, Math.min(codeLineCount(text), line));
}

export function selectedCodeLineRangeFromOffsets(
  text: string,
  fromOffset: number,
  toOffset: number,
): CodeLineRange | undefined {
  const startOffset = clampOffset(text, Math.min(fromOffset, toOffset));
  const endOffset = clampOffset(text, Math.max(fromOffset, toOffset));

  if (endOffset <= startOffset) {
    return undefined;
  }

  const inclusiveEndOffset = Math.max(startOffset, endOffset - 1);
  const fromLine = codeLineFromOffset(text, startOffset);
  const toLine = codeLineFromOffset(text, inclusiveEndOffset);

  return {
    fromLine: Math.min(fromLine, toLine),
    toLine: Math.max(fromLine, toLine),
  };
}

export function codeLineRangeContains(range: CodeLineRange, line: number) {
  return line >= range.fromLine && line <= range.toLine;
}

export function codeLineRangeLabel(range: CodeLineRange) {
  return range.fromLine === range.toLine
    ? `${range.fromLine}번 줄`
    : `${range.fromLine}-${range.toLine}번 줄`;
}
