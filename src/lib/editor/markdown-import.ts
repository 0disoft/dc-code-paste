import type { JSONContent } from "@tiptap/core";
import { normalizeEditableLinkHref } from "$lib/editor/link";
import { defaultLanguage, isSupportedLanguage, type DcLanguageId } from "$lib/highlighter/catalog";
import { normalizeCodeFilename } from "$lib/highlighter/code-block-metadata";
import { normalizeHighlightLines } from "$lib/highlighter/highlight-lines";

type InlineMark = {
  type: string;
  attrs?: Record<string, unknown>;
};

type ParsedListItem = {
  text: string;
};

type MarkdownImportOptions = {
  defaultLanguage?: DcLanguageId;
};

const fencePattern = /^```([^\s`]*)?(?:\s+(.+))?\s*$/i;
const headingPattern = /^(#{1,6})\s+(.+)$/;
const unorderedListPattern = /^[-*+]\s+(.+)$/;
const orderedListPattern = /^\d+[.)]\s+(.+)$/;
const horizontalRulePattern = /^(?:[-*_]\s*){3,}$/;
const standaloneMarkdownLinkPattern = /^\[([^\]]+)]\(([^)]+)\)$/;
const linkBoxLabelPattern = /^(?:linkbox|link box|링크박스|link|링크)$/i;

function textNode(text: string, marks?: InlineMark[]): JSONContent | undefined {
  if (!text) {
    return undefined;
  }

  return marks && marks.length > 0 ? { type: "text", text, marks } : { type: "text", text };
}

function compactContent(content: Array<JSONContent | undefined>): JSONContent[] | undefined {
  const nextContent = content.filter((item): item is JSONContent => Boolean(item));
  return nextContent.length > 0 ? nextContent : undefined;
}

function normalizeLanguage(value: string | undefined, fallback: DcLanguageId): DcLanguageId {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return fallback;
  }

  const aliases: Record<string, DcLanguageId> = {
    "c++": "cpp",
    cc: "cpp",
    "c#": "csharp",
    cs: "csharp",
    js: "javascript",
    mjs: "javascript",
    ts: "typescript",
    mts: "typescript",
    udiff: "diff",
    patch: "patch",
    shell: "bash",
    sh: "bash",
    zsh: "bash",
    py: "python",
    rs: "rust",
    hs: "haskell",
  };
  const candidate = aliases[normalized] ?? normalized;

  return isSupportedLanguage(candidate) ? candidate : fallback;
}

function parseFenceHighlightLines(value: string | undefined): string {
  if (!value) {
    return "";
  }

  const braced = /\{([^}]+)}/.exec(value);
  if (braced) {
    return normalizeHighlightLines(braced[1]);
  }

  const assigned = /(?:^|\s)(?:highlight|highlights|hl|lines)=([0-9,\s-]+)/i.exec(value);
  return assigned ? normalizeHighlightLines(assigned[1]) : "";
}

function parseFenceFilename(value: string | undefined): string {
  if (!value) {
    return "";
  }

  const quoted = /(?:^|\s)(?:filename|file|title)="([^"]+)"/i.exec(value);
  if (quoted) {
    return normalizeCodeFilename(quoted[1]);
  }

  const assigned = /(?:^|\s)(?:filename|file|title)=([^\s{}]+)/i.exec(value);
  if (assigned) {
    return normalizeCodeFilename(assigned[1]);
  }

  const bare = value
    .replace(/\{[^}]+}/g, "")
    .replace(/(?:^|\s)(?:highlight|highlights|hl|lines)=[0-9,\s-]+/gi, "")
    .trim();

  return /^[\w@./\\ -]+\.[\w-]+$/.test(bare) ? normalizeCodeFilename(bare) : "";
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

export function parseMarkdownInline(value: string): JSONContent[] | undefined {
  const tokenPattern = /`[^`]+`|\[[^\]]+]\([^)]+\)|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_/g;
  const content: Array<JSONContent | undefined> = [];
  let cursor = 0;

  for (const match of value.matchAll(tokenPattern)) {
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

function paragraphNode(text: string): JSONContent {
  return { type: "paragraph", content: parseMarkdownInline(text.trim()) };
}

function linkBoxNode(label: string, href: string): JSONContent | undefined {
  const normalizedHref = normalizeEditableLinkHref(href);

  if (!normalizedHref) {
    return undefined;
  }

  const visibleText = linkBoxLabelPattern.test(label.trim()) ? normalizedHref : label.trim();

  return {
    type: "linkBox",
    attrs: { href: normalizedHref },
    content: [paragraphNode(visibleText || normalizedHref)],
  };
}

function standaloneLinkBoxNode(line: string): JSONContent | undefined {
  const markdownLink = standaloneMarkdownLinkPattern.exec(line.trim());

  if (markdownLink) {
    return linkBoxNode(markdownLink[1] ?? "", markdownLink[2] ?? "");
  }

  const normalizedHref = normalizeEditableLinkHref(line);
  return normalizedHref ? linkBoxNode(normalizedHref, normalizedHref) : undefined;
}

function listNode(type: "bulletList" | "orderedList", items: ParsedListItem[]): JSONContent {
  return {
    type,
    content: items.map((item) => ({
      type: "listItem",
      content: [paragraphNode(item.text)],
    })),
  };
}

function isBlockStarter(line: string): boolean {
  const trimmed = line.trim();

  return (
    !trimmed ||
    fencePattern.test(trimmed) ||
    headingPattern.test(trimmed) ||
    horizontalRulePattern.test(trimmed) ||
    unorderedListPattern.test(trimmed) ||
    orderedListPattern.test(trimmed) ||
    Boolean(standaloneLinkBoxNode(trimmed)) ||
    trimmed.startsWith(">")
  );
}

function collectParagraph(lines: string[], start: number): { text: string; nextIndex: number } {
  const paragraphLines: string[] = [];
  let index = start;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (index !== start && isBlockStarter(line)) {
      break;
    }

    if (!line.trim()) {
      break;
    }

    paragraphLines.push(line.trim());
    index += 1;
  }

  return { text: paragraphLines.join(" "), nextIndex: index };
}

export function parseMarkdownToDocument(
  markdown: string,
  options: MarkdownImportOptions = {},
): JSONContent {
  const fallbackLanguage = options.defaultLanguage ?? defaultLanguage;
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const content: JSONContent[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const fence = fencePattern.exec(trimmed);
    if (fence) {
      const codeLines: string[] = [];
      const language = normalizeLanguage(fence[1], fallbackLanguage);
      const highlightLines = parseFenceHighlightLines(fence[2]);
      const filename = parseFenceFilename(fence[2]);
      index += 1;

      while (index < lines.length && !fencePattern.test(lines[index]?.trim() ?? "")) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      const attrs: Record<string, string> = { language };
      if (highlightLines) {
        attrs.highlightLines = highlightLines;
      }
      if (filename) {
        attrs.filename = filename;
      }

      content.push({
        type: "codeBlock",
        attrs,
        content: compactContent([textNode(codeLines.join("\n"))]),
      });
      continue;
    }

    if (horizontalRulePattern.test(trimmed)) {
      content.push({ type: "horizontalRule" });
      index += 1;
      continue;
    }

    const heading = headingPattern.exec(trimmed);
    if (heading) {
      const level = heading[1]?.length ?? 1;
      const text = heading[2] ?? "";
      content.push(
        level === 2
          ? { type: "sectionHeading", content: parseMarkdownInline(text) }
          : {
              type: "heading",
              attrs: { level: Math.min(level, 6) },
              content: parseMarkdownInline(text),
            },
      );
      index += 1;
      continue;
    }

    const linkBox = standaloneLinkBoxNode(trimmed);
    if (linkBox) {
      content.push(linkBox);
      index += 1;
      continue;
    }

    const unordered = unorderedListPattern.exec(trimmed);
    if (unordered) {
      const items: ParsedListItem[] = [];

      while (index < lines.length) {
        const match = unorderedListPattern.exec(lines[index]?.trim() ?? "");
        if (!match) {
          break;
        }

        items.push({ text: match[1] ?? "" });
        index += 1;
      }

      content.push(listNode("bulletList", items));
      continue;
    }

    const ordered = orderedListPattern.exec(trimmed);
    if (ordered) {
      const items: ParsedListItem[] = [];

      while (index < lines.length) {
        const match = orderedListPattern.exec(lines[index]?.trim() ?? "");
        if (!match) {
          break;
        }

        items.push({ text: match[1] ?? "" });
        index += 1;
      }

      content.push(listNode("orderedList", items));
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];

      while (index < lines.length && lines[index]?.trim().startsWith(">")) {
        quoteLines.push((lines[index] ?? "").trim().replace(/^>\s?/, ""));
        index += 1;
      }

      content.push({ type: "blockquote", content: [paragraphNode(quoteLines.join(" "))] });
      continue;
    }

    const paragraph = collectParagraph(lines, index);
    content.push(paragraphNode(paragraph.text));
    index = paragraph.nextIndex;
  }

  return {
    type: "doc",
    content: content.length > 0 ? content : [{ type: "paragraph" }],
  };
}
