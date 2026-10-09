import { Extension } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { normalizeReadingNotes, type ReadingNote } from "./reading-notes-format.ts";
import {
  relationAnchorCatalog,
  type RelationAnchor,
  type RelationState,
} from "./sentence-relations.ts";

export const ReadingNoteAttributes = Extension.create({
  name: "readingNoteAttributes",
  addGlobalAttributes() {
    return [
      {
        types: ["doc"],
        attributes: {
          readingNotes: {
            default: [],
            rendered: false,
            validate(value: unknown) {
              if (!normalizeReadingNotes(value)) throw new RangeError("Invalid reading notes");
            },
          },
        },
      },
    ];
  },
});

export type ReadingNoteEntry = {
  note: ReadingNote;
  state: RelationState;
  parts: { reference: ReadingNote["parts"][number]; matches: RelationAnchor[] }[];
};

export function readingNoteCatalog(document: Node | undefined): ReadingNoteEntry[] {
  const anchors = relationAnchorCatalog(document);
  return (normalizeReadingNotes(document?.attrs.readingNotes) ?? []).map((note) => {
    const parts = note.parts.map((reference) => ({
      reference,
      matches: anchors.get(reference.id) ?? [],
    }));
    const unique = parts.filter((part) => part.matches.length === 1);
    const changed =
      unique.some((part) => part.matches[0].text !== part.reference.text) ||
      unique.some(
        (part, index) => index > 0 && part.matches[0].from < unique[index - 1].matches[0].from,
      );
    const state: RelationState = parts.some((part) => !part.matches.length)
      ? "missing"
      : parts.some((part) => part.matches.length > 1)
        ? "duplicated"
        : changed
          ? "changed"
          : "linked";
    return { note, parts, state };
  });
}
