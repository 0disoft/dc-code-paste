import type { JSONContent } from "@tiptap/core";
import { normalizeEditableLinkHref } from "#lib/editor/link.ts";
import { relationFreeDocument } from "#lib/editor/relation-free-document.ts";
import {
  normalizeSentenceSource,
  sentenceSourceLabel,
  type SentenceSource,
} from "#lib/editor/sentence-source-format.ts";

const inlineBlocks = new Set([
  "paragraph",
  "heading",
  "sectionHeading",
  "summaryItem",
  "referenceItem",
  "ctaButton",
  "dcDataTableCell",
  "dcDataTableCaption",
]);
const publicLinkBlocks = new Set(["referenceItem", "ctaButton", "linkBox"]);

function safeHref(value: unknown) {
  return typeof value === "string" ? normalizeEditableLinkHref(value) : undefined;
}

function withHref(text: string, href: string | undefined) {
  if (!href) return text;
  if (!text) return href;
  const label = text.trim();
  if (label === href || (/^(?:https?:|mailto:)/i.test(label) && safeHref(label) === href))
    return text;
  return `${text} (${href})`;
}

function rawText(node: JSONContent): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  return (node.content ?? []).map(rawText).join("");
}

/** Group adjacent link marks even when visual formatting splits the text nodes. */
function linkedText(children: JSONContent[]) {
  let output = "";
  let text = "";
  let href: string | undefined;
  function flush() {
    output += withHref(text, href);
    text = "";
  }
  for (const child of children) {
    const nextHref =
      child.type === "text"
        ? safeHref(child.marks?.find((mark) => mark.type === "link")?.attrs?.href)
        : undefined;
    if (nextHref !== href) flush();
    href = nextHref;
    text += rawText(child);
  }
  flush();
  return output;
}

/** Match the HTML source boundary; inline code never acquires a source annotation. */
function inlineText(children: JSONContent[]) {
  let output = "";
  let group: JSONContent[] = [];
  let source: SentenceSource | null = null;
  let sourceKey = "null";
  function flush() {
    output += linkedText(group);
    if (source) output += ` [출처: ${withHref(sentenceSourceLabel(source), source.href)}]`;
    group = [];
  }
  for (const child of children) {
    const nextSource =
      child.type === "text" && !child.marks?.some((mark) => mark.type === "code")
        ? normalizeSentenceSource(
            child.marks?.find((mark) => mark.type === "sentenceSource")?.attrs,
          )
        : null;
    const nextKey = JSON.stringify(nextSource);
    if (nextKey !== sourceKey) flush();
    source = nextSource;
    sourceKey = nextKey;
    group.push(child);
  }
  flush();
  return output;
}

function blockText(node: JSONContent): string {
  if (node.type === "codeBlock") return rawText(node);
  if (node.type === "text" || node.type === "hardBreak") return rawText(node);
  const children = node.content ?? [];
  const text = inlineBlocks.has(node.type ?? "")
    ? inlineText(children)
    : children.map(blockText).join("\n\n");
  return publicLinkBlocks.has(node.type ?? "") ? withHref(text, safeHref(node.attrs?.href)) : text;
}

/** Public body only: never traverse draft buffers, private metadata, or arbitrary attributes. */
export function exportDocumentToPlainText(document: JSONContent): string {
  return blockText(relationFreeDocument(document));
}
