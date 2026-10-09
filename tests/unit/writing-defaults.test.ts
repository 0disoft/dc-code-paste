import { expect, it } from "vitest";
import {
  clearWritingDefaults,
  normalizeWritingAppearance,
  readWritingDefaults,
  writeWritingDefaults,
  writingDefaultsStorageKey,
} from "#lib/editor/writing-defaults.ts";
import { defaultProseFontFamily } from "#lib/dc/font-stacks.ts";

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
const appearance = {
  bodyFontFamily: "Georgia,Batang,serif",
  bodyFontSize: "20px",
  documentTheme: "darkEditorial",
  readingLayout: "airy",
} as const;

it("stores only writing appearance and leaves the active draft, history and other preferences untouched", () => {
  const storage = new MemoryStorage();
  storage.setItem("dc-code-paste:draft:v1", "original-draft");
  storage.setItem("dc-code-paste:draft-history:v1", "original-history");
  expect(
    writeWritingDefaults(storage, {
      ...appearance,
      document: { type: "doc" },
      language: "python",
      llmApiKey: "excluded-value",
    }),
  ).toEqual(appearance);
  expect(readWritingDefaults(storage)).toEqual(appearance);
  expect(storage.getItem(writingDefaultsStorageKey)).not.toContain("excluded-value");
  expect(storage.getItem("dc-code-paste:draft:v1")).toBe("original-draft");
  expect(storage.getItem("dc-code-paste:draft-history:v1")).toBe("original-history");
  expect(clearWritingDefaults(storage)).toBe(true);
  expect(readWritingDefaults(storage)).toBeUndefined();
  expect(storage.getItem("dc-code-paste:draft:v1")).toBe("original-draft");
});

it("keeps complete and custom font stacks without changing the user's choice", () => {
  for (const bodyFontFamily of [
    defaultProseFontFamily,
    "Custom Font,Georgia,serif",
    '"Noto Serif KR",serif',
  ]) {
    expect(normalizeWritingAppearance({ ...appearance, bodyFontFamily })?.bodyFontFamily).toBe(
      bodyFontFamily,
    );
  }
});

it("ignores corrupt, oversized, future and unsupported remembered settings", () => {
  const storage = new MemoryStorage();
  for (const raw of [
    "broken-json",
    "x".repeat(5000),
    JSON.stringify({ version: 2, appearance }),
    JSON.stringify({ version: 1, appearance: { ...appearance, bodyFontSize: "100px" } }),
    JSON.stringify({ version: 1, appearance: { ...appearance, documentTheme: "unknown" } }),
  ]) {
    storage.setItem(writingDefaultsStorageKey, raw);
    expect(readWritingDefaults(storage)).toBeUndefined();
    expect(storage.getItem(writingDefaultsStorageKey)).toBe(raw);
  }
  for (const changes of [
    { bodyFontFamily: "Font; color:red" },
    { bodyFontFamily: "<script>" },
    { bodyFontSize: "20px;display:none" },
    { readingLayout: "unknown" },
  ]) {
    expect(writeWritingDefaults(storage, { ...appearance, ...changes })).toBeUndefined();
  }
});

it("reports blocked or unconfirmed storage writes instead of claiming they were saved", () => {
  const blocked = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
    removeItem() {
      throw new Error("blocked");
    },
  };
  const ignored = {
    getItem() {
      return null;
    },
    setItem() {},
    removeItem() {},
  };
  expect(writeWritingDefaults(blocked, appearance)).toBeUndefined();
  expect(readWritingDefaults(blocked)).toBeUndefined();
  expect(clearWritingDefaults(blocked)).toBe(false);
  expect(writeWritingDefaults(ignored, appearance)).toBeUndefined();
  expect(writeWritingDefaults(undefined, appearance)).toBeUndefined();
  expect(clearWritingDefaults(undefined)).toBe(false);
});
