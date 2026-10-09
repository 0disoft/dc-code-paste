import { getSchema, type JSONContent } from "@tiptap/core";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { expect, it } from "vitest";
import { createEditorExtensions } from "#lib/editor/extensions.ts";
import { readingIntentOptions } from "#lib/editor/reading-intent-format.ts";
import { readSelectionReadingIntent } from "#lib/editor/reading-intent.ts";
import { createDraftFile, readDraftFile } from "#lib/editor/draft-file.ts";
import { exportDocumentToDcHtml } from "#lib/dc/export-document.ts";
import type { DraftPreferences } from "#lib/editor/draft-storage.ts";

const schema = getSchema(createEditorExtensions());
const preferences: DraftPreferences = {
  language: "python",
  theme: "github-light",
  bodyFontFamily: "Georgia",
  bodyFontSize: "18px",
  selectionFontFamily: "Georgia",
  selectionFontSize: "20px",
  codeFontSize: "15px",
  showLineNumbers: false,
  documentTheme: "cleanEditorial",
  structure: "dcTable",
};
const plain = (text: string): JSONContent => ({ type: "text", text });

for (const { value: intent, label } of readingIntentOptions) {
  it(`preserves ${intent} with original text, links and manual styling through backup and export`, async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "원문 <그대로> & 유지",
              marks: [
                { type: "readingIntent", attrs: { intent } },
                { type: "bold" },
                { type: "link", attrs: { href: "https://example.com/source" } },
                {
                  type: "textStyle",
                  attrs: { fontSize: "20px", fontFamily: "Georgia", color: "#1d4ed8" },
                },
              ],
            },
          ],
        },
      ],
    };
    const backup = createDraftFile(document, preferences);
    const loaded = await readDraftFile(
      { size: Buffer.byteLength(backup.content), text: async () => backup.content },
      schema,
    );
    const restored = schema.nodeFromJSON(loaded.document);
    expect(restored.textContent).toBe("원문 <그대로> & 유지");
    const state = EditorState.create({
      doc: restored,
      selection: TextSelection.create(restored, 1, restored.content.size - 1),
    });
    expect(readSelectionReadingIntent(state)).toEqual({ intent, mixed: false, canApply: true });
    const html = await exportDocumentToDcHtml(loaded.document, preferences);
    expect(html).toContain(`data-reading-intent="${intent}"`);
    expect(html).toContain(`title="${label}"`);
    expect(html).toContain("font-size:20px");
    expect(html).toContain('href="https://example.com/source"');
    expect(html).toContain("원문 &lt;그대로&gt; &amp; 유지");
  });
}

it("reports mixed intentions and refuses a selection made entirely of code", () => {
  const doc = schema.nodeFromJSON({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          plain("일반"),
          { ...plain("핵심"), marks: [{ type: "readingIntent", attrs: { intent: "focus" } }] },
        ],
      },
      { type: "codeBlock", content: [plain("const x = 1")] },
    ],
  });
  const state = EditorState.create({ doc, selection: TextSelection.create(doc, 1, 5) });
  expect(readSelectionReadingIntent(state)).toEqual({ intent: null, mixed: true, canApply: true });
  const codeSelection = state.apply(
    state.tr.setSelection(TextSelection.create(doc, 7, doc.content.size - 1)),
  );
  expect(readSelectionReadingIntent(codeSelection).canApply).toBe(false);
});

it("rejects unknown intention attributes and never exports them as markup", async () => {
  const document: JSONContent = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            ...plain("원문"),
            marks: [{ type: "readingIntent", attrs: { intent: '"><script>unsafe</script>' } }],
          },
        ],
      },
    ],
  };
  expect(() => schema.nodeFromJSON(document).check()).toThrow("Invalid reading intent");
  const html = await exportDocumentToDcHtml(document, preferences);
  expect(html).toContain("원문");
  expect(html).not.toContain("script");
  expect(html).not.toContain("data-reading-intent");
});
