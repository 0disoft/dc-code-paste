import type { JSONContent } from "@tiptap/core";
import { relationFreeDocument } from "./relation-free-document.ts";
import {
  createDraftSnapshot,
  normalizeDraftSnapshot,
  type DraftPreferences,
  type DraftSnapshot,
} from "./draft-storage.ts";

export const copiedOutputStorageKey = "dc-code-paste:last-copied-output:v1";
export const maxCopiedOutputChars = 1_500_000;
type OutputStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type CopiedOutput = {
  version: 1;
  copiedAt: string;
  channel: "preview" | "source";
  html: string;
  plainText: string;
  draft: DraftSnapshot;
};

function normalizeCopiedOutput(value: unknown): CopiedOutput | undefined {
  if (!value || typeof value !== "object") return;
  const item = value as Record<string, unknown>;
  if (
    item.version !== 1 ||
    typeof item.copiedAt !== "string" ||
    !Number.isFinite(Date.parse(item.copiedAt)) ||
    (item.channel !== "preview" && item.channel !== "source") ||
    typeof item.html !== "string" ||
    !item.html ||
    typeof item.plainText !== "string"
  )
    return;
  const draft = normalizeDraftSnapshot(item.draft);
  if (!draft) return;
  return {
    version: 1,
    copiedAt: item.copiedAt,
    channel: item.channel,
    html: item.html,
    plainText: item.plainText,
    draft,
  };
}

export function createCopiedOutput(
  document: JSONContent,
  preferences: DraftPreferences,
  html: string,
  plainText: string,
  channel: CopiedOutput["channel"],
): CopiedOutput | undefined {
  try {
    return normalizeCopiedOutput(
      JSON.parse(
        JSON.stringify({
          version: 1,
          copiedAt: new Date().toISOString(),
          channel,
          html,
          plainText,
          draft: createDraftSnapshot(document, preferences),
        }),
      ),
    );
  } catch {
    return;
  }
}

export function readCopiedOutput(storage: OutputStorage | undefined): CopiedOutput | undefined {
  try {
    const raw = storage?.getItem(copiedOutputStorageKey);
    if (!raw || raw.length > maxCopiedOutputChars) return;
    return normalizeCopiedOutput(JSON.parse(raw));
  } catch {
    return;
  }
}

/** Keep the successful clipboard result in memory even when browser storage is full. */
export function writeCopiedOutput(
  storage: OutputStorage | undefined,
  output: CopiedOutput,
): boolean {
  try {
    if (!storage) return false;
    const raw = JSON.stringify(output);
    if (raw.length > maxCopiedOutputChars) return false;
    storage.setItem(copiedOutputStorageKey, raw);
    return storage.getItem(copiedOutputStorageKey) === raw;
  } catch {
    return false;
  }
}

export function clearCopiedOutput(storage: OutputStorage | undefined): boolean {
  try {
    if (!storage) return false;
    storage.removeItem(copiedOutputStorageKey);
    return storage.getItem(copiedOutputStorageKey) === null;
  } catch {
    return false;
  }
}

function appearance(preferences: DraftPreferences) {
  return JSON.stringify({
    theme: preferences.theme,
    bodyFontFamily: preferences.bodyFontFamily,
    bodyFontSize: preferences.bodyFontSize,
    codeFontSize: preferences.codeFontSize,
    showLineNumbers: preferences.showLineNumbers,
    documentTheme: preferences.documentTheme,
    readingLayout: preferences.readingLayout ?? "balanced",
    structure: preferences.structure,
  });
}

export function copiedOutputChanges(
  output: CopiedOutput,
  document: JSONContent,
  preferences: DraftPreferences,
) {
  return {
    content: documentFingerprint(output.draft.document) !== documentFingerprint(document),
    appearance: appearance(output.draft.preferences) !== appearance(preferences),
  };
}

function documentFingerprint(document: JSONContent) {
  return JSON.stringify(relationFreeDocument(document), (_key, value) => {
    if (value?.type !== "sentenceSource" || !value.attrs) return value;
    const attrs = { ...value.attrs };
    delete attrs.reviewKey;
    return { ...value, attrs };
  });
}
