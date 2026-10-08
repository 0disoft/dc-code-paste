import { getSchema, type Editor } from "@tiptap/core";
import { EditorState, TextSelection, type Transaction } from "@tiptap/pm/state";
import { expect, it } from "vitest";
import { createEditorExtensions } from "../../src/lib/editor/extensions";
import {
  selectedBlockInfo,
  setSelectedBlockAppearance,
} from "../../src/lib/editor/block-inspector";

it("edits a summary from its text selection without recoloring a legacy block", () => {
  const schema = getSchema(createEditorExtensions());
  const doc = schema.nodeFromJSON({
    type: "doc",
    content: [
      {
        type: "summaryBox",
        attrs: { label: "기존 요약" },
        content: [{ type: "summaryItem", content: [{ type: "text", text: "기존 내용" }] }],
      },
      { type: "paragraph", content: [{ type: "text", text: "본문" }] },
    ],
  });
  let state = EditorState.create({ doc, selection: TextSelection.create(doc, 3) });
  const editor = {
    get state() {
      return state;
    },
    view: {
      dispatch(tr: Transaction) {
        state = state.apply(tr);
      },
    },
  } as unknown as Editor;
  expect(selectedBlockInfo(editor)?.type).toBe("summaryBox");
  expect(setSelectedBlockAppearance(editor, { spacing: "spacious" })).toBe(true);
  expect(state.doc.firstChild?.attrs).toMatchObject({
    label: "기존 요약",
    tone: null,
    spacing: "spacious",
    alignment: null,
  });
  expect(state.doc.textContent).toBe("기존 내용본문");
  expect(state.selection.from).toBe(3);
  state = state.apply(
    state.tr.setSelection(TextSelection.create(state.doc, state.doc.firstChild!.nodeSize + 1)),
  );
  expect(selectedBlockInfo(editor)?.type).toBe("paragraph");
  expect(setSelectedBlockAppearance(editor, { tone: "green" })).toBe(false);
});
