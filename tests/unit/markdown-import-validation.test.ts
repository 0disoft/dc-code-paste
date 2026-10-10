import { getSchema, type JSONContent } from "@tiptap/core";
import { expect, it } from "vitest";
import { createEditorExtensions } from "#lib/editor/extensions.ts";
import { parseMarkdownToDocument } from "#lib/editor/markdown-import.ts";
import { prepareMarkdownImportDocument } from "#lib/editor/markdown-import-validation.ts";
import { createDraftFile, maxDraftFileBytes } from "#lib/editor/draft-file.ts";
import {
  createDraftSnapshot,
  parseDraftSnapshot,
  type DraftPreferences,
} from "#lib/editor/draft-storage.ts";

const schema = getSchema(createEditorExtensions());
const preferences: DraftPreferences = {
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

it("rejects the reported many-paragraph Markdown without modifying the parsed document", () => {
  const markdown = Array.from({ length: 10_001 }, (_, index) => `문단 ${index}`).join("\n\n");
  const document = parseMarkdownToDocument(markdown);
  const original = JSON.stringify(document);
  expect(() => prepareMarkdownImportDocument(schema, document, preferences, markdown)).toThrow(
    "문서 구조가 보관 한도",
  );
  expect(JSON.stringify(document)).toBe(original);
});

it("includes the editor's trailing paragraph when checking the exact structural limit", () => {
  const paragraphs: JSONContent[] = Array.from({ length: 9_999 }, () => ({
    type: "paragraph",
    content: [{ type: "text", text: "문단" }],
  }));
  const document = { type: "doc", content: [...paragraphs, { type: "horizontalRule" }] };
  // The parsed structure fits exactly, but its insertion paragraph would exceed the limit.
  expect(
    parseDraftSnapshot(JSON.stringify(createDraftSnapshot(document, preferences))),
  ).toBeTruthy();
  expect(() => prepareMarkdownImportDocument(schema, document, preferences, "---")).toThrow(
    "보관 한도",
  );
  const accepted = prepareMarkdownImportDocument(
    schema,
    { type: "doc", content: paragraphs },
    preferences,
    "문단",
  );
  expect(
    parseDraftSnapshot(JSON.stringify(createDraftSnapshot(accepted, preferences))),
  ).toBeTruthy();
  expect(accepted.content).toHaveLength(9_999);
});

it("normalizes valid editor structures and adds a usable insertion paragraph", () => {
  const markdown = "# 제목";
  const document = prepareMarkdownImportDocument(
    schema,
    parseMarkdownToDocument(markdown),
    preferences,
    markdown,
  );
  expect(document.content?.map((node) => node.type)).toEqual(["heading", "paragraph"]);
  expect(() => schema.nodeFromJSON(document).check()).not.toThrow();
  expect(() => createDraftFile(document, preferences, markdown)).not.toThrow();
  expect(() =>
    prepareMarkdownImportDocument(
      schema,
      { type: "doc", content: [{ type: "summaryBox", content: [{ type: "paragraph" }] }] },
      preferences,
      "",
    ),
  ).toThrow("문서 구조");
});

it("permits file-backed Markdown beyond the autosave limit", () => {
  const markdown = "x".repeat(2_000_001);
  const document = prepareMarkdownImportDocument(
    schema,
    parseMarkdownToDocument(markdown),
    preferences,
    markdown,
  );
  const backup = createDraftFile(document, preferences, markdown);
  expect(parseDraftSnapshot(backup.content)).toBeUndefined();
  expect(parseDraftSnapshot(backup.content, maxDraftFileBytes)).toBeTruthy();
});

it("checks UTF-8 backup size including the retained Markdown source", () => {
  const markdown = "가".repeat(Math.ceil(maxDraftFileBytes / 6));
  expect(() =>
    prepareMarkdownImportDocument(schema, parseMarkdownToDocument(markdown), preferences, markdown),
  ).toThrow("8MB");
});
