import type { Editor } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { NodeSelection, Selection } from "@tiptap/pm/state";
import { blockTypeLabel } from "./block-inspector";

export function documentOutline(doc: Node) {
  const entries: { index: number; position: number; label: string; text: string }[] = [];
  doc.forEach((node, position, index) => {
    const label = blockTypeLabel(node.type.name);
    const heading =
      node.type.name === "heroBlock"
        ? Array.from({ length: node.childCount }, (_, i) => node.child(i)).find(
            (child) => child.type.name === "heading",
          )
        : undefined;
    const text = (
      heading?.textContent ||
      node.textBetween(0, node.content.size, " ") ||
      node.attrs.label ||
      node.attrs.filename ||
      label
    )
      .replace(/\s+/g, " ")
      .trim();
    entries.push({
      index,
      position,
      label,
      text,
    });
  });
  return entries;
}

export function activeOutlineIndex(editor: Editor | undefined) {
  return editor?.state.selection.$from.index(0) ?? -1;
}

export function navigateToBlock(editor: Editor, index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= editor.state.doc.childCount) return false;
  let position = 0;
  for (let i = 0; i < index; i++) position += editor.state.doc.child(i).nodeSize;
  const node = editor.state.doc.child(index);
  const selection =
    node.isLeaf && NodeSelection.isSelectable(node)
      ? NodeSelection.create(editor.state.doc, position)
      : Selection.near(editor.state.doc.resolve(position + 1));
  editor.view.dispatch(
    editor.state.tr.setSelection(selection).setMeta("addToHistory", false).scrollIntoView(),
  );
  editor.commands.focus();
  return true;
}
