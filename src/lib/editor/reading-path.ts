import type { Editor } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { TextSelection, type Selection } from "@tiptap/pm/state";
import { normalizeReadingIntent, type ReadingIntent } from "./reading-intent-format.ts";

export type ReadingPassage = {
  intent: ReadingIntent;
  from: number;
  to: number;
  text: string;
  heading: string;
};

/** Read only explicit author annotations, retaining document order and full passage text. */
export function readingPassages(document: Node | undefined): ReadingPassage[] {
  if (!document) return [];
  const passages: ReadingPassage[] = [];
  let heading = "";
  document.descendants((block, position) => {
    if (block.type.name === "codeBlock") return false;
    if (block.type.name === "heading" || block.type.name === "sectionHeading")
      heading = block.textContent || block.attrs.label || "";
    if (!block.isTextblock) return;
    let current: ReadingPassage | undefined;
    block.forEach((node, offset) => {
      const intent = normalizeReadingIntent(
        node.marks.find((mark) => mark.type.name === "readingIntent")?.attrs.intent,
      );
      const text = node.isText ? node.text! : node.type.name === "hardBreak" ? "\n" : "";
      if (!intent || !text || node.marks.some((mark) => mark.type.name === "code")) {
        current = undefined;
        return;
      }
      const from = position + 1 + offset;
      const to = from + node.nodeSize;
      if (current?.intent === intent && current.to === from) {
        current.to = to;
        current.text += text;
      } else {
        current = { intent, from, to, text, heading };
        passages.push(current);
      }
    });
    return false;
  });
  return passages.filter((passage) => passage.text.trim());
}

export function createReadingPassageReader() {
  let previous: Node | undefined;
  let passages: ReadingPassage[] = [];
  return (document: Node | undefined) => {
    if (document !== previous) {
      previous = document;
      passages = readingPassages(document);
    }
    return passages;
  };
}

export function activeReadingPassage(passages: ReadingPassage[], selection: Selection | undefined) {
  if (!selection) return -1;
  return passages.findIndex(
    (passage) => selection.from >= passage.from && selection.to <= passage.to,
  );
}

export function navigateReadingPassage(
  editor: Editor,
  passage: ReadingPassage,
  passages = readingPassages(editor.state.doc),
) {
  if (
    editor.isDestroyed ||
    !passages.some(
      (current) =>
        current.from === passage.from &&
        current.to === passage.to &&
        current.intent === passage.intent &&
        current.text === passage.text,
    )
  )
    return false;
  editor.view.dispatch(
    editor.state.tr
      .setSelection(TextSelection.create(editor.state.doc, passage.from, passage.to))
      .setMeta("addToHistory", false)
      .scrollIntoView(),
  );
  editor.view.focus();
  return true;
}
