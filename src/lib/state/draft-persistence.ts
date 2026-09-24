import type { JSONContent } from "@tiptap/core";
import {
  createDraftSnapshot,
  draftStorageKey,
  parseDraftSnapshot,
  writeDraftSnapshot,
  type DraftPreferences,
  type DraftSnapshot,
} from "$lib/editor/draft-storage";

export type DraftSaveState = "idle" | "dirty" | "saving" | "saved" | "error" | "conflict";

type DraftData = { document: JSONContent; preferences: DraftPreferences };
type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type DraftPersistenceOptions = {
  debounceMs: number;
  getStorage: () => DraftStorage | undefined;
  getCurrent: () => DraftData;
  canPersist: () => boolean;
  cloneDocument: (document: JSONContent) => JSONContent;
  clonePreferences: (preferences: DraftPreferences) => DraftPreferences;
  setState: (state: DraftSaveState) => void;
  setSavedAt: (updatedAt: string) => void;
  onSaved: () => void;
};

function fingerprint({ document, preferences }: DraftData) {
  return JSON.stringify({ document, preferences });
}

export function createDraftPersistenceController({
  debounceMs,
  getStorage,
  getCurrent,
  canPersist,
  cloneDocument,
  clonePreferences,
  setState,
  setSavedAt,
  onSaved,
}: DraftPersistenceOptions) {
  let state: DraftSaveState = "idle";
  let lastObservedRaw: string | null = null;
  let lastSavedFingerprint = "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  function publishState(nextState: DraftSaveState) {
    state = nextState;
    if (!disposed) setState(nextState);
  }

  function clearScheduled() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }

  function seedObserved(raw: string | null) {
    lastObservedRaw = raw;
  }

  function acceptRemote(raw: string | null, snapshot: DraftSnapshot) {
    clearScheduled();
    lastObservedRaw = raw;
    lastSavedFingerprint = fingerprint(snapshot);
    if (!disposed) setSavedAt(snapshot.updatedAt);
    publishState("saved");
  }

  function observeExternal(raw: string | null) {
    if (disposed || raw === lastObservedRaw) return;
    const remote = raw ? parseDraftSnapshot(raw) : undefined;
    const currentFingerprint = fingerprint(getCurrent());
    if (remote && fingerprint(remote) === currentFingerprint) {
      acceptRemote(raw, remote);
      return;
    }
    clearScheduled();
    publishState("conflict");
  }

  function persist(data: DraftData) {
    if (disposed) return false;
    const storage = getStorage();
    if (!storage) {
      publishState("error");
      return false;
    }

    let currentRaw: string | null;
    try {
      currentRaw = storage.getItem(draftStorageKey);
    } catch {
      publishState("error");
      return false;
    }
    if (currentRaw !== lastObservedRaw) {
      observeExternal(currentRaw);
      return state !== "conflict";
    }

    const snapshot = createDraftSnapshot(
      cloneDocument(data.document),
      clonePreferences(data.preferences),
    );
    publishState("saving");
    if (!writeDraftSnapshot(storage, snapshot)) {
      publishState("error");
      return false;
    }

    lastObservedRaw = JSON.stringify(snapshot);
    lastSavedFingerprint = fingerprint(snapshot);
    setSavedAt(snapshot.updatedAt);
    publishState("saved");
    onSaved();
    return true;
  }

  function schedule(data: DraftData) {
    clearScheduled();
    if (disposed || state === "conflict") return;
    if (fingerprint(data) === lastSavedFingerprint) {
      publishState("saved");
      return;
    }
    publishState("dirty");
    timer = setTimeout(() => {
      timer = undefined;
      persist(data);
    }, debounceMs);
  }

  function persistCurrent() {
    return persist(getCurrent());
  }

  function flush() {
    clearScheduled();
    if (!disposed && canPersist() && (state === "dirty" || state === "error")) {
      persistCurrent();
    }
  }

  function retry() {
    if (!disposed && canPersist()) persistCurrent();
  }

  function overwriteBaseline(raw: string | null) {
    if (disposed) return;
    lastObservedRaw = raw;
    publishState("dirty");
  }

  function dispose() {
    disposed = true;
    clearScheduled();
  }

  return {
    seedObserved,
    acceptRemote,
    observeExternal,
    persistCurrent,
    schedule,
    clearScheduled,
    flush,
    retry,
    overwriteBaseline,
    dispose,
  };
}
