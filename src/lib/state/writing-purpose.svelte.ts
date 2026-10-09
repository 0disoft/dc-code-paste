import type { Editor } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import {
  createWritingPurposeTransaction,
  normalizeWritingPurpose,
} from "#lib/editor/writing-purpose.ts";

export function createWritingPurposeState(options: { editor: () => Editor | undefined }) {
  return {
    get value() {
      return normalizeWritingPurpose(options.editor()?.state.doc.attrs.writingPurpose) ?? "";
    },
    save(input: string, expectedValue: string) {
      const editor = options.editor();
      if (!editor) return { error: "편집기를 연 뒤 다시 시도해 주세요." };
      const result = createWritingPurposeTransaction(editor.state, input, expectedValue);
      if ("error" in result) return result;
      if (result.transaction) {
        editor.view.dispatch(result.transaction);
        editor.view.dispatch(closeHistory(editor.state.tr));
      }
      return { value: result.value };
    },
  };
}
