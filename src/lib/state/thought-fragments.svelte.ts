import type { Editor } from "@tiptap/core";
import type { DcLanguageId } from "#lib/highlighter/catalog.ts";
import { closeHistory } from "@tiptap/pm/history";
import { thoughtFragmentCatalog } from "#lib/editor/thought-fragments.ts";
import {
  addThoughtFragmentTransaction,
  captureThoughtFragmentSelectionTransaction,
  updateThoughtFragmentTransaction,
  removeThoughtFragmentTransaction,
  insertThoughtFragmentTransaction,
  navigateThoughtFragmentAnchor,
} from "#lib/editor/thought-fragment-commands.ts";

export function createThoughtFragmentsState(options: {
  editor: () => Editor | undefined;
  language: () => DcLanguageId;
}) {
  let error = $state("");
  function run(action: (editor: Editor) => ReturnType<typeof addThoughtFragmentTransaction>) {
    const editor = options.editor();
    if (!editor) {
      error = "편집기를 연 뒤 다시 시도해 주세요.";
      return false;
    }
    const result = action(editor);
    if ("error" in result) {
      error = result.error;
      return false;
    }
    error = "";
    if (result.transaction) {
      editor.view.dispatch(result.transaction);
      editor.view.dispatch(closeHistory(editor.state.tr));
    }
    return true;
  }
  return {
    get entries() {
      return thoughtFragmentCatalog(options.editor()?.state.doc);
    },
    get error() {
      return error;
    },
    clearError() {
      error = "";
    },
    add(text: string) {
      return run((editor) => addThoughtFragmentTransaction(editor.state, text));
    },
    captureSelection() {
      return run((editor) => captureThoughtFragmentSelectionTransaction(editor.state));
    },
    update(id: string, text: string, expected: string) {
      return run((editor) => updateThoughtFragmentTransaction(editor.state, id, text, expected));
    },
    remove(id: string) {
      return run((editor) => removeThoughtFragmentTransaction(editor.state, id));
    },
    insert(id: string, kind: "prose" | "code") {
      return run((editor) =>
        insertThoughtFragmentTransaction(editor.state, id, kind, options.language()),
      );
    },
    navigate(id: string) {
      const editor = options.editor();
      return editor ? navigateThoughtFragmentAnchor(editor, id) : false;
    },
  };
}
