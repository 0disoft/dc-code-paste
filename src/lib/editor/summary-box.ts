import type { JSONContent } from "@tiptap/core";

const defaultSummaryItems = [
  "입출력 병목은 코드보다 데이터 흐름에서 먼저 찾는다.",
  "빠른 입출력 설정은 코드 맨 앞에서 한 번에 끝낸다.",
  "같은 글 안에서는 같은 입출력 계열로 밀고 간다.",
] as const;

export function createDefaultSummaryBox(): JSONContent {
  return {
    type: "summaryBox",
    content: defaultSummaryItems.map((text) => ({
      type: "summaryItem",
      content: [{ type: "text", text }],
    })),
  };
}

function cleanSummaryLine(line: string): string {
  return line
    .trim()
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .trim();
}

export function createSummaryBoxFromText(text: string): JSONContent | undefined {
  const items = text
    .split(/\r?\n/)
    .map(cleanSummaryLine)
    .filter((line) => line.length > 0)
    .map((line) => ({
      type: "summaryItem",
      content: [{ type: "text", text: line }],
    }));

  return items.length > 0
    ? {
        type: "summaryBox",
        content: items,
      }
    : undefined;
}
