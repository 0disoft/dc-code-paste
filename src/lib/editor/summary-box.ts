import type { JSONContent } from "@tiptap/core";
import { parseMarkdownInline } from "$lib/editor/markdown-inline";

export const defaultSummaryBoxLabel = "동시성 핵심";

const defaultSummaryItems = [
  "goroutine은 go 키워드로 실행되는 가벼운 작업 단위다.",
  "channel은 고루틴 사이에서 값을 안전하게 주고받는 통로다.",
  "context는 여러 고루틴의 취소와 시간 제한을 한 번에 전파한다.",
] as const;

export function createDefaultSummaryBox(): JSONContent {
  return {
    type: "summaryBox",
    attrs: { label: defaultSummaryBoxLabel },
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
      content: parseMarkdownInline(line),
    }));

  return items.length > 0
    ? {
        type: "summaryBox",
        attrs: { label: defaultSummaryBoxLabel },
        content: items,
      }
    : undefined;
}
