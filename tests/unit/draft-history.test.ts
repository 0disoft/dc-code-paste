import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JSONContent } from "@tiptap/core";
import {
  draftHistoryStorageKey,
  type DraftHistorySnapshot,
  type DraftPreferences,
} from "$lib/editor/draft-storage";
import { createDraftHistoryController } from "$lib/state/draft-history";

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
  return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
}

class MemoryStorage {
  readonly values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

function harness() {
  const storage = new MemoryStorage();
  let value = { document: document("first"), preferences };
  let history: DraftHistorySnapshot[] = [];
  const states: string[] = [];
  const controller = createDraftHistoryController({
    autoIntervalMs: 30_000,
    getStorage: () => storage,
    getCurrent: () => value,
    cloneDocument: structuredClone,
    clonePreferences: structuredClone,
    applySnapshot(next) {
      value = next;
    },
    setHistory(next) {
      history = next;
    },
    setState(next) {
      states.push(next);
    },
  });
  controller.initialize();
  return {
    controller,
    storage,
    states,
    history: () => history,
    current: () => value,
    edit: (text: string) => {
      value = { document: document(text), preferences };
    },
  };
}

describe("draft history lifecycle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("checkpoints once before replacement and restores the requested snapshot", () => {
    const { controller, storage, history, current, edit } = harness();
    expect(controller.checkpointBeforeReplacement()).toBe(true);
    expect(controller.checkpointBeforeReplacement()).toBe(true);
    expect(history()).toHaveLength(1);
    edit("second");
    expect(controller.restore(history()[0]!)).toBe(true);
    expect(current().document).toEqual(document("first"));
    expect(history()).toHaveLength(2);
    expect(JSON.parse(storage.getItem(draftHistoryStorageKey) ?? "")).toHaveLength(2);
  });

  it("does not auto-save within the interval and saves one changed draft afterward", () => {
    const { controller, history, edit } = harness();
    edit("changed");
    controller.maybeSaveAutomatic();
    expect(history()).toHaveLength(0);
    vi.advanceTimersByTime(30_000);
    controller.maybeSaveAutomatic();
    controller.maybeSaveAutomatic();
    expect(history()).toHaveLength(1);
  });

  it("keeps a later error from being reset by an old saved-state timer", () => {
    const { controller, states } = harness();
    expect(controller.save({ automatic: false })).toBe(true);
    controller.dispose();
    vi.advanceTimersByTime(1300);
    expect(states).toEqual(["saved"]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("renames and removes through the controller, then rejects writes after dispose", () => {
    const { controller, history, storage } = harness();
    controller.save({ automatic: false });
    const id = history()[0]!.id;
    expect(controller.rename(id, "  이름  ")).toBe(true);
    expect(history()[0]?.name).toBe("이름");
    controller.dispose();
    expect(controller.remove(id)).toBe(false);
    expect(JSON.parse(storage.getItem(draftHistoryStorageKey) ?? "")).toHaveLength(1);
  });
});
