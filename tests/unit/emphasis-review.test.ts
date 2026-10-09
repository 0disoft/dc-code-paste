import { getSchema, type Editor, type JSONContent } from "@tiptap/core";
import { EditorState, type Transaction } from "@tiptap/pm/state";
import { expect, it, vi } from "vitest";
import { createEditorExtensions } from "#lib/editor/extensions.ts";
import {
  createEmphasisReviewReader,
  emphasisReview,
  navigateEmphasisPassage,
} from "#lib/editor/emphasis-review.ts";

const schema = getSchema(createEditorExtensions());
const bold = { type: "bold" };
const focus = { type: "readingIntent", attrs: { intent: "focus" } };
const text = (value: string, marks: JSONContent["marks"] = []): JSONContent => ({
  type: "text",
  text: value,
  marks,
});

it("counts overlapping emphasis once, joins styling boundaries and keeps original block order", () => {
  const doc = schema.nodeFromJSON({
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 1 }, content: [text("제목", [bold, focus])] },
      {
        type: "paragraph",
        content: [
          text("앞 "),
          text("핵", [bold]),
          text("심", [bold, focus, { type: "link", attrs: { href: "https://example.com" } }]),
          { type: "hardBreak", marks: [focus] },
          text("질문", [focus]),
          text(" 설명"),
        ],
      },
      {
        type: "bulletList",
        content: [
          { type: "listItem", content: [{ type: "paragraph", content: [text("근거", [bold])] }] },
        ],
      },
      { type: "heading", attrs: { level: 2 }, content: [text("다음 절")] },
      { type: "blockquote", content: [{ type: "paragraph", content: [text("인용", [focus])] }] },
    ],
  });
  const review = emphasisReview(doc);
  expect(review.bodyCharacters).toBe(13);
  expect(review.emphasisCharacters).toBe(8);
  expect(review.passages.map(({ text, heading, kinds }) => ({ text, heading, kinds }))).toEqual([
    { text: "핵심\n질문", heading: "제목", kinds: ["bold", "focus"] },
    { text: "근거", heading: "제목", kinds: ["bold"] },
    { text: "인용", heading: "다음 절", kinds: ["focus"] },
  ]);
  for (const passage of review.passages)
    expect(doc.textBetween(passage.from, passage.to, "\n", "\n")).toBe(passage.text);
});

it("excludes code, title styling and whitespace-only emphasis while preserving long prose", () => {
  const long = `${"긴 강조 문장 ".repeat(150)}끝까지 남김`;
  const doc = schema.nodeFromJSON({
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 1 }, content: [text("굵은 제목", [bold])] },
      { type: "codeBlock", content: [text("코드", [bold, focus])] },
      {
        type: "paragraph",
        content: [
          text("인라인 코드", [bold, focus, { type: "code" }]),
          text("설명"),
          text("   ", [bold]),
        ],
      },
      {
        type: "paragraph",
        content: [text("천천히 읽기", [{ type: "readingIntent", attrs: { intent: "slow" } }])],
      },
      { type: "paragraph", content: [text(long, [bold])] },
    ],
  });
  const review = emphasisReview(doc);
  expect(review.passages).toHaveLength(1);
  expect(review.passages[0].text).toBe(long);
  expect(review.emphasisCharacters).toBe(long.length);
  expect(review.bodyCharacters).toBe(5 + "천천히 읽기".length + long.length);
  expect(emphasisReview(undefined)).toEqual({
    passages: [],
    bodyCharacters: 0,
    emphasisCharacters: 0,
  });
});

it("reuses analysis for selection changes and updates counts after typing and removing emphasis", () => {
  const doc = schema.nodeFromJSON({
    type: "doc",
    content: [{ type: "paragraph", content: [text("핵심", [bold])] }],
  });
  const reader = createEmphasisReviewReader();
  const initial = reader(doc);
  expect(reader(doc)).toBe(initial);
  const state = EditorState.create({ doc });
  const edited = state.apply(state.tr.insertText("추가", 2));
  expect(reader(edited.doc)).not.toBe(initial);
  expect(reader(edited.doc).emphasisCharacters).toBe(4);
  const removed = edited.apply(
    edited.tr.removeMark(1, edited.doc.content.size - 1, schema.marks.bold),
  );
  expect(reader(removed.doc)).toEqual({ passages: [], bodyCharacters: 4, emphasisCharacters: 0 });
});

it("navigates without changing content or history and rejects edited, unmarked and destroyed targets", () => {
  const doc = schema.nodeFromJSON({
    type: "doc",
    content: [{ type: "paragraph", content: [text("앞 "), text("핵심", [bold, focus])] }],
  });
  let state = EditorState.create({ doc });
  let historyMeta: unknown;
  const editorFocus = vi.fn();
  const editor = {
    get state() {
      return state;
    },
    view: {
      focus: editorFocus,
      dispatch(tr: Transaction) {
        historyMeta = tr.getMeta("addToHistory");
        state = state.apply(tr);
      },
    },
  } as unknown as Editor;
  const passage = emphasisReview(doc).passages[0];
  expect(navigateEmphasisPassage(editor, passage)).toBe(true);
  expect(state.doc.eq(doc)).toBe(true);
  expect(state.doc.textBetween(state.selection.from, state.selection.to)).toBe("핵심");
  expect(historyMeta).toBe(false);
  expect(editorFocus).toHaveBeenCalledOnce();
  state = state.apply(state.tr.removeMark(passage.from, passage.to, schema.marks.bold));
  expect(navigateEmphasisPassage(editor, passage)).toBe(false);
  const current = emphasisReview(state.doc).passages[0];
  state = state.apply(state.tr.insertText("다른 ", 1));
  expect(navigateEmphasisPassage(editor, current)).toBe(false);
  expect(navigateEmphasisPassage({ ...editor, isDestroyed: true } as Editor, current)).toBe(false);
});
