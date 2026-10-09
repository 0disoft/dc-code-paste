export const readingLayoutOptions = [
  { value: "balanced", label: "기본 간격", description: "흐름을 한눈에 보기 좋은 간격" },
  { value: "airy", label: "여유 있는 간격", description: "문장 사이에 생각할 여유를 주는 간격" },
] as const;

export type ReadingLayout = (typeof readingLayoutOptions)[number]["value"];

export function normalizeReadingLayout(value: unknown): ReadingLayout {
  return value === "airy" ? "airy" : "balanced";
}

export function readingLayoutMetrics(value: unknown) {
  return normalizeReadingLayout(value) === "airy"
    ? { lineHeight: 1.95, paragraphGap: 24, listLineHeight: 1.95, listItemGap: 12 }
    : { lineHeight: 1.72, paragraphGap: 14, listLineHeight: 1.7, listItemGap: 7 };
}
