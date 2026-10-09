export const readingIntentOptions = [
  { value: "focus", label: "먼저 읽기", shortLabel: "먼저" },
  { value: "slow", label: "천천히 읽기", shortLabel: "천천히" },
  { value: "evidence", label: "근거", shortLabel: "근거" },
  { value: "quote", label: "다른 사람의 말", shortLabel: "인용" },
  { value: "question", label: "아직 답하지 못한 질문", shortLabel: "질문" },
] as const;
export type ReadingIntent = (typeof readingIntentOptions)[number]["value"];

const styles: Record<ReadingIntent, string> = {
  focus: "font-weight:700",
  slow: "border-bottom:1px dotted currentColor",
  evidence: "text-decoration:underline;text-underline-offset:3px",
  quote: "font-style:italic",
  question: "border-bottom:2px dashed currentColor",
};

export function normalizeReadingIntent(value: unknown): ReadingIntent | null {
  return readingIntentOptions.find((item) => item.value === value)?.value ?? null;
}

export function readingIntentAttributes(value: unknown) {
  const intent = normalizeReadingIntent(value);
  if (!intent) return null;
  return {
    "data-reading-intent": intent,
    title: readingIntentOptions.find((item) => item.value === intent)!.label,
    style: styles[intent],
  };
}
