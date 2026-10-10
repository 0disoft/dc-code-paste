import { expect, it } from "vitest";
import { getSchema, type Editor, type JSONContent } from "@tiptap/core";
import { EditorState, TextSelection, type Transaction } from "@tiptap/pm/state";
import { closeHistory, history, undo, redo } from "@tiptap/pm/history";
import { createEditorExtensions } from "#lib/editor/extensions.ts";
import {
  createReadingNoteTransaction,
  readingExperimentUnits,
  removeReadingNoteTransaction,
} from "#lib/editor/reading-experiment.ts";
import { readingNoteCatalog, visibleReadingNotes } from "#lib/editor/reading-notes.ts";
import { normalizeReadingNotes } from "#lib/editor/reading-notes-format.ts";
import {
  createSentenceRelationTransaction,
  selectedRelationPassage,
} from "#lib/editor/sentence-relation-commands.ts";
import { sentenceRelationCatalog } from "#lib/editor/sentence-relations.ts";
import { applyBlockAction } from "#lib/editor/block-actions.ts";
import { exportDocumentToDcHtml } from "#lib/dc/export-document.ts";
import { createDraftFile, readDraftFile } from "#lib/editor/draft-file.ts";
import type { DraftPreferences } from "#lib/editor/draft-storage.ts";

const schema = getSchema(createEditorExtensions());
const paragraph = (text: string): JSONContent => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});
function initial(content: JSONContent[] = [paragraph("앞 문장"), paragraph("뒤 문장")]) {
  return EditorState.create({
    doc: schema.nodeFromJSON({ type: "doc", content }),
    plugins: [history()],
  });
}
function add(state: EditorState, index = 0, text = "이 말은 어디에서 나온 걸까?") {
  const result = createReadingNoteTransaction(state, readingExperimentUnits(state)[index], text);
  if ("error" in result) throw new Error(result.error);
  const saved = state.apply(result.transaction);
  return saved.apply(closeHistory(saved.tr));
}

it("reveals notes only after every linked passage is visible and hides them again on restart", () => {
  const state = add(add(initial(), 0, "앞 메모"), 1, "뒤 메모");
  const units = readingExperimentUnits(state);
  const catalog = readingNoteCatalog(state.doc);
  expect(visibleReadingNotes(catalog, [], false)).toEqual([]);
  expect(visibleReadingNotes(catalog, units.slice(0, 1), false)).toEqual([catalog[0]]);
  expect(visibleReadingNotes(catalog, units, true)).toEqual(catalog);
  expect(visibleReadingNotes(catalog, units.slice(0, 1), false)).toEqual([catalog[0]]);
  const mixed = { ...catalog[0], parts: [...catalog[0].parts, ...catalog[1].parts] };
  expect(visibleReadingNotes([mixed], units.slice(0, 1), false)).toEqual([]);
  expect(visibleReadingNotes([mixed], units, false)).toEqual([mixed]);
});

it("withholds missing and duplicated snapshots until the whole document is revealed", () => {
  const saved = add(initial());
  const missing = saved.apply(saved.tr.delete(0, saved.doc.firstChild!.nodeSize));
  const duplicated = saved.apply(saved.tr.insert(saved.doc.content.size, saved.doc.firstChild!));
  for (const state of [missing, duplicated]) {
    const catalog = readingNoteCatalog(state.doc);
    expect(catalog[0].state).toBe(state === missing ? "missing" : "duplicated");
    expect(visibleReadingNotes(catalog, readingExperimentUnits(state), false)).toEqual([]);
    expect(visibleReadingNotes(catalog, readingExperimentUnits(state), true)).toEqual(catalog);
  }
});

it("uses current ranges for edited notes and does not expose a partially visible anchor", () => {
  const saved = add(initial(), 1);
  const state = saved.apply(
    saved.tr.insertText("修正", readingExperimentUnits(saved)[1].position + 2),
  );
  const units = readingExperimentUnits(state);
  const catalog = readingNoteCatalog(state.doc);
  expect(catalog[0].state).toBe("changed");
  expect(visibleReadingNotes(catalog, units.slice(0, 1), false)).toEqual([]);
  expect(visibleReadingNotes(catalog, units, false)).toEqual(catalog);
  const crossing = {
    ...catalog[0],
    parts: [{ ...catalog[0].parts[0], matches: [{ ...catalog[0].parts[0].matches[0], from: 1 }] }],
  };
  expect(visibleReadingNotes([crossing], units.slice(0, 1), false)).toEqual([]);
});

it("builds ordered reading units, retains explicit intentions, and excludes code and dividers from note targets", () => {
  const state = initial([
    paragraph("먼저"),
    { type: "horizontalRule" },
    { type: "codeBlock", content: [{ type: "text", text: "  return value;" }] },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "표시한 근거",
          marks: [{ type: "readingIntent", attrs: { intent: "evidence" } }],
        },
      ],
    },
  ]);
  const units = readingExperimentUnits(state);
  expect(units.map((unit) => unit.index)).toEqual([0, 1, 2, 3]);
  expect(units.map((unit) => unit.canNote)).toEqual([true, false, false, true]);
  expect(units[2].text).toBe("  return value;");
  expect(units[3].intentions).toEqual(["evidence"]);
  expect(createReadingNoteTransaction(state, units[1], "구분선")).toHaveProperty("error");
  expect(createReadingNoteTransaction(state, units[2], "코드")).toHaveProperty("error");
});

it("stores multiline notes without changing prose, selection, links or formatting", () => {
  const state = initial([
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "문장 앞",
          marks: [{ type: "bold" }, { type: "link", attrs: { href: "https://example.com" } }],
        },
        { type: "text", text: "인라인 코드", marks: [{ type: "code" }] },
        { type: "text", text: "문장 뒤" },
      ],
    },
  ]);
  const saved = add(state, 0, "  왜?\n누가?  ");
  saved.doc.check();
  expect(saved.doc.textContent).toBe(state.doc.textContent);
  expect(saved.selection.eq(state.selection)).toBe(true);
  expect(saved.doc.firstChild!.firstChild!.marks.map((mark) => mark.type.name)).toEqual(
    expect.arrayContaining(["bold", "link"]),
  );
  const entry = readingNoteCatalog(saved.doc)[0];
  expect(entry.note.text).toBe("왜?\n누가?");
  expect(entry.note.parts.map((part) => part.text)).toEqual(["문장 앞", "문장 뒤"]);
  expect(entry.state).toBe("linked");
});

it("preserves relation anchors while adding, undoing and removing a reading note", () => {
  let state = initial();
  const from = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1, 5)));
  const passage = selectedRelationPassage(from)!;
  state = from.apply(from.tr.setSelection(TextSelection.create(from.doc, 7, 11)));
  const relation = createSentenceRelationTransaction(state, passage, "condition");
  if ("error" in relation) throw new Error(relation.error);
  state = state.apply(relation.transaction);
  state = add(state);
  const id = readingNoteCatalog(state.doc)[0].note.id;
  expect(sentenceRelationCatalog(state.doc)[0].state).toBe("linked");
  expect(
    undo(state, (tr) => {
      state = state.apply(tr);
    }),
  ).toBe(true);
  expect(readingNoteCatalog(state.doc)).toEqual([]);
  expect(sentenceRelationCatalog(state.doc)[0].state).toBe("linked");
  expect(
    redo(state, (tr) => {
      state = state.apply(tr);
    }),
  ).toBe(true);
  state = state.apply(removeReadingNoteTransaction(state, id)!);
  expect(readingNoteCatalog(state.doc)).toEqual([]);
  expect(sentenceRelationCatalog(state.doc)[0].state).toBe("linked");
});

it("tracks moves, edits, duplicates and missing passages without inventing a target", () => {
  let state = add(initial());
  const entry = readingNoteCatalog(state.doc)[0];
  state = state.apply(state.tr.insertText("고친", entry.parts[0].matches[0].from + 1));
  expect(readingNoteCatalog(state.doc)[0].state).toBe("changed");
  expect(
    undo(state, (tr) => {
      state = state.apply(tr);
    }),
  ).toBe(true);
  const editor = {
    get state() {
      return state;
    },
    schema,
    commands: { focus: () => true },
    view: {
      dispatch(tr: Transaction) {
        state = state.apply(tr);
      },
    },
  } as unknown as Editor;
  state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 2)));
  expect(applyBlockAction(editor, "down")).toBe(true);
  expect(readingNoteCatalog(state.doc)[0].state).toBe("linked");
  expect(applyBlockAction(editor, "duplicate")).toBe(true);
  expect(readingNoteCatalog(state.doc)[0].state).toBe("duplicated");
  expect(readingNoteCatalog(state.doc)[0].parts[0].matches).toHaveLength(2);
  expect(
    undo(state, (tr) => {
      state = state.apply(tr);
    }),
  ).toBe(true);
  expect(applyBlockAction(editor, "delete")).toBe(true);
  const missing = readingNoteCatalog(state.doc)[0];
  expect(missing.state).toBe("missing");
  expect(missing.parts[0].matches).toEqual([]);
  expect(missing.parts[0].reference.text).toBe("앞 문장");
});

it("rejects stale units and malformed or oversized saved notes through the document schema", () => {
  let state = initial();
  const unit = readingExperimentUnits(state)[0];
  state = state.apply(state.tr.insertText("수정", 2));
  expect(createReadingNoteTransaction(state, unit, "메모")).toHaveProperty("error");
  expect(
    createReadingNoteTransaction(state, readingExperimentUnits(state)[0], "x".repeat(2001)),
  ).toHaveProperty("error");
  const valid = readingNoteCatalog(add(initial()).doc)[0].note;
  for (const note of [
    { ...valid, text: "" },
    { ...valid, text: "x".repeat(2001) },
    { ...valid, createdAt: "unknown" },
    { ...valid, parts: [] },
    { ...valid, parts: [{ id: "bad id", text: "본문" }] },
  ]) {
    expect(normalizeReadingNotes([note])).toBeNull();
    expect(() =>
      schema
        .nodeFromJSON({
          type: "doc",
          attrs: { readingNotes: [note] },
          content: [paragraph("본문")],
        })
        .check(),
    ).toThrow("Invalid reading notes");
  }
});

it("roundtrips private reading notes in a draft and preserves byte-identical exported HTML", async () => {
  const state = initial();
  const saved = add(state);
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
  const file = createDraftFile(saved.doc.toJSON(), preferences);
  const restored = await readDraftFile(
    { size: Buffer.byteLength(file.content), text: async () => file.content },
    schema,
  );
  expect(readingNoteCatalog(schema.nodeFromJSON(restored.document))[0]).toMatchObject({
    state: "linked",
    note: { text: "이 말은 어디에서 나온 걸까?" },
  });
  const options = {
    theme: preferences.theme,
    bodyFontFamily: preferences.bodyFontFamily,
    bodyFontSize: preferences.bodyFontSize,
    codeFontSize: preferences.codeFontSize,
    showLineNumbers: false,
  };
  expect(await exportDocumentToDcHtml(restored.document, options)).toBe(
    await exportDocumentToDcHtml(state.doc.toJSON(), options),
  );
});
