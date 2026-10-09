import { getSchema, type Editor, type JSONContent } from "@tiptap/core";
import { EditorState, TextSelection, type Transaction } from "@tiptap/pm/state";
import { expect, it, vi } from "vitest";
import { createEditorExtensions } from "#lib/editor/extensions.ts";
import {
  activeReadingPassage,
  createReadingPassageReader,
  navigateReadingPassage,
  readingPassages,
} from "#lib/editor/reading-path.ts";

const schema = getSchema(createEditorExtensions());
const text = (
  value: string,
  intent?: string,
  marks: NonNullable<JSONContent["marks"]> = [],
): JSONContent => ({
  type: "text",
  text: value,
  marks: [...(intent ? [{ type: "readingIntent", attrs: { intent } }] : []), ...marks],
});

it("joins adjacent inline styling, preserves line breaks and separates intentions and block boundaries", () => {
  const doc = schema.nodeFromJSON({
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 1 }, content: [text("첫 절")] },
      {
        type: "paragraph",
        content: [
          text("앞", "focus"),
          text("굵게", "focus", [{ type: "bold" }]),
          { type: "hardBreak", marks: [{ type: "readingIntent", attrs: { intent: "focus" } }] },
          text("뒤", "focus", [{ type: "link", attrs: { href: "https://example.com" } }]),
          text("일반 문장"),
          text("근거", "evidence"),
        ],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [{ type: "paragraph", content: [text("목록 핵심", "focus")] }],
          },
        ],
      },
      { type: "heading", attrs: { level: 2 }, content: [text("두 번째 절")] },
      { type: "blockquote", content: [{ type: "paragraph", content: [text("인용", "quote")] }] },
    ],
  });
  const passages = readingPassages(doc);
  expect(passages.map(({ intent, text, heading }) => ({ intent, text, heading }))).toEqual([
    { intent: "focus", text: "앞굵게\n뒤", heading: "첫 절" },
    { intent: "evidence", text: "근거", heading: "첫 절" },
    { intent: "focus", text: "목록 핵심", heading: "첫 절" },
    { intent: "quote", text: "인용", heading: "두 번째 절" },
  ]);
  for (const passage of passages)
    expect(doc.textBetween(passage.from, passage.to, "\n", "\n")).toBe(passage.text);
});

it("ignores code and whitespace-only passages without truncating prose", () => {
  const long = `${"긴 원문 ".repeat(100)}끝까지 보이는 내용`;
  const doc = schema.nodeFromJSON({
    type: "doc",
    content: [
      { type: "codeBlock", content: [text("block code", "focus")] },
      {
        type: "paragraph",
        content: [
          text("inline code", "focus", [{ type: "code" }]),
          text("일반 문장"),
          text("   ", "question"),
        ],
      },
      { type: "paragraph", content: [text(long, "slow")] },
    ],
  });
  expect(readingPassages(doc)).toHaveLength(1);
  expect(readingPassages(doc)[0].text).toBe(long);
  expect(readingPassages(undefined)).toEqual([]);
});

it("reuses the catalog for selection changes and reads edits and removed marks immediately", () => {
  const doc = schema.nodeFromJSON({
    type: "doc",
    content: [{ type: "paragraph", content: [text("첫 핵심", "focus")] }],
  });
  const reader = createReadingPassageReader();
  const initial = reader(doc);
  expect(reader(doc)).toBe(initial);
  const state = EditorState.create({ doc });
  const edited = state.apply(state.tr.insertText("수정", 1, 2));
  expect(reader(edited.doc)).not.toBe(initial);
  expect(reader(edited.doc)[0].text).toBe("수정 핵심");
  const removed = edited.apply(
    edited.tr.removeMark(1, edited.doc.content.size - 1, schema.marks.readingIntent),
  );
  expect(reader(removed.doc)).toEqual([]);
});

it("selects exact source ranges without changing the document or history and rejects stale entries", () => {
  const doc = schema.nodeFromJSON({
    type: "doc",
    content: [{ type: "paragraph", content: [text("일반 문장 "), text("핵심", "focus")] }],
  });
  let state = EditorState.create({ doc });
  let historyMeta: unknown;
  const focus = vi.fn<() => void>();
  const editor = {
    get state() {
      return state;
    },
    view: {
      focus,
      dispatch(tr: Transaction) {
        historyMeta = tr.getMeta("addToHistory");
        state = state.apply(tr);
      },
    },
  } as unknown as Editor;
  const passages = readingPassages(doc);
  expect(activeReadingPassage(passages, state.selection)).toBe(-1);
  expect(navigateReadingPassage(editor, passages[0])).toBe(true);
  expect(state.selection).toBeInstanceOf(TextSelection);
  expect(state.doc.textBetween(state.selection.from, state.selection.to)).toBe("핵심");
  expect(activeReadingPassage(passages, state.selection)).toBe(0);
  expect(state.doc.eq(doc)).toBe(true);
  expect(historyMeta).toBe(false);
  expect(focus).toHaveBeenCalledOnce();
  state = state.apply(state.tr.insertText("앞에 추가", 1));
  expect(navigateReadingPassage(editor, passages[0])).toBe(false);
  const current = readingPassages(state.doc);
  state = state.apply(
    state.tr.removeMark(current[0].from, current[0].to, schema.marks.readingIntent),
  );
  expect(navigateReadingPassage(editor, current[0])).toBe(false);
});
