import type { JSONContent } from "@tiptap/core";
import { normalizeReadingLayout, type ReadingLayout } from "./reading-layout.ts";
import {
  normalizeDcExportStructure,
  type DcDocumentTheme,
  type DcExportStructure,
} from "#lib/dc/export-document.ts";
import {
  isSupportedLanguage,
  isSupportedTheme,
  type DcLanguageId,
  type DcThemeId,
} from "#lib/highlighter/catalog.ts";

export const draftStorageKey = "dc-code-paste:draft:v1";
export const invalidDraftBackupKey = "dc-code-paste:draft-invalid-backup:v1";
export const draftHistoryStorageKey = "dc-code-paste:draft-history:v1";
export const maxDraftHistoryCount = 10;
export const maxSavedDraftCount = 30;

export type DraftPreferences = {
  language: DcLanguageId;
  theme: DcThemeId;
  bodyFontFamily: string;
  bodyFontSize: string;
  selectionFontFamily: string;
  selectionFontSize: string;
  codeFontSize: string;
  showLineNumbers: boolean;
  documentTheme: DcDocumentTheme;
  readingLayout?: ReadingLayout;
  structure: DcExportStructure;
};

export type DraftSnapshot = {
  version: 2;
  updatedAt: string;
  document: JSONContent;
  preferences: DraftPreferences;
  /** Unapplied working text; never part of the public document export. */
  markdownDraft?: string;
};

export type DraftHistorySnapshot = DraftSnapshot & {
  id: string;
  createdAt: string;
  name?: string;
  kind?: "manual" | "automatic";
};

export function isManualDraftSnapshot(snapshot: Pick<DraftHistorySnapshot, "kind" | "name">) {
  // Old records do not tell us whether they were saved manually. Preserve them.
  return snapshot.kind !== "automatic" || Boolean(snapshot.name?.trim());
}

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const maxDraftChars = 2_000_000;
const maxDraftNodes = 20_000;
const draftNodeTypes = new Set([
  "doc",
  "text",
  "paragraph",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "listItem",
  "codeBlock",
  "horizontalRule",
  "hardBreak",
  "sectionHeading",
  "heroBlock",
  "summaryBox",
  "summaryItem",
  "tutorialBlock",
  "tutorialStep",
  "comparisonBlock",
  "comparisonColumn",
  "referenceList",
  "referenceItem",
  "ctaGroup",
  "ctaButton",
  "linkBox",
  "dcDataTable",
  "dcDataTableRow",
  "dcDataTableCaption",
  "dcDataTableCell",
  "tipBox",
  "warningBox",
  "successBox",
  "failureBox",
  "experimentBox",
  "emphasisBox",
  "rebuttalBox",
  "conclusionBox",
  "referenceBox",
  "calloutBox",
]);
const draftMarkTypes = new Set([
  "relationAnchor",
  "sentenceSource",
  "readingIntent",
  "bold",
  "italic",
  "strike",
  "underline",
  "code",
  "link",
  "textStyle",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonContent(
  value: unknown,
  depth = 0,
  budget = { remaining: maxDraftNodes },
): value is JSONContent {
  if (!isRecord(value) || depth > 80 || --budget.remaining < 0) {
    return false;
  }

  if (typeof value.type !== "string" || !draftNodeTypes.has(value.type)) {
    return false;
  }

  if ("text" in value && typeof value.text !== "string") {
    return false;
  }
  if (value.type === "text" && (typeof value.text !== "string" || "content" in value)) {
    return false;
  }
  if (value.type !== "text" && "text" in value) {
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
      if (!isRecord(mark) || typeof mark.type !== "string" || !draftMarkTypes.has(mark.type)) {
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

    return value.content.every((child) => isJsonContent(child, depth + 1, budget));
  }

  return value.type !== "doc" || Array.isArray(value.content);
}

function isDocumentTheme(value: unknown): value is DcDocumentTheme {
  return value === "lightLecture" || value === "darkEditorial" || value === "cleanEditorial";
}

export function normalizeDraftPreferences(value: unknown): DraftPreferences | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const structure = normalizeDcExportStructure(value.structure);

  if (
    typeof value.language !== "string" ||
    !isSupportedLanguage(value.language) ||
    typeof value.theme !== "string" ||
    !isSupportedTheme(value.theme) ||
    typeof value.bodyFontFamily !== "string" ||
    typeof value.bodyFontSize !== "string" ||
    typeof value.selectionFontFamily !== "string" ||
    typeof value.selectionFontSize !== "string" ||
    typeof value.codeFontSize !== "string" ||
    typeof value.showLineNumbers !== "boolean" ||
    !structure
  ) {
    return undefined;
  }

  return {
    language: value.language,
    theme: value.theme,
    bodyFontFamily: value.bodyFontFamily,
    bodyFontSize: value.bodyFontSize,
    selectionFontFamily: value.selectionFontFamily,
    selectionFontSize: value.selectionFontSize,
    codeFontSize: value.codeFontSize,
    showLineNumbers: value.showLineNumbers,
    documentTheme: isDocumentTheme(value.documentTheme) ? value.documentTheme : "lightLecture",
    ...(value.readingLayout === undefined
      ? {}
      : { readingLayout: normalizeReadingLayout(value.readingLayout) }),
    structure,
  };
}

function createSnapshotId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `draft_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeSnapshotName(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, 60) : undefined;
}

function restoreLegacyTitleOnlyStep(node: JSONContent): JSONContent {
  if (
    node.type === "tutorialStep" &&
    !node.content?.length &&
    typeof node.attrs?.title === "string"
  ) {
    const { title, ...attrs } = node.attrs;
    return {
      ...node,
      attrs,
      content: [{ type: "paragraph", content: [{ type: "text", text: title }] }],
    };
  }

  if (!Array.isArray(node.content)) {
    return node;
  }

  return {
    ...node,
    content: node.content.map(restoreLegacyTitleOnlyStep),
  };
}

export function normalizeDraftSnapshot(value: unknown): DraftSnapshot | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if ((value.version !== 1 && value.version !== 2) || typeof value.updatedAt !== "string") {
    return undefined;
  }

  if (value.markdownDraft !== undefined && typeof value.markdownDraft !== "string") {
    return undefined;
  }

  if (
    !isRecord(value.document) ||
    value.document.type !== "doc" ||
    !isJsonContent(value.document)
  ) {
    return undefined;
  }

  const preferences = normalizeDraftPreferences(value.preferences);

  if (!preferences) {
    return undefined;
  }

  return {
    version: 2,
    updatedAt: value.updatedAt,
    document: value.version === 1 ? restoreLegacyTitleOnlyStep(value.document) : value.document,
    preferences,
    ...(value.markdownDraft ? { markdownDraft: value.markdownDraft as string } : {}),
  };
}

function normalizeDraftHistorySnapshot(value: unknown): DraftHistorySnapshot | undefined {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.createdAt !== "string") {
    return undefined;
  }

  const snapshot = normalizeDraftSnapshot(value);

  if (!snapshot) {
    return undefined;
  }

  const name = normalizeSnapshotName(value.name);

  return {
    ...snapshot,
    id: value.id,
    createdAt: value.createdAt,
    kind: value.kind === "automatic" && !name ? "automatic" : "manual",
    ...(name ? { name } : {}),
  };
}

export function createDraftSnapshot(
  document: JSONContent,
  preferences: DraftPreferences,
  markdownDraft = "",
): DraftSnapshot {
  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    document,
    preferences,
    ...(markdownDraft ? { markdownDraft } : {}),
  };
}

export function createDraftHistorySnapshot(
  document: JSONContent,
  preferences: DraftPreferences,
  markdownDraft = "",
  kind: "manual" | "automatic" = "manual",
): DraftHistorySnapshot {
  const timestamp = new Date().toISOString();

  return {
    version: 2,
    id: createSnapshotId(),
    kind,
    createdAt: timestamp,
    updatedAt: timestamp,
    document,
    preferences,
    ...(markdownDraft ? { markdownDraft } : {}),
  };
}

export function parseDraftSnapshot(
  value: string,
  maxChars = maxDraftChars,
): DraftSnapshot | undefined {
  if (value.length > maxChars) {
    return undefined;
  }
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    return undefined;
  }

  return normalizeDraftSnapshot(parsed);
}

export type DraftReadResult = {
  snapshot?: DraftSnapshot;
  invalidRaw?: string;
  backupKey?: string;
};

export function readDraftSnapshotWithRecovery(
  storage: DraftStorage,
  validate: (snapshot: DraftSnapshot) => boolean = () => true,
): DraftReadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(draftStorageKey);
  } catch {
    return {};
  }

  if (!raw) {
    return {};
  }

  const snapshot = parseDraftSnapshot(raw);
  if (snapshot && validate(snapshot)) {
    return { snapshot };
  }

  try {
    const previous = storage.getItem(invalidDraftBackupKey);
    const backupKey =
      previous && previous !== raw
        ? `${invalidDraftBackupKey}:${createSnapshotId()}`
        : invalidDraftBackupKey;
    storage.setItem(backupKey, raw);
    if (storage.getItem(backupKey) === raw) {
      storage.removeItem(draftStorageKey);
      return { invalidRaw: raw, backupKey };
    }
  } catch {
    // Keep the original key and disable autosave until the user exports it.
  }

  return { invalidRaw: raw };
}

export function parseDraftHistorySnapshots(value: string): DraftHistorySnapshot[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((item) => normalizeDraftHistorySnapshot(item))
    .filter((item): item is DraftHistorySnapshot => Boolean(item));
}

export function readDraftSnapshot(storage: DraftStorage): DraftSnapshot | undefined {
  try {
    const stored = storage.getItem(draftStorageKey);
    return stored ? parseDraftSnapshot(stored) : undefined;
  } catch {
    return undefined;
  }
}

export function readDraftHistorySnapshots(storage: DraftStorage): DraftHistorySnapshot[] {
  try {
    const stored = storage.getItem(draftHistoryStorageKey);
    return stored ? parseDraftHistorySnapshots(stored) : [];
  } catch {
    return [];
  }
}

export function writeDraftSnapshot(storage: DraftStorage, snapshot: DraftSnapshot): boolean {
  try {
    const raw = JSON.stringify(snapshot);
    if (!parseDraftSnapshot(raw)) return false;
    storage.setItem(draftStorageKey, raw);
    return true;
  } catch {
    return false;
  }
}

export function writeDraftHistorySnapshots(
  storage: DraftStorage,
  snapshots: DraftHistorySnapshot[],
): boolean {
  try {
    const current = readDraftHistorySnapshots(storage);
    for (const [manual, limit] of [
      [true, maxSavedDraftCount],
      [false, maxDraftHistoryCount],
    ] as const) {
      const entries = snapshots.filter((item) => isManualDraftSnapshot(item) === manual);
      if (entries.length <= limit) continue;
      const previous = current.filter((item) => isManualDraftSnapshot(item) === manual);
      const previousIds = new Set(previous.map((item) => item.id));
      if (entries.length > previous.length || entries.some((item) => !previousIds.has(item.id)))
        return false;
    }
    const raw = JSON.stringify(snapshots);
    if (parseDraftHistorySnapshots(raw).length !== snapshots.length) return false;
    storage.setItem(draftHistoryStorageKey, raw);
    return true;
  } catch {
    return false;
  }
}

export function appendDraftHistorySnapshot(
  storage: DraftStorage,
  snapshot: DraftHistorySnapshot,
): DraftHistorySnapshot[] {
  const current = readDraftHistorySnapshots(storage);
  let automaticCount = 0;
  const next = [snapshot, ...current.filter((item) => item.id !== snapshot.id)].filter(
    (item) => isManualDraftSnapshot(item) || ++automaticCount <= maxDraftHistoryCount,
  );

  return writeDraftHistorySnapshots(storage, next) ? next : current;
}

export function deleteDraftHistorySnapshot(
  storage: DraftStorage,
  id: string,
): { snapshots: DraftHistorySnapshot[]; saved: boolean } {
  const current = readDraftHistorySnapshots(storage);
  const next = current.filter((item) => item.id !== id);

  return writeDraftHistorySnapshots(storage, next)
    ? { snapshots: next, saved: true }
    : { snapshots: current, saved: false };
}

export function renameDraftHistorySnapshot(
  storage: DraftStorage,
  id: string,
  name: string,
): { snapshots: DraftHistorySnapshot[]; saved: boolean } {
  const current = readDraftHistorySnapshots(storage);
  const nextName = normalizeSnapshotName(name);
  const next = current.map((snapshot) => {
    if (snapshot.id !== id) {
      return snapshot;
    }

    const { name: _name, ...snapshotWithoutName } = snapshot;
    return nextName
      ? { ...snapshotWithoutName, kind: "manual" as const, name: nextName }
      : snapshotWithoutName;
  });

  return writeDraftHistorySnapshots(storage, next)
    ? { snapshots: next, saved: true }
    : { snapshots: current, saved: false };
}

export function clearDraftSnapshot(storage: DraftStorage): boolean {
  try {
    storage.removeItem(draftStorageKey);
    return true;
  } catch {
    return false;
  }
}

export function clearDraftHistorySnapshots(storage: DraftStorage): boolean {
  try {
    storage.removeItem(draftHistoryStorageKey);
    return true;
  } catch {
    return false;
  }
}
