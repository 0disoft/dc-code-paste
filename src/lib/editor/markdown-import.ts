import type { JSONContent } from "@tiptap/core";
import {
  calloutNodeNameByKind,
  defaultCalloutLabel,
  isCalloutKind,
  type CalloutKind,
} from "$lib/editor/callout";
import { normalizeCalloutToneColor } from "$lib/editor/callout-palette";
import { createComparisonBlockFromText } from "$lib/editor/comparison-block";
import { normalizeCtaGroupLayout, type CtaGroupLayout } from "$lib/editor/cta-group";
import { createHeroBlockFromText } from "$lib/editor/hero-block";
import { normalizeEditableLinkHref } from "$lib/editor/link";
import { createReferenceListFromText } from "$lib/editor/reference-list";
import { createSummaryBoxFromText } from "$lib/editor/summary-box";
import { createTutorialBlockFromText } from "$lib/editor/tutorial-block";
import { compactContent, parseMarkdownInline, textNode } from "$lib/editor/markdown-inline";
import { defaultLanguage, isSupportedLanguage, type DcLanguageId } from "$lib/highlighter/catalog";
import { normalizeCodeFilename } from "$lib/highlighter/code-block-metadata";
import { highlightedLineIndexes, normalizeHighlightLines } from "$lib/highlighter/highlight-lines";

type ParsedListItem = {
  text: string;
};

type ParsedMarkdownTable = {
  node: JSONContent;
  nextIndex: number;
};

type MarkdownImportOptions = {
  defaultLanguage?: DcLanguageId;
  sanitizeCodeHighlightLines?: boolean;
};

type CustomBlockMetadata = {
  label?: string;
  color?: string;
};

type CustomBlockParts = {
  metadata: CustomBlockMetadata;
  body: string;
};

const fencePattern = /^```([^\s`]*)?(?:\s+(.+))?\s*$/i;
const headingPattern = /^(#{1,6})\s+(.+)$/;
const unorderedListPattern = /^[-*+]\s+(.+)$/;
const orderedListPattern = /^\d+[.)]\s+(.+)$/;
const horizontalRulePattern = /^(?:[-*_]\s*){3,}$/;
const standaloneMarkdownLinkPattern = /^\[([^\]]+)]\(([^)]+)\)$/;
const linkBoxLabelPattern = /^(?:linkbox|link box|링크박스|link|링크)$/i;
const customBlockStartPattern = /^:::\s*([a-zA-Z가-힣_-]+)(?:\s+(.+))?\s*$/;
const customBlockEndPattern = /^:::\s*$/;

export { parseMarkdownInline } from "$lib/editor/markdown-inline";

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
    assembly: "asm",
    nasm: "asm",
    yasm: "asm",
    js: "javascript",
    mjs: "javascript",
    ts: "typescript",
    mts: "typescript",
    md: "markdown",
    markdown: "markdown",
    mdx: "markdown",
    mmd: "mermaid",
    mermaid: "mermaid",
    jsonc: "json",
    yml: "yaml",
    mysql: "sql",
    postgres: "sql",
    postgresql: "sql",
    sqlite: "sql",
    sqlite3: "sql",
    mssql: "sql",
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

function parseFenceLineRange(value: string | undefined, names: string[]): string {
  if (!value) {
    return "";
  }

  const namePattern = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const assigned = new RegExp(`(?:^|\\s)(?:${namePattern})=([0-9,\\s-]+)`, "i").exec(value);

  return assigned ? normalizeHighlightLines(assigned[1]) : "";
}

function isDecorativeCodeHighlightLine(line: string): boolean {
  const trimmed = line.trim();

  return !trimmed || /^(?:[})\];,]+|end)$/i.test(trimmed);
}

function compactCodeLineNumbers(lineNumbers: readonly number[]): string {
  if (lineNumbers.length === 0) {
    return "";
  }

  const ranges: string[] = [];
  let start = lineNumbers[0] ?? 0;
  let previous = start;

  for (const line of lineNumbers.slice(1)) {
    if (line === previous + 1) {
      previous = line;
      continue;
    }

    ranges.push(start === previous ? String(start) : `${start}-${previous}`);
    start = line;
    previous = line;
  }

  ranges.push(start === previous ? String(start) : `${start}-${previous}`);
  return ranges.join(",");
}

export function sanitizeCodeHighlightLines(value: string, codeLines: readonly string[]): string {
  const lineNumbers = [...highlightedLineIndexes(value, codeLines.length)]
    .map((index) => index + 1)
    .filter((lineNumber) => !isDecorativeCodeHighlightLine(codeLines[lineNumber - 1] ?? ""))
    .sort((left, right) => left - right);

  return compactCodeLineNumbers(lineNumbers);
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
    .replace(/(?:^|\s)(?:add|adds|added|addition|additionLines|plus)=[0-9,\s-]+/gi, "")
    .replace(
      /(?:^|\s)(?:delete|deletes|deleted|deletion|deletionLines|remove|removed|minus)=[0-9,\s-]+/gi,
      "",
    )
    .trim();

  return /^[\w@./\\ -]+\.[\w-]+$/.test(bare) ? normalizeCodeFilename(bare) : "";
}

function paragraphNode(text: string): JSONContent {
  return { type: "paragraph", content: parseMarkdownInline(text.trim()) };
}

function splitMarkdownTableCells(line: string): string[] {
  const trimmed = line.trim();
  const withoutOuterPipes = trimmed.replace(/^\|/, "").replace(/\|$/, "");

  return withoutOuterPipes.split("|").map((cell) => cell.trim());
}

function isMarkdownTableLine(line: string): boolean {
  const trimmed = line.trim();

  return trimmed.includes("|") && splitMarkdownTableCells(trimmed).length >= 2;
}

function isMarkdownTableSeparatorLine(line: string): boolean {
  if (!isMarkdownTableLine(line)) {
    return false;
  }

  return splitMarkdownTableCells(line).every((cell) => /^:?-{3,}:?$/.test(cell));
}

function normalizeMarkdownTableRowCells(cells: string[], width: number): string[] {
  return Array.from({ length: width }, (_, index) => cells[index]?.trim() ?? "");
}

function dataTableCellNode(text: string, header: boolean): JSONContent {
  return {
    type: "dcDataTableCell",
    ...(header ? { attrs: { header: true } } : {}),
    content: parseMarkdownInline(text),
  };
}

function dataTableRowNode(cells: string[], header: boolean): JSONContent {
  return {
    type: "dcDataTableRow",
    content: cells.map((cell) => dataTableCellNode(cell, header)),
  };
}

function parseMarkdownTable(lines: string[], start: number): ParsedMarkdownTable | undefined {
  const headerLine = lines[start] ?? "";
  const separatorLine = lines[start + 1] ?? "";

  if (!isMarkdownTableLine(headerLine) || !isMarkdownTableSeparatorLine(separatorLine)) {
    return undefined;
  }

  const headerCells = splitMarkdownTableCells(headerLine);
  const columnCount = headerCells.length;
  const rows: JSONContent[] = [
    dataTableRowNode(normalizeMarkdownTableRowCells(headerCells, columnCount), true),
  ];
  let index = start + 2;

  while (index < lines.length && isMarkdownTableLine(lines[index] ?? "")) {
    const rowLine = lines[index] ?? "";

    if (isMarkdownTableSeparatorLine(rowLine)) {
      break;
    }

    rows.push(
      dataTableRowNode(
        normalizeMarkdownTableRowCells(splitMarkdownTableCells(rowLine), columnCount),
        false,
      ),
    );
    index += 1;
  }

  return rows.length > 1
    ? {
        node: {
          type: "dcDataTable",
          content: rows,
        },
        nextIndex: index,
      }
    : undefined;
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

function normalizeCustomBlockName(value: string): string {
  const normalized = value.trim().toLowerCase();
  const aliases: Record<string, string> = {
    히어로: "hero",
    요약: "summary",
    튜토리얼: "tutorial",
    비교: "comparison",
    참고목록: "references",
    자료목록: "references",
    링크목록: "references",
    버튼: "cta",
    버튼묶음: "cta",
    팁: "tip",
    주의: "warning",
    참고: "reference",
    강조: "emphasis",
    성공: "success",
    실패: "failure",
    실험: "experiment",
    결론: "conclusion",
    반박: "rebuttal",
  };

  return aliases[normalized] ?? normalized;
}

function customBlockStart(line: string): { name: string; info: string } | undefined {
  if (customBlockEndPattern.test(line.trim())) {
    return undefined;
  }

  const match = customBlockStartPattern.exec(line.trim());
  if (!match) {
    return undefined;
  }

  return {
    name: normalizeCustomBlockName(match[1] ?? ""),
    info: match[2]?.trim() ?? "",
  };
}

function contentOrEmptyParagraph(document: JSONContent): JSONContent[] {
  return document.content?.length ? document.content : [{ type: "paragraph" }];
}

function collectCustomBlock(
  lines: string[],
  start: number,
): { body: string; nextIndex: number } | undefined {
  if (!customBlockStart(lines[start] ?? "")) {
    return undefined;
  }

  const body: string[] = [];
  let index = start + 1;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (customBlockEndPattern.test(line.trim())) {
      return { body: body.join("\n"), nextIndex: index + 1 };
    }

    body.push(line);
    index += 1;
  }

  return undefined;
}

function calloutKindFromCustomBlockName(name: string): CalloutKind | undefined {
  return isCalloutKind(name) ? name : undefined;
}

function metadataKey(line: string): { key: keyof CustomBlockMetadata; value: string } | undefined {
  const match = /^(label|라벨|title|제목|color|색상|toneColor|tone-color)\s*[:：]\s*(.+)$/i.exec(
    line.trim(),
  );

  if (!match) {
    return undefined;
  }

  const rawKey = (match[1] ?? "").toLowerCase();
  const value = match[2]?.trim() ?? "";

  if (!value) {
    return undefined;
  }

  return {
    key:
      rawKey === "color" || rawKey === "색상" || rawKey === "tonecolor" || rawKey === "tone-color"
        ? "color"
        : "label",
    value,
  };
}

function extractCustomBlockParts(body: string, allowedKeys: Array<keyof CustomBlockMetadata>) {
  const allowed = new Set<keyof CustomBlockMetadata>(allowedKeys);
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const metadata: CustomBlockMetadata = {};
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const parsed = metadataKey(line);
    if (!parsed || !allowed.has(parsed.key)) {
      break;
    }

    metadata[parsed.key] = parsed.value;
    index += 1;
  }

  return {
    metadata,
    body: lines.slice(index).join("\n").trim(),
  } satisfies CustomBlockParts;
}

function createCalloutBlock(kind: CalloutKind, body: string, fallbackLanguage: DcLanguageId) {
  const { metadata, body: contentBody } = extractCustomBlockParts(body, ["label", "color"]);

  return {
    type: calloutNodeNameByKind[kind],
    attrs: {
      label: metadata.label?.trim() || defaultCalloutLabel(kind),
      toneColor: normalizeCalloutToneColor(metadata.color, kind),
    },
    content: contentOrEmptyParagraph(
      parseMarkdownToDocument(contentBody || " ", {
        defaultLanguage: fallbackLanguage,
      }),
    ),
  };
}

function ctaButtonFromLine(line: string): JSONContent | undefined {
  const trimmed = line
    .trim()
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .trim();

  if (!trimmed) {
    return undefined;
  }

  const markdownLink = /^\[([^\]]+)]\(([^)]+)\)$/.exec(trimmed);
  if (markdownLink) {
    const href = normalizeEditableLinkHref(markdownLink[2] ?? "");
    const label = markdownLink[1]?.trim();

    return href && label
      ? { type: "ctaButton", attrs: { href }, content: [{ type: "text", text: label }] }
      : undefined;
  }

  const labelled = /^(.+?)(?:\s*[:：]\s*|\s+-\s+)(https?:\/\/\S+)$/i.exec(trimmed);
  if (labelled) {
    const label = labelled[1]?.trim();
    const href = normalizeEditableLinkHref(labelled[2] ?? "");

    return href && label
      ? { type: "ctaButton", attrs: { href }, content: [{ type: "text", text: label }] }
      : undefined;
  }

  const href = normalizeEditableLinkHref(trimmed);
  if (!href) {
    return undefined;
  }

  return { type: "ctaButton", attrs: { href }, content: [{ type: "text", text: href }] };
}

function createCtaGroupFromText(text: string, layout: CtaGroupLayout): JSONContent | undefined {
  const buttons = text
    .split(/\r?\n/)
    .map(ctaButtonFromLine)
    .filter((button): button is JSONContent => Boolean(button));

  return buttons.length > 0
    ? {
        type: "ctaGroup",
        attrs: { layout },
        content: buttons,
      }
    : undefined;
}

function customBlockNode(
  name: string,
  info: string,
  body: string,
  fallbackLanguage: DcLanguageId,
): JSONContent | undefined {
  const calloutKind = calloutKindFromCustomBlockName(name);
  if (calloutKind) {
    return createCalloutBlock(calloutKind, body, fallbackLanguage);
  }

  if (name === "hero") {
    return createHeroBlockFromText(body);
  }

  if (name === "summary") {
    const { metadata, body: contentBody } = extractCustomBlockParts(body, ["label"]);
    const summary = createSummaryBoxFromText(contentBody || body);

    return summary && metadata.label?.trim()
      ? { ...summary, attrs: { ...summary.attrs, label: metadata.label.trim() } }
      : summary;
  }

  if (name === "tutorial") {
    return createTutorialBlockFromText(body);
  }

  if (name === "comparison") {
    return createComparisonBlockFromText(body);
  }

  if (name === "references" || name === "reference-list" || name === "referencelist") {
    return createReferenceListFromText(body);
  }

  if (name === "cta" || name === "cta-group" || name === "ctagroup") {
    return createCtaGroupFromText(body, normalizeCtaGroupLayout(info));
  }

  return undefined;
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
    Boolean(customBlockStart(trimmed)) ||
    isMarkdownTableLine(trimmed) ||
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
      const parsedHighlightLines = parseFenceHighlightLines(fence[2]);
      const additionLines = parseFenceLineRange(fence[2], [
        "add",
        "adds",
        "added",
        "addition",
        "additionLines",
        "plus",
      ]);
      const deletionLines = parseFenceLineRange(fence[2], [
        "delete",
        "deletes",
        "deleted",
        "deletion",
        "deletionLines",
        "remove",
        "removed",
        "minus",
      ]);
      const filename = parseFenceFilename(fence[2]);
      index += 1;

      while (index < lines.length && !fencePattern.test(lines[index]?.trim() ?? "")) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      const highlightLines = options.sanitizeCodeHighlightLines
        ? sanitizeCodeHighlightLines(parsedHighlightLines, codeLines)
        : parsedHighlightLines;
      const attrs: Record<string, string> = { language };
      if (highlightLines) {
        attrs.highlightLines = highlightLines;
      }
      if (additionLines) {
        attrs.additionLines = additionLines;
      }
      if (deletionLines) {
        attrs.deletionLines = deletionLines;
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

    const customBlock = customBlockStart(trimmed);
    if (customBlock) {
      const collected = collectCustomBlock(lines, index);

      if (collected) {
        const node = customBlockNode(
          customBlock.name,
          customBlock.info,
          collected.body,
          fallbackLanguage,
        );

        if (node) {
          content.push(node);
          index = collected.nextIndex;
          continue;
        }
      }
    }

    if (horizontalRulePattern.test(trimmed)) {
      content.push({ type: "horizontalRule" });
      index += 1;
      continue;
    }

    const table = parseMarkdownTable(lines, index);
    if (table) {
      content.push(table.node);
      index = table.nextIndex;
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
        quoteLines.push((lines[index] ?? "").trim().replace(/^>+\s?/, ""));
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
