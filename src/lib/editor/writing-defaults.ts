import type { DraftPreferences } from "./draft-storage.ts";
import type { ReadingLayout } from "./reading-layout.ts";

export const writingDefaultsStorageKey = "dc-code-paste:writing-defaults:v1";
export const writingBodyFontSizes: readonly string[] = [
  "14px",
  "15px",
  "16px",
  "17px",
  "18px",
  "19px",
  "20px",
];
export type WritingAppearance = Pick<
  DraftPreferences,
  "bodyFontFamily" | "bodyFontSize" | "documentTheme"
> & { readingLayout: ReadingLayout };
type AppearanceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function normalizeWritingAppearance(value: unknown): WritingAppearance | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const item = value as Record<string, unknown>;
  if (
    typeof item.bodyFontFamily !== "string" ||
    !item.bodyFontFamily.trim() ||
    item.bodyFontFamily.length > 1024 ||
    /[;<>:{}()]/.test(item.bodyFontFamily) ||
    [...item.bodyFontFamily].some((character) => character.charCodeAt(0) < 32) ||
    typeof item.bodyFontSize !== "string" ||
    !writingBodyFontSizes.includes(item.bodyFontSize) ||
    (item.documentTheme !== "cleanEditorial" &&
      item.documentTheme !== "lightLecture" &&
      item.documentTheme !== "darkEditorial") ||
    (item.readingLayout !== "balanced" && item.readingLayout !== "airy")
  )
    return;
  return {
    bodyFontFamily: item.bodyFontFamily.trim(),
    bodyFontSize: item.bodyFontSize,
    documentTheme: item.documentTheme,
    readingLayout: item.readingLayout,
  };
}

export function readWritingDefaults(
  storage: AppearanceStorage | undefined,
): WritingAppearance | undefined {
  try {
    const raw = storage?.getItem(writingDefaultsStorageKey);
    if (!raw || raw.length > 4096) return;
    const value = JSON.parse(raw);
    return value?.version === 1 ? normalizeWritingAppearance(value.appearance) : undefined;
  } catch {
    return;
  }
}

export function writeWritingDefaults(
  storage: AppearanceStorage | undefined,
  value: unknown,
): WritingAppearance | undefined {
  const appearance = normalizeWritingAppearance(value);
  if (!storage || !appearance) return;
  try {
    const raw = JSON.stringify({ version: 1, appearance });
    storage.setItem(writingDefaultsStorageKey, raw);
    return storage.getItem(writingDefaultsStorageKey) === raw ? appearance : undefined;
  } catch {
    return;
  }
}

export function clearWritingDefaults(storage: AppearanceStorage | undefined): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(writingDefaultsStorageKey);
    return storage.getItem(writingDefaultsStorageKey) === null;
  } catch {
    return false;
  }
}
