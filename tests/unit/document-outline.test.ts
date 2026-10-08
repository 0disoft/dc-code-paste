import { getSchema, type Editor } from "@tiptap/core";
import { EditorState, NodeSelection, type Transaction } from "@tiptap/pm/state";
import { expect, it } from "vitest";
import { createEditorExtensions } from "../../src/lib/editor/extensions";
import {
  documentOutline,
  activeOutlineIndex,
  navigateToBlock,
} from "../../src/lib/editor/document-outline";

it("keeps nested blocks as one entry and navigates without changing content", () => {
  const schema = getSchema(createEditorExtensions());
  const doc = schema.nodeFromJSON({
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "앞 문단" }] },
      {
        type: "summaryBox",
        attrs: { tone: "green" },
        content: [{ type: "summaryItem", content: [{ type: "text", text: "찾을 요약" }] }],
      },
      { type: "horizontalRule" },
    ],
  });
  let state = EditorState.create({ doc });
  const editor = {
    get state() {
      return state;
    },
    view: {
      dispatch(tr: Transaction) {
        state = state.apply(tr);
      },
    },
    commands: {
      focus() {
        return true;
      },
    },
  } as unknown as Editor;
  expect(documentOutline(doc)).toEqual([
    { index: 0, position: 0, label: "문단", text: "앞 문단" },
    { index: 1, position: doc.child(0).nodeSize, label: "요약 블록", text: "찾을 요약" },
    {
      index: 2,
      position: doc.child(0).nodeSize + doc.child(1).nodeSize,
      label: "구분선",
      text: "구분선",
    },
  ]);
  expect(navigateToBlock(editor, 1)).toBe(true);
  expect(state.selection).toBeInstanceOf(NodeSelection);
  expect(activeOutlineIndex(editor)).toBe(1);
  expect(state.doc.eq(doc)).toBe(true);
  expect(navigateToBlock(editor, 2)).toBe(true);
  expect(activeOutlineIndex(editor)).toBe(2);
  expect(navigateToBlock(editor, 3)).toBe(false);
  expect(navigateToBlock(editor, -1)).toBe(false);
});
