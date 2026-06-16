import type { JSONContent } from "@tiptap/core";
import {
  normalizeDcExportStructure,
  type DcDocumentTheme,
  type DcExportStructure,
} from "$lib/dc/export-document";
import { containsMarkdownInlineToken, parseMarkdownInline } from "$lib/editor/markdown-inline";
import { parseMarkdownToDocument, sanitizeCodeHighlightLines } from "$lib/editor/markdown-import";
import {
  isSupportedLanguage,
  isSupportedTheme,
  type DcLanguageId,
  type DcThemeId,
} from "$lib/highlighter/catalog";

export const draftStorageKey = "dc-code-paste:draft:v1";
export const draftHistoryStorageKey = "dc-code-paste:draft-history:v1";
export const maxDraftHistoryCount = 10;

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
  structure: DcExportStructure;
};

export type DraftSnapshot = {
  version: 1;
  updatedAt: string;
  document: JSONContent;
  preferences: DraftPreferences;
};

export type DraftHistorySnapshot = DraftSnapshot & {
  id: string;
  createdAt: string;
  name?: string;
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

function isDocumentTheme(value: unknown): value is DcDocumentTheme {
  return value === "lightLecture" || value === "darkEditorial";
}

function normalizeDraftPreferences(value: unknown): DraftPreferences | undefined {
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

function textContent(node: JSONContent): string {
  if (typeof node.text === "string") {
    return node.text;
  }

  return Array.isArray(node.content) ? node.content.map(textContent).join("") : "";
}

function plainUnmarkedTextContent(node: JSONContent): string | undefined {
  if (!Array.isArray(node.content) || node.content.length === 0) {
    return undefined;
  }

  const parts: string[] = [];

  for (const child of node.content) {
    if (child.type !== "text" || typeof child.text !== "string" || child.marks?.length) {
      return undefined;
    }

    parts.push(child.text);
  }

  return parts.join("");
}

function restoreInlineMarkdownContentNode(
  node: JSONContent,
  parentType?: string,
): JSONContent | undefined {
  const shouldRestore =
    node.type === "summaryItem" ||
    (node.type === "paragraph" &&
      (parentType === "comparisonColumn" || parentType === "tutorialStep"));

  if (!shouldRestore) {
    return undefined;
  }

  const text = plainUnmarkedTextContent(node);
  if (!text || !containsMarkdownInlineToken(text)) {
    return undefined;
  }

  return {
    ...node,
    content: parseMarkdownInline(text),
  };
}

function restoreTutorialTitleOnlyStep(node: JSONContent): JSONContent | undefined {
  if (node.type !== "tutorialStep" || node.content?.length) {
    return undefined;
  }

  const title = typeof node.attrs?.title === "string" ? node.attrs.title.trim() : "";
  if (!title) {
    return undefined;
  }

  const { title: _title, ...attrs } = node.attrs ?? {};

  return {
    ...node,
    attrs,
    content: [
      {
        type: "paragraph",
        content: parseMarkdownInline(title),
      },
    ],
  };
}

function markdownTableRow(cells: readonly string[]): string {
  return `| ${cells.join(" | ")} |`;
}

function collapsedMarkdownTableRows(text: string): string[] {
  const cells = text
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean);
  const separatorStart = cells.findIndex((cell) => /^:?-{3,}:?$/.test(cell));

  if (separatorStart < 1) {
    return [];
  }

  let columnCount = 0;
  while (
    separatorStart + columnCount < cells.length &&
    /^:?-{3,}:?$/.test(cells[separatorStart + columnCount] ?? "")
  ) {
    columnCount += 1;
  }

  if (columnCount < 2 || separatorStart < columnCount) {
    return [];
  }

  const header = cells.slice(separatorStart - columnCount, separatorStart);
  const rows = [
    markdownTableRow(header),
    markdownTableRow(cells.slice(separatorStart, separatorStart + columnCount)),
  ];
  let index = separatorStart + columnCount;

  while (index + columnCount <= cells.length) {
    rows.push(markdownTableRow(cells.slice(index, index + columnCount)));
    index += columnCount;
  }

  return rows.length >= 3 ? rows : [];
}

function restoreCollapsedMarkdownTableParagraph(node: JSONContent): JSONContent | undefined {
  if (node.type !== "paragraph") {
    return undefined;
  }

  const text = textContent(node).replace(/\s+/g, " ").trim();
  const rows = collapsedMarkdownTableRows(text);

  const separator = rows[1]?.replace(/\s+/g, "") ?? "";
  if (rows.length < 3 || !/^\|:?-{3,}:?(?:\|:?-{3,}:?)+\|$/.test(separator)) {
    return undefined;
  }

  const table = parseMarkdownToDocument(rows.join("\n")).content?.[0];

  return table?.type === "dcDataTable" ? table : undefined;
}

function restoreDecorativeCodeHighlightLines(node: JSONContent): JSONContent | undefined {
  if (node.type !== "codeBlock" || typeof node.attrs?.highlightLines !== "string") {
    return undefined;
  }

  const normalized = sanitizeCodeHighlightLines(
    node.attrs.highlightLines,
    textContent(node).split("\n"),
  );

  if (normalized === node.attrs.highlightLines) {
    return undefined;
  }

  const attrs = { ...node.attrs };
  if (normalized) {
    attrs.highlightLines = normalized;
  } else {
    delete attrs.highlightLines;
  }

  return {
    ...node,
    attrs,
  };
}

function normalizeDraftDocumentNodes(node: JSONContent, parentType?: string): JSONContent {
  const restoredTable = restoreCollapsedMarkdownTableParagraph(node);
  if (restoredTable) {
    return restoredTable;
  }

  const restoredTutorialStep = restoreTutorialTitleOnlyStep(node);
  if (restoredTutorialStep) {
    return restoredTutorialStep;
  }

  const restoredInline = restoreInlineMarkdownContentNode(node, parentType);
  if (restoredInline) {
    return restoredInline;
  }

  const restoredCodeHighlights = restoreDecorativeCodeHighlightLines(node);
  if (restoredCodeHighlights) {
    return restoredCodeHighlights;
  }

  if (!Array.isArray(node.content)) {
    return node;
  }

  return {
    ...node,
    content: node.content.map((child) => normalizeDraftDocumentNodes(child, node.type)),
  };
}

export function normalizeDraftSnapshot(value: unknown): DraftSnapshot | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if (value.version !== 1 || typeof value.updatedAt !== "string") {
    return undefined;
  }

  if (!isJsonContent(value.document)) {
    return undefined;
  }

  const preferences = normalizeDraftPreferences(value.preferences);

  if (!preferences) {
    return undefined;
  }

  return {
    version: 1,
    updatedAt: value.updatedAt,
    document: normalizeDraftDocumentNodes(value.document),
    preferences,
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
    ...(name ? { name } : {}),
  };
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

export function createDraftHistorySnapshot(
  document: JSONContent,
  preferences: DraftPreferences,
): DraftHistorySnapshot {
  const timestamp = new Date().toISOString();

  return {
    version: 1,
    id: createSnapshotId(),
    createdAt: timestamp,
    updatedAt: timestamp,
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

  return normalizeDraftSnapshot(parsed);
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
    .filter((item): item is DraftHistorySnapshot => Boolean(item))
    .slice(0, maxDraftHistoryCount);
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
    storage.setItem(draftStorageKey, JSON.stringify(snapshot));
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
    storage.setItem(
      draftHistoryStorageKey,
      JSON.stringify(snapshots.slice(0, maxDraftHistoryCount)),
    );
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
  const next = [snapshot, ...current.filter((item) => item.id !== snapshot.id)].slice(
    0,
    maxDraftHistoryCount,
  );

  return writeDraftHistorySnapshots(storage, next) ? next : current;
}

export function deleteDraftHistorySnapshot(
  storage: DraftStorage,
  id: string,
): DraftHistorySnapshot[] {
  const current = readDraftHistorySnapshots(storage);
  const next = current.filter((item) => item.id !== id);

  return writeDraftHistorySnapshots(storage, next) ? next : current;
}

export function renameDraftHistorySnapshot(
  storage: DraftStorage,
  id: string,
  name: string,
): DraftHistorySnapshot[] {
  const current = readDraftHistorySnapshots(storage);
  const nextName = normalizeSnapshotName(name);
  const next = current.map((snapshot) => {
    if (snapshot.id !== id) {
      return snapshot;
    }

    const { name: _name, ...snapshotWithoutName } = snapshot;
    return nextName ? { ...snapshotWithoutName, name: nextName } : snapshotWithoutName;
  });

  return writeDraftHistorySnapshots(storage, next) ? next : current;
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
