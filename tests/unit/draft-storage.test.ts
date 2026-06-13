import { describe, expect, it } from "vitest";
import { sampleDocument } from "../../src/lib/editor/sample-document";
import {
  appendDraftHistorySnapshot,
  clearDraftHistorySnapshots,
  clearDraftSnapshot,
  createDraftHistorySnapshot,
  createDraftSnapshot,
  deleteDraftHistorySnapshot,
  draftHistoryStorageKey,
  draftStorageKey,
  maxDraftHistoryCount,
  parseDraftHistorySnapshots,
  parseDraftSnapshot,
  readDraftHistorySnapshots,
  readDraftSnapshot,
  renameDraftHistorySnapshot,
  writeDraftHistorySnapshots,
  writeDraftSnapshot,
  type DraftPreferences,
} from "../../src/lib/editor/draft-storage";

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

  it("normalizes legacy modern export preferences to DC table", () => {
    const snapshot = createDraftSnapshot(sampleDocument, preferences);
    const restored = parseDraftSnapshot(
      JSON.stringify({
        ...snapshot,
        preferences: {
          ...snapshot.preferences,
          structure: "modern",
        },
      }),
    );

    expect(restored?.preferences.structure).toBe("dcTable");
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

  it("restores legacy v1 drafts without a saved document theme", () => {
    const snapshot = {
      version: 1,
      updatedAt: new Date().toISOString(),
      document: sampleDocument,
      preferences: {
        ...preferences,
        documentTheme: undefined,
      },
    };

    const restored = parseDraftSnapshot(JSON.stringify(snapshot));

    expect(restored?.preferences.documentTheme).toBe("lightLecture");
  });

  it("treats storage failures as non-fatal", () => {
    const snapshot = createDraftSnapshot(sampleDocument, preferences);

    expect(readDraftSnapshot(throwingStorage)).toBeUndefined();
    expect(writeDraftSnapshot(throwingStorage, snapshot)).toBe(false);
    expect(clearDraftSnapshot(throwingStorage)).toBe(false);
  });

  it("round-trips validated draft history snapshots", () => {
    const storage = new MemoryStorage();
    const snapshot = createDraftHistorySnapshot(sampleDocument, preferences);

    expect(writeDraftHistorySnapshots(storage, [snapshot])).toBe(true);

    const restored = readDraftHistorySnapshots(storage);
    expect(restored).toHaveLength(1);
    expect(restored[0]).toEqual(snapshot);

    expect(clearDraftHistorySnapshots(storage)).toBe(true);
    expect(storage.getItem(draftHistoryStorageKey)).toBeNull();
  });

  it("filters malformed draft history payloads and limits the list", () => {
    const validSnapshots = Array.from({ length: maxDraftHistoryCount + 3 }, () =>
      createDraftHistorySnapshot(sampleDocument, preferences),
    );
    const malformedSnapshot = {
      ...validSnapshots[0],
      id: 123,
    };

    const restored = parseDraftHistorySnapshots(
      JSON.stringify([malformedSnapshot, ...validSnapshots]),
    );

    expect(restored).toHaveLength(maxDraftHistoryCount);
    expect(restored[0]?.id).toBe(validSnapshots[0]?.id);
    expect(parseDraftHistorySnapshots("{")).toEqual([]);
    expect(parseDraftHistorySnapshots(JSON.stringify({ items: validSnapshots }))).toEqual([]);
  });

  it("appends and deletes draft history snapshots", () => {
    const storage = new MemoryStorage();
    const first = createDraftHistorySnapshot(sampleDocument, preferences);
    const second = createDraftHistorySnapshot(sampleDocument, {
      ...preferences,
      language: "typescript",
    });

    expect(appendDraftHistorySnapshot(storage, first)).toHaveLength(1);
    expect(appendDraftHistorySnapshot(storage, second).map((item) => item.id)).toEqual([
      second.id,
      first.id,
    ]);
    expect(deleteDraftHistorySnapshot(storage, second.id).map((item) => item.id)).toEqual([
      first.id,
    ]);
  });

  it("renames draft history snapshots while preserving unnamed legacy snapshots", () => {
    const storage = new MemoryStorage();
    const first = createDraftHistorySnapshot(sampleDocument, preferences);
    const second = createDraftHistorySnapshot(sampleDocument, {
      ...preferences,
      language: "typescript",
    });

    expect(writeDraftHistorySnapshots(storage, [first, second])).toBe(true);

    const renamed = renameDraftHistorySnapshot(storage, first.id, "  풀이   초안  ");

    expect(renamed[0]?.id).toBe(first.id);
    expect(renamed[0]?.name).toBe("풀이 초안");
    expect(renamed[0]?.document).toEqual(sampleDocument);
    expect(renamed[0]?.updatedAt).toBe(first.updatedAt);
    expect(renamed[1]?.name).toBeUndefined();
    expect(readDraftHistorySnapshots(storage)[0]?.name).toBe("풀이 초안");

    const cleared = renameDraftHistorySnapshot(storage, first.id, " ");

    expect(cleared[0]?.name).toBeUndefined();
  });

  it("treats draft history storage failures as non-fatal", () => {
    const snapshot = createDraftHistorySnapshot(sampleDocument, preferences);

    expect(readDraftHistorySnapshots(throwingStorage)).toEqual([]);
    expect(writeDraftHistorySnapshots(throwingStorage, [snapshot])).toBe(false);
    expect(appendDraftHistorySnapshot(throwingStorage, snapshot)).toEqual([]);
    expect(deleteDraftHistorySnapshot(throwingStorage, snapshot.id)).toEqual([]);
    expect(renameDraftHistorySnapshot(throwingStorage, snapshot.id, "새 이름")).toEqual([]);
    expect(clearDraftHistorySnapshots(throwingStorage)).toBe(false);
  });
});
