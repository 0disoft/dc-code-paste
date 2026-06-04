import type { JSONContent } from "@tiptap/core";
import type { DcExportStructure } from "$lib/dc/export-document";
import {
  isSupportedLanguage,
  isSupportedTheme,
  type DcLanguageId,
  type DcThemeId,
} from "$lib/highlighter/catalog";

export const draftStorageKey = "dc-code-paste:draft:v1";

export type DraftPreferences = {
  language: DcLanguageId;
  theme: DcThemeId;
  bodyFontFamily: string;
  bodyFontSize: string;
  selectionFontFamily: string;
  selectionFontSize: string;
  codeFontSize: string;
  showLineNumbers: boolean;
  structure: DcExportStructure;
};

export type DraftSnapshot = {
  version: 1;
  updatedAt: string;
  document: JSONContent;
  preferences: DraftPreferences;
};

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonContent(value: unknown, depth = 0): value is JSONContent {
  if (!isRecord(value) || depth > 80) {
    return false;
  }

  if ("type" in value && typeof value.type !== "string") {
    return false;
  }

  if ("text" in value && typeof value.text !== "string") {
    return false;
  }

  if ("attrs" in value && !isRecord(value.attrs)) {
    return false;
  }

  if ("marks" in value) {
    if (!Array.isArray(value.marks)) {
      return false;
    }

    for (const mark of value.marks) {
      if (!isRecord(mark) || typeof mark.type !== "string") {
        return false;
      }

      if ("attrs" in mark && !isRecord(mark.attrs)) {
        return false;
      }
    }
  }

  if ("content" in value) {
    if (!Array.isArray(value.content)) {
      return false;
    }

    return value.content.every((child) => isJsonContent(child, depth + 1));
  }

  return typeof value.type === "string" || typeof value.text === "string";
}

function isExportStructure(value: unknown): value is DcExportStructure {
  return value === "modern" || value === "dcTable";
}

function isDraftPreferences(value: unknown): value is DraftPreferences {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.language === "string" &&
    isSupportedLanguage(value.language) &&
    typeof value.theme === "string" &&
    isSupportedTheme(value.theme) &&
    typeof value.bodyFontFamily === "string" &&
    typeof value.bodyFontSize === "string" &&
    typeof value.selectionFontFamily === "string" &&
    typeof value.selectionFontSize === "string" &&
    typeof value.codeFontSize === "string" &&
    typeof value.showLineNumbers === "boolean" &&
    isExportStructure(value.structure)
  );
}

export function createDraftSnapshot(
  document: JSONContent,
  preferences: DraftPreferences,
): DraftSnapshot {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    document,
    preferences,
  };
}

export function parseDraftSnapshot(value: string): DraftSnapshot | undefined {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    return undefined;
  }

  if (!isRecord(parsed)) {
    return undefined;
  }

  if (parsed.version !== 1 || typeof parsed.updatedAt !== "string") {
    return undefined;
  }

  if (!isJsonContent(parsed.document) || !isDraftPreferences(parsed.preferences)) {
    return undefined;
  }

  return {
    version: 1,
    updatedAt: parsed.updatedAt,
    document: parsed.document,
    preferences: parsed.preferences,
  };
}

export function readDraftSnapshot(storage: DraftStorage): DraftSnapshot | undefined {
  try {
    const stored = storage.getItem(draftStorageKey);
    return stored ? parseDraftSnapshot(stored) : undefined;
  } catch {
    return undefined;
  }
}

export function writeDraftSnapshot(storage: DraftStorage, snapshot: DraftSnapshot): boolean {
  try {
    storage.setItem(draftStorageKey, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function clearDraftSnapshot(storage: DraftStorage): boolean {
  try {
    storage.removeItem(draftStorageKey);
    return true;
  } catch {
    return false;
  }
}
