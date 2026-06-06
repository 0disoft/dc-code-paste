import type { JSONContent } from "@tiptap/core";
import { createDraftSnapshot, parseDraftSnapshot, type DraftPreferences } from "./draft-storage";

export const presetStorageKey = "dc-code-paste:presets:v1";
export const maxPresetCount = 30;

export type PresetSnapshot = {
  version: 1;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  document: JSONContent;
  preferences: DraftPreferences;
};

type PresetStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizePresetName(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, 60) : "새 프리셋";
}

function createPresetId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function parsePresetRecord(value: unknown): PresetSnapshot | undefined {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    return undefined;
  }

  const draft = parseDraftSnapshot(
    JSON.stringify({
      version: 1,
      updatedAt: value.updatedAt,
      document: value.document,
      preferences: value.preferences,
    }),
  );

  if (!draft) {
    return undefined;
  }

  return {
    version: 1,
    id: value.id,
    name: normalizePresetName(value.name),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    document: draft.document,
    preferences: draft.preferences,
  };
}

export function createPresetSnapshot(
  name: string,
  document: JSONContent,
  preferences: DraftPreferences,
): PresetSnapshot {
  const draft = createDraftSnapshot(document, preferences);

  return {
    version: 1,
    id: createPresetId(),
    name: normalizePresetName(name),
    createdAt: draft.updatedAt,
    updatedAt: draft.updatedAt,
    document: draft.document,
    preferences: draft.preferences,
  };
}

export function parsePresetSnapshots(value: string): PresetSnapshot[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }

  if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.presets)) {
    return [];
  }

  return parsed.presets
    .map(parsePresetRecord)
    .filter((preset): preset is PresetSnapshot => Boolean(preset))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, maxPresetCount);
}

export function readPresetSnapshots(storage: PresetStorage): PresetSnapshot[] {
  try {
    const stored = storage.getItem(presetStorageKey);
    return stored ? parsePresetSnapshots(stored) : [];
  } catch {
    return [];
  }
}

export function writePresetSnapshots(
  storage: PresetStorage,
  presets: readonly PresetSnapshot[],
): boolean {
  try {
    storage.setItem(
      presetStorageKey,
      JSON.stringify({
        version: 1,
        presets: presets.slice(0, maxPresetCount),
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function deletePresetSnapshot(storage: PresetStorage, id: string): PresetSnapshot[] {
  const nextPresets = readPresetSnapshots(storage).filter((preset) => preset.id !== id);
  return writePresetSnapshots(storage, nextPresets) ? nextPresets : readPresetSnapshots(storage);
}

export function clearPresetSnapshots(storage: PresetStorage): boolean {
  try {
    storage.removeItem(presetStorageKey);
    return true;
  } catch {
    return false;
  }
}
