import { expect, it } from "vitest";
import type { DraftPreferences } from "#lib/editor/draft-storage.ts";
import {
  clearCopiedOutput,
  copiedOutputChanges,
  copiedOutputStorageKey,
  createCopiedOutput,
  maxCopiedOutputChars,
  readCopiedOutput,
  writeCopiedOutput,
} from "#lib/editor/copied-output.ts";

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
const document = () => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "복사한 문장" }] }],
});
class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

it("compares published content while ignoring private notes, purpose and anchor-only text splits", () => {
  const output = createCopiedOutput(
    document(),
    preferences,
    "<p>복사한 문장</p>",
    "복사한 문장",
    "preview",
  )!;
  const privateDocument = structuredClone(output.draft.document);
  privateDocument.attrs = { writingPurpose: "목적", readingNotes: [], sentenceRelations: [] };
  privateDocument.content![0].content = [
    {
      type: "text",
      text: "복사한 ",
      marks: [{ type: "relationAnchor", attrs: { ids: ["private"] } }],
    },
    { type: "text", text: "문장" },
  ];
  expect(copiedOutputChanges(output, privateDocument, preferences)).toEqual({
    content: false,
    appearance: false,
  });
  privateDocument.content![0].content![0].marks!.push({ type: "bold" });
  expect(copiedOutputChanges(output, privateDocument, preferences).content).toBe(true);
});

it("preserves exact clipboard bytes and a separate copy of the document without changing drafts", () => {
  const storage = new MemoryStorage();
  const source = document();
  const settings = { ...preferences };
  const html =
    '<table><tr><td>복사한 문장 &amp; <a href="https://example.com/">출처</a></td></tr></table>';
  const output = createCopiedOutput(source, settings, html, "복사한 문장 & 출처", "preview")!;
  source.content[0].content[0].text = "수정한 문장";
  settings.bodyFontSize = "20px";
  storage.setItem("dc-code-paste:draft:v1", "active-draft");
  expect(writeCopiedOutput(storage, output)).toBe(true);
  const restored = readCopiedOutput(storage)!;
  expect(restored.html).toBe(html);
  expect(restored.draft.document).toEqual(document());
  expect(restored.draft.preferences.bodyFontSize).toBe("18px");
  expect(storage.getItem("dc-code-paste:draft:v1")).toBe("active-draft");
  expect(clearCopiedOutput(storage)).toBe(true);
  expect(readCopiedOutput(storage)).toBeUndefined();
  expect(storage.getItem("dc-code-paste:draft:v1")).toBe("active-draft");
});

it("distinguishes content and export settings changes while ignoring selection controls", () => {
  const output = createCopiedOutput(
    document(),
    preferences,
    "<p>복사한 문장</p>",
    "복사한 문장",
    "source",
  )!;
  expect(
    copiedOutputChanges(output, document(), {
      ...preferences,
      readingLayout: "balanced",
      selectionFontSize: "20px",
      language: "rust",
    }),
  ).toEqual({ content: false, appearance: false });
  expect(
    copiedOutputChanges(output, document(), { ...preferences, readingLayout: "airy" }),
  ).toEqual({ content: false, appearance: true });
  const modified = document();
  modified.content[0].content[0].text = "다른 문장";
  expect(copiedOutputChanges(output, modified, preferences)).toEqual({
    content: true,
    appearance: false,
  });
});

it("ignores malformed, oversized, future and unsupported records without deleting them", () => {
  const storage = new MemoryStorage();
  const valid = createCopiedOutput(
    document(),
    preferences,
    "<p>복사한 문장</p>",
    "복사한 문장",
    "preview",
  )!;
  for (const raw of [
    "broken",
    "x".repeat(maxCopiedOutputChars + 1),
    JSON.stringify({ ...valid, version: 2 }),
    JSON.stringify({ ...valid, copiedAt: "invalid-date" }),
    JSON.stringify({ ...valid, channel: "guide" }),
    JSON.stringify({ ...valid, html: "" }),
    JSON.stringify({ ...valid, draft: { ...valid.draft, document: { type: "unknown" } } }),
  ]) {
    storage.setItem(copiedOutputStorageKey, raw);
    expect(readCopiedOutput(storage)).toBeUndefined();
    expect(storage.getItem(copiedOutputStorageKey)).toBe(raw);
  }
});

it("reports failed persistence separately from the clipboard result", () => {
  const output = createCopiedOutput(
    document(),
    preferences,
    "<p>복사한 문장</p>",
    "복사한 문장",
    "preview",
  )!;
  const blocked = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("quota");
    },
    removeItem() {
      throw new Error("blocked");
    },
  };
  expect(writeCopiedOutput(blocked, output)).toBe(false);
  expect(writeCopiedOutput(undefined, output)).toBe(false);
  expect(readCopiedOutput(blocked)).toBeUndefined();
  expect(clearCopiedOutput(blocked)).toBe(false);
  const storage = new MemoryStorage();
  expect(writeCopiedOutput(storage, { ...output, html: "x".repeat(maxCopiedOutputChars) })).toBe(
    false,
  );
  expect(storage.getItem(copiedOutputStorageKey)).toBeNull();
  expect(output.html).toContain("복사한 문장");
});

it("ignores source review metadata in output comparisons while detecting changed evidence", () => {
  const original = document();
  original.content[0].content[0] = {
    ...original.content[0].content[0],
    marks: [
      {
        type: "sentenceSource",
        attrs: { href: "https://example.com/source", label: "자료", excerpt: "근거 원문" },
      },
    ],
  } as (typeof original.content)[0]["content"][0];
  const output = createCopiedOutput(
    original,
    preferences,
    "<p>복사한 문장</p>",
    "복사한 문장",
    "preview",
  )!;
  const reviewed = structuredClone(output.draft.document);
  reviewed.content![0].content![0].marks![0].attrs!.reviewKey = "100:0000000100000002";
  expect(copiedOutputChanges(output, reviewed, preferences).content).toBe(false);
  reviewed.content![0].content![0].marks![0].attrs!.excerpt = "수정된 근거";
  expect(copiedOutputChanges(output, reviewed, preferences).content).toBe(true);
});
