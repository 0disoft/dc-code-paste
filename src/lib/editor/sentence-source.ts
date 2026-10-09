import { Mark, getMarkRange, type Editor } from "@tiptap/core";
import type { EditorState } from "@tiptap/pm/state";
import { closeHistory } from "@tiptap/pm/history";
import { documentSourceCatalog, type DocumentSource } from "./document-sources.ts";
import { normalizeSourceReviewKey, createSourceReviewKey } from "./source-review-format.ts";
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
      reviewKey: {
        default: "",
        rendered: false,
        validate(value: unknown) {
          if (value !== "" && !normalizeSourceReviewKey(value))
            throw new RangeError("Invalid source review key");
        },
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: "span[data-source-href]",
        getAttrs(element) {
          const source = normalizeSentenceSource({
            href: element.getAttribute("data-source-href"),
            label: element.getAttribute("data-source-label") ?? "",
            excerpt: element.getAttribute("data-source-excerpt") ?? "",
          });
          return source
            ? {
                ...source,
                reviewKey: normalizeSourceReviewKey(element.getAttribute("data-source-review")),
              }
            : false;
        },
      },
    ];
  },
  renderHTML({ mark }) {
    const reviewKey = normalizeSourceReviewKey(mark.attrs.reviewKey);
    return [
      "span",
      {
        ...sentenceSourceAttributes(mark.attrs),
        ...(reviewKey ? { "data-source-review": reviewKey } : {}),
      },
      0,
    ];
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
  const runs: { from: number; to: number; text: string }[] = [];
  state.doc.nodesBetween(selection.from, selection.to, (node, pos, parent) => {
    if (
      !node.isText ||
      !parent?.type.allowsMarkType(type) ||
      node.marks.some((mark) => mark.type.name === "code")
    )
      return;
    const from = Math.max(selection.from, pos);
    const to = Math.min(selection.to, pos + node.nodeSize);
    if (!source) {
      tr.removeMark(from, to, type);
      return;
    }
    const text = node.text!.slice(from - pos, to - pos);
    const previous = runs.at(-1);
    if (previous?.to === from) {
      previous.to = to;
      previous.text += text;
    } else runs.push({ from, to, text });
  });
  if (source)
    for (const run of runs)
      tr.addMark(
        run.from,
        run.to,
        type.create({ ...source, reviewKey: createSourceReviewKey(run.text) }),
      );
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

export function readSelectionSourceReview(
  state: EditorState | undefined,
  catalog: DocumentSource[] = documentSourceCatalog(state?.doc),
) {
  const selection = readSelectionSentenceSource(state);
  const mentions = selection.source
    ? catalog.flatMap((entry) =>
        entry.href === selection.source!.href
          ? entry.mentions.filter(
              (mention) =>
                mention.from < selection.to &&
                mention.to > selection.from &&
                mention.label === selection.source!.label &&
                mention.excerpt === selection.source!.excerpt,
            )
          : [],
      )
    : [];
  return {
    mentions,
    changedCount: mentions.filter((mention) => mention.review === "changed").length,
    untrackedCount: mentions.filter((mention) => mention.review === "untracked").length,
  };
}

export function createSourceReviewTransaction(state: EditorState) {
  const review = readSelectionSourceReview(state);
  const type = state.schema.marks.sentenceSource;
  if (!type || !review.mentions.length) return null;
  const tr = closeHistory(state.tr);
  for (const mention of review.mentions) {
    if (mention.review === "unchanged") continue;
    const source = state.doc.nodeAt(mention.from)?.marks.find((mark) => mark.type === type);
    if (!source) continue;
    tr.addMark(
      mention.from,
      mention.to,
      type.create({
        ...source.attrs,
        reviewKey: createSourceReviewKey(state.doc.textBetween(mention.from, mention.to)),
      }),
    );
  }
  tr.removeStoredMark(type);
  return tr.steps.length ? tr : null;
}

export function setSelectionSourceReviewed(editor: Editor) {
  const tr = createSourceReviewTransaction(editor.state);
  if (!tr) return false;
  editor.view.dispatch(tr);
  editor.view.dispatch(closeHistory(editor.state.tr));
  return true;
}
