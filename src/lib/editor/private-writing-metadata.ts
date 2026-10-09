import type { Transaction } from "@tiptap/pm/state";

export const privateDocumentAttributes = ["sentenceRelations", "readingNotes", "writingPurpose"];

/** Metadata-only transactions must not append the editor's empty insertion paragraph. */
export function changesOnlyPrivateWritingMetadata(transactions: readonly Transaction[]): boolean {
  let changed = false;
  for (const transaction of transactions) {
    for (const step of transaction.steps) {
      changed = true;
      const data = step.toJSON();
      if (data.stepType === "docAttr" && privateDocumentAttributes.includes(data.attr)) continue;
      if (
        (data.stepType === "addMark" || data.stepType === "removeMark") &&
        data.mark?.type === "relationAnchor"
      )
        continue;
      return false;
    }
  }
  return changed;
}
