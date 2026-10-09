import { expect, it } from "vitest";
import { getSchema, type JSONContent } from "@tiptap/core";
import { EditorState, TextSelection, NodeSelection, type Transaction } from "@tiptap/pm/state";
import { history, closeHistory, undo, redo } from "@tiptap/pm/history";
import { createEditorExtensions } from "#lib/editor/extensions.ts";
import {
  addThoughtFragmentTransaction,
  updateThoughtFragmentTransaction,
  removeThoughtFragmentTransaction,
  insertThoughtFragmentTransaction,
} from "#lib/editor/thought-fragment-commands.ts";
import { thoughtFragmentCatalog } from "#lib/editor/thought-fragments.ts";
import {
  normalizeThoughtFragments,
  normalizeThoughtFragmentText,
} from "#lib/editor/thought-fragments-format.ts";
import { exportDocumentToDcHtml } from "#lib/dc/export-document.ts";
import { createDraftFile, readDraftFile } from "#lib/editor/draft-file.ts";
import { createCopiedOutput, copiedOutputChanges } from "#lib/editor/copied-output.ts";
import type { DraftPreferences } from "#lib/editor/draft-storage.ts";

const schema = getSchema(createEditorExtensions());
const paragraph = (text: string): JSONContent => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});
const preferences: DraftPreferences = {
  language: "javascript",
  theme: "github-light",
  bodyFontFamily: "Georgia",
  bodyFontSize: "18px",
  selectionFontFamily: "Georgia",
  selectionFontSize: "18px",
  codeFontSize: "15px",
  showLineNumbers: false,
  documentTheme: "cleanEditorial",
  structure: "dcTable",
};
function initial(content = [paragraph("원래 문장"), paragraph("뒷 문장")]) {
  return EditorState.create({
    doc: schema.nodeFromJSON({ type: "doc", content }),
    plugins: [history()],
  });
}
function apply(state: EditorState, result: { transaction?: Transaction } | { error: string }) {
  if ("error" in result) throw new Error(result.error);
  if (!result.transaction) return state;
  const next = state.apply(result.transaction);
  return next.apply(closeHistory(next.tr));
}
function add(state: EditorState, text = "  조각 첫줄\n\n다음 줄  ") {
  return apply(state, addThoughtFragmentTransaction(state, text));
}
const id = (state: EditorState) => thoughtFragmentCatalog(state.doc)[0].fragment.id;
const insert = (state: EditorState, kind: "prose" | "code" = "prose") =>
  apply(state, insertThoughtFragmentTransaction(state, id(state), kind));

it("stores unfinished material verbatim without changing existing prose or selection", () => {
  let state = initial();
  state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1, 4)));
  const saved = add(state, "  const x = '<script>';\r\n  return x;  ");
  expect(saved.selection.eq(state.selection)).toBe(true);
  expect(saved.doc.textContent).toBe(state.doc.textContent);
  expect(thoughtFragmentCatalog(saved.doc)[0]).toMatchObject({
    fragment: { text: "  const x = '<script>';\n  return x;  ", uses: [] },
  });
  expect(normalizeThoughtFragmentText(" ")).toBeNull();
  expect(normalizeThoughtFragmentText("x".repeat(8001))).toBeNull();
});

it("inserts prose after the caret's block without replacing a selected range, and undoes the usage with its content", () => {
  let state = add(initial());
  state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1, 4)));
  const original = state.doc.textContent;
  state = insert(state);
  expect(state.doc.childCount).toBe(5);
  expect(state.doc.child(0).textContent).toBe("원래 문장");
  expect(state.doc.child(1).textContent).toBe("  조각 첫줄");
  expect(state.doc.child(2).textContent).toBe("");
  expect(state.doc.child(3).textContent).toBe("다음 줄  ");
  expect(state.doc.lastChild!.textContent).toBe("뒷 문장");
  expect(thoughtFragmentCatalog(state.doc)[0].uses[0].state).toBe("linked");
  undo(state, (tr) => {
    state = state.apply(tr);
  });
  expect(state.doc.textContent).toBe(original);
  expect(thoughtFragmentCatalog(state.doc)[0].uses).toEqual([]);
  redo(state, (tr) => {
    state = state.apply(tr);
  });
  expect(thoughtFragmentCatalog(state.doc)[0].uses[0].state).toBe("linked");
});

it("handles node selections and nested caret positions while retaining exact code indentation", () => {
  let state = add(initial(), "  let x = 1;\n\treturn x;\n");
  state = state.apply(state.tr.setSelection(NodeSelection.create(state.doc, 0)));
  state = insert(state, "code");
  expect(state.doc.child(1).type.name).toBe("codeBlock");
  expect(state.doc.child(1).textContent).toBe("  let x = 1;\n\treturn x;\n");
  expect(thoughtFragmentCatalog(state.doc)[0].uses[0]).toMatchObject({
    state: "linked",
    use: { kind: "code" },
  });
  let nested = add(
    initial([
      { type: "bulletList", content: [{ type: "listItem", content: [paragraph("목록 안")] }] },
      paragraph("뒤"),
    ]),
    "조각",
  );
  nested = nested.apply(nested.tr.setSelection(TextSelection.create(nested.doc, 3)));
  nested = insert(nested);
  expect(nested.doc.child(0).type.name).toBe("bulletList");
  expect(nested.doc.child(1).textContent).toBe("조각");
  expect(nested.doc.lastChild!.textContent).toBe("뒤");
});

it("tracks edited, duplicated and missing inserted blocks while keeping the original fragment independent", () => {
  let state = insert(add(initial(), "처음 조각"));
  const entry = thoughtFragmentCatalog(state.doc)[0];
  const target = entry.uses[0].parts[0].matches[0];
  state = state.apply(state.tr.insertText("고친", target.from + 2));
  expect(thoughtFragmentCatalog(state.doc)[0].uses[0].state).toBe("changed");
  state = apply(
    state,
    updateThoughtFragmentTransaction(state, id(state), "조각도 수정", "처음 조각"),
  );
  expect(thoughtFragmentCatalog(state.doc)[0].uses[0].sourceChanged).toBe(true);
  expect(
    updateThoughtFragmentTransaction(state, id(state), "덮어쓰기", "처음 조각"),
  ).toHaveProperty("error");
  const node = state.doc.nodeAt(target.from)!;
  state = state.apply(state.tr.insert(target.to + "고친".length, node));
  expect(thoughtFragmentCatalog(state.doc)[0].uses[0].state).toBe("duplicated");
  const matches = thoughtFragmentCatalog(state.doc)[0].uses[0].parts[0].matches;
  for (const match of [...matches].reverse())
    state = state.apply(state.tr.delete(match.from, match.to));
  expect(thoughtFragmentCatalog(state.doc)[0].uses[0].state).toBe("missing");
  expect(thoughtFragmentCatalog(state.doc)[0].uses[0].parts[0].reference.text).toBe("처음 조각");
});

it("removes a fragment and its private anchors without deleting any inserted text", async () => {
  const state = insert(add(initial(), "남겨 둘 코드"), "code");
  const removed = apply(state, removeThoughtFragmentTransaction(state, id(state)));
  expect(removed.doc.textContent).toBe(state.doc.textContent);
  expect(thoughtFragmentCatalog(removed.doc)).toEqual([]);
  expect(removed.doc.child(1).attrs.thoughtFragmentAnchors).toEqual([]);
  expect(await exportDocumentToDcHtml(removed.doc.toJSON(), preferences)).toBe(
    await exportDocumentToDcHtml(state.doc.toJSON(), preferences),
  );
});

it("rejects malformed records and too many prose lines without changing the document", () => {
  const state = add(initial(), Array.from({ length: 129 }, () => "줄").join("\n"));
  expect(insertThoughtFragmentTransaction(state, id(state), "prose")).toHaveProperty("error");
  const valid = thoughtFragmentCatalog(state.doc)[0].fragment;
  for (const record of [
    { ...valid, text: "" },
    { ...valid, createdAt: "bad" },
    { ...valid, id: "bad id" },
    { ...valid, uses: [{ id: "use", kind: "unknown", parts: [{ id: "part", text: "원문" }] }] },
  ]) {
    expect(normalizeThoughtFragments([record])).toBeNull();
    expect(() =>
      schema
        .nodeFromJSON({
          type: "doc",
          attrs: { thoughtFragments: [record] },
          content: [paragraph("원문")],
        })
        .check(),
    ).toThrow("Invalid thought fragments");
  }
});

it("roundtrips unused and used fragments in drafts, keeps unused material out of output, and excludes private anchors", async () => {
  const original = initial();
  const saved = add(original, "비공개로만 남겨 둔 조각");
  const html = await exportDocumentToDcHtml(original.doc.toJSON(), preferences);
  expect(await exportDocumentToDcHtml(saved.doc.toJSON(), preferences)).toBe(html);
  const output = createCopiedOutput(
    original.doc.toJSON(),
    preferences,
    html,
    original.doc.textContent,
    "preview",
  )!;
  expect(copiedOutputChanges(output, saved.doc.toJSON(), preferences).content).toBe(false);
  const used = insert(saved);
  const file = createDraftFile(used.doc.toJSON(), preferences);
  const restored = await readDraftFile(
    { size: Buffer.byteLength(file.content), text: async () => file.content },
    schema,
  );
  expect(thoughtFragmentCatalog(schema.nodeFromJSON(restored.document))[0].uses[0].state).toBe(
    "linked",
  );
  const exported = await exportDocumentToDcHtml(restored.document, preferences);
  expect(exported).toContain("비공개로만 남겨 둔 조각");
  expect(exported).not.toContain("thoughtFragment");
  expect(exported).not.toContain(thoughtFragmentCatalog(used.doc)[0].uses[0].use.id);
});
