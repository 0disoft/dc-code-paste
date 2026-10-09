import { getSchema, type JSONContent } from "@tiptap/core";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { expect, it } from "vitest";
import { createEditorExtensions } from "#lib/editor/extensions.ts";
import {
  createSentenceSourceTransaction,
  readSelectionSentenceSource,
} from "#lib/editor/sentence-source.ts";
import { normalizeSentenceSource } from "#lib/editor/sentence-source-format.ts";
import { exportDocumentToDcHtml } from "#lib/dc/export-document.ts";
import { createDraftFile, readDraftFile } from "#lib/editor/draft-file.ts";
import type { DraftPreferences } from "#lib/editor/draft-storage.ts";

const schema = getSchema(createEditorExtensions());
const source = {
  href: "https://example.com/evidence",
  label: "실험 기록",
  excerpt: "측정한 원문\n둘째 줄",
};
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
const original: JSONContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "핵심 ", marks: [{ type: "bold" }] },
        {
          type: "text",
          text: "문장",
          marks: [
            { type: "link", attrs: { href: "https://example.com/original" } },
            {
              type: "textStyle",
              attrs: { fontFamily: "Georgia", fontSize: "20px", color: "#1d4ed8" },
            },
            { type: "readingIntent", attrs: { intent: "focus" } },
          ],
        },
      ],
    },
  ],
};
function selected(document: JSONContent, from = 1, to?: number) {
  const doc = schema.nodeFromJSON(document);
  return EditorState.create({
    doc,
    selection: TextSelection.create(doc, from, to ?? doc.content.size - 1),
  });
}

it("attaches one source to styled text without replacing original links, and roundtrips through backup", async () => {
  const state = selected(original);
  const changed = state.apply(createSentenceSourceTransaction(state, source)!);
  expect(changed.doc.textContent).toBe(state.doc.textContent);
  expect(readSelectionSentenceSource(changed).source).toEqual(source);
  const file = createDraftFile(changed.doc.toJSON(), { ...preferences, readingLayout: "airy" });
  const restored = await readDraftFile(
    { size: Buffer.byteLength(file.content), text: async () => file.content },
    schema,
  );
  const html = await exportDocumentToDcHtml(restored.document, restored.preferences);
  expect(html.match(/\[출처: 실험 기록\]/g)).toHaveLength(1);
  expect(html).toContain('href="https://example.com/original"');
  expect(html).toContain('href="https://example.com/evidence"');
  expect(html).toContain("font-size:20px");
  expect(html).toContain('data-reading-intent="focus"');
  expect(html).toContain("측정한 원문");
  expect(restored.document).toEqual(changed.doc.toJSON());
  const removed = changed.apply(createSentenceSourceTransaction(changed, null)!);
  expect(removed.doc.toJSON()).toEqual(state.doc.toJSON());
});

it("updates the whole source at a cursor, and distinguishes partially sourced selections", () => {
  const state = selected(original, 1, 3);
  const changed = state.apply(createSentenceSourceTransaction(state, source)!);
  const cursor = changed.apply(changed.tr.setSelection(TextSelection.create(changed.doc, 2)));
  expect(readSelectionSentenceSource(cursor)).toMatchObject({
    source,
    from: 1,
    to: 3,
    canApply: true,
  });
  const updated = cursor.apply(
    createSentenceSourceTransaction(cursor, { ...source, label: "새 자료" })!,
  );
  expect(readSelectionSentenceSource(updated).source?.label).toBe("새 자료");
  const all = updated.apply(updated.tr.setSelection(TextSelection.create(updated.doc, 1, 6)));
  expect(readSelectionSentenceSource(all)).toMatchObject({
    mixed: true,
    hasSource: true,
    source: null,
  });
});

it("skips code while attaching and removing sources from a mixed selection", () => {
  const state = selected({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "설명" },
          { type: "text", text: "inline", marks: [{ type: "code" }] },
        ],
      },
      { type: "codeBlock", content: [{ type: "text", text: "const x = 1" }] },
      { type: "paragraph", content: [{ type: "text", text: "추가 설명" }] },
    ],
  });
  const changed = state.apply(createSentenceSourceTransaction(state, source)!);
  const json = changed.doc.toJSON();
  expect(json.content[0].content[1].marks).toEqual([{ type: "code" }]);
  expect(json.content[1]).toEqual(state.doc.toJSON().content[1]);
  expect(json.content[2].content[0].marks[0].type).toBe("sentenceSource");
  const codeOnly = selected({
    type: "doc",
    content: [{ type: "codeBlock", content: [{ type: "text", text: "code" }] }],
  });
  expect(createSentenceSourceTransaction(codeOnly, source)).toBeNull();
});

it("rejects unsafe URLs and escapes source labels and excerpts in HTML", async () => {
  for (const href of [
    "javascript:alert(1)",
    "data:text/html,unsafe",
    "mailto:test@example.com",
    "https://example.com/ bad",
  ]) {
    expect(normalizeSentenceSource({ ...source, href })).toBeNull();
    expect(createSentenceSourceTransaction(selected(original), { ...source, href })).toBeNull();
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "원문",
              marks: [{ type: "sentenceSource", attrs: { ...source, href } }],
            },
          ],
        },
      ],
    };
    expect(() => schema.nodeFromJSON(document).check()).toThrow("Invalid source URL");
    const html = await exportDocumentToDcHtml(document, preferences);
    expect(html).toContain("원문");
    expect(html).not.toContain("data-source");
    expect(html).not.toContain("[출처:");
  }
  const malicious = {
    ...source,
    label: '"><img src=x onerror=alert(1)>',
    excerpt: '"<script>alert(1)</script>',
  };
  const state = selected(original);
  const changed = state.apply(createSentenceSourceTransaction(state, malicious)!);
  const html = await exportDocumentToDcHtml(changed.doc.toJSON(), preferences);
  expect(html).not.toContain("<img");
  expect(html).not.toContain("<script");
  expect(html).toContain("&lt;img");
  expect(html).toContain("&lt;script");
});
