import type { Node } from "@tiptap/pm/model";
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
  function entryFor(source: SentenceSource) {
    let entry = sources.get(source.href);
    if (!entry) {
      entry = { href: source.href, label: source.label, mentions: [], referenceCount: 0 };
      sources.set(source.href, entry);
    } else if (!entry.label && source.label) entry.label = source.label;
    return entry;
  }
  document.descendants((node, pos, parent) => {
    if (node.type.spec.code) return false;
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
    )
      return;
    const source = normalizeSentenceSource(mark.attrs);
    if (!source) return;
    const entry = entryFor(source);
    const previous = entry.mentions.at(-1);
    if (
      previous &&
      previous.to === pos &&
      previous.label === source.label &&
      previous.excerpt === source.excerpt
    ) {
      previous.to = pos + node.nodeSize;
      previous.text = (previous.text + (node.text ?? "")).slice(0, maxMentionTextLength);
    } else {
      entry.mentions.push({
        from: pos,
        to: pos + node.nodeSize,
        text: (node.text ?? "").slice(0, maxMentionTextLength),
        label: source.label,
        excerpt: source.excerpt,
      });
    }
  });
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
