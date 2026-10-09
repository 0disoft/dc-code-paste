import { Extension } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { normalizeRelationAnchorIds, type RelationPart } from "./sentence-relations-format.ts";
import type { RelationState } from "./sentence-relations.ts";
import {
  normalizeThoughtFragments,
  type ThoughtFragment,
  type ThoughtFragmentUse,
} from "./thought-fragments-format.ts";

export const thoughtFragmentNodeTypes = ["paragraph", "heading", "codeBlock"];
export const ThoughtFragmentAttributes = Extension.create({
  name: "thoughtFragmentAttributes",
  addGlobalAttributes() {
    return [
      {
        types: ["doc"],
        attributes: {
          thoughtFragments: {
            default: [],
            rendered: false,
            validate(value: unknown) {
              if (!normalizeThoughtFragments(value))
                throw new RangeError("Invalid thought fragments");
            },
          },
        },
      },
      {
        types: thoughtFragmentNodeTypes,
        attributes: {
          thoughtFragmentAnchors: {
            default: [],
            rendered: false,
            validate(value: unknown) {
              if (!normalizeRelationAnchorIds(value))
                throw new RangeError("Invalid thought fragment anchors");
            },
          },
        },
      },
    ];
  },
});

export type ThoughtFragmentAnchor = {
  id: string;
  from: number;
  to: number;
  text: string;
  code: boolean;
};
export type ThoughtFragmentUseEntry = {
  use: ThoughtFragmentUse;
  state: RelationState;
  sourceChanged: boolean;
  parts: { reference: RelationPart; matches: ThoughtFragmentAnchor[] }[];
};
export type ThoughtFragmentEntry = { fragment: ThoughtFragment; uses: ThoughtFragmentUseEntry[] };

export function thoughtFragmentAnchorCatalog(document: Node | undefined) {
  const anchors = new Map<string, ThoughtFragmentAnchor[]>();
  document?.descendants((node, position) => {
    if (!thoughtFragmentNodeTypes.includes(node.type.name)) return;
    for (const id of normalizeRelationAnchorIds(node.attrs.thoughtFragmentAnchors) ?? []) {
      const matches = anchors.get(id) ?? [];
      matches.push({
        id,
        from: position,
        to: position + node.nodeSize,
        text: node.textBetween(0, node.content.size, "\n", "\n"),
        code: node.type.spec.code === true,
      });
      anchors.set(id, matches);
    }
  });
  return anchors;
}

export function thoughtFragmentCatalog(document: Node | undefined): ThoughtFragmentEntry[] {
  const anchors = thoughtFragmentAnchorCatalog(document);
  return (normalizeThoughtFragments(document?.attrs.thoughtFragments) ?? []).map((fragment) => ({
    fragment,
    uses: fragment.uses.map((use) => {
      const parts = use.parts.map((reference) => ({
        reference,
        matches: anchors.get(reference.id) ?? [],
      }));
      const unique = parts.filter((part) => part.matches.length === 1);
      const changed =
        unique.some(
          (part) =>
            part.matches[0].text !== part.reference.text ||
            part.matches[0].code !== (use.kind === "code"),
        ) ||
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
      return {
        use,
        parts,
        state,
        sourceChanged: use.parts.map((part) => part.text).join("\n") !== fragment.text,
      };
    }),
  }));
}
