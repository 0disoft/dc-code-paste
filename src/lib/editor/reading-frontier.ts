import type {
  RelationAnchor,
  RelationEndpoint,
  SentenceRelationEntry,
  RelationState,
} from "./sentence-relations.ts";
import { sentenceRelationLabel } from "./sentence-relations-format.ts";

export type ReadingFrontierEndpoint = {
  shown: RelationAnchor[];
  later: number;
  missing: number;
  duplicated: number;
};

export type ReadingFrontierEntry = {
  id: string;
  label: string;
  state: RelationState;
  claim: ReadingFrontierEndpoint;
  related: ReadingFrontierEndpoint;
  nextPosition?: number;
};

/** Only expose text whose entire anchor has appeared before the reading boundary. */
export function readingRelationFrontier(
  entries: SentenceRelationEntry[],
  boundary: number,
): ReadingFrontierEntry[] {
  if (!Number.isFinite(boundary) || boundary < 0) return [];
  const result: ReadingFrontierEntry[] = [];
  function endpoint(source: RelationEndpoint) {
    const visible: ReadingFrontierEndpoint = { shown: [], later: 0, missing: 0, duplicated: 0 };
    const upcoming: number[] = [];
    for (const part of source.parts) {
      if (!part.matches.length) visible.missing += 1;
      else if (part.matches.length !== 1) visible.duplicated += 1;
      else if (part.matches[0].to <= boundary) visible.shown.push(part.matches[0]);
      else {
        visible.later += 1;
        upcoming.push(part.matches[0].to);
      }
    }
    visible.shown.sort((first, second) => first.from - second.from);
    return { visible, upcoming };
  }
  for (const entry of entries) {
    const claim = endpoint(entry.claim);
    if (!claim.visible.shown.length) continue;
    const related = endpoint(entry.related);
    result.push({
      id: entry.relation.id,
      label: sentenceRelationLabel(entry.relation),
      state: entry.state,
      claim: claim.visible,
      related: related.visible,
      ...(related.upcoming.length ? { nextPosition: Math.min(...related.upcoming) } : {}),
    });
  }
  return result.sort((first, second) => first.claim.shown[0].from - second.claim.shown[0].from);
}
