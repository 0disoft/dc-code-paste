import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JSONContent } from "@tiptap/core";
import {
  createDraftSnapshot,
  draftStorageKey,
  invalidDraftBackupKey,
  readDraftSnapshotWithRecovery,
  type DraftPreferences,
} from "#lib/editor/draft-storage.ts";
import {
  createDraftPersistenceController,
  type DraftSaveState,
} from "#lib/state/draft-persistence.ts";

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
  let current = { document: document("first"), preferences, markdownDraft: "" };
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
      current = { ...current, document: document(value) };
    },
    setMarkdown: (value: string) => {
      current = { ...current, markdownDraft: value };
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

  it("resumes saving after an invalid draft's backup fails and the original is explicitly cleared", async () => {
    const { controller, storage, getCurrent, setState } = createHarness();
    const invalid = "{invalid downloaded draft";
    storage.setItem(draftStorageKey, invalid);
    const setItem = storage.setItem.bind(storage);
    vi.spyOn(storage, "setItem").mockImplementation((key, value) => {
      if (key.startsWith(invalidDraftBackupKey)) throw new Error("Backup storage blocked");
      setItem(key, value);
    });
    expect(readDraftSnapshotWithRecovery(storage)).toEqual({ invalidRaw: invalid });
    controller.seedObserved(invalid);
    storage.removeItem(draftStorageKey);
    controller.seedObserved(null);
    controller.schedule(getCurrent());
    await vi.advanceTimersByTimeAsync(50);
    expect(setState).toHaveBeenLastCalledWith("saved");
    expect(setState).not.toHaveBeenCalledWith("conflict");
    expect(JSON.parse(storage.getItem(draftStorageKey)!).document).toEqual(getCurrent().document);
  });

  it("still detects another tab's write between clearing an invalid draft and saving its replacement", async () => {
    const { controller, storage, getCurrent, setState } = createHarness();
    const invalid = "{invalid draft";
    storage.setItem(draftStorageKey, invalid);
    controller.seedObserved(invalid);
    storage.removeItem(draftStorageKey);
    controller.seedObserved(null);
    controller.schedule(getCurrent());
    const remote = JSON.stringify(
      createDraftSnapshot(document("other tab after recovery"), preferences),
    );
    storage.setItem(draftStorageKey, remote);
    await vi.advanceTimersByTimeAsync(50);
    expect(setState).toHaveBeenLastCalledWith("conflict");
    expect(storage.getItem(draftStorageKey)).toBe(remote);
  });

  it("reports an oversized draft as unsaved", () => {
    const { controller, storage, setCurrent, setState, setSavedAt, onSaved } = createHarness();
    setCurrent("x".repeat(2_000_000));

    expect(controller.persistCurrent()).toBe(false);
    expect(setState).toHaveBeenLastCalledWith("error");
    expect(storage.getItem(draftStorageKey)).toBeNull();
    expect(setSavedAt).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("marks unapplied edits dirty and flushes the latest working text without changing the document", () => {
    const { controller, storage, getCurrent, setMarkdown, setState } = createHarness();
    expect(controller.persistCurrent()).toBe(true);
    setMarkdown("# Pending draft\n\n  exact indentation\n");
    controller.schedule(getCurrent());
    expect(setState).toHaveBeenLastCalledWith("dirty");
    setMarkdown("# Latest pending draft\n\n\tkeep this newline\n");
    controller.flush();
    const snapshot = JSON.parse(storage.getItem(draftStorageKey)!);
    expect(snapshot.document).toEqual(document("first"));
    expect(snapshot.markdownDraft).toBe(getCurrent().markdownDraft);
    expect(setState).toHaveBeenLastCalledWith("saved");
    setMarkdown("");
    controller.schedule(getCurrent());
    controller.flush();
    expect(JSON.parse(storage.getItem(draftStorageKey)!)).not.toHaveProperty("markdownDraft");
  });

  it("stops a save when another tab changes only the unapplied text", async () => {
    const { controller, storage, getCurrent, setMarkdown, setState } = createHarness();
    expect(controller.persistCurrent()).toBe(true);
    setMarkdown("Local pending text");
    controller.schedule(getCurrent());
    const raw = JSON.stringify(
      createDraftSnapshot(getCurrent().document, preferences, "Remote pending text"),
    );
    storage.setItem(draftStorageKey, raw);
    controller.observeExternal(raw);
    controller.flush();
    await vi.advanceTimersByTimeAsync(50);
    expect(setState).toHaveBeenLastCalledWith("conflict");
    expect(storage.getItem(draftStorageKey)).toBe(raw);
    expect(getCurrent().markdownDraft).toBe("Local pending text");
    controller.overwriteBaseline(raw);
    expect(controller.persistCurrent()).toBe(true);
    expect(JSON.parse(storage.getItem(draftStorageKey)!).markdownDraft).toBe("Local pending text");
  });

  it("keeps the previous snapshot when the combined document and working text exceeds storage limits", () => {
    const { controller, storage, setMarkdown, setState } = createHarness();
    expect(controller.persistCurrent()).toBe(true);
    const previous = storage.getItem(draftStorageKey);
    setMarkdown("x".repeat(2_000_000));
    expect(controller.persistCurrent()).toBe(false);
    expect(setState).toHaveBeenLastCalledWith("error");
    expect(storage.getItem(draftStorageKey)).toBe(previous);
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
