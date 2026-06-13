export const maxHighlightLineNumber = 10_000;

export function normalizeHighlightLines(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const ranges: string[] = [];
  const seen = new Set<string>();

  for (const match of value.matchAll(/\d+(?:\s*-\s*\d+)?/g)) {
    const [rawRange] = match;
    const [rawStart, rawEnd] = rawRange.split(/\s*-\s*/);
    const start = Number.parseInt(rawStart ?? "", 10);
    const end = rawEnd ? Number.parseInt(rawEnd, 10) : start;

    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < 1) {
      continue;
    }

    const from = Math.min(start, end);
    const to = Math.max(start, end);

    if (from > maxHighlightLineNumber) {
      continue;
    }

    const cappedTo = Math.min(to, maxHighlightLineNumber);
    const key = from === cappedTo ? String(from) : `${from}-${cappedTo}`;

    if (!seen.has(key)) {
      seen.add(key);
      ranges.push(key);
    }
  }

  return ranges.join(",");
}

export function highlightedLineIndexes(value: unknown, lineCount: number): Set<number> {
  const normalized = normalizeHighlightLines(value);
  const indexes = new Set<number>();

  if (!normalized || lineCount < 1) {
    return indexes;
  }

  for (const range of normalized.split(",")) {
    const [rawStart, rawEnd] = range.split("-");
    const start = Number.parseInt(rawStart ?? "", 10);
    const end = rawEnd ? Number.parseInt(rawEnd, 10) : start;

    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
      continue;
    }

    const from = Math.max(1, Math.min(start, end));
    const to = Math.min(lineCount, maxHighlightLineNumber, Math.max(start, end));

    for (let line = from; line <= to; line += 1) {
      indexes.add(line - 1);
    }
  }

  return indexes;
}
