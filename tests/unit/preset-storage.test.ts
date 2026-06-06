import { describe, expect, it } from "vitest";
import { sampleDocument } from "../../src/lib/editor/sample-document";
import type { DraftPreferences } from "../../src/lib/editor/draft-storage";
import {
  clearPresetSnapshots,
  createPresetSnapshot,
  deletePresetSnapshot,
  maxPresetCount,
  parsePresetSnapshots,
  presetStorageKey,
  readPresetSnapshots,
  writePresetSnapshots,
} from "../../src/lib/editor/preset-storage";

const preferences: DraftPreferences = {
  language: "cpp",
  theme: "github-dark",
  bodyFontFamily: "Malgun Gothic, Apple SD Gothic Neo, Segoe UI, sans-serif",
  bodyFontSize: "15px",
  selectionFontFamily: "Malgun Gothic, Apple SD Gothic Neo, Segoe UI, sans-serif",
  selectionFontSize: "15px",
  codeFontSize: "14px",
  showLineNumbers: true,
  documentTheme: "darkEditorial",
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

describe("preset storage", () => {
  it("round-trips named document presets", () => {
    const storage = new MemoryStorage();
    const preset = createPresetSnapshot("  강의글   구조  ", sampleDocument, preferences);

    expect(writePresetSnapshots(storage, [preset])).toBe(true);

    const restored = readPresetSnapshots(storage);
    expect(restored).toHaveLength(1);
    expect(restored[0]?.name).toBe("강의글 구조");
    expect(restored[0]?.document).toEqual(sampleDocument);
    expect(restored[0]?.preferences).toEqual(preferences);
    expect(storage.getItem(presetStorageKey)).toContain("강의글 구조");
  });

  it("drops malformed presets and limits the stored list", () => {
    const presets = Array.from({ length: maxPresetCount + 4 }, (_, index) =>
      createPresetSnapshot(`프리셋 ${index}`, sampleDocument, preferences),
    );
    const serialized = JSON.stringify({
      version: 1,
      presets: [
        ...presets,
        {
          version: 1,
          id: "bad",
          name: "깨진 프리셋",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          document: { type: 123 },
          preferences,
        },
      ],
    });

    const parsed = parsePresetSnapshots(serialized);

    expect(parsed).toHaveLength(maxPresetCount);
    expect(parsed.some((preset) => preset.name === "깨진 프리셋")).toBe(false);
  });

  it("deletes presets by id", () => {
    const storage = new MemoryStorage();
    const first = createPresetSnapshot("첫 번째", sampleDocument, preferences);
    const second = createPresetSnapshot("두 번째", sampleDocument, preferences);

    expect(writePresetSnapshots(storage, [first, second])).toBe(true);

    const nextPresets = deletePresetSnapshot(storage, first.id);

    expect(nextPresets).toHaveLength(1);
    expect(nextPresets[0]?.id).toBe(second.id);
  });

  it("treats malformed payloads and storage failures as empty or non-fatal", () => {
    const preset = createPresetSnapshot("", sampleDocument, preferences);

    expect(parsePresetSnapshots("{")).toEqual([]);
    expect(parsePresetSnapshots(JSON.stringify({ version: 2, presets: [preset] }))).toEqual([]);
    expect(readPresetSnapshots(throwingStorage)).toEqual([]);
    expect(writePresetSnapshots(throwingStorage, [preset])).toBe(false);
    expect(clearPresetSnapshots(throwingStorage)).toBe(false);
  });
});
