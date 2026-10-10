import { getSchema } from "@tiptap/core";
import { EditorState, TextSelection, type Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { expect, it, vi } from "vitest";
import { createEditorExtensions } from "#lib/editor/extensions.ts";
import { restoreClickedTextblockSelection } from "#lib/editor/selection-focus.ts";

const schema = getSchema(createEditorExtensions());
const doc = schema.nodeFromJSON({
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "이전 자리" }] },
    {
      type: "summaryBox",
      content: [{ type: "summaryItem", content: [{ type: "text", text: "클릭한 요약" }] }],
    },
  ],
});
const clicked = doc.firstChild!.nodeSize + 3;
const click = { button: 0, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false };

function fixture(position = 1) {
  let state = EditorState.create({ doc, selection: TextSelection.create(doc, position) });
  const focus = vi.fn<() => void>();
  const dispatch = vi.fn<(tr: Transaction) => void>((tr) => {
    state = state.apply(tr);
  });
  const view = {
    get state() {
      return state;
    },
    dispatch,
    focus,
  } as unknown as EditorView;
  return { view, dispatch, focus };
}

it("repairs a stale caret in another block without changing document content", () => {
  const { view, dispatch, focus } = fixture();
  expect(restoreClickedTextblockSelection(view, clicked, click)).toBe(false);
  expect(view.state.selection.from).toBe(clicked);
  expect(view.state.doc.eq(doc)).toBe(true);
  expect(dispatch).toHaveBeenCalledOnce();
  expect(focus).toHaveBeenCalledOnce();
});

it("preserves native cursor placement within the clicked textblock", () => {
  const { view, dispatch, focus } = fixture(clicked + 1);
  restoreClickedTextblockSelection(view, clicked, click);
  expect(view.state.selection.from).toBe(clicked + 1);
  expect(dispatch).not.toHaveBeenCalled();
  expect(focus).not.toHaveBeenCalled();
});

it("leaves modifier gestures, non-left clicks and non-textblock boundaries alone", () => {
  const { view, dispatch } = fixture();
  for (const event of [
    { ...click, button: 2 },
    { ...click, shiftKey: true },
    { ...click, ctrlKey: true },
    { ...click, metaKey: true },
    { ...click, altKey: true },
  ])
    restoreClickedTextblockSelection(view, clicked, event);
  restoreClickedTextblockSelection(view, doc.firstChild!.nodeSize, click);
  expect(dispatch).not.toHaveBeenCalled();
  expect(view.state.selection.from).toBe(1);
});
