import { getSchema, type Editor, type JSONContent } from "@tiptap/core";
import { EditorState, TextSelection, type Transaction } from "@tiptap/pm/state";
import { closeHistory, history, redo, undo } from "@tiptap/pm/history";
import { expect, it, vi } from "vitest";
import { createEditorExtensions } from "#lib/editor/extensions.ts";
import {
  createSentenceRelationReader,
  relationAnchorCatalog,
  sentenceRelationCatalog,
} from "#lib/editor/sentence-relations.ts";
import {
  createSentenceRelationTransaction,
  mapSelectedRelationPassage,
  navigateRelationAnchor,
  removeSentenceRelationTransaction,
  selectedRelationPassage,
} from "#lib/editor/sentence-relation-commands.ts";
import {
  normalizeRelationAnchorIds,
  normalizeSentenceRelations,
  normalizeCustomRelationLabel,
  sentenceRelationLabel,
  type SentenceRelationKind,
} from "#lib/editor/sentence-relations-format.ts";
import { applyBlockAction } from "#lib/editor/block-actions.ts";
import { createDraftFile, readDraftFile } from "#lib/editor/draft-file.ts";
import { exportDocumentToDcHtml } from "#lib/dc/export-document.ts";
import type { DraftPreferences } from "#lib/editor/draft-storage.ts";

const schema = getSchema(createEditorExtensions());
const paragraph = (text: string, marks: JSONContent["marks"] = []): JSONContent => ({
  type: "paragraph",
  content: [{ type: "text", text, marks }],
});
function stateFor(content = [paragraph("주장"), paragraph("조건"), paragraph("다른 근거")]) {
  return EditorState.create({
    doc: schema.nodeFromJSON({ type: "doc", content }),
    plugins: [history()],
  });
}
function selectBlock(state: EditorState, index: number) {
  let position = 1;
  for (let before = 0; before < index; before++) position += state.doc.child(before).nodeSize;
  return state.apply(
    state.tr.setSelection(
      TextSelection.create(state.doc, position, position + state.doc.child(index).content.size),
    ),
  );
}
function connect(
  state: EditorState,
  claimIndex = 0,
  relatedIndex = 1,
  kind: SentenceRelationKind = "condition",
) {
  state = selectBlock(state, claimIndex);
  const claim = selectedRelationPassage(state)!;
  state = selectBlock(state, relatedIndex);
  const result = createSentenceRelationTransaction(state, claim, kind);
  if ("error" in result) throw new Error(result.error);
  return state.apply(result.transaction);
}

it("connects exact ranges while preserving overlapping relations, links and text", () => {
  const initial = stateFor([
    paragraph("주장", [{ type: "bold" }, { type: "link", attrs: { href: "https://example.com" } }]),
    paragraph("조건"),
    paragraph("다른 근거"),
  ]);
  const one = connect(initial);
  const two = connect(one, 0, 2, "evidence");
  two.doc.check();
  expect(two.doc.textContent).toBe(initial.doc.textContent);
  const catalog = sentenceRelationCatalog(two.doc);
  expect(catalog.map((entry) => entry.state)).toEqual(["linked", "linked"]);
  expect(catalog[0].claim.parts[0].matches[0].text).toBe("주장");
  expect(
    two.doc.firstChild!.firstChild!.marks.find((mark) => mark.type.name === "relationAnchor")!.attrs
      .ids,
  ).toHaveLength(2);
  expect(two.doc.firstChild!.firstChild!.marks.map((mark) => mark.type.name)).toEqual(
    expect.arrayContaining(["bold", "link"]),
  );
  const removed = two.apply(removeSentenceRelationTransaction(two, catalog[0].relation.id)!);
  expect(sentenceRelationCatalog(removed.doc)).toHaveLength(1);
  expect(sentenceRelationCatalog(removed.doc)[0].state).toBe("linked");
  expect(
    removed.doc.firstChild!.firstChild!.marks.find((mark) => mark.type.name === "relationAnchor")!
      .attrs.ids,
  ).toHaveLength(1);
});

it("supports multiple paragraphs and line breaks while excluding inline and block code", () => {
  let state = stateFor([
    {
      type: "paragraph",
      content: [
        { type: "text", text: "첫 구간" },
        { type: "hardBreak" },
        { type: "text", text: "다음 줄" },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "둘째" },
        { type: "text", text: "코드", marks: [{ type: "code" }] },
        { type: "text", text: "끝" },
      ],
    },
    { type: "codeBlock", content: [{ type: "text", text: "코드 블록" }] },
    paragraph("반론"),
  ]);
  const end = state.doc.child(0).nodeSize + state.doc.child(1).nodeSize - 1;
  state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1, end)));
  const claim = selectedRelationPassage(state)!;
  expect(claim.parts.map((part) => part.text)).toEqual(["첫 구간\n다음 줄", "둘째", "끝"]);
  state = selectBlock(state, 3);
  const result = createSentenceRelationTransaction(state, claim, "counterpoint");
  if ("error" in result) throw new Error(result.error);
  const connected = state.apply(result.transaction);
  connected.doc.check();
  const entry = sentenceRelationCatalog(connected.doc)[0];
  expect(entry.state).toBe("linked");
  expect(entry.claim.parts).toHaveLength(3);
  expect(connected.doc.child(2).firstChild!.marks).toEqual([]);
  expect(selectedRelationPassage(selectBlock(connected, 2))).toBeNull();
});

it("tracks actual block moves and retains records of deleted or duplicated endpoints", () => {
  let state = connect(stateFor());
  const editor = {
    schema,
    get state() {
      return state;
    },
    commands: { focus: () => true },
    view: {
      dispatch(tr: Transaction) {
        state = state.apply(tr);
      },
    },
  } as unknown as Editor;
  state = selectBlock(state, 1);
  expect(applyBlockAction(editor, "up")).toBe(true);
  const moved = sentenceRelationCatalog(state.doc)[0];
  expect(moved.state).toBe("linked");
  expect(moved.related.parts[0].matches[0].from).toBeLessThan(moved.claim.parts[0].matches[0].from);
  expect(applyBlockAction(editor, "duplicate")).toBe(true);
  expect(sentenceRelationCatalog(state.doc)[0].state).toBe("duplicated");
  expect(
    undo(state, (tr) => {
      state = state.apply(tr);
    }),
  ).toBe(true);
  expect(sentenceRelationCatalog(state.doc)[0].state).toBe("linked");
  expect(applyBlockAction(editor, "delete")).toBe(true);
  const missing = sentenceRelationCatalog(state.doc)[0];
  expect(missing.state).toBe("missing");
  expect(missing.relation.related[0].text).toBe("조건");
  expect(missing.related.parts[0].matches).toEqual([]);
});

it("maps a pending selection through changes before it and rejects changes inside it or overlapping endpoints", () => {
  let state = selectBlock(stateFor(), 1);
  const pending = selectedRelationPassage(state)!;
  const tr = state.tr.insertText("앞에 추가", 1);
  const mapped = mapSelectedRelationPassage(pending, tr)!;
  expect(mapped.parts[0].from).toBeGreaterThan(pending.parts[0].from);
  state = state.apply(tr);
  expect(
    mapSelectedRelationPassage(mapped, state.tr.insertText("바뀜", mapped.parts[0].from + 1)),
  ).toBeNull();
  const invalid = createSentenceRelationTransaction(state, mapped, "condition");
  expect(invalid).toHaveProperty("error");
  state = selectBlock(state, 2);
  expect(createSentenceRelationTransaction(state, mapped, "evidence")).toHaveProperty(
    "transaction",
  );
});

it("keeps relation creation and removal in independent undo events", () => {
  const initial = stateFor();
  let state = initial.apply(initial.tr.insertText("입력", 2));
  state = connect(state);
  state = state.apply(closeHistory(state.tr));
  expect(
    undo(state, (tr) => {
      state = state.apply(tr);
    }),
  ).toBe(true);
  expect(sentenceRelationCatalog(state.doc)).toEqual([]);
  expect(state.doc.textContent).toContain("입력");
  expect(
    redo(state, (tr) => {
      state = state.apply(tr);
    }),
  ).toBe(true);
  expect(sentenceRelationCatalog(state.doc)).toHaveLength(1);
  const id = sentenceRelationCatalog(state.doc)[0].relation.id;
  state = state.apply(removeSentenceRelationTransaction(state, id)!);
  state = state.apply(closeHistory(state.tr));
  expect(sentenceRelationCatalog(state.doc)).toEqual([]);
  expect(
    undo(state, (tr) => {
      state = state.apply(tr);
    }),
  ).toBe(true);
  expect(sentenceRelationCatalog(state.doc)[0].state).toBe("linked");
});

it("navigates unique current anchors without editing and refuses stale or duplicated copies", () => {
  let state = connect(stateFor());
  const anchor = sentenceRelationCatalog(state.doc)[0].claim.parts[0].matches[0];
  const focus = vi.fn<() => void>();
  let historyMeta: unknown;
  const editor = {
    get state() {
      return state;
    },
    view: {
      focus,
      dispatch(tr: Transaction) {
        historyMeta = tr.getMeta("addToHistory");
        state = state.apply(tr);
      },
    },
  } as unknown as Editor;
  const original = state.doc;
  expect(navigateRelationAnchor(editor, anchor)).toBe(true);
  expect(state.doc.eq(original)).toBe(true);
  expect(historyMeta).toBe(false);
  expect(state.doc.textBetween(state.selection.from, state.selection.to)).toBe("주장");
  state = state.apply(state.tr.insertText("수정", anchor.from + 1));
  expect(navigateRelationAnchor(editor, anchor)).toBe(false);
  expect(sentenceRelationCatalog(state.doc)[0].state).toBe("changed");
  expect(focus).toHaveBeenCalledOnce();
});

it("rejects malformed kinds, duplicate identities and oversized records through the document schema", () => {
  expect(normalizeRelationAnchorIds(["same", "same"])).toBeNull();
  expect(
    normalizeSentenceRelations([
      {
        id: "relation",
        kind: "unknown",
        claim: [{ id: "claim", text: "주장" }],
        related: [{ id: "related", text: "조건" }],
      },
    ]),
  ).toBeNull();
  expect(() =>
    schema
      .nodeFromJSON({
        type: "doc",
        attrs: { sentenceRelations: [{}] },
        content: [paragraph("원문")],
      })
      .check(),
  ).toThrow("Invalid sentence relations");
  expect(() =>
    schema
      .nodeFromJSON({
        type: "doc",
        content: [paragraph("원문", [{ type: "relationAnchor", attrs: { ids: ["bad id"] } }])],
      })
      .check(),
  ).toThrow("Invalid relation anchor identities");
  const state = selectBlock(stateFor([paragraph("긴".repeat(8001)), paragraph("조건")]), 0);
  expect(selectedRelationPassage(state)).toBeNull();
  const selected = selectBlock(stateFor(), 0);
  const claim = selectedRelationPassage(selected)!;
  expect(
    createSentenceRelationTransaction(selectBlock(selected, 1), claim, "condition", {
      identity: () => "same",
    }),
  ).toHaveProperty("error");
});

it("accepts named connections and rejects missing, multiline or oversized names at the schema boundary", () => {
  const initial = stateFor([paragraph("여름의 바람"), paragraph("다시 열린 창")]);
  const first = selectBlock(initial, 0);
  const passage = selectedRelationPassage(first)!;
  const target = selectBlock(first, 1);
  for (const label of [undefined, "", "  ", "두\n줄", "길".repeat(81)]) {
    expect(createSentenceRelationTransaction(target, passage, "custom", { label })).toHaveProperty(
      "error",
    );
  }
  const result = createSentenceRelationTransaction(target, passage, "custom", {
    label: "  다시 떠오르는 장면  ",
  });
  if ("error" in result) throw new Error(result.error);
  const state = target.apply(result.transaction);
  state.doc.check();
  expect(state.doc.textContent).toBe(initial.doc.textContent);
  const entry = sentenceRelationCatalog(state.doc)[0];
  expect(entry.relation.kind).toBe("custom");
  expect(sentenceRelationLabel(entry.relation)).toBe("다시 떠오르는 장면");
  for (const label of [undefined, 1, "", "두\n줄", "길".repeat(81)]) {
    expect(normalizeSentenceRelations([{ ...entry.relation, label }])).toBeNull();
    expect(() =>
      schema
        .nodeFromJSON({
          ...state.doc.toJSON(),
          attrs: { sentenceRelations: [{ ...entry.relation, label }] },
        })
        .check(),
    ).toThrow("Invalid sentence relations");
  }
  expect(normalizeCustomRelationLabel("이름\u0000제어문자")).toBeNull();
  expect(sentenceRelationLabel(connect(initial).doc.attrs.sentenceRelations[0])).toBe("조건");
});

it("roundtrips named connections in a draft while leaving partial styled HTML export byte-identical", async () => {
  let initial = stateFor([
    paragraph("주장 가운데 끝", [
      { type: "bold" },
      { type: "link", attrs: { href: "https://example.com/original" } },
    ]),
    paragraph("조건"),
  ]);
  initial = initial.apply(initial.tr.setSelection(TextSelection.create(initial.doc, 4, 7)));
  const claim = selectedRelationPassage(initial)!;
  const target = selectBlock(initial, 1);
  const result = createSentenceRelationTransaction(target, claim, "custom", {
    label: "<장면> & 이어지는 말",
  });
  if ("error" in result) throw new Error(result.error);
  const linked = target.apply(result.transaction);
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
  const backup = createDraftFile(linked.doc.toJSON(), preferences);
  const restored = await readDraftFile(
    { size: Buffer.byteLength(backup.content), text: async () => backup.content },
    schema,
  );
  expect(sentenceRelationCatalog(schema.nodeFromJSON(restored.document))[0].state).toBe("linked");
  expect(sentenceRelationCatalog(schema.nodeFromJSON(restored.document))[0].relation.label).toBe(
    "<장면> & 이어지는 말",
  );
  const options = {
    theme: "github-light" as const,
    bodyFontFamily: "Georgia",
    bodyFontSize: "18px",
    codeFontSize: "15px",
    showLineNumbers: false,
  };
  const before = await exportDocumentToDcHtml(initial.doc.toJSON(), options);
  const after = await exportDocumentToDcHtml(restored.document, options);
  expect(after).toBe(before);
  expect(after).not.toContain("relation");
  const reader = createSentenceRelationReader();
  expect(reader(linked.doc)).toBe(reader(linked.doc));
  expect(relationAnchorCatalog(linked.doc).size).toBe(2);
});
