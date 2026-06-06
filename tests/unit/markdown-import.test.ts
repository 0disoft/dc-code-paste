import { describe, expect, it } from "vitest";
import { parseMarkdownInline, parseMarkdownToDocument } from "../../src/lib/editor/markdown-import";

describe("markdown import", () => {
  it("turns markdown headings, inline code, and links into editor JSON", () => {
    expect(
      parseMarkdownToDocument(
        [
          "# Markdown 강의",
          "",
          "본문에서 `ios::sync_with_stdio(false)`를 쓰고 [cppreference](https://en.cppreference.com)를 건다.",
          "",
          "## 사용 방법",
        ].join("\n"),
      ),
    ).toEqual({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Markdown 강의" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "본문에서 " },
            {
              type: "text",
              text: "ios::sync_with_stdio(false)",
              marks: [{ type: "code" }],
            },
            { type: "text", text: "를 쓰고 " },
            {
              type: "text",
              text: "cppreference",
              marks: [
                {
                  type: "link",
                  attrs: {
                    href: "https://en.cppreference.com/",
                    target: "_blank",
                    rel: "noopener noreferrer",
                  },
                },
              ],
            },
            { type: "text", text: "를 건다." },
          ],
        },
        {
          type: "sectionHeading",
          content: [{ type: "text", text: "사용 방법" }],
        },
      ],
    });
  });

  it("turns lists and fenced code blocks into editor JSON", () => {
    const document = parseMarkdownToDocument(
      [
        "- 입력 크기를 먼저 본다.",
        "- 반복 횟수를 본다.",
        "",
        "1. 기본 코드로 맞춘다.",
        "2. 병목을 확인한다.",
        "",
        "```ts",
        "const value = 1;",
        "```",
      ].join("\n"),
    );

    expect(document.content?.[0]).toEqual({
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "입력 크기를 먼저 본다." }] },
          ],
        },
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "반복 횟수를 본다." }] }],
        },
      ],
    });
    expect(document.content?.[1]?.type).toBe("orderedList");
    expect(document.content?.[2]).toEqual({
      type: "codeBlock",
      attrs: { language: "typescript" },
      content: [{ type: "text", text: "const value = 1;" }],
    });
  });

  it("keeps diff and patch code fences as diff-style code blocks", () => {
    expect(
      parseMarkdownToDocument(["```patch", "-old", "+new", "```"].join("\n")).content?.[0],
    ).toEqual({
      type: "codeBlock",
      attrs: { language: "patch" },
      content: [{ type: "text", text: "-old\n+new" }],
    });

    expect(
      parseMarkdownToDocument(["```diff", "-old", "+new", "```"].join("\n")).content?.[0],
    ).toEqual({
      type: "codeBlock",
      attrs: { language: "diff" },
      content: [{ type: "text", text: "-old\n+new" }],
    });
  });

  it("keeps fenced code line highlight metadata", () => {
    expect(
      parseMarkdownToDocument(
        ["```ts {2, 4-5}", "const a = 1;", "const b = 2;", "const c = 3;", "```"].join("\n"),
      ).content?.[0],
    ).toEqual({
      type: "codeBlock",
      attrs: { language: "typescript", highlightLines: "2,4-5" },
      content: [{ type: "text", text: "const a = 1;\nconst b = 2;\nconst c = 3;" }],
    });
  });

  it("keeps fenced code filename metadata", () => {
    expect(
      parseMarkdownToDocument(
        ['```ts {2} title="vite.config.ts"', "export default {};", "const value = 1;", "```"].join(
          "\n",
        ),
      ).content?.[0],
    ).toEqual({
      type: "codeBlock",
      attrs: { language: "typescript", highlightLines: "2", filename: "vite.config.ts" },
      content: [{ type: "text", text: "export default {};\nconst value = 1;" }],
    });
  });

  it("turns standalone links into link boxes", () => {
    expect(
      parseMarkdownToDocument(
        ["[원문 보기](https://example.com/archive)", "", "https://example.com/raw"].join("\n"),
      ).content,
    ).toEqual([
      {
        type: "linkBox",
        attrs: { href: "https://example.com/archive" },
        content: [{ type: "paragraph", content: [{ type: "text", text: "원문 보기" }] }],
      },
      {
        type: "linkBox",
        attrs: { href: "https://example.com/raw" },
        content: [
          { type: "paragraph", content: [{ type: "text", text: "https://example.com/raw" }] },
        ],
      },
    ]);
  });

  it("keeps unsupported inline links as plain text", () => {
    expect(parseMarkdownInline("[bad](javascript:alert)")).toEqual([
      { type: "text", text: "[bad](javascript:alert)" },
    ]);
  });
});
