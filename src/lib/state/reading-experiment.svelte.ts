import type { Editor } from "@tiptap/core";
import type { DcExportOptions } from "#lib/dc/export-document.ts";
import type { JSONContent } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import {
  readingExperimentUnits,
  createReadingNoteTransaction,
  removeReadingNoteTransaction,
  type ReadingExperimentUnit,
} from "#lib/editor/reading-experiment.ts";
import { readingNoteCatalog } from "#lib/editor/reading-notes.ts";

export function createReadingExperimentState(options: {
  editor: () => Editor | undefined;
  exportOptions: () => DcExportOptions;
  render: (document: JSONContent, options: DcExportOptions) => Promise<string>;
}) {
  let error = $state("");
  return {
    get units() {
      return readingExperimentUnits(options.editor()?.state);
    },
    get notes() {
      return readingNoteCatalog(options.editor()?.state.doc);
    },
    get exportOptions() {
      return options.exportOptions();
    },
    get error() {
      return error;
    },
    clearError() {
      error = "";
    },
    render(unit: ReadingExperimentUnit, exportOptions: DcExportOptions) {
      return options.render(
        { type: "doc", content: [unit.node.toJSON()] },
        { ...exportOptions, includeAttribution: false },
      );
    },
    addNote(unit: ReadingExperimentUnit, text: string) {
      const editor = options.editor();
      if (!editor) return false;
      const result = createReadingNoteTransaction(editor.state, unit, text);
      if ("error" in result) {
        error = result.error;
        return false;
      }
      error = "";
      editor.view.dispatch(result.transaction);
      editor.view.dispatch(closeHistory(editor.state.tr));
      return true;
    },
    removeNote(id: string) {
      const editor = options.editor();
      if (!editor) return false;
      const transaction = removeReadingNoteTransaction(editor.state, id);
      if (!transaction) return false;
      error = "";
      editor.view.dispatch(transaction);
      editor.view.dispatch(closeHistory(editor.state.tr));
      return true;
    },
  };
}
