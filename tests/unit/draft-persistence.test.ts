import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JSONContent } from "@tiptap/core";
import {
  createDraftSnapshot,
  draftStorageKey,
  type DraftPreferences,
} from "$lib/editor/draft-storage";
import {
  createDraftPersistenceController,
  type DraftSaveState,
} from "$lib/state/draft-persistence";

const preferences: DraftPreferences = {
  language: "cpp",
  theme: "catppuccin-mocha",
  bodyFontFamily: "Malgun Gothic, sans-serif",
  bodyFontSize: "18px",
  selectionFontFamily: "Malgun Gothic, sans-serif",
  selectionFontSize: "18px",
  codeFontSize: "16px",
  showLineNumbers: true,
  documentTheme: "darkEditorial",
  structure: "dcTable",
};

function document(text: string): JSONContent {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

class MemoryStorage {
  readonly values = new Map<string, string>();
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

function createHarness() {
  const storage = new MemoryStorage();
  let current = { document: document("first"), preferences };
  const setState = vi.fn<(state: DraftSaveState) => void>();
  const setSavedAt = vi.fn<(updatedAt: string) => void>();
  const onSaved = vi.fn<() => void>();
  const controller = createDraftPersistenceController({
    debounceMs: 50,
    getStorage: () => storage,
    getCurrent: () => current,
    canPersist: () => true,
    cloneDocument: (value) => structuredClone(value),
    clonePreferences: (value) => structuredClone(value),
    setState,
    setSavedAt,
    onSaved,
  });
  controller.seedObserved(null);
  return {
    storage,
    controller,
    setState,
    setSavedAt,
    onSaved,
    setCurrent: (value: string) => {
      current = { document: document(value), preferences };
    },
    getCurrent: () => current,
  };
}

describe("draft persistence lifecycle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("coalesces edits and saves only the latest document", async () => {
    const { controller, storage, setCurrent, getCurrent, onSaved } = createHarness();
    controller.schedule(getCurrent());
    await vi.advanceTimersByTimeAsync(20);
    setCurrent("latest");
    controller.schedule(getCurrent());
    await vi.advanceTimersByTimeAsync(50);
    expect(JSON.parse(storage.getItem(draftStorageKey) ?? "").document).toEqual(document("latest"));
    expect(onSaved).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops a pending save when another tab writes a different draft", async () => {
    const { controller, storage, getCurrent, setState } = createHarness();
    controller.schedule(getCurrent());
    const remote = createDraftSnapshot(document("other tab"), preferences);
    const raw = JSON.stringify(remote);
    storage.setItem(draftStorageKey, raw);
    controller.observeExternal(raw);
    expect(setState).toHaveBeenLastCalledWith("conflict");
    await vi.advanceTimersByTimeAsync(50);
    expect(storage.getItem(draftStorageKey)).toBe(raw);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("accepts a matching remote revision and cancels redundant saves", async () => {
    const { controller, storage, getCurrent, setState, setSavedAt } = createHarness();
    controller.schedule(getCurrent());
    const remote = createDraftSnapshot(getCurrent().document, preferences);
    const raw = JSON.stringify(remote);
    storage.setItem(draftStorageKey, raw);
    controller.observeExternal(raw);
    expect(setState).toHaveBeenLastCalledWith("saved");
    expect(setSavedAt).toHaveBeenCalledWith(remote.updatedAt);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(50);
    expect(storage.getItem(draftStorageKey)).toBe(raw);
  });

  it("flushes a pending draft and cancels timers on disposal", async () => {
    const { controller, storage, setCurrent, getCurrent, onSaved } = createHarness();
    controller.schedule(getCurrent());
    setCurrent("flushed");
    controller.flush();
    expect(JSON.parse(storage.getItem(draftStorageKey) ?? "").document).toEqual(
      document("flushed"),
    );
    controller.schedule({ document: document("unsaved"), preferences });
    controller.dispose();
    await vi.advanceTimersByTimeAsync(50);
    expect(onSaved).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
