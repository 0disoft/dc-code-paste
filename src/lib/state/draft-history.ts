import type { JSONContent } from "@tiptap/core";
import {
  appendDraftHistorySnapshot,
  createDraftHistorySnapshot,
  deleteDraftHistorySnapshot,
  readDraftHistorySnapshots,
  renameDraftHistorySnapshot,
  isManualDraftSnapshot,
  maxSavedDraftCount,
  type DraftHistorySnapshot,
  type DraftPreferences,
} from "#lib/editor/draft-storage.ts";

type DraftData = { document: JSONContent; preferences: DraftPreferences; markdownDraft?: string };
type DraftHistoryState = "idle" | "saved" | "error" | "full";
type DraftHistoryStorage = Storage;

type DraftHistoryOptions = {
  autoIntervalMs: number;
  getStorage: () => DraftHistoryStorage | undefined;
  getCurrent: () => DraftData;
  cloneDocument: (document: JSONContent) => JSONContent;
  clonePreferences: (preferences: DraftPreferences) => DraftPreferences;
  applySnapshot: (snapshot: DraftData) => void;
  setHistory: (history: DraftHistorySnapshot[]) => void;
  setState: (state: DraftHistoryState) => void;
};

export function draftHistoryFingerprint(
  document: JSONContent,
  preferences: DraftPreferences,
  markdownDraft = "",
) {
  return JSON.stringify({ document, preferences, markdownDraft });
}

export function createDraftHistoryController(options: DraftHistoryOptions) {
  let lastFingerprint = "";
  let lastSavedAt = 0;
  let savedStateTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  function current() {
    const value = options.getCurrent();
    return {
      document: options.cloneDocument(value.document),
      preferences: options.clonePreferences(value.preferences),
      ...(value.markdownDraft ? { markdownDraft: value.markdownDraft } : {}),
    };
  }

  function currentFingerprint() {
    const value = current();
    return draftHistoryFingerprint(value.document, value.preferences, value.markdownDraft);
  }

  function setState(value: DraftHistoryState) {
    if (value !== "saved" && savedStateTimer !== undefined) {
      clearTimeout(savedStateTimer);
      savedStateTimer = undefined;
    }
    if (!disposed) options.setState(value);
  }

  function markBaseline(value: DraftData = current()) {
    lastFingerprint = draftHistoryFingerprint(
      value.document,
      value.preferences,
      value.markdownDraft,
    );
    lastSavedAt = Date.now();
  }

  function refresh() {
    const storage = options.getStorage();
    const history = storage ? readDraftHistorySnapshots(storage) : [];
    if (!disposed) options.setHistory(history);
    return history;
  }

  function initialize() {
    const history = refresh();
    if (history[0]) {
      markBaseline({
        document: options.cloneDocument(history[0].document),
        preferences: options.clonePreferences(history[0].preferences),
        markdownDraft: history[0].markdownDraft,
      });
    } else {
      lastFingerprint = "";
      lastSavedAt = Date.now();
    }
  }

  function setSavedState() {
    if (savedStateTimer !== undefined) clearTimeout(savedStateTimer);
    setState("saved");
    savedStateTimer = setTimeout(() => {
      savedStateTimer = undefined;
      setState("idle");
    }, 1300);
  }

  function save({ automatic, force = false }: { automatic: boolean; force?: boolean }) {
    if (disposed) return false;
    const storage = options.getStorage();
    if (!storage) {
      setState("error");
      return false;
    }

    if (
      !automatic &&
      readDraftHistorySnapshots(storage).filter(isManualDraftSnapshot).length >= maxSavedDraftCount
    ) {
      refresh();
      setState("full");
      return false;
    }
    const value = current();
    const fingerprint = draftHistoryFingerprint(
      value.document,
      value.preferences,
      value.markdownDraft,
    );
    if (automatic && !force && fingerprint === lastFingerprint) return false;

    const snapshot = createDraftHistorySnapshot(
      value.document,
      value.preferences,
      value.markdownDraft,
      automatic ? "automatic" : "manual",
    );
    const history = appendDraftHistorySnapshot(storage, snapshot);
    if (history[0]?.id !== snapshot.id) {
      setState("error");
      return false;
    }

    options.setHistory(history);
    lastFingerprint = fingerprint;
    lastSavedAt = Date.now();
    if (!automatic) setSavedState();
    return true;
  }

  function checkpointBeforeReplacement() {
    if (disposed) return false;
    const fingerprint = currentFingerprint();
    // A loaded baseline may never have been saved, or its recovery point may have been deleted.
    const hasRecoveryPoint = refresh().some(
      (snapshot) =>
        draftHistoryFingerprint(snapshot.document, snapshot.preferences, snapshot.markdownDraft) ===
        fingerprint,
    );
    return hasRecoveryPoint || save({ automatic: true, force: true });
  }

  function maybeSaveAutomatic() {
    if (Date.now() - lastSavedAt >= options.autoIntervalMs) {
      void save({ automatic: true });
    }
  }

  function restore(snapshot: DraftHistorySnapshot) {
    if (!checkpointBeforeReplacement()) return false;
    const value = {
      document: options.cloneDocument(snapshot.document),
      preferences: options.clonePreferences(snapshot.preferences),
      ...(snapshot.markdownDraft ? { markdownDraft: snapshot.markdownDraft } : {}),
    };
    options.applySnapshot(value);
    markBaseline(value);
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
    const entries = readDraftHistorySnapshots(storage);
    const target = entries.find((item) => item.id === id);
    if (
      name.trim() &&
      target &&
      !isManualDraftSnapshot(target) &&
      entries.filter(isManualDraftSnapshot).length >= maxSavedDraftCount
    ) {
      setState("full");
      return false;
    }
    const result = renameDraftHistorySnapshot(storage, id, name);
    if (!result.saved) {
      setState("error");
      return false;
    }
    options.setHistory(result.snapshots);
    return true;
  }

  function remove(id: string) {
    if (disposed) return false;
    const storage = options.getStorage();
    if (!storage) {
      setState("error");
      return false;
    }
    const result = deleteDraftHistorySnapshot(storage, id);
    if (!result.saved) {
      setState("error");
      return false;
    }
    options.setHistory(result.snapshots);
    setState("idle");
    return true;
  }

  function dispose() {
    disposed = true;
    if (savedStateTimer !== undefined) clearTimeout(savedStateTimer);
    savedStateTimer = undefined;
  }

  return {
    currentFingerprint,
    checkpointBeforeReplacement,
    refresh,
    initialize,
    setSavedState,
    save,
    maybeSaveAutomatic,
    restore,
    rename,
    remove,
    markBaseline,
    dispose,
  };
}
