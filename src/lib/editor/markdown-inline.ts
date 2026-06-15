import type { JSONContent } from "@tiptap/core";
import { normalizeEditableLinkHref } from "$lib/editor/link";

type InlineMark = {
  type: string;
  attrs?: Record<string, unknown>;
};

const inlineTokenPattern = /`[^`]+`|\[[^\]]+]\([^)]+\)|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_/g;

export function textNode(text: string, marks?: InlineMark[]): JSONContent | undefined {
  if (!text) {
    return undefined;
  }

  return marks && marks.length > 0 ? { type: "text", text, marks } : { type: "text", text };
}

export function compactContent(content: Array<JSONContent | undefined>): JSONContent[] | undefined {
  const nextContent = content.filter((item): item is JSONContent => Boolean(item));
  return nextContent.length > 0 ? nextContent : undefined;
}

function splitInlineToken(value: string) {
  const codeMatch = /^`([^`]+)`$/.exec(value);
  if (codeMatch) {
    return { kind: "code" as const, text: codeMatch[1] ?? "" };
  }

  const linkMatch = /^\[([^\]]+)]\(([^)]+)\)$/.exec(value);
  if (linkMatch) {
    return { kind: "link" as const, text: linkMatch[1] ?? "", href: linkMatch[2] ?? "" };
  }

  const boldMatch = /^(?:\*\*|__)(.+)(?:\*\*|__)$/.exec(value);
  if (boldMatch) {
    return { kind: "bold" as const, text: boldMatch[1] ?? "" };
  }

  const italicMatch = /^(?:\*|_)(.+)(?:\*|_)$/.exec(value);
  if (italicMatch) {
    return { kind: "italic" as const, text: italicMatch[1] ?? "" };
  }

  return { kind: "text" as const, text: value };
}

export function containsMarkdownInlineToken(value: string): boolean {
  inlineTokenPattern.lastIndex = 0;
  return inlineTokenPattern.test(value);
}

export function parseMarkdownInline(value: string): JSONContent[] | undefined {
  inlineTokenPattern.lastIndex = 0;
  const content: Array<JSONContent | undefined> = [];
  let cursor = 0;

  for (const match of value.matchAll(inlineTokenPattern)) {
    const matchText = match[0];
    const index = match.index ?? 0;

    content.push(textNode(value.slice(cursor, index)));

    const token = splitInlineToken(matchText);
    if (token.kind === "code") {
      content.push(textNode(token.text, [{ type: "code" }]));
    } else if (token.kind === "link") {
      const href = normalizeEditableLinkHref(token.href);
      content.push(
        href
          ? textNode(token.text || href, [
              {
                type: "link",
                attrs: { href, target: "_blank", rel: "noopener noreferrer" },
              },
            ])
          : textNode(matchText),
      );
    } else if (token.kind === "bold") {
      content.push(textNode(token.text, [{ type: "bold" }]));
    } else if (token.kind === "italic") {
      content.push(textNode(token.text, [{ type: "italic" }]));
    } else {
      content.push(textNode(token.text));
    }

    cursor = index + matchText.length;
  }

  content.push(textNode(value.slice(cursor)));

  return compactContent(content);
}
