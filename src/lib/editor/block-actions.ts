import type { Editor } from "@tiptap/core";
import { Fragment } from "@tiptap/pm/model";
import { Selection } from "@tiptap/pm/state";
import { closeHistory } from "@tiptap/pm/history";
import { selectedBlockTarget } from "./block-inspector";
import { selectionAtBlockStart } from "./block-selection";

export type BlockAction = "up" | "down" | "duplicate" | "delete";

function actionPlan(editor: Editor, action: BlockAction) {
  const target = selectedBlockTarget(editor);
  if (!target) return;
  const { node, pos } = target;
  const resolved = editor.state.doc.resolve(pos);
  const parent = resolved.parent;
  const index = resolved.index();
  let from = pos;
  let to = pos + node.nodeSize;
  let startIndex = index;
  let endIndex = index + 1;
  let fragment = Fragment.empty;
  let focus = pos;
  if (action === "up") {
    if (index === 0) return;
    const previous = parent.child(index - 1);
    from -= previous.nodeSize;
    startIndex--;
    focus = from;
    fragment = Fragment.fromArray([node, previous]);
  } else if (action === "down") {
    if (index + 1 >= parent.childCount) return;
    const next = parent.child(index + 1);
    to += next.nodeSize;
    endIndex++;
    focus += next.nodeSize;
    fragment = Fragment.fromArray([next, node]);
  } else if (action === "duplicate") {
    from = to;
    startIndex = endIndex;
    focus = from;
    fragment = Fragment.from(node);
  } else if (parent.type.name === "doc" && parent.childCount === 1) {
    fragment = Fragment.from(editor.schema.nodes.paragraph!.create());
  }
  if (!parent.canReplace(startIndex, endIndex, fragment)) return;
  return { from, to, fragment, focus };
}

export function availableBlockActions(editor: Editor | undefined) {
  return Object.fromEntries(
    (["up", "down", "duplicate", "delete"] as const).map((action) => [
      action,
      Boolean(editor && actionPlan(editor, action)),
    ]),
  ) as Record<BlockAction, boolean>;
}

export function applyBlockAction(editor: Editor, action: BlockAction) {
  const plan = actionPlan(editor, action);
  if (!plan) return false;
  const tr = editor.state.tr.replaceWith(plan.from, plan.to, plan.fragment);
  const position = Math.min(plan.focus, tr.doc.content.size);
  tr.setSelection(
    action === "delete"
      ? Selection.near(tr.doc.resolve(position))
      : selectionAtBlockStart(tr.doc, position),
  );
  editor.view.dispatch(closeHistory(tr).scrollIntoView());
  editor.commands.focus();
  // Keep immediate typing in its own undo event.
  editor.view.dispatch(closeHistory(editor.state.tr));
  return true;
}
