import { getSchema, type JSONContent } from "@tiptap/core";
import { expect, it } from "vitest";
import { createEditorExtensions } from "#lib/editor/extensions.ts";
import { createDefaultHeroBlock } from "#lib/editor/hero-block.ts";
import { createDefaultSummaryBox } from "#lib/editor/summary-box.ts";
import { parseMarkdownToDocument } from "#lib/editor/markdown-import.ts";
import { exportDocumentToDcHtml } from "#lib/dc/export-document.ts";

const schema = getSchema(createEditorExtensions());
const options = {
  theme: "github-light",
  structure: "dcTable",
  bodyFontFamily: "sans-serif",
  bodyFontSize: "18px",
  codeFontSize: "15px",
  showLineNumbers: false,
} as const;
const sampleCopy = /GO CONCURRENCY|Go 동시성|CODING GUIDE|동시성 핵심|강의 노트/;

it.each(["lightLecture", "cleanEditorial", "darkEditorial"] as const)(
  "keeps travel prose free of sample copy in the editor, text and %s HTML",
  async (documentTheme) => {
    const parsed = parseMarkdownToDocument(
      ":::hero\n봄 여행 준비\n:::\n\n:::summary\n여권 챙기기\n:::",
    );
    const document = schema.nodeFromJSON(parsed);
    document.check();
    expect(document.textContent).toBe("봄 여행 준비여권 챙기기");
    expect(document.textBetween(0, document.content.size, "\n\n")).not.toMatch(sampleCopy);
    const normalized = document.toJSON() as JSONContent;
    expect(normalized.content?.[0]?.attrs?.label).toBe("");
    expect(normalized.content?.[0]?.content).toHaveLength(1);
    expect(normalized.content?.[1]?.attrs?.label).toBe("요약");
    const html = await exportDocumentToDcHtml(normalized, { ...options, documentTheme });
    expect(html).toContain("봄 여행 준비");
    expect(html).toContain("여권 챙기기");
    expect(html).toContain("요약");
    expect(html).not.toMatch(sampleCopy);
  },
);

it("uses matching defaults for older blocks with missing labels and omits fabricated empty titles", async () => {
  const document: JSONContent = {
    type: "doc",
    content: [
      {
        type: "heroBlock",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "봄 여행 준비" }],
          },
        ],
      },
      {
        type: "summaryBox",
        content: [{ type: "summaryItem", content: [{ type: "text", text: "여권 챙기기" }] }],
      },
      { type: "heroBlock", content: [{ type: "paragraph" }] },
    ],
  };
  const rawHtml = await exportDocumentToDcHtml(document, options);
  const editorHtml = await exportDocumentToDcHtml(
    schema.nodeFromJSON(document).toJSON() as JSONContent,
    options,
  );
  expect(rawHtml).toBe(editorHtml);
  expect(rawHtml).not.toMatch(sampleCopy);
  expect(rawHtml).toContain("요약");
});

it("preserves explicitly authored labels, subtitles and sample blocks", async () => {
  const parsed = parseMarkdownToDocument(
    ":::hero\nlabel: 여행 기록\n봄 여행 준비\n출발 전에 챙길 것\n:::\n\n:::summary\nlabel: 여행 체크리스트\n여권 챙기기\n:::",
  );
  const html = await exportDocumentToDcHtml(
    schema.nodeFromJSON(parsed).toJSON() as JSONContent,
    options,
  );
  for (const text of ["여행 기록", "출발 전에 챙길 것", "여행 체크리스트"])
    expect(html).toContain(text);
  const sample = { type: "doc", content: [createDefaultHeroBlock(), createDefaultSummaryBox()] };
  expect(() => schema.nodeFromJSON(sample).check()).not.toThrow();
  const sampleHtml = await exportDocumentToDcHtml(sample, options);
  expect(sampleHtml).toContain("GO CONCURRENCY");
  expect(sampleHtml).toContain("동시성 핵심");
});
