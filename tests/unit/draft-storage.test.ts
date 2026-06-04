import { describe, expect, it } from "vitest";
import { sampleDocument } from "../../src/lib/editor/sample-document";
import {
  clearDraftSnapshot,
  createDraftSnapshot,
  draftStorageKey,
  parseDraftSnapshot,
  readDraftSnapshot,
  writeDraftSnapshot,
  type DraftPreferences,
} from "../../src/lib/editor/draft-storage";

const preferences: DraftPreferences = {
  language: "cpp",
  theme: "github-dark",
  bodyFontFamily: "Malgun Gothic, Apple SD Gothic Neo, Segoe UI, sans-serif",
  bodyFontSize: "15px",
  selectionFontFamily: "Malgun Gothic, Apple SD Gothic Neo, Segoe UI, sans-serif",
  selectionFontSize: "15px",
  codeFontSize: "14px",
  showLineNumbers: true,
  structure: "dcTable",
};

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const throwingStorage = {
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

describe("draft storage", () => {
  it("round-trips a validated draft snapshot", () => {
    const storage = new MemoryStorage();
    const snapshot = createDraftSnapshot(sampleDocument, preferences);

    expect(writeDraftSnapshot(storage, snapshot)).toBe(true);

    const restored = readDraftSnapshot(storage);
    expect(restored?.version).toBe(1);
    expect(restored?.document).toEqual(sampleDocument);
    expect(restored?.preferences).toEqual(preferences);

    expect(clearDraftSnapshot(storage)).toBe(true);
    expect(storage.getItem(draftStorageKey)).toBeNull();
  });

  it("rejects malformed or unsupported draft payloads", () => {
    expect(parseDraftSnapshot("{")).toBeUndefined();
    expect(parseDraftSnapshot(JSON.stringify({ version: 1 }))).toBeUndefined();
    expect(
      parseDraftSnapshot(
        JSON.stringify({
          version: 1,
          updatedAt: new Date().toISOString(),
          document: { type: 123 },
          preferences,
        }),
      ),
    ).toBeUndefined();
    expect(
      parseDraftSnapshot(
        JSON.stringify({
          version: 1,
          updatedAt: new Date().toISOString(),
          document: sampleDocument,
          preferences: { ...preferences, language: "brainfuck" },
        }),
      ),
    ).toBeUndefined();
  });

  it("treats storage failures as non-fatal", () => {
    const snapshot = createDraftSnapshot(sampleDocument, preferences);

    expect(readDraftSnapshot(throwingStorage)).toBeUndefined();
    expect(writeDraftSnapshot(throwingStorage, snapshot)).toBe(false);
    expect(clearDraftSnapshot(throwingStorage)).toBe(false);
  });
});
