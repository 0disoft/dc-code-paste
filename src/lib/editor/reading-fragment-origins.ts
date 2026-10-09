import type { ReadingExperimentUnit } from "./reading-experiment.ts";
import type { ThoughtFragmentEntry } from "./thought-fragments.ts";

export type ReadingFragmentOrigin = {
  id: string;
  fragmentNumber: number;
  useNumber: number;
  partNumber: number;
  kind: "prose" | "code";
  state: "linked" | "changed" | "duplicated";
  sourceChanged: boolean;
  canNavigate: boolean;
  originalText?: string;
};

export function readingFragmentOrigins(
  units: ReadingExperimentUnit[],
  catalog: ThoughtFragmentEntry[],
  showChangedSnapshots: boolean,
): Map<number, ReadingFragmentOrigin[]> {
  const owners = new Map<number, ReadingExperimentUnit>();
  for (const unit of units) {
    owners.set(unit.position, unit);
    unit.node.descendants((node, position) => {
      if (node.attrs.thoughtFragmentAnchors?.length) owners.set(unit.position + position + 1, unit);
    });
  }
  const grouped = new Map<number, ReadingFragmentOrigin[]>();
  catalog.forEach((entry, fragmentIndex) => {
    entry.uses.forEach((use, useIndex) => {
      use.parts.forEach((part, partIndex) => {
        for (const match of part.matches) {
          const owner = owners.get(match.from);
          if (!owner) continue;
          const origins = grouped.get(owner.index) ?? [];
          if (origins.some((origin) => origin.id === part.reference.id)) continue;
          const sameText = match.text === part.reference.text;
          origins.push({
            id: part.reference.id,
            fragmentNumber: fragmentIndex + 1,
            useNumber: useIndex + 1,
            partNumber: partIndex + 1,
            kind: use.use.kind,
            state:
              part.matches.length > 1
                ? "duplicated"
                : !sameText || match.code !== (use.use.kind === "code")
                  ? "changed"
                  : "linked",
            sourceChanged: use.sourceChanged,
            canNavigate: part.matches.length === 1,
            // A split or edited block's snapshot may include an unread passage.
            // Project just the visible part, and withhold changed text until all units
            // are shown. Never pass the full stored fragment or its other parts to UI.
            originalText: showChangedSnapshots || sameText ? part.reference.text : undefined,
          });
          grouped.set(owner.index, origins);
        }
      });
    });
  });
  return grouped;
}
