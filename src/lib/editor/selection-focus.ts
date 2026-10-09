import type { EditorView } from "@tiptap/pm/view";
import { TextSelection } from "@tiptap/pm/state";

export function restoreRepeatedTextblockSelection(view: EditorView, position: number): false {
  const cursor = view.state.doc.resolve(position);
  for (let depth = cursor.depth; depth > 0; depth--) {
    if (!cursor.node(depth).inlineContent) continue;
    const selection = TextSelection.create(view.state.doc, cursor.start(depth), cursor.end(depth));
    // A triple click can keep the same ProseMirror range after another input had
    // focus. Its default handler skips an equal selection, leaving the browser's
    // preceding double-click range visible. Resync the DOM without editing history.
    if (view.state.selection.eq(selection)) view.focus();
    break;
  }
  // Keep ProseMirror's default triple-click selection and drag handling.
  return false;
}
