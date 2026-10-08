import { getSchema } from "@tiptap/core";
import { expect, it } from "vitest";
import { createEditorExtensions } from "../../src/lib/editor/extensions";
import { createWritingTemplate } from "../../src/lib/editor/writing-templates";
import { createDraftFile, readDraftFile, maxDraftFileBytes } from "../../src/lib/editor/draft-file";
import type { DraftPreferences } from "../../src/lib/editor/draft-storage";
import { parseDraftSnapshot } from "../../src/lib/editor/draft-storage";

const schema = getSchema(createEditorExtensions());
const preferences: DraftPreferences = {
  language: "python",
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
const file = (text: string) => ({ size: Buffer.byteLength(text), text: async () => text });

it("round-trips a portable draft with its block appearance and preferences", async () => {
  const document = createWritingTemplate("news");
  document.content![1]!.attrs = {
    label: "要約",
    tone: "green",
    alignment: "right",
    spacing: "compact",
  };
  const backup = createDraftFile(document, preferences);
  expect(backup.filename).toMatch(/^dc-code-paste-.*\.json$/);
  const loaded = await readDraftFile(file(backup.content), schema);
  expect(loaded.preferences).toEqual(preferences);
  expect(loaded.document.content![1]!.attrs).toMatchObject(document.content![1]!.attrs!);
  expect(schema.nodeFromJSON(loaded.document).textContent).toBe(
    schema.nodeFromJSON(document).textContent,
  );
});

it("rejects malformed, incompatible and oversized files", async () => {
  await expect(readDraftFile(file("{broken"), schema)).rejects.toThrow("JSON");
  const document = createWritingTemplate("news");
  document.content![1]!.content = [{ type: "paragraph" }];
  const backup = createDraftFile(document, preferences);
  await expect(readDraftFile(file(backup.content), schema)).rejects.toThrow("문서 구조");
  let read = false;
  await expect(
    readDraftFile(
      {
        size: maxDraftFileBytes + 1,
        text: async () => {
          read = true;
          return "";
        },
      },
      schema,
    ),
  ).rejects.toThrow("8MB");
  expect(read).toBe(false);
});

it("round-trips a long Korean file below 8MB even when it exceeds the browser draft limit", async () => {
  const text = "가".repeat(2_000_001);
  const document = {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
  const backup = createDraftFile(document, preferences);
  expect(Buffer.byteLength(backup.content, "utf8")).toBeLessThan(maxDraftFileBytes);
  // Automatic browser storage retains its own smaller limit.
  expect(parseDraftSnapshot(backup.content)).toBeUndefined();
  const loaded = await readDraftFile(file(backup.content), schema);
  expect(schema.nodeFromJSON(loaded.document).textContent).toBe(text);
  expect(loaded.preferences).toEqual(preferences);
});

it("reports a UTF-8 file size limit before producing an oversized Korean backup", () => {
  const text = "가".repeat(Math.ceil(maxDraftFileBytes / 3));
  const document = {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
  expect(() => createDraftFile(document, preferences)).toThrow("8MB");
});

it("reads a whitespace-heavy valid JSON file using the file limit", async () => {
  const backup = createDraftFile(createWritingTemplate("news"), preferences);
  const raw = `${" ".repeat(2_000_001)}${backup.content}`;
  expect(Buffer.byteLength(raw, "utf8")).toBeLessThan(maxDraftFileBytes);
  const loaded = await readDraftFile(file(raw), schema);
  expect(loaded.preferences).toEqual(preferences);
});
