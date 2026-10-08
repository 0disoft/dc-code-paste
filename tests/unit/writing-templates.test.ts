import { getSchema } from "@tiptap/core";
import { expect, it } from "vitest";
import { createEditorExtensions } from "../../src/lib/editor/extensions";
import { createWritingTemplate, writingTemplates } from "../../src/lib/editor/writing-templates";
import { exportDocumentToDcHtml } from "../../src/lib/dc/export-document";

it.each(writingTemplates)(
  "opens and exports the $label template without losing blocks",
  async ({ id }) => {
    const document = createWritingTemplate(id);
    const schema = getSchema(createEditorExtensions());
    const node = schema.nodeFromJSON(document);
    expect(() => node.check()).not.toThrow();
    const html = await exportDocumentToDcHtml(document, {
      theme: "github-light",
    documentTheme: "cleanEditorial",
    bodyFontFamily: "sans-serif",
      bodyFontSize: "18px",
      codeFontSize: "15px",
      showLineNumbers: false,
    });
    expect(html).toContain(node.firstChild!.firstChild!.textContent);
    expect(html).toContain("핵심 요약");
    expect(html).toContain(id === "howto" ? "결과 확인하기" : node.lastChild!.textContent);
  },
);
