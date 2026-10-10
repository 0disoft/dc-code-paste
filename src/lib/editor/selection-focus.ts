import type { EditorView } from "@tiptap/pm/view";
import { TextSelection } from "@tiptap/pm/state";

export function restoreClickedTextblockSelection(
  view: EditorView,
  position: number,
  event: Pick<MouseEvent, "button" | "shiftKey" | "ctrlKey" | "metaKey" | "altKey">,
): false {
  if (event.button !== 0 || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey)
    return false;
  const cursor = view.state.doc.resolve(position);
  // Firefox can focus the editor at its previous caret instead of the clicked
  // textblock. Repair only that mismatch; preserve native cursor placement inside
  // the same textblock and leave range/modifier gestures to ProseMirror.
  if (cursor.parent.inlineContent && !view.state.selection.$from.sameParent(cursor)) {
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, position)));
    view.focus();
  }
  return false;
}

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
