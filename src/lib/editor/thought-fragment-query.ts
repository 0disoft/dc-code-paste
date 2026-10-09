import type { ThoughtFragmentEntry } from "./thought-fragments.ts";

export type ThoughtFragmentFilter = "all" | "unused" | "review";

export function thoughtFragmentNeedsReview(entry: ThoughtFragmentEntry): boolean {
  return entry.uses.some((use) => use.state !== "linked" || use.sourceChanged);
}

function searchable(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

export function queryThoughtFragments(
  entries: ThoughtFragmentEntry[],
  query: string,
  filter: ThoughtFragmentFilter,
) {
  const needle = searchable(query);
  return entries.filter((entry) => {
    if (filter === "unused" && entry.uses.length) return false;
    if (filter === "review" && !thoughtFragmentNeedsReview(entry)) return false;
    if (!needle) return true;
    const passages = [
      entry.fragment.text,
      ...entry.uses.flatMap((use) =>
        use.parts.flatMap((part) => [
          part.reference.text,
          ...part.matches.map((match) => match.text),
        ]),
      ),
    ];
    return passages.some((text) => searchable(text).includes(needle));
  });
}
