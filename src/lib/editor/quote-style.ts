export const quoteStyleOptions = [
  { label: "문학", value: "literary" },
  { label: "논문", value: "academic" },
  { label: "한 줄", value: "pull" },
  { label: "큰따옴표", value: "bigQuote" },
] as const;

export type QuoteStyle = (typeof quoteStyleOptions)[number]["value"];

export function normalizeQuoteStyle(value: unknown): QuoteStyle {
  return quoteStyleOptions.some((option) => option.value === value)
    ? (value as QuoteStyle)
    : "literary";
}
