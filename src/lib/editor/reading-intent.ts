import { Mark, type Editor } from "@tiptap/core";
import type { EditorState } from "@tiptap/pm/state";
import { closeHistory } from "@tiptap/pm/history";

import {
  normalizeReadingIntent,
  readingIntentAttributes,
  type ReadingIntent,
} from "./reading-intent-format";
export const ReadingIntentMark = Mark.create({
  name: "readingIntent",
  inclusive: false,
  addAttributes() {
    return {
      intent: {
        default: "focus",
        rendered: false,
        validate(value: unknown) {
          if (!normalizeReadingIntent(value)) throw new RangeError("Invalid reading intent");
        },
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: "span[data-reading-intent]",
        getAttrs: (element) => {
          const intent = normalizeReadingIntent(element.getAttribute("data-reading-intent"));
          return intent ? { intent } : false;
        },
      },
    ];
  },
  renderHTML({ mark }) {
    return ["span", readingIntentAttributes(mark.attrs.intent) ?? {}, 0];
  },
});

export function readSelectionReadingIntent(state: EditorState | undefined) {
  const values = new Set<ReadingIntent | null>();
  let canApply = false;
  const markType = state?.schema.marks.readingIntent;
  if (state && markType) {
    if (state.selection.empty) {
      const marks = state.storedMarks ?? state.selection.$from.marks();
      values.add(
        normalizeReadingIntent(marks.find((mark) => mark.type === markType)?.attrs.intent),
      );
    } else {
      state.doc.nodesBetween(state.selection.from, state.selection.to, (node, _pos, parent) => {
        if (
          !node.isText ||
          !parent?.type.allowsMarkType(markType) ||
          node.marks.some((mark) => mark.type.name === "code")
        )
          return;
        canApply = true;
        values.add(
          normalizeReadingIntent(node.marks.find((mark) => mark.type === markType)?.attrs.intent),
        );
      });
    }
  }
  return { intent: values.size === 1 ? [...values][0]! : null, mixed: values.size > 1, canApply };
}

export function setSelectionReadingIntent(editor: Editor, intent: ReadingIntent | null) {
  if (!readSelectionReadingIntent(editor.state).canApply) return false;
  if (intent !== null && !normalizeReadingIntent(intent)) return false;
  const chain = editor
    .chain()
    .focus()
    .command(({ tr }) => {
      closeHistory(tr);
      return true;
    });
  const changed =
    intent === null
      ? chain.unsetMark("readingIntent").run()
      : chain.setMark("readingIntent", { intent }).run();
  if (changed) editor.view.dispatch(closeHistory(editor.state.tr));
  return changed;
}
