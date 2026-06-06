import { getSchema } from "@tiptap/core";
import CodeBlock from "@tiptap/extension-code-block";
import StarterKit from "@tiptap/starter-kit";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import { calloutExtensions } from "../../src/lib/editor/callout-extension";
import { editorialExtensions } from "../../src/lib/editor/editorial-extension";
import { LinkBox } from "../../src/lib/editor/link-box-extension";
import {
  replaceSelectedInlineRangeWithCallout,
  replaceSelectedInlineRangeWithCodeBlock,
  replaceSelectedInlineRangeWithCtaButton,
  replaceSelectedInlineRangeWithLinkBox,
  replaceSelectedInlineRangeWithSectionHeading,
} from "../../src/lib/editor/selection-commands";

const schema = getSchema([
  StarterKit.configure({ codeBlock: false }),
  CodeBlock,
  ...calloutExtensions,
  ...editorialExtensions,
  LinkBox,
]);

function createState(doc: ProseMirrorNode, from: number, to: number) {
  return EditorState.create({
    schema,
    doc,
    selection: TextSelection.create(doc, from, to),
  });
}

describe("selection commands", () => {
  it("turns only the selected inline range into a callout and keeps marks", () => {
    const bold = schema.marks.bold.create();
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [
        schema.text("he"),
        schema.text("llo", [bold]),
        schema.text(" world"),
      ]),
    ]);
    const state = createState(doc, 3, 8);
    let nextDoc = state.doc;

    const handled = replaceSelectedInlineRangeWithCallout(
      state,
      (transaction) => {
        nextDoc = transaction.doc;
      },
      "tip",
    );

    expect(handled).toBe(true);
    expect(nextDoc.toJSON()).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "he" }] },
        {
          type: "tipBox",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", marks: [{ type: "bold" }], text: "llo" },
                { type: "text", text: " w" },
              ],
            },
          ],
        },
        { type: "paragraph", content: [{ type: "text", text: "orld" }] },
      ],
    });
  });

  it("turns only the selected inline range into a code block", () => {
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [schema.text("before const value = 1; after")]),
    ]);
    const state = createState(doc, 8, 24);
    let nextDoc = state.doc;

    const handled = replaceSelectedInlineRangeWithCodeBlock(
      state,
      (transaction) => {
        nextDoc = transaction.doc;
      },
      "javascript",
    );

    expect(handled).toBe(true);
    expect(nextDoc.toJSON()).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "before " }] },
        {
          type: "codeBlock",
          attrs: { language: "javascript" },
          content: [{ type: "text", text: "const value = 1;" }],
        },
        { type: "paragraph", content: [{ type: "text", text: " after" }] },
      ],
    });
  });

  it("turns a partial multi-paragraph selection into one callout", () => {
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [schema.text("alpha beta")]),
      schema.node("paragraph", null, [schema.text("gamma delta")]),
    ]);
    const state = createState(doc, 3, 18);
    let nextDoc = state.doc;

    const handled = replaceSelectedInlineRangeWithCallout(
      state,
      (transaction) => {
        nextDoc = transaction.doc;
      },
      "reference",
    );

    expect(handled).toBe(true);
    expect(nextDoc.toJSON()).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "al" }] },
        {
          type: "referenceBox",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "pha beta" }] },
            { type: "paragraph", content: [{ type: "text", text: "gamma" }] },
          ],
        },
        { type: "paragraph", content: [{ type: "text", text: " delta" }] },
      ],
    });
  });

  it("turns a selected range into an emphasis callout", () => {
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [schema.text("watch this part")]),
    ]);
    const state = createState(doc, 7, 11);
    let nextDoc = state.doc;

    const handled = replaceSelectedInlineRangeWithCallout(
      state,
      (transaction) => {
        nextDoc = transaction.doc;
      },
      "emphasis",
    );

    expect(handled).toBe(true);
    expect(nextDoc.toJSON()).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "watch " }] },
        {
          type: "emphasisBox",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "this" }],
            },
          ],
        },
        { type: "paragraph", content: [{ type: "text", text: " part" }] },
      ],
    });
  });

  it("turns a selected range into a link box", () => {
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [schema.text("read the reference")]),
    ]);
    const state = createState(doc, 10, 19);
    let nextDoc = state.doc;

    const handled = replaceSelectedInlineRangeWithLinkBox(
      state,
      (transaction) => {
        nextDoc = transaction.doc;
      },
      "https://example.com/reference",
    );

    expect(handled).toBe(true);
    expect(nextDoc.toJSON()).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "read the " }] },
        {
          type: "linkBox",
          attrs: { href: "https://example.com/reference" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "reference" }],
            },
          ],
        },
      ],
    });
  });

  it("turns a selected range into an editorial section heading", () => {
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [schema.text("before 사용 방법 및 예시 after")]),
    ]);
    const state = createState(doc, 8, 18);
    let nextDoc = state.doc;

    const handled = replaceSelectedInlineRangeWithSectionHeading(state, (transaction) => {
      nextDoc = transaction.doc;
    });

    expect(handled).toBe(true);
    expect(nextDoc.toJSON()).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "before " }] },
        {
          type: "sectionHeading",
          content: [{ type: "text", text: "사용 방법 및 예시" }],
        },
        { type: "paragraph", content: [{ type: "text", text: " after" }] },
      ],
    });
  });

  it("turns a selected range into a CTA button", () => {
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [schema.text("open archive now")]),
    ]);
    const state = createState(doc, 6, 13);
    let nextDoc = state.doc;

    const handled = replaceSelectedInlineRangeWithCtaButton(
      state,
      (transaction) => {
        nextDoc = transaction.doc;
      },
      "https://example.com/archive",
    );

    expect(handled).toBe(true);
    expect(nextDoc.toJSON()).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "open " }] },
        {
          type: "ctaButton",
          attrs: { href: "https://example.com/archive", variant: "primary" },
          content: [{ type: "text", text: "archive" }],
        },
        { type: "paragraph", content: [{ type: "text", text: " now" }] },
      ],
    });
  });

  it("turns a partial multi-paragraph selection into one code block", () => {
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [schema.text("alpha beta")]),
      schema.node("paragraph", null, [schema.text("gamma delta")]),
    ]);
    const state = createState(doc, 3, 18);
    let nextDoc = state.doc;

    const handled = replaceSelectedInlineRangeWithCodeBlock(
      state,
      (transaction) => {
        nextDoc = transaction.doc;
      },
      "cpp",
    );

    expect(handled).toBe(true);
    expect(nextDoc.toJSON()).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "al" }] },
        {
          type: "codeBlock",
          attrs: { language: "cpp" },
          content: [{ type: "text", text: "pha beta\ngamma" }],
        },
        { type: "paragraph", content: [{ type: "text", text: " delta" }] },
      ],
    });
  });

  it("does not replace an empty selection", () => {
    const doc = schema.node("doc", null, [schema.node("paragraph", null, [schema.text("hello")])]);
    const state = createState(doc, 3, 3);

    expect(replaceSelectedInlineRangeWithCallout(state, undefined, "warning")).toBe(false);
    expect(replaceSelectedInlineRangeWithCodeBlock(state, undefined, "cpp")).toBe(false);
    expect(replaceSelectedInlineRangeWithLinkBox(state, undefined, "https://example.com")).toBe(
      false,
    );
    expect(replaceSelectedInlineRangeWithSectionHeading(state, undefined)).toBe(false);
    expect(replaceSelectedInlineRangeWithCtaButton(state, undefined, "https://example.com")).toBe(
      false,
    );
  });
});
