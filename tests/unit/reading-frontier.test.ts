import { expect, it } from "vitest";
import { getSchema, type JSONContent } from "@tiptap/core";
import { EditorState } from "@tiptap/pm/state";
import { createEditorExtensions } from "#lib/editor/extensions.ts";
import { readingRelationFrontier } from "#lib/editor/reading-frontier.ts";
import { sentenceRelationCatalog } from "#lib/editor/sentence-relations.ts";
import { readingExperimentUnits } from "#lib/editor/reading-experiment.ts";

const schema = getSchema(createEditorExtensions());
function paragraph(text: string, id?: string): JSONContent {
  return {
    type: "paragraph",
    content: [
      {
        type: "text",
        text,
        ...(id ? { marks: [{ type: "relationAnchor", attrs: { ids: [id] } }] } : {}),
      },
    ],
  };
}
function document(
  content: JSONContent[] = [
    paragraph("주장", "claim"),
    paragraph("설명 사이"),
    paragraph("아직 비공개인 근거", "evidence"),
  ],
) {
  return schema.nodeFromJSON({
    type: "doc",
    attrs: {
      sentenceRelations: [
        {
          id: "connection",
          kind: "evidence",
          claim: [{ id: "claim", text: "주장" }],
          related: [{ id: "evidence", text: "아직 비공개인 근거" }],
        },
      ],
    },
    content,
  });
}
function frontier(doc = document(), count = 1) {
  const units = readingExperimentUnits(EditorState.create({ doc }));
  const last = units.slice(0, count).at(-1);
  return readingRelationFrontier(
    sentenceRelationCatalog(doc),
    last ? last.position + last.node.nodeSize : 0,
  );
}

it("hides future connections and future text until their claim has appeared", () => {
  expect(frontier(document(), 0)).toEqual([]);
  const pending = frontier()[0];
  expect(pending.claim.shown.map((anchor) => anchor.text)).toEqual(["주장"]);
  expect(pending.related).toMatchObject({ shown: [], later: 1, missing: 0, duplicated: 0 });
  expect(pending.nextPosition).toBeGreaterThan(0);
  expect(JSON.stringify(pending)).not.toContain("아직 비공개인 근거");
  expect(frontier(document(), 2)[0]).toEqual(pending);
  const shown = frontier(document(), 3)[0];
  expect(shown.related.shown[0].text).toBe("아직 비공개인 근거");
  expect(shown.related.later).toBe(0);
  expect(shown.nextPosition).toBeUndefined();
});

it("recognizes related passages that have already appeared before the claim", () => {
  const doc = document([
    paragraph("아직 비공개인 근거", "evidence"),
    paragraph("説明"),
    paragraph("주장", "claim"),
  ]);
  expect(frontier(doc, 2)).toEqual([]);
  expect(frontier(doc, 3)[0].related.shown[0].text).toBe("아직 비공개인 근거");
});

it("keeps missing and duplicated locations unknown rather than exposing snapshots or choosing a copy", () => {
  const missing = frontier(document([paragraph("주장", "claim")]))[0];
  expect(missing.related).toMatchObject({ shown: [], later: 0, missing: 1 });
  expect(missing.nextPosition).toBeUndefined();
  expect(JSON.stringify(missing)).not.toContain("아직 비공개인 근거");
  const duplicated = frontier(
    document([
      paragraph("주장", "claim"),
      paragraph("아직 비공개인 근거", "evidence"),
      paragraph("아직 비공개인 근거", "evidence"),
    ]),
    3,
  )[0];
  expect(duplicated.related).toMatchObject({ shown: [], later: 0, duplicated: 1 });
  expect(duplicated.nextPosition).toBeUndefined();
  expect(
    frontier(
      document([
        paragraph("주장", "claim"),
        paragraph("주장", "claim"),
        paragraph("아직 비공개인 근거", "evidence"),
      ]),
      3,
    ),
  ).toEqual([]);
});

it("shows only the appeared parts of a multi-part claim and related passage", () => {
  const doc = document([
    paragraph("주장", "claim"),
    paragraph("앞쪽 근거", "first"),
    paragraph("이어서 말할 주장", "claim_tail"),
    paragraph("아직 비공개인 근거", "evidence"),
  ]);
  const multi = schema.nodeFromJSON({
    ...doc.toJSON(),
    attrs: {
      sentenceRelations: [
        {
          ...doc.attrs.sentenceRelations[0],
          kind: "custom",
          label: "함께 떠올리기",
          claim: [
            ...doc.attrs.sentenceRelations[0].claim,
            { id: "claim_tail", text: "이어서 말할 주장" },
          ],
          related: [{ id: "first", text: "앞쪽 근거" }, ...doc.attrs.sentenceRelations[0].related],
        },
      ],
    },
  });
  const partial = frontier(multi, 2)[0];
  expect(partial.label).toBe("함께 떠올리기");
  expect(partial.claim.later).toBe(1);
  expect(partial.related.later).toBe(1);
  expect(partial.related.shown.map((anchor) => anchor.text)).toEqual(["앞쪽 근거"]);
  expect(JSON.stringify(partial)).not.toContain("이어서 말할 주장");
  expect(JSON.stringify(partial)).not.toContain("아직 비공개인 근거");
});

it("uses changed live text and does not mutate the source document or catalog", () => {
  const doc = document([paragraph("고친 주장", "claim"), paragraph("근거도 고쳤다", "evidence")]);
  const catalog = sentenceRelationCatalog(doc);
  const snapshot = JSON.stringify(catalog);
  const entry = readingRelationFrontier(catalog, doc.content.size)[0];
  expect(entry.state).toBe("changed");
  expect(entry.claim.shown[0].text).toBe("고친 주장");
  expect(entry.related.shown[0].text).toBe("근거도 고쳤다");
  expect(JSON.stringify(catalog)).toBe(snapshot);
  doc.check();
});

it("rejects invalid boundaries and keeps an anchor crossing the boundary hidden", () => {
  const catalog = sentenceRelationCatalog(document());
  for (const boundary of [-1, Number.NaN, Number.POSITIVE_INFINITY])
    expect(readingRelationFrontier(catalog, boundary)).toEqual([]);
  expect(readingRelationFrontier(catalog, 2)).toEqual([]);
  const boundary = catalog[0].related.parts[0].matches[0].from + 1;
  const entry = readingRelationFrontier(catalog, boundary)[0];
  expect(entry.related.shown).toEqual([]);
  expect(entry.related.later).toBe(1);
  expect(JSON.stringify(entry)).not.toContain("아직 비공개인 근거");
});
