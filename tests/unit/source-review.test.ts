import { getSchema, type JSONContent } from "@tiptap/core";
import { EditorState, TextSelection, type Transaction } from "@tiptap/pm/state";
import { closeHistory, history, redo, undo } from "@tiptap/pm/history";
import { expect, it } from "vitest";
import { createEditorExtensions } from "#lib/editor/extensions.ts";
import {
  createSentenceSourceTransaction,
  createSourceReviewTransaction,
  readSelectionSourceReview,
} from "#lib/editor/sentence-source.ts";
import { documentSourceCatalog } from "#lib/editor/document-sources.ts";
import { createDraftFile, readDraftFile } from "#lib/editor/draft-file.ts";
import { exportDocumentToDcHtml } from "#lib/dc/export-document.ts";
import type { DraftPreferences } from "#lib/editor/draft-storage.ts";

const schema = getSchema(createEditorExtensions());
const source = { href: "https://example.com/source", label: "실험 자료", excerpt: "실험 원문" };
const preferences: DraftPreferences = {
  language: "javascript",
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
const document: JSONContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "검토할 ", marks: [{ type: "bold" }] },
        {
          type: "text",
          text: "문장",
          marks: [{ type: "link", attrs: { href: "https://example.com/original" } }],
        },
      ],
    },
  ],
};
function selected(value: JSONContent, withHistory = false) {
  const doc = schema.nodeFromJSON(value);
  return EditorState.create({
    doc,
    selection: TextSelection.create(doc, 1, doc.content.size - 1),
    plugins: withHistory ? [history()] : [],
  });
}

it("detects text edits and restoration while ignoring styling and retaining source metadata", () => {
  const state = selected(document);
  const connected = state.apply(createSentenceSourceTransaction(state, source)!);
  expect(readSelectionSourceReview(connected)).toMatchObject({
    changedCount: 0,
    untrackedCount: 0,
  });
  const styled = connected.apply(connected.tr.addMark(2, 4, schema.marks.italic.create()));
  expect(readSelectionSourceReview(styled).mentions[0].review).toBe("unchanged");
  const edited = styled.apply(styled.tr.insertText("다르게", 2, 3));
  expect(readSelectionSourceReview(edited)).toMatchObject({ changedCount: 1, untrackedCount: 0 });
  const mention = documentSourceCatalog(edited.doc)[0].mentions[0];
  expect(mention).toMatchObject({
    label: source.label,
    excerpt: source.excerpt,
    review: "changed",
  });
  const restored = edited.apply(edited.tr.insertText("토", 2, 5));
  expect(documentSourceCatalog(restored.doc)[0].mentions[0].review).toBe("unchanged");
});

it("refreshes the entire connected run from a partial selection, with independent undo and redo", () => {
  let state = selected(document, true);
  state = state.apply(createSentenceSourceTransaction(state, source)!);
  state = state.apply(closeHistory(state.tr));
  state = state.apply(state.tr.insertText("고친", 2, 3));
  state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 2, 3)));
  const content = state.doc.textContent;
  state = state.apply(createSourceReviewTransaction(state)!);
  state = state.apply(closeHistory(state.tr));
  expect(state.doc.textContent).toBe(content);
  expect(documentSourceCatalog(state.doc)[0].mentions).toHaveLength(1);
  expect(documentSourceCatalog(state.doc)[0].mentions[0].review).toBe("unchanged");
  const dispatch = (tr: Transaction) => {
    state = state.apply(tr);
  };
  expect(undo(state, dispatch)).toBe(true);
  expect(state.doc.textContent).toBe(content);
  expect(documentSourceCatalog(state.doc)[0].mentions[0].review).toBe("changed");
  expect(redo(state, dispatch)).toBe(true);
  expect(state.doc.textContent).toBe(content);
  expect(documentSourceCatalog(state.doc)[0].mentions[0].review).toBe("unchanged");
});

it("creates independent baselines across prose blocks and inline code gaps", () => {
  const state = selected({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "앞 구간" },
          { type: "text", text: "code", marks: [{ type: "code" }] },
          { type: "text", text: "뒤 구간" },
        ],
      },
      { type: "codeBlock", content: [{ type: "text", text: "const x = 1" }] },
      { type: "paragraph", content: [{ type: "text", text: "다음 문단" }] },
    ],
  });
  const connected = state.apply(createSentenceSourceTransaction(state, source)!);
  const mentions = documentSourceCatalog(connected.doc)[0].mentions;
  expect(mentions.map((mention) => [mention.text, mention.review])).toEqual([
    ["앞 구간", "unchanged"],
    ["뒤 구간", "unchanged"],
    ["다음 문단", "unchanged"],
  ]);
  expect(createSourceReviewTransaction(connected)).toBeNull();
});

it("checks text beyond the catalog excerpt without duplicating whole passages in mark attributes", () => {
  const long = `${"긴 문장 ".repeat(100)}마지막 단어`;
  const state = selected({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: long }] }],
  });
  const connected = state.apply(createSentenceSourceTransaction(state, source)!);
  const entry = documentSourceCatalog(connected.doc)[0].mentions[0];
  expect(entry.text).toHaveLength(220);
  const edited = connected.apply(connected.tr.insertText("수정", 300, 302));
  expect(documentSourceCatalog(edited.doc)[0].mentions[0].review).toBe("changed");
  expect(documentSourceCatalog(edited.doc)[0].mentions[0].text).toBe(entry.text);
  expect(connected.doc.child(0).child(0).marks[0].attrs.reviewKey.length).toBeLessThan(64);
});

it("keeps adjacent identical passages independently tracked when each is connected separately", () => {
  let state = selected({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "문장문장" }] }],
  });
  state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1, 3)));
  state = state.apply(createSentenceSourceTransaction(state, source)!);
  state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 3, 5)));
  state = state.apply(createSentenceSourceTransaction(state, source)!);
  const mentions = documentSourceCatalog(state.doc)[0].mentions;
  expect(mentions.map((mention) => [mention.text, mention.review])).toEqual([
    ["문장", "unchanged"],
    ["문장", "unchanged"],
  ]);
  state = state.apply(state.tr.insertText("수정", 2, 3));
  expect(documentSourceCatalog(state.doc)[0].mentions.map((mention) => mention.review)).toEqual([
    "changed",
    "unchanged",
  ]);
});

it("keeps legacy sources untracked until explicitly refreshed and roundtrips the baseline in a draft", async () => {
  const legacy = structuredClone(document);
  for (const node of legacy.content![0].content!)
    node.marks = [...(node.marks ?? []), { type: "sentenceSource", attrs: source }];
  const state = selected(legacy);
  expect(readSelectionSourceReview(state)).toMatchObject({ changedCount: 0, untrackedCount: 1 });
  const reviewed = state.apply(createSourceReviewTransaction(state)!);
  const file = createDraftFile(reviewed.doc.toJSON(), preferences);
  const restored = await readDraftFile(
    { size: Buffer.byteLength(file.content), text: async () => file.content },
    schema,
  );
  expect(documentSourceCatalog(schema.nodeFromJSON(restored.document))[0].mentions[0].review).toBe(
    "unchanged",
  );
  const html = await exportDocumentToDcHtml(restored.document, preferences);
  expect(html.match(/\[출처: 실험 자료\]/g)).toHaveLength(1);
  expect(html).not.toContain("data-source-review");
  expect(html).toContain('href="https://example.com/original"');
});
