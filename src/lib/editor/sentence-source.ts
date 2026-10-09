import { Mark, getMarkRange, type Editor } from "@tiptap/core";
import type { EditorState } from "@tiptap/pm/state";
import { closeHistory } from "@tiptap/pm/history";
import {
  maxSourceLabelLength,
  maxSourceExcerptLength,
  normalizeSentenceSource,
  sentenceSourceAttributes,
  type SentenceSource,
} from "./sentence-source-format.ts";

export const SentenceSourceMark = Mark.create({
  name: "sentenceSource",
  inclusive: false,
  addAttributes() {
    return {
      href: {
        default: "",
        rendered: false,
        validate(value: unknown) {
          if (!normalizeSentenceSource({ href: value })) throw new RangeError("Invalid source URL");
        },
      },
      label: {
        default: "",
        rendered: false,
        validate(value: unknown) {
          if (typeof value !== "string" || value.length > maxSourceLabelLength)
            throw new RangeError("Invalid source label");
        },
      },
      excerpt: {
        default: "",
        rendered: false,
        validate(value: unknown) {
          if (typeof value !== "string" || value.length > maxSourceExcerptLength)
            throw new RangeError("Invalid source excerpt");
        },
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: "span[data-source-href]",
        getAttrs(element) {
          return (
            normalizeSentenceSource({
              href: element.getAttribute("data-source-href"),
              label: element.getAttribute("data-source-label") ?? "",
              excerpt: element.getAttribute("data-source-excerpt") ?? "",
            }) ?? false
          );
        },
      },
    ];
  },
  renderHTML({ mark }) {
    return ["span", sentenceSourceAttributes(mark.attrs) ?? {}, 0];
  },
});

export function readSelectionSentenceSource(state: EditorState | undefined) {
  const type = state?.schema.marks.sentenceSource;
  const range =
    state && type && state.selection.empty
      ? getMarkRange(state.selection.$from, type)
      : state?.selection;
  const from = range?.from ?? 0;
  const to = range?.to ?? 0;
  const values = new Map<string, SentenceSource | null>();
  let hasSource = false;
  let canApply = false;
  if (state && type && from < to) {
    state.doc.nodesBetween(from, to, (node, _pos, parent) => {
      if (
        !node.isText ||
        !parent?.type.allowsMarkType(type) ||
        node.marks.some((mark) => mark.type.name === "code")
      )
        return;
      canApply = true;
      const source = normalizeSentenceSource(node.marks.find((mark) => mark.type === type)?.attrs);
      hasSource ||= !!source;
      values.set(JSON.stringify(source), source);
    });
  }
  return {
    source: values.size === 1 ? [...values.values()][0]! : null,
    mixed: values.size > 1,
    hasSource,
    canApply,
    from,
    to,
  };
}

export function createSentenceSourceTransaction(state: EditorState, value: SentenceSource | null) {
  const selection = readSelectionSentenceSource(state);
  const source = value === null ? null : normalizeSentenceSource(value);
  if (!selection.canApply || (value !== null && !source)) return null;
  const type = state.schema.marks.sentenceSource;
  const tr = closeHistory(state.tr);
  state.doc.nodesBetween(selection.from, selection.to, (node, pos, parent) => {
    if (
      !node.isText ||
      !parent?.type.allowsMarkType(type) ||
      node.marks.some((mark) => mark.type.name === "code")
    )
      return;
    const from = Math.max(selection.from, pos);
    const to = Math.min(selection.to, pos + node.nodeSize);
    if (source) tr.addMark(from, to, type.create(source));
    else tr.removeMark(from, to, type);
  });
  tr.removeStoredMark(type);
  return tr.steps.length ? tr : null;
}

export function setSelectionSentenceSource(editor: Editor, source: SentenceSource | null) {
  const tr = createSentenceSourceTransaction(editor.state, source);
  if (!tr) return false;
  editor.view.dispatch(tr);
  editor.view.dispatch(closeHistory(editor.state.tr));
  return true;
}
