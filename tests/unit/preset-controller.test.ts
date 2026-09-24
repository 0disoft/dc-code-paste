import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleDocument } from "$lib/editor/sample-document";
import type { DraftPreferences } from "$lib/editor/draft-storage";
import { createPresetController } from "$lib/state/preset-controller";
import type { PresetSnapshot } from "$lib/editor/preset-storage";

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

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
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

describe("preset controller", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("saves and applies a preset after checking the current draft", () => {
    const storage = new MemoryStorage();
    const states: string[] = [];
    let name = "예시";
    let presets: PresetSnapshot[] = [];
    let applied: PresetSnapshot | undefined;
    const checkpoint = vi.fn<() => boolean>(() => true);
    const controller = createPresetController({
      getStorage: () => storage,
      getName: () => name,
      getCurrent: () => ({ document: sampleDocument, preferences }),
      cloneDocument: structuredClone,
      clonePreferences: structuredClone,
      checkpointBeforeReplacement: checkpoint,
      applySnapshot: (preset) => (applied = preset),
      setPresets: (value) => (presets = value),
      setState: (value) => states.push(value),
      clearName: () => (name = ""),
    });

    expect(controller.save()).toBe(true);
    expect(presets).toHaveLength(1);
    expect(name).toBe("");
    expect(states.at(-1)).toBe("saved");
    expect(controller.apply(presets[0]!)).toBe(true);
    expect(checkpoint).toHaveBeenCalledOnce();
    expect(applied?.name).toBe("예시");
    expect(states.at(-1)).toBe("idle");
  });

  it("keeps rename and delete open when storage rejects the write", () => {
    const storage = new MemoryStorage();
    const states: string[] = [];
    let presets: PresetSnapshot[] = [];
    const controller = createPresetController({
      getStorage: () => storage,
      getName: () => "예시",
      getCurrent: () => ({ document: sampleDocument, preferences }),
      cloneDocument: structuredClone,
      clonePreferences: structuredClone,
      checkpointBeforeReplacement: () => true,
      applySnapshot: () => {},
      setPresets: (value) => (presets = value),
      setState: (value) => states.push(value),
      clearName: () => {},
    });
    expect(controller.save()).toBe(true);
    const id = presets[0]!.id;
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    expect(controller.rename(id, "새 이름")).toBe(false);
    expect(controller.remove(id)).toBe(false);
    expect(presets[0]?.name).toBe("예시");
    expect(states.at(-1)).toBe("error");
    controller.dispose();
  });

  it("cancels saved feedback when cleared or disposed", () => {
    const states: string[] = [];
    const controller = createPresetController({
      getStorage: () => new MemoryStorage(),
      getName: () => "예시",
      getCurrent: () => ({ document: sampleDocument, preferences }),
      cloneDocument: structuredClone,
      clonePreferences: structuredClone,
      checkpointBeforeReplacement: () => true,
      applySnapshot: () => {},
      setPresets: () => {},
      setState: (value) => states.push(value),
      clearName: () => {},
    });

    controller.save();
    controller.clearState();
    vi.advanceTimersByTime(1300);
    expect(states).toEqual(["saved", "idle"]);

    controller.save();
    controller.dispose();
    vi.advanceTimersByTime(1300);
    expect(states).toEqual(["saved", "idle", "saved"]);
  });
});
