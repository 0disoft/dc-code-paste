import type { JSONContent } from "@tiptap/core";
import { Fragment, type Node, type Schema } from "@tiptap/pm/model";
import { createDraftFile } from "./draft-file.ts";
import {
  createDraftSnapshot,
  normalizeDraftSnapshot,
  type DraftPreferences,
} from "./draft-storage.ts";

/** Validate the document that will actually be stored, including the insertion paragraph. */
export function prepareMarkdownImportDocument(
  schema: Schema,
  document: JSONContent,
  preferences: DraftPreferences,
  markdownDraft: string,
): JSONContent {
  let normalized: Node;
  try {
    normalized = schema.nodeFromJSON(document);
    if (normalized.type !== schema.topNodeType) throw new Error("Expected a document");
    normalized.check();
    // StarterKit's trailingNode adds this default block after a non-paragraph final block.
    const trailingType = schema.topNodeType.contentMatch.defaultType;
    if (trailingType && normalized.lastChild?.type !== trailingType) {
      normalized = normalized.copy(normalized.content.append(Fragment.from(trailingType.create())));
      normalized.check();
    }
  } catch {
    throw new Error("Markdown의 문서 구조를 읽을 수 없습니다. 입력 내용을 확인해 주세요.");
  }

  const nextDocument = normalized.toJSON() as JSONContent;
  if (!normalizeDraftSnapshot(createDraftSnapshot(nextDocument, preferences, markdownDraft))) {
    throw new Error("문서 구조가 보관 한도를 넘었습니다. 글을 나눠 적용해 주세요.");
  }
  // File backups intentionally support larger drafts than browser autosave.
  createDraftFile(nextDocument, preferences, markdownDraft);
  return nextDocument;
}
