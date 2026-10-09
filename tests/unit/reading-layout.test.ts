import { getSchema, type JSONContent } from "@tiptap/core";
import { expect, it } from "vitest";
import { createEditorExtensions } from "#lib/editor/extensions.ts";
import { createDraftFile, readDraftFile } from "#lib/editor/draft-file.ts";
import { createDraftSnapshot, normalizeDraftPreferences } from "#lib/editor/draft-storage.ts";
import { createDcExportSession, exportDocumentToDcHtml } from "#lib/dc/export-document.ts";
import { normalizeReadingLayout } from "#lib/editor/reading-layout.ts";
import type { DraftPreferences } from "#lib/editor/draft-storage.ts";

const preferences: DraftPreferences = {
  language: "javascript",
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
            { type: "readingIntent", attrs: { intent: "focus" } },
            { type: "link", attrs: { href: "https://example.com/source" } },
            {
              type: "textStyle",
              attrs: { fontSize: "20px", fontFamily: "Georgia", color: "#1d4ed8" },
            },
          ],
        },
      ],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "목록 내용" }] }],
        },
      ],
    },
    {
      type: "codeBlock",
      attrs: { language: "javascript" },
      content: [{ type: "text", text: "const value = '<safe>';" }],
    },
  ],
};

it("changes prose spacing while preserving original text, manual styles, intentions and code", async () => {
  const before = JSON.stringify(document);
  const balanced = await exportDocumentToDcHtml(document, preferences);
  const airy = await exportDocumentToDcHtml(document, { ...preferences, readingLayout: "airy" });
  expect(balanced).toContain("margin:0 0 14px");
  expect(balanced).toContain("line-height:1.72");
  expect(airy).toContain("margin:0 0 24px");
  expect(airy).toContain("line-height:1.95");
  expect(airy).toContain("padding:0 0 12px");
  for (const html of [balanced, airy]) {
    expect(html).toContain("원문 &lt;그대로&gt; &amp; 유지");
    expect(html).toContain('href="https://example.com/source"');
    expect(html).toContain('data-reading-intent="focus"');
    expect(html).toContain("font-size:20px");
    expect(html).toContain("Georgia");
    expect(html).toContain("#1d4ed8");
  }
  const code = document.content!.at(-1)!;
  expect(await exportDocumentToDcHtml({ type: "doc", content: [code] }, preferences)).toBe(
    await exportDocumentToDcHtml(
      { type: "doc", content: [code] },
      { ...preferences, readingLayout: "airy" },
    ),
  );
  expect(JSON.stringify(document)).toBe(before);
});

it("retains the chosen layout through snapshots and file backup, with a safe legacy default", async () => {
  const schema = getSchema(createEditorExtensions());
  for (const readingLayout of ["balanced", "airy"] as const) {
    const snapshot = createDraftSnapshot(document, { ...preferences, readingLayout });
    const file = createDraftFile(snapshot.document, snapshot.preferences);
    const restored = await readDraftFile(
      { size: Buffer.byteLength(file.content), text: async () => file.content },
      schema,
    );
    expect(restored.preferences.readingLayout).toBe(readingLayout);
    expect(restored.document).toEqual(schema.nodeFromJSON(document).toJSON());
  }
  expect(normalizeReadingLayout(normalizeDraftPreferences(preferences)?.readingLayout)).toBe(
    "balanced",
  );
  expect(
    normalizeDraftPreferences({ ...preferences, readingLayout: '"><script>alert(1)</script>' })
      ?.readingLayout,
  ).toBe("balanced");
});

it("renders both candidates independently in a shared export cache", async () => {
  const session = createDcExportSession();
  try {
    const [balanced, airy] = await Promise.all([
      session.exportDocument(document, { ...preferences, readingLayout: "balanced" }),
      session.exportDocument(document, { ...preferences, readingLayout: "airy" }),
    ]);
    expect(airy).not.toBe(balanced);
    expect(await session.exportDocument(document, preferences)).toBe(balanced);
    expect(await session.exportDocument(document, { ...preferences, readingLayout: "airy" })).toBe(
      airy,
    );
  } finally {
    session.dispose();
  }
});
