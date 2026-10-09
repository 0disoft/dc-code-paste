import { expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import { EditorState, type Transaction } from "@tiptap/pm/state";
import { createEditorExtensions } from "#lib/editor/extensions.ts";
import { readingExperimentUnits } from "#lib/editor/reading-experiment.ts";
import { readingFragmentOrigins } from "#lib/editor/reading-fragment-origins.ts";
import { thoughtFragmentCatalog } from "#lib/editor/thought-fragments.ts";
import {
  addThoughtFragmentTransaction,
  insertThoughtFragmentTransaction,
  updateThoughtFragmentTransaction,
  removeThoughtFragmentTransaction,
} from "#lib/editor/thought-fragment-commands.ts";

const schema = getSchema(createEditorExtensions());
function apply(state: EditorState, result: { transaction?: Transaction } | { error: string }) {
  if ("error" in result) throw new Error(result.error);
  return result.transaction ? state.apply(result.transaction) : state;
}
function inserted(text: string, kind: "prose" | "code" = "prose") {
  let state = EditorState.create({
    doc: schema.node("doc", null, [
      schema.node("paragraph", null, schema.text("앞")),
      schema.node("paragraph", null, schema.text("뒤")),
    ]),
  });
  state = apply(state, addThoughtFragmentTransaction(state, text));
  state = apply(
    state,
    insertThoughtFragmentTransaction(state, thoughtFragmentCatalog(state.doc)[0].fragment.id, kind),
  );
  return state;
}
function origins(state: EditorState, count: number, showChangedSnapshots = false) {
  return readingFragmentOrigins(
    readingExperimentUnits(state).slice(0, count),
    thoughtFragmentCatalog(state.doc),
    showChangedSnapshots,
  );
}

it("projects only the visible part of a multi-paragraph fragment without its unread text", () => {
  let state = inserted("읽은 부분\n아직 읽지 않은 부분");
  expect(origins(state, 1).size).toBe(0);
  const visible = origins(state, 2);
  expect(visible.get(1)).toMatchObject([
    {
      fragmentNumber: 1,
      partNumber: 1,
      originalText: "읽은 부분",
      state: "linked",
      canNavigate: true,
    },
  ]);
  expect(JSON.stringify([...visible])).not.toContain("아직 읽지 않은 부분");
  const later = thoughtFragmentCatalog(state.doc)[0].uses[0].parts[1].matches[0];
  state = state.apply(state.tr.insertText("뒤에서 고친 ", later.from + 1));
  expect(origins(state, 2).get(1)?.[0].state).toBe("linked");
});

it("withholds an edited or split snapshot until all passages are shown", () => {
  const saved = inserted("앞 구간과 미래 구간");
  const original = saved.doc.child(1);
  const first = original.type.create(original.attrs, schema.text("앞 구간"));
  const second = original.type.create(original.attrs, schema.text("미래 구간"));
  const state = EditorState.create({
    doc: saved.doc.type.create(saved.doc.attrs, [
      saved.doc.child(0),
      first,
      second,
      saved.doc.lastChild!,
    ]),
  });
  const visible = origins(state, 2);
  expect(visible.get(1)).toMatchObject([
    { state: "duplicated", canNavigate: false, originalText: undefined },
  ]);
  expect(JSON.stringify([...visible])).not.toContain("미래 구간");
  expect(origins(state, 4, true).get(1)?.[0].originalText).toBe("앞 구간과 미래 구간");
});

it("groups nested repeated anchors once and keeps exact code indentation", () => {
  let state = inserted("  const x = '<script>';\n\treturn x;\n", "code");
  const source = state.doc.child(1);
  const nested = schema.node("blockquote", null, [source, source]);
  state = EditorState.create({ doc: state.doc.type.create(state.doc.attrs, [nested]) });
  const grouped = origins(state, 1);
  expect(grouped.get(0)).toHaveLength(1);
  expect(grouped.get(0)?.[0]).toMatchObject({
    kind: "code",
    state: "duplicated",
    canNavigate: false,
    originalText: "  const x = '<script>';\n\treturn x;\n",
  });
});

it("keeps later private source edits out of projections and drops origins when the source is removed", () => {
  let state = inserted("읽은 조각");
  const id = thoughtFragmentCatalog(state.doc)[0].fragment.id;
  state = apply(
    state,
    updateThoughtFragmentTransaction(state, id, "PRIVATE_SOURCE_ONLY", "읽은 조각"),
  );
  const visible = origins(state, 2);
  expect(visible.get(1)?.[0]).toMatchObject({ sourceChanged: true, originalText: "읽은 조각" });
  expect(JSON.stringify([...visible])).not.toContain("PRIVATE_SOURCE_ONLY");
  const text = state.doc.textContent;
  state = apply(state, removeThoughtFragmentTransaction(state, id));
  expect(state.doc.textContent).toBe(text);
  expect(origins(state, 3).size).toBe(0);
});

it("reports changes in this block independently and reveals its previous text only on request", () => {
  let state = inserted("처음 코드", "code");
  const match = thoughtFragmentCatalog(state.doc)[0].uses[0].parts[0].matches[0];
  state = state.apply(
    state.tr.setNodeMarkup(match.from, schema.nodes.paragraph, state.doc.child(1).attrs),
  );
  expect(origins(state, 2).get(1)?.[0]).toMatchObject({
    state: "changed",
    originalText: "처음 코드",
  });
  state = state.apply(state.tr.insertText("고친 ", match.from + 1));
  expect(origins(state, 2).get(1)?.[0].originalText).toBeUndefined();
  expect(origins(state, 3, true).get(1)?.[0].originalText).toBe("처음 코드");
});
