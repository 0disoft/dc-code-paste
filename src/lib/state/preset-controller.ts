import type { JSONContent } from "@tiptap/core";
import {
  createPresetSnapshot,
  deletePresetSnapshot,
  maxPresetCount,
  readPresetSnapshots,
  renamePresetSnapshot,
  writePresetSnapshots,
  type PresetSnapshot,
} from "$lib/editor/preset-storage";
import type { DraftPreferences } from "$lib/editor/draft-storage";

type PresetState = "idle" | "saved" | "error";

type PresetOptions = {
  getStorage: () => Storage | undefined;
  getName: () => string;
  getCurrent: () => { document: JSONContent; preferences: DraftPreferences };
  cloneDocument: (document: JSONContent) => JSONContent;
  clonePreferences: (preferences: DraftPreferences) => DraftPreferences;
  checkpointBeforeReplacement: () => boolean;
  applySnapshot: (preset: PresetSnapshot) => void;
  setPresets: (presets: PresetSnapshot[]) => void;
  setState: (state: PresetState) => void;
  clearName: () => void;
};

export function createPresetController(options: PresetOptions) {
  let savedStateTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  function setState(state: PresetState) {
    if (savedStateTimer !== undefined) clearTimeout(savedStateTimer);
    savedStateTimer = undefined;
    if (!disposed) options.setState(state);
  }

  function refresh() {
    if (disposed) return;
    const storage = options.getStorage();
    options.setPresets(storage ? readPresetSnapshots(storage) : []);
  }

  function save() {
    if (disposed) return false;
    const storage = options.getStorage();
    if (!storage) {
      setState("error");
      return false;
    }

    const current = options.getCurrent();
    const preset = createPresetSnapshot(
      options.getName(),
      options.cloneDocument(current.document),
      options.clonePreferences(current.preferences),
    );
    const nextPresets = [preset, ...readPresetSnapshots(storage)].slice(0, maxPresetCount);
    if (!writePresetSnapshots(storage, nextPresets)) {
      setState("error");
      return false;
    }

    options.setPresets(nextPresets);
    options.clearName();
    setState("saved");
    savedStateTimer = setTimeout(() => {
      savedStateTimer = undefined;
      if (!disposed) options.setState("idle");
    }, 1300);
    return true;
  }

  function apply(preset: PresetSnapshot) {
    if (disposed) return false;
    if (!options.checkpointBeforeReplacement()) {
      setState("error");
      return false;
    }
    options.applySnapshot(preset);
    setState("idle");
    return true;
  }

  function rename(id: string, name: string) {
    if (disposed) return false;
    const storage = options.getStorage();
    if (!storage) {
      setState("error");
      return false;
    }
    const result = renamePresetSnapshot(storage, id, name);
    if (!result.saved) {
      setState("error");
      return false;
    }
    options.setPresets(result.snapshots);
    return true;
  }

  function remove(id: string) {
    if (disposed) return false;
    const storage = options.getStorage();
    if (!storage) {
      setState("error");
      return false;
    }
    const result = deletePresetSnapshot(storage, id);
    if (!result.saved) {
      setState("error");
      return false;
    }
    options.setPresets(result.snapshots);
    return true;
  }

  function dispose() {
    disposed = true;
    if (savedStateTimer !== undefined) clearTimeout(savedStateTimer);
    savedStateTimer = undefined;
  }

  return { refresh, clearState: () => setState("idle"), save, apply, rename, remove, dispose };
}
