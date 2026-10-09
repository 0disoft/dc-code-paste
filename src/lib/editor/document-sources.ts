import type { Node } from "@tiptap/pm/model";
import {
  normalizeSourceReviewKey,
  sourceReviewState,
  type SourceReviewState,
} from "./source-review-format.ts";
import {
  maxSourceLabelLength,
  normalizeSentenceSource,
  type SentenceSource,
} from "./sentence-source-format.ts";

export type SourceMention = {
  from: number;
  to: number;
  text: string;
  label: string;
  excerpt: string;
  reviewKey: string;
  review: SourceReviewState;
};
export type DocumentSource = {
  href: string;
  label: string;
  mentions: SourceMention[];
  referenceCount: number;
};
const maxMentionTextLength = 220;

export function documentSourceCatalog(document: Node | undefined): DocumentSource[] {
  if (!document) return [];
  const sources = new Map<string, DocumentSource>();
  let pending:
    | { source: SentenceSource; from: number; to: number; text: string; reviewKey: string }
    | undefined;
  function flush() {
    if (!pending) return;
    const { source, from, to, text, reviewKey } = pending;
    entryFor(source).mentions.push({
      from,
      to,
      text: text.slice(0, maxMentionTextLength),
      label: source.label,
      excerpt: source.excerpt,
      reviewKey,
      review: sourceReviewState(text, reviewKey),
    });
    pending = undefined;
  }
  function entryFor(source: SentenceSource) {
    let entry = sources.get(source.href);
    if (!entry) {
      entry = { href: source.href, label: source.label, mentions: [], referenceCount: 0 };
      sources.set(source.href, entry);
    } else if (!entry.label && source.label) entry.label = source.label;
    return entry;
  }
  document.descendants((node, pos, parent) => {
    if (node.type.spec.code) {
      flush();
      return false;
    }
    if (node.type.name === "referenceItem") {
      const source = normalizeSentenceSource({
        href: node.attrs.href,
        label: node.textContent.replace(/\s+/g, " ").trim().slice(0, maxSourceLabelLength),
      });
      if (source) entryFor(source).referenceCount++;
    }
    const mark = node.marks.find((item) => item.type.name === "sentenceSource");
    if (
      !node.isText ||
      !mark ||
      !parent?.type.allowsMarkType(mark.type) ||
      node.marks.some((item) => item.type.name === "code")
    ) {
      flush();
      return;
    }
    const source = normalizeSentenceSource(mark.attrs);
    if (!source) {
      flush();
      return;
    }
    const reviewKey = normalizeSourceReviewKey(mark.attrs.reviewKey);
    if (
      pending &&
      pending.to === pos &&
      pending.source.href === source.href &&
      pending.source.label === source.label &&
      pending.source.excerpt === source.excerpt &&
      pending.reviewKey === reviewKey
    ) {
      pending.to = pos + node.nodeSize;
      pending.text += node.text ?? "";
    } else {
      flush();
      entryFor(source);
      pending = { source, from: pos, to: pos + node.nodeSize, text: node.text ?? "", reviewKey };
    }
  });
  flush();
  return [...sources.values()];
}

/** Reuse source metadata only; excerpts belong to the sentence being edited. */
export function reuseDocumentSource(
  current: SentenceSource,
  entry: DocumentSource,
): SentenceSource {
  return {
    href: entry.href,
    label: entry.label,
    excerpt: normalizeSentenceSource(current)?.href === entry.href ? current.excerpt : "",
  };
}

/** Selection and preference changes keep the immutable document, so reuse its catalog. */
export function createDocumentSourceReader() {
  let previous: Node | undefined;
  let catalog: DocumentSource[] = [];
  return (document: Node | undefined) => {
    if (document !== previous) {
      previous = document;
      catalog = documentSourceCatalog(document);
    }
    return catalog;
  };
}
