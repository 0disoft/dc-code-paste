import { normalizeEditableLinkHref } from "./link.ts";

export const maxSourceLabelLength = 160;
export const maxSourceExcerptLength = 4000;
export type SentenceSource = { href: string; label: string; excerpt: string };

export function normalizeSentenceSource(value: unknown): SentenceSource | null {
  if (!value || typeof value !== "object") return null;
  const { href, label = "", excerpt = "" } = value as Record<string, unknown>;
  if (
    typeof href !== "string" ||
    href.length > 4096 ||
    typeof label !== "string" ||
    typeof excerpt !== "string"
  )
    return null;
  const normalizedHref = normalizeEditableLinkHref(href);
  if (!normalizedHref || !["http:", "https:"].includes(new URL(normalizedHref).protocol))
    return null;
  const normalizedLabel = label.replace(/\s+/g, " ").trim();
  const normalizedExcerpt = excerpt.trim();
  if (
    normalizedLabel.length > maxSourceLabelLength ||
    normalizedExcerpt.length > maxSourceExcerptLength
  )
    return null;
  return { href: normalizedHref, label: normalizedLabel, excerpt: normalizedExcerpt };
}

export function sentenceSourceLabel(source: SentenceSource): string {
  return source.label || new URL(source.href).hostname;
}

export function sentenceSourceAttributes(value: unknown) {
  const source = normalizeSentenceSource(value);
  if (!source) return null;
  const label = sentenceSourceLabel(source);
  return {
    "data-source-href": source.href,
    "data-source-label": source.label,
    "data-source-excerpt": source.excerpt,
    title: source.excerpt ? `${label}\n${source.excerpt}` : `출처: ${label}`,
  };
}
