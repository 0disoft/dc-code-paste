import type { JSONContent } from "@tiptap/core";
import type { Schema } from "@tiptap/pm/model";
import { createDraftSnapshot, parseDraftSnapshot, type DraftPreferences } from "./draft-storage";

export const maxDraftFileBytes = 8 * 1024 * 1024;

export function createDraftFile(
  document: JSONContent,
  preferences: DraftPreferences,
  markdownDraft = "",
) {
  const content = JSON.stringify(
    createDraftSnapshot(document, preferences, markdownDraft),
    null,
    2,
  );
  if (new TextEncoder().encode(content).byteLength > maxDraftFileBytes)
    throw new Error("초안 파일이 8MB를 넘었습니다. 글을 나눠 저장해 주세요.");
  if (!parseDraftSnapshot(content, maxDraftFileBytes))
    throw new Error("이 글은 파일 저장 한도를 넘었습니다. 글을 나눠 저장해 주세요.");
  return {
    content,
    filename: `dc-code-paste-${new Date().toISOString().replaceAll(":", "-")}.json`,
  };
}

export async function readDraftFile(file: Pick<File, "size" | "text">, schema: Schema) {
  if (file.size > maxDraftFileBytes) throw new Error("8MB 이하의 초안 파일을 선택해 주세요.");
  const raw = await file.text();
  const snapshot = parseDraftSnapshot(raw, maxDraftFileBytes);
  if (!snapshot) throw new Error("dc-code-paste에서 저장한 올바른 초안 JSON 파일을 선택해 주세요.");
  try {
    const document = schema.nodeFromJSON(snapshot.document);
    document.check();
    return { ...snapshot, document: document.toJSON() as JSONContent };
  } catch {
    throw new Error("파일의 문서 구조를 읽을 수 없습니다. 현재 글은 그대로 유지됩니다.");
  }
}
