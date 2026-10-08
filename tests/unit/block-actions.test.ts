import { getSchema, type Editor, type JSONContent } from "@tiptap/core";
import { EditorState, TextSelection, type Transaction } from "@tiptap/pm/state";
import { expect, it } from "vitest";
import { createEditorExtensions } from "../../src/lib/editor/extensions";
import { applyBlockAction, availableBlockActions } from "../../src/lib/editor/block-actions";

function harness(content: JSONContent[], position = 1) {
  const schema = getSchema(createEditorExtensions());
  const doc = schema.nodeFromJSON({ type: "doc", content });
  let state = EditorState.create({ doc, selection: TextSelection.create(doc, position) });
  return {
    get state() {
      return state;
    },
    schema,
    commands: {
      focus() {
        return true;
      },
    },
    view: {
      dispatch(tr: Transaction) {
        state = state.apply(tr);
      },
    },
  } as unknown as Editor;
}
const paragraph = (text: string): JSONContent => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});

it("moves and duplicates a selected summary with its content and appearance intact", () => {
  const summary: JSONContent = {
    type: "summaryBox",
    attrs: { label: "요약", tone: "green" },
    content: [{ type: "summaryItem", content: [{ type: "text", text: "핵심" }] }],
  };
  const editor = harness([paragraph("앞"), summary, paragraph("뒤")], 5);
  expect(applyBlockAction(editor, "up")).toBe(true);
  expect(editor.state.doc.firstChild?.attrs.tone).toBe("green");
  expect(editor.state.doc.textContent).toBe("핵심앞뒤");
  expect(editor.state.selection).toBeInstanceOf(TextSelection);
  expect(editor.state.selection.empty).toBe(true);
  expect(availableBlockActions(editor).up).toBe(false);
  expect(applyBlockAction(editor, "down")).toBe(true);
  expect(editor.state.doc.textContent).toBe("앞핵심뒤");
  expect(applyBlockAction(editor, "duplicate")).toBe(true);
  expect(editor.state.doc.textContent).toBe("앞핵심핵심뒤");
  editor.view.dispatch(editor.state.tr.insertText("추가"));
  expect(editor.state.doc.textContent).toBe("앞핵심추가핵심뒤");
  expect(applyBlockAction(editor, "delete")).toBe(true);
  expect(editor.state.doc.textContent).toBe("앞핵심뒤");
});

it("leaves an editable paragraph when deleting the last document block", () => {
  const editor = harness([paragraph("마지막")]);
  expect(availableBlockActions(editor)).toMatchObject({ up: false, down: false, delete: true });
  expect(applyBlockAction(editor, "delete")).toBe(true);
  expect(editor.state.doc.childCount).toBe(1);
  expect(editor.state.doc.firstChild?.type.name).toBe("paragraph");
  expect(editor.state.doc.textContent).toBe("");
});

it("refuses to delete a required final child in a nested block", () => {
  const editor = harness(
    [
      {
        type: "ctaGroup",
        content: [
          {
            type: "ctaButton",
            attrs: { href: "https://example.com" },
            content: [{ type: "text", text: "자료" }],
          },
        ],
      },
    ],
    2,
  );
  expect(availableBlockActions(editor).delete).toBe(false);
  expect(applyBlockAction(editor, "delete")).toBe(false);
  expect(editor.state.doc.textContent).toBe("자료");
});
