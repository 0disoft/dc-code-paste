import { Extension, Mark } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import {
  normalizeRelationAnchorIds,
  normalizeSentenceRelations,
  type RelationPart,
  type SentenceRelation,
} from "./sentence-relations-format.ts";

export const RelationAnchorMark = Mark.create({
  name: "relationAnchor",
  inclusive: false,
  addAttributes() {
    return {
      ids: {
        default: [],
        rendered: false,
        validate(value: unknown) {
          if (!normalizeRelationAnchorIds(value))
            throw new RangeError("Invalid relation anchor identities");
        },
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: "span[data-relation-anchors]",
        getAttrs(element) {
          const ids = normalizeRelationAnchorIds(
            (element.getAttribute("data-relation-anchors") ?? "").split(" ").filter(Boolean),
          );
          return ids?.length ? { ids } : false;
        },
      },
    ];
  },
  renderHTML({ mark }) {
    return [
      "span",
      { "data-relation-anchors": (normalizeRelationAnchorIds(mark.attrs.ids) ?? []).join(" ") },
      0,
    ];
  },
});

export const SentenceRelationAttributes = Extension.create({
  name: "sentenceRelationAttributes",
  addGlobalAttributes() {
    return [
      {
        types: ["doc"],
        attributes: {
          sentenceRelations: {
            default: [],
            rendered: false,
            validate(value: unknown) {
              if (!normalizeSentenceRelations(value))
                throw new RangeError("Invalid sentence relations");
            },
          },
        },
      },
    ];
  },
});

export type RelationAnchor = { id: string; from: number; to: number; text: string };
export type RelationState = "linked" | "changed" | "missing" | "duplicated";
export type RelationEndpoint = {
  parts: { reference: RelationPart; matches: RelationAnchor[] }[];
  state: RelationState;
};
export type SentenceRelationEntry = {
  relation: SentenceRelation;
  claim: RelationEndpoint;
  related: RelationEndpoint;
  state: RelationState;
};

export function relationAnchorCatalog(document: Node | undefined) {
  const anchors = new Map<string, RelationAnchor[]>();
  document?.descendants((node, position, parent) => {
    if (node.type.spec.code) return false;
    const mark = node.marks.find((item) => item.type.name === "relationAnchor");
    if (
      !mark ||
      !parent?.type.allowsMarkType(mark.type) ||
      node.marks.some((item) => item.type.name === "code")
    )
      return;
    const text = node.isText ? node.text! : node.type.name === "hardBreak" ? "\n" : "";
    if (!text) return;
    for (const id of normalizeRelationAnchorIds(mark.attrs.ids) ?? []) {
      const matches = anchors.get(id) ?? [];
      const previous = matches.at(-1);
      if (previous?.to === position) {
        previous.to = position + node.nodeSize;
        previous.text += text;
      } else matches.push({ id, from: position, to: position + node.nodeSize, text });
      anchors.set(id, matches);
    }
  });
  return anchors;
}

function combinedState(states: RelationState[]): RelationState {
  return states.includes("missing")
    ? "missing"
    : states.includes("duplicated")
      ? "duplicated"
      : states.includes("changed")
        ? "changed"
        : "linked";
}

export function sentenceRelationCatalog(document: Node | undefined): SentenceRelationEntry[] {
  const anchors = relationAnchorCatalog(document);
  function endpoint(references: RelationPart[]): RelationEndpoint {
    const parts = references.map((reference) => ({
      reference,
      matches: anchors.get(reference.id) ?? [],
    }));
    const states = parts.map(({ reference, matches }): RelationState =>
      !matches.length
        ? "missing"
        : matches.length !== 1
          ? "duplicated"
          : matches[0].text !== reference.text
            ? "changed"
            : "linked",
    );
    const positions = parts.flatMap((part) =>
      part.matches.length === 1 ? [part.matches[0].from] : [],
    );
    if (positions.some((position, index) => index > 0 && position < positions[index - 1]))
      states.push("changed");
    return { parts, state: combinedState(states) };
  }
  const entries = (normalizeSentenceRelations(document?.attrs.sentenceRelations) ?? []).map(
    (relation) => {
      const claim = endpoint(relation.claim);
      const related = endpoint(relation.related);
      return { relation, claim, related, state: combinedState([claim.state, related.state]) };
    },
  );
  const position = (entry: SentenceRelationEntry) =>
    Math.min(...entry.claim.parts.flatMap((part) => part.matches.map((anchor) => anchor.from)));
  return entries.sort((first, second) => position(first) - position(second));
}

export function createSentenceRelationReader() {
  let previous: Node | undefined;
  let catalog: SentenceRelationEntry[] = [];
  return (document: Node | undefined) => {
    if (document !== previous) {
      previous = document;
      catalog = sentenceRelationCatalog(document);
    }
    return catalog;
  };
}
