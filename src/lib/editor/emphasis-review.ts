import type { Editor } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";

export type EmphasisKind = "bold" | "focus";
export type EmphasisPassage = {
  from: number;
  to: number;
  text: string;
  heading: string;
  kinds: EmphasisKind[];
  characters: number;
};

export type EmphasisReview = {
  passages: EmphasisPassage[];
  bodyCharacters: number;
  emphasisCharacters: number;
};

/** Inspect explicit prose emphasis, excluding titles, code and automatic block styling. */
export function emphasisReview(document: Node | undefined): EmphasisReview {
  const passages: EmphasisPassage[] = [];
  let bodyCharacters = 0;
  let heading = "";
  document?.descendants((block, position) => {
    if (block.type.name === "codeBlock") return false;
    if (block.type.name === "heading" || block.type.name === "sectionHeading") {
      heading = block.textContent || block.attrs.label || "";
      return false;
    }
    if (!block.isTextblock) return;
    let current: EmphasisPassage | undefined;
    block.forEach((node, offset) => {
      if (node.marks.some((mark) => mark.type.name === "code")) {
        current = undefined;
        return;
      }
      const text = node.isText ? node.text! : node.type.name === "hardBreak" ? "\n" : "";
      const characters = node.isText ? text.length : 0;
      bodyCharacters += characters;
      const kinds: EmphasisKind[] = [];
      if (node.marks.some((mark) => mark.type.name === "bold")) kinds.push("bold");
      if (
        node.marks.some(
          (mark) => mark.type.name === "readingIntent" && mark.attrs.intent === "focus",
        )
      )
        kinds.push("focus");
      if (!kinds.length || !text) {
        current = undefined;
        return;
      }
      const from = position + 1 + offset;
      const to = from + node.nodeSize;
      if (current?.to === from) {
        current.to = to;
        current.text += text;
        current.characters += characters;
        current.kinds = (["bold", "focus"] as const).filter(
          (kind) => current!.kinds.includes(kind) || kinds.includes(kind),
        );
      } else {
        current = { from, to, text, heading, kinds, characters };
        passages.push(current);
      }
    });
    return false;
  });
  const visible = passages.filter((passage) => passage.text.trim());
  return {
    passages: visible,
    bodyCharacters,
    emphasisCharacters: visible.reduce((count, passage) => count + passage.characters, 0),
  };
}

export function createEmphasisReviewReader() {
  let previous: Node | undefined;
  let review = emphasisReview(undefined);
  return (document: Node | undefined) => {
    if (document !== previous) {
      previous = document;
      review = emphasisReview(document);
    }
    return review;
  };
}

export function navigateEmphasisPassage(editor: Editor, passage: EmphasisPassage) {
  if (
    editor.isDestroyed ||
    !emphasisReview(editor.state.doc).passages.some(
      (current) =>
        current.from === passage.from &&
        current.to === passage.to &&
        current.text === passage.text &&
        current.kinds.length === passage.kinds.length &&
        current.kinds.every((kind) => passage.kinds.includes(kind)),
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
