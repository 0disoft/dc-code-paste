import type { JSONContent } from "@tiptap/core";
import { expect, it } from "vitest";
import { exportDocumentToPlainText } from "#lib/dc/export-plain-text.ts";
import { parseMarkdownToDocument } from "#lib/editor/markdown-import.ts";

const source = {
  type: "sentenceSource",
  attrs: {
    href: "https://example.com/evidence",
    label: "공식 근거",
    excerpt: "SOURCE_EXCERPT_NOT_BODY",
  },
};
const link = { type: "link", attrs: { href: "https://example.com/inline" } };

it("groups publicly linked and sourced sentences across style and private anchor splits", () => {
  const document: JSONContent = {
    type: "doc",
    attrs: {
      sentenceRelations: [{ name: "PRIVATE_RELATION" }],
      readingNotes: [{ text: "PRIVATE_NOTE" }],
      writingPurpose: { text: "PRIVATE_PURPOSE" },
      thoughtFragments: [{ text: "PRIVATE_FRAGMENT" }],
      unknownPrivateField: "PRIVATE_UNKNOWN",
    },
    content: [
      {
        type: "paragraph",
        attrs: { thoughtFragmentAnchors: ["PRIVATE_ANCHOR"] },
        content: [
          {
            type: "text",
            text: "공개 ",
            marks: [source, { type: "relationAnchor", attrs: { id: "PRIVATE_ID" } }],
          },
          { type: "text", text: "주장", marks: [source, { type: "bold" }] },
          { type: "text", text: "과 ", marks: [source, link] },
          { type: "text", text: "자료", marks: [source, link, { type: "italic" }] },
        ],
      },
    ],
  };
  const before = JSON.stringify(document);
  const text = exportDocumentToPlainText(document);
  expect(text).toBe(
    "공개 주장과 자료 (https://example.com/inline) [출처: 공식 근거 (https://example.com/evidence)]",
  );
  expect(text).not.toMatch(/PRIVATE_|SOURCE_EXCERPT/);
  expect(JSON.stringify(document)).toBe(before);
});

it("retains reference, CTA and link-box URLs along with their displayed text", () => {
  const markdown = [
    ":::references",
    "[공식 참고 자료](https://example.com/reference)",
    ":::",
    "",
    ":::cta",
    "[가입하기](https://example.com/join)",
    ":::",
    "",
    "[자세한 안내](https://example.com/guide)",
  ].join("\n");
  const text = exportDocumentToPlainText(parseMarkdownToDocument(markdown));
  for (const expected of [
    "공식 참고 자료 (https://example.com/reference)",
    "가입하기 (https://example.com/join)",
    "자세한 안내 (https://example.com/guide)",
  ])
    expect(text).toContain(expected);
});

it("keeps code whitespace literal and preserves explicit prose breaks", () => {
  const code = "\tconst url = 'https://example.com/code';\n\n  next();  \n";
  const document: JSONContent = {
    type: "doc",
    content: [
      {
        type: "codeBlock",
        attrs: { filename: "PRIVATE_FILENAME" },
        content: [{ type: "text", text: code, marks: [source, link] }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "첫 줄" },
          { type: "hardBreak" },
          { type: "text", text: "다음 줄" },
        ],
      },
    ],
  };
  expect(exportDocumentToPlainText(document)).toBe(`${code}\n\n첫 줄\n다음 줄`);
  const inlineCode = {
    type: "paragraph",
    content: [{ type: "text", text: "literal()", marks: [source, { type: "code" }] }],
  };
  expect(exportDocumentToPlainText(inlineCode)).toBe("literal()");
});

it("does not duplicate bare URLs and filters unsupported protocols on all public links", () => {
  const document: JSONContent = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "https://example.com/inline", marks: [link] },
          {
            type: "text",
            text: " 위험한 링크",
            marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
          },
          {
            type: "text",
            text: " 출처",
            marks: [
              {
                type: "sentenceSource",
                attrs: { href: "data:text/html,secret", label: "PRIVATE_UNSAFE" },
              },
            ],
          },
        ],
      },
      {
        type: "referenceItem",
        attrs: { href: "javascript:alert(2)" },
        content: [{ type: "text", text: "차단된 자료" }],
      },
      {
        type: "ctaButton",
        attrs: { href: "mailto:hello@example.com" },
        content: [{ type: "text", text: "문의" }],
      },
      {
        type: "linkBox",
        attrs: { href: "example.com/guide" },
        content: [{ type: "paragraph", content: [{ type: "text", text: "안내" }] }],
      },
    ],
  };
  const text = exportDocumentToPlainText(document);
  expect(text.match(/https:\/\/example\.com\/inline/g)).toHaveLength(1);
  expect(text).not.toMatch(/javascript:|data:text|PRIVATE_UNSAFE/);
  expect(text).toContain("문의 (mailto:hello@example.com)");
  expect(text).toContain("안내 (https://example.com/guide)");
});
