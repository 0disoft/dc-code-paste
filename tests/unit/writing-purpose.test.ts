import { expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { closeHistory, history, undo, redo } from "@tiptap/pm/history";
import { createEditorExtensions } from "#lib/editor/extensions.ts";
import {
  createWritingPurposeTransaction,
  normalizeWritingPurpose,
} from "#lib/editor/writing-purpose.ts";
import { createDraftFile, readDraftFile } from "#lib/editor/draft-file.ts";
import { exportDocumentToDcHtml } from "#lib/dc/export-document.ts";
import { copiedOutputChanges, createCopiedOutput } from "#lib/editor/copied-output.ts";
import type { DraftPreferences } from "#lib/editor/draft-storage.ts";

const schema = getSchema(createEditorExtensions());
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
function initial() {
  const doc = schema.nodeFromJSON({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "이 글의 본문", marks: [{ type: "bold" }] }],
      },
    ],
  });
  return EditorState.create({
    doc,
    plugins: [history()],
    selection: TextSelection.create(doc, 1, 4),
  });
}
function save(state: EditorState, text: string, expected = "") {
  const result = createWritingPurposeTransaction(state, text, expected);
  if ("error" in result) throw new Error(result.error);
  if (!result.transaction) return state;
  const next = state.apply(result.transaction);
  return next.apply(closeHistory(next.tr));
}

it("keeps purpose optional, normalizes a sentence, and rejects malformed or oversized stored values", () => {
  expect(normalizeWritingPurpose("  무엇이\n남았으면\t좋을까?  ")).toBe("무엇이 남았으면 좋을까?");
  expect(normalizeWritingPurpose("   ")).toBe("");
  expect(normalizeWritingPurpose(undefined)).toBeNull();
  for (const value of [null, 1, {}, "x".repeat(501), "말\u0000끝"]) {
    expect(normalizeWritingPurpose(value)).toBeNull();
    expect(() =>
      schema.nodeFromJSON({ ...initial().doc.toJSON(), attrs: { writingPurpose: value } }).check(),
    ).toThrow("Invalid writing purpose");
  }
  expect(initial().doc.attrs.writingPurpose).toBe("");
});

it("preserves prose and selection, separates typing history, and supports undo, redo and clearing", () => {
  let state = initial();
  state = state.apply(state.tr.insertText("고친 ", 2));
  const original = state;
  state = save(state, "뜻을 이해했으면");
  expect(state.selection.eq(original.selection)).toBe(true);
  expect(state.doc.textContent).toBe(original.doc.textContent);
  expect(state.doc.firstChild!.firstChild!.marks[0].type.name).toBe("bold");
  undo(state, (tr) => {
    state = state.apply(tr);
  });
  expect(state.doc.attrs.writingPurpose).toBe("");
  expect(state.doc.textContent).toBe(original.doc.textContent);
  redo(state, (tr) => {
    state = state.apply(tr);
  });
  expect(state.doc.attrs.writingPurpose).toBe("뜻을 이해했으면");
  state = save(state, "", "뜻을 이해했으면");
  expect(state.doc.attrs.writingPurpose).toBe("");
});

it("avoids no-op history entries and rejects a stale purpose without overwriting the current one", () => {
  let state = initial();
  expect(createWritingPurposeTransaction(state, "", "")).toEqual({ value: "" });
  state = save(state, "먼저 저장한 목적");
  expect(createWritingPurposeTransaction(state, "다른 목적", "")).toMatchObject({ conflict: true });
  expect(state.doc.attrs.writingPurpose).toBe("먼저 저장한 목적");
  expect(
    createWritingPurposeTransaction(state, "x".repeat(501), "먼저 저장한 목적"),
  ).toHaveProperty("error");
});

it("preserves purpose in draft files and keeps public HTML identical across document themes", async () => {
  const state = initial();
  const saved = save(state, "저장한 비공개 목적");
  const file = createDraftFile(saved.doc.toJSON(), preferences);
  const restored = await readDraftFile(
    { size: Buffer.byteLength(file.content), text: async () => file.content },
    schema,
  );
  expect(restored.document.attrs?.writingPurpose).toBe("저장한 비공개 목적");
  for (const documentTheme of ["cleanEditorial", "darkEditorial"] as const) {
    const options = { ...preferences, documentTheme };
    const html = await exportDocumentToDcHtml(restored.document, options);
    expect(html).toBe(await exportDocumentToDcHtml(state.doc.toJSON(), options));
    expect(html).not.toContain("저장한 비공개 목적");
  }
  const output = createCopiedOutput(
    state.doc.toJSON(),
    preferences,
    "<p>원문</p>",
    "원문",
    "preview",
  )!;
  expect(copiedOutputChanges(output, restored.document, preferences)).toEqual({
    content: false,
    appearance: false,
  });
});
