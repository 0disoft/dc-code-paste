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
  renamePresetSnapshot,
  writePresetSnapshots,
} from "../../src/lib/editor/preset-storage";

const preferences: DraftPreferences = {
  language: "cpp",
  theme: "catppuccin-mocha",
  bodyFontFamily: "Malgun Gothic, Apple SD Gothic Neo, Segoe UI, sans-serif",
  bodyFontSize: "18px",
  selectionFontFamily: "Malgun Gothic, Apple SD Gothic Neo, Segoe UI, sans-serif",
  selectionFontSize: "18px",
  codeFontSize: "16px",
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
  it("does not replace readable presets with a document that cannot be restored", () => {
    const storage = new MemoryStorage();
    const original = createPresetSnapshot("기존 프리셋", sampleDocument, preferences);
    expect(writePresetSnapshots(storage, [original])).toBe(true);
    const raw = storage.getItem(presetStorageKey);
    const document = {
      type: "doc",
      content: Array.from({ length: 10_000 }, () => ({
        type: "paragraph",
        content: [{ type: "text", text: "줄" }],
      })),
    };
    const invalid = createPresetSnapshot("새 프리셋", document, preferences);
    expect(writePresetSnapshots(storage, [invalid, original])).toBe(false);
    expect(storage.getItem(presetStorageKey)).toBe(raw);
    expect(readPresetSnapshots(storage)).toEqual([original]);
  });

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

  it("drops malformed presets without discarding valid over-limit records", () => {
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

    expect(parsed).toHaveLength(maxPresetCount + 4);
    expect(parsed.some((preset) => preset.name === "깨진 프리셋")).toBe(false);
  });

  it("refuses overflow writes and still allows cleanup of legacy oversized collections", () => {
    const storage = new MemoryStorage();
    const presets = Array.from({ length: maxPresetCount }, (_, index) =>
      createPresetSnapshot(`보관 ${index}`, sampleDocument, preferences),
    );
    expect(writePresetSnapshots(storage, presets)).toBe(true);
    const raw = storage.getItem(presetStorageKey);
    const extra = createPresetSnapshot("새 보관본", sampleDocument, preferences);
    expect(writePresetSnapshots(storage, [extra, ...presets])).toBe(false);
    expect(storage.getItem(presetStorageKey)).toBe(raw);
    storage.setItem(presetStorageKey, JSON.stringify({ version: 1, presets: [extra, ...presets] }));
    expect(renamePresetSnapshot(storage, extra.id, "예전 한도 초과 보관본").saved).toBe(true);
    expect(readPresetSnapshots(storage)).toHaveLength(maxPresetCount + 1);
    expect(deletePresetSnapshot(storage, extra.id).saved).toBe(true);
    expect(readPresetSnapshots(storage)).toHaveLength(maxPresetCount);
  });

  it("deletes presets by id", () => {
    const storage = new MemoryStorage();
    const first = createPresetSnapshot("첫 번째", sampleDocument, preferences);
    const second = createPresetSnapshot("두 번째", sampleDocument, preferences);

    expect(writePresetSnapshots(storage, [first, second])).toBe(true);

    const nextPresets = deletePresetSnapshot(storage, first.id);

    expect(nextPresets.saved).toBe(true);
    expect(nextPresets.snapshots).toHaveLength(1);
    expect(nextPresets.snapshots[0]?.id).toBe(second.id);

    const writeFailingStorage = {
      getItem: storage.getItem.bind(storage),
      setItem() {
        throw new Error("blocked");
      },
      removeItem: storage.removeItem.bind(storage),
    };

    const preservedPresets = deletePresetSnapshot(writeFailingStorage, second.id);

    expect(preservedPresets.saved).toBe(false);
    expect(preservedPresets.snapshots).toHaveLength(1);
    expect(preservedPresets.snapshots[0]?.id).toBe(second.id);
  });

  it("renames presets without changing their saved content", () => {
    const storage = new MemoryStorage();
    const preset = createPresetSnapshot("강의글 구조", sampleDocument, preferences);

    expect(writePresetSnapshots(storage, [preset])).toBe(true);

    const renamed = renamePresetSnapshot(storage, preset.id, "  풀이   템플릿  ");

    expect(renamed.saved).toBe(true);
    expect(renamed.snapshots).toHaveLength(1);
    expect(renamed.snapshots[0]?.name).toBe("풀이 템플릿");
    expect(renamed.snapshots[0]?.document).toEqual(sampleDocument);
    expect(renamed.snapshots[0]?.preferences).toEqual(preferences);
    expect(renamed.snapshots[0]?.updatedAt).toBe(preset.updatedAt);
    expect(readPresetSnapshots(storage)[0]?.name).toBe("풀이 템플릿");
  });

  it("treats malformed payloads and storage failures as empty or non-fatal", () => {
    const preset = createPresetSnapshot("", sampleDocument, preferences);

    expect(parsePresetSnapshots("{")).toEqual([]);
    expect(parsePresetSnapshots(JSON.stringify({ version: 2, presets: [preset] }))).toEqual([]);
    expect(readPresetSnapshots(throwingStorage)).toEqual([]);
    expect(writePresetSnapshots(throwingStorage, [preset])).toBe(false);
    expect(renamePresetSnapshot(throwingStorage, preset.id, "새 이름")).toEqual({
      snapshots: [],
      saved: false,
    });
    expect(clearPresetSnapshots(throwingStorage)).toBe(false);
  });
});
