import type { JSONContent } from "@tiptap/core";
import { normalizeEditableLinkHref } from "./link";

const defaultReferenceItems = [
  {
    label: "A Tour of Go - Concurrency",
    href: "https://go.dev/tour/concurrency/1",
  },
  {
    label: "Effective Go - Concurrency",
    href: "https://go.dev/doc/effective_go#concurrency",
  },
  {
    label: "Go Concurrency Patterns",
    href: "https://go.dev/blog/pipelines",
  },
] as const;

export function createDefaultReferenceList(): JSONContent {
  return {
    type: "referenceList",
    content: defaultReferenceItems.map((item) => ({
      type: "referenceItem",
      attrs: { href: item.href },
      content: [{ type: "text", text: item.label }],
    })),
  };
}

function visibleFallbackLabel(href: string): string {
  try {
    const url = new URL(href);
    const path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
    return `${url.hostname}${path}` || href;
  } catch {
    return href.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  }
}

function cleanReferenceLine(line: string): string {
  return line
    .trim()
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .trim();
}

function referenceItemFromLine(line: string): JSONContent | undefined {
  const trimmed = cleanReferenceLine(line);

  if (!trimmed) {
    return undefined;
  }

  const markdownLink = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(trimmed);

  if (markdownLink) {
    const href = normalizeEditableLinkHref(markdownLink[2]);
    const label = markdownLink[1].trim();

    if (href && label) {
      return {
        type: "referenceItem",
        attrs: { href },
        content: [{ type: "text", text: label }],
      };
    }
  }

  const urlMatch = /https?:\/\/[^\s)]+/i.exec(trimmed);
  const href = normalizeEditableLinkHref(urlMatch?.[0] ?? trimmed);

  if (!href) {
    return undefined;
  }

  const label = urlMatch
    ? trimmed
        .replace(urlMatch[0], "")
        .replace(/[-:|]+$/, "")
        .trim()
    : visibleFallbackLabel(href);

  return {
    type: "referenceItem",
    attrs: { href },
    content: [{ type: "text", text: label || visibleFallbackLabel(href) }],
  };
}

export function createReferenceListFromText(text: string): JSONContent | undefined {
  const items = text
    .split(/\r?\n/)
    .map(referenceItemFromLine)
    .filter((item): item is JSONContent => item !== undefined);

  return items.length > 0
    ? {
        type: "referenceList",
        content: items,
      }
    : undefined;
}
