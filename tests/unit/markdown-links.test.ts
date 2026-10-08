import { describe, expect, it } from "vitest";
import { parseMarkdownToDocument } from "../../src/lib/editor/markdown-import";

describe("standalone Markdown links", () => {
  it.each(["안녕하세요", "hello", "README.md", "12345", "foo_bar_baz", "//comment"])(
    "keeps ordinary text %s as prose",
    (text) => {
      expect(parseMarkdownToDocument(text).content).toEqual([
        { type: "paragraph", content: [{ type: "text", text }] },
      ]);
    },
  );

  it("keeps single-word emphasis as formatted prose", () => {
    expect(parseMarkdownToDocument("**안녕하세요**").content).toEqual([
      {
        type: "paragraph",
        content: [{ type: "text", text: "안녕하세요", marks: [{ type: "bold" }] }],
      },
    ]);
  });

  it.each([
    ["https://example.com/source", "https://example.com/source"],
    ["http://localhost:3000", "http://localhost:3000/"],
    ["www.example.com", "https://www.example.com/"],
    ["mailto:hello@example.com", "mailto:hello@example.com"],
    ["[원문](example.com)", "https://example.com/"],
  ])("keeps explicit link %s as a link box", (text, href) => {
    expect(parseMarkdownToDocument(text).content?.[0]).toMatchObject({
      type: "linkBox",
      attrs: { href },
    });
  });
});
