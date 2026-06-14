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

  it("keeps inline formatting inside markdown list items", () => {
    expect(
      parseMarkdownToDocument(
        [
          "- **굵게** 표시하고 [문서](https://example.com/docs)를 연결한다.",
          "- `channel` 값을 확인한다.",
        ].join("\n"),
      ).content?.[0],
    ).toEqual({
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "굵게", marks: [{ type: "bold" }] },
                { type: "text", text: " 표시하고 " },
                {
                  type: "text",
                  text: "문서",
                  marks: [
                    {
                      type: "link",
                      attrs: {
                        href: "https://example.com/docs",
                        target: "_blank",
                        rel: "noopener noreferrer",
                      },
                    },
                  ],
                },
                { type: "text", text: "를 연결한다." },
              ],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "channel", marks: [{ type: "code" }] },
                { type: "text", text: " 값을 확인한다." },
              ],
            },
          ],
        },
      ],
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

  it("normalizes assembly code fence aliases", () => {
    for (const fence of ["asm", "assembly", "nasm", "yasm"]) {
      expect(
        parseMarkdownToDocument(["```" + fence, "mov eax, 1", "```"].join("\n")).content?.[0],
      ).toEqual({
        type: "codeBlock",
        attrs: { language: "asm" },
        content: [{ type: "text", text: "mov eax, 1" }],
      });
    }
  });

  it("normalizes data and query code fence aliases", () => {
    expect(
      parseMarkdownToDocument(["```yml", "enabled: true", "```"].join("\n")).content?.[0],
    ).toEqual({
      type: "codeBlock",
      attrs: { language: "yaml" },
      content: [{ type: "text", text: "enabled: true" }],
    });

    for (const fence of ["mysql", "postgres", "sqlite"]) {
      expect(
        parseMarkdownToDocument(["```" + fence, "select * from posts", "```"].join("\n"))
          .content?.[0],
      ).toEqual({
        type: "codeBlock",
        attrs: { language: "sql" },
        content: [{ type: "text", text: "select * from posts" }],
      });
    }
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

  it("keeps fenced code addition and deletion metadata", () => {
    expect(
      parseMarkdownToDocument(
        [
          '```cpp {5-6} add=7 delete=2 title="main.cpp"',
          "#include <iostream>",
          "using namespace std;",
          "",
          "int main() {",
          "  ios::sync_with_stdio(false);",
          "  cin.tie(nullptr);",
          "}",
          "```",
        ].join("\n"),
      ).content?.[0],
    ).toEqual({
      type: "codeBlock",
      attrs: {
        language: "cpp",
        highlightLines: "5-6",
        additionLines: "7",
        deletionLines: "2",
        filename: "main.cpp",
      },
      content: [
        {
          type: "text",
          text: [
            "#include <iostream>",
            "using namespace std;",
            "",
            "int main() {",
            "  ios::sync_with_stdio(false);",
            "  cin.tie(nullptr);",
            "}",
          ].join("\n"),
        },
      ],
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

  it("turns LLM authoring blocks into editor design nodes", () => {
    const document = parseMarkdownToDocument(
      [
        ":::hero",
        "label: GUIDE",
        "빠른 입출력",
        "병목을 먼저 좁힌다.",
        ":::",
        "",
        ":::summary",
        "label: 빠른 체크",
        "- 입력 크기를 본다.",
        "- 출력 횟수를 본다.",
        ":::",
        "",
        ":::tip",
        "label: 습관",
        "color: #22c55e",
        "반복문 안에서는 `endl`을 피한다.",
        ":::",
        "",
        ":::comparison",
        "Before: endl을 반복해서 쓴다.",
        "After: \\n을 쓰고 마지막에만 flush한다.",
        ":::",
        "",
        ":::references",
        "- [cppreference](https://en.cppreference.com)",
        ":::",
        "",
        ":::cta vertical",
        "- GitHub: https://github.com/0disoft/dc-code-paste",
        ":::",
      ].join("\n"),
    );

    expect(document.content?.map((node) => node.type)).toEqual([
      "heroBlock",
      "summaryBox",
      "tipBox",
      "comparisonBlock",
      "referenceList",
      "ctaGroup",
    ]);
    expect(document.content?.[0]?.attrs).toEqual({ label: "GUIDE" });
    expect(document.content?.[1]?.attrs).toEqual({ label: "빠른 체크" });
    expect(document.content?.[1]?.content?.[0]?.type).toBe("summaryItem");
    expect(document.content?.[2]?.attrs).toEqual({ label: "습관", toneColor: "#22c55e" });
    expect(document.content?.[2]?.content?.[0]?.type).toBe("paragraph");
    expect(document.content?.[3]?.content?.map((node) => node.type)).toEqual([
      "comparisonColumn",
      "comparisonColumn",
    ]);
    expect(document.content?.[4]?.content?.[0]?.attrs).toEqual({
      href: "https://en.cppreference.com/",
    });
    expect(document.content?.[4]?.content?.[0]?.content?.[0]).toEqual({
      type: "text",
      text: "cppreference",
    });
    expect(document.content?.[5]?.attrs).toEqual({ layout: "vertical" });
  });

  it("keeps unsupported inline links as plain text", () => {
    expect(parseMarkdownInline("[bad](javascript:alert)")).toEqual([
      { type: "text", text: "[bad](javascript:alert)" },
    ]);
  });

  it("flattens nested markdown quote markers instead of leaking them into text", () => {
    expect(
      parseMarkdownToDocument(["> 바깥 인용", ">> 안쪽 인용"].join("\n")).content?.[0],
    ).toEqual({
      type: "blockquote",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "바깥 인용 안쪽 인용" }],
        },
      ],
    });
  });

  it("does not absorb the rest of the document when a custom block is not closed", () => {
    expect(
      parseMarkdownToDocument([":::tip", "닫히지 않은 블록", "", "## 다음 제목"].join("\n"))
        .content,
    ).toEqual([
      {
        type: "paragraph",
        content: [{ type: "text", text: ":::tip 닫히지 않은 블록" }],
      },
      {
        type: "sectionHeading",
        content: [{ type: "text", text: "다음 제목" }],
      },
    ]);
  });
});
