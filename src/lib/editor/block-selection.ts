import type { Node } from "@tiptap/pm/model";
import { NodeSelection, Selection } from "@tiptap/pm/state";

/** Put the caret inside text blocks; keep leaf blocks selected as a whole. */
export function selectionAtBlockStart(doc: Node, position: number) {
  const node = doc.nodeAt(position);
  if (node?.isLeaf && NodeSelection.isSelectable(node)) return NodeSelection.create(doc, position);
  const inside = node && !node.isLeaf ? position + 1 : position;
  return Selection.near(doc.resolve(Math.min(inside, doc.content.size)));
}
