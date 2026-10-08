import { expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import { EditorState } from "@tiptap/pm/state";
import { history, undo, redo } from "@tiptap/pm/history";
import { Step } from "@tiptap/pm/transform";
import { createEditorExtensions } from "#lib/editor/extensions.ts";
import { DocumentPreferencesStep } from "#lib/editor/document-replacement.ts";
import type { DraftPreferences } from "#lib/editor/draft-storage.ts";

const schema = getSchema(createEditorExtensions());
const before: DraftPreferences = {
  language: "cpp",
  theme: "github-light",
  bodyFontFamily: "sans-serif",
  bodyFontSize: "18px",
  selectionFontFamily: "sans-serif",
  selectionFontSize: "18px",
  codeFontSize: "15px",
  showLineNumbers: false,
  documentTheme: "cleanEditorial",
  structure: "dcTable",
};
const after: DraftPreferences = {
  ...before,
  language: "python",
  theme: "catppuccin-mocha",
  bodyFontFamily: "Georgia",
  bodyFontSize: "20px",
  codeFontSize: "17px",
  showLineNumbers: true,
  documentTheme: "darkEditorial",
};

it("keeps all preferences reversible even when the document content is unchanged", () => {
  const document = schema.nodeFromJSON({ type: "doc", content: [{ type: "paragraph" }] });
  let state = EditorState.create({ doc: document, plugins: [history()] });
  let preferences = before;
  const dispatch = (tr: typeof state.tr) => {
    for (const step of tr.steps)
      if (step instanceof DocumentPreferencesStep) preferences = step.after;
    state = state.apply(tr);
  };
  dispatch(state.tr.step(new DocumentPreferencesStep(before, after)));
  expect(preferences).toEqual(after);
  expect(undo(state, dispatch)).toBe(true);
  expect(preferences).toEqual(before);
  expect(state.doc.eq(document)).toBe(true);
  expect(redo(state, dispatch)).toBe(true);
  expect(preferences).toEqual(after);
  expect(state.doc.eq(document)).toBe(true);
});

it("round-trips the history step through ProseMirror serialization and rejects invalid preferences", () => {
  const loaded = Step.fromJSON(schema, new DocumentPreferencesStep(before, after).toJSON());
  expect(loaded).toBeInstanceOf(DocumentPreferencesStep);
  expect((loaded as DocumentPreferencesStep).before).toEqual(before);
  expect((loaded as DocumentPreferencesStep).after).toEqual(after);
  expect(() =>
    Step.fromJSON(schema, { stepType: "dcDocumentPreferences", before: {}, after }),
  ).toThrow("Invalid document preferences");
});
