import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { exportDocumentToDcHtml } from "../../src/lib/dc/export-document";

const exportOptions = {
  theme: "github-dark",
  bodyFontFamily: "Malgun Gothic, Apple SD Gothic Neo, Segoe UI, sans-serif",
  bodyFontSize: "15px",
  codeFontSize: "14px",
  showLineNumbers: false,
} as const;

describe("exportDocumentToDcHtml", () => {
  it("renders prose, links, callouts, and code blocks as inline-style DC HTML", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "강의 노트" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "중요한 문장", marks: [{ type: "bold" }] },
            { type: "text", text: "과 " },
            {
              type: "text",
              text: "링크",
              marks: [{ type: "link", attrs: { href: "https://example.com" } }],
            },
          ],
        },
        {
          type: "tipBox",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "여긴 팁이야." }],
            },
          ],
        },
        {
          type: "warningBox",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "입력값 범위를 먼저 봐." }],
            },
          ],
        },
        {
          type: "referenceBox",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "레퍼런스는 여기." }],
            },
          ],
        },
        {
          type: "emphasisBox",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "핵심만 따로 눌러준다." }],
            },
          ],
        },
        {
          type: "linkBox",
          attrs: { href: "https://example.com/reference" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "외부 레퍼런스" }],
            },
          ],
        },
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "인용문도 글 흐름 안에서 살아야 한다." }],
            },
          ],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "첫 번째 체크" }],
                },
              ],
            },
          ],
        },
        {
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "순서 있는 체크" }],
                },
              ],
            },
          ],
        },
        {
          type: "horizontalRule",
        },
        {
          type: "codeBlock",
          attrs: { language: "javascript" },
          content: [{ type: "text", text: "const value = 1;" }],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, exportOptions);

    expect(html).toContain("<h1");
    expect(html).toContain("font-weight:800");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain("TIP");
    expect(html).toContain("주의");
    expect(html).toContain("REF");
    expect(html).toContain("POINT");
    expect(html).toContain("LINK");
    expect(html).toContain('href="https://example.com/reference"');
    expect(html).toContain("<blockquote");
    expect(html).toContain("인용문도 글 흐름 안에서 살아야 한다.");
    expect(html).toContain("<ul");
    expect(html).toContain("<ol");
    expect(html).toContain("<li");
    expect(html).toContain("<hr");
    expect(html).toContain("const");
    expect(html).toContain("oklch(");
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  }, 15_000);

  it("keeps legacy calloutBox documents exportable", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "calloutBox",
          attrs: { kind: "reference" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "이전 문서도 버리지 않는다." }],
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, exportOptions);

    expect(html).toContain("REF");
    expect(html).toContain("이전 문서도 버리지 않는다.");
  });

  it("keeps selected font family and size scoped to textStyle spans", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "기본 " },
            {
              type: "text",
              text: "선택 스타일",
              marks: [
                {
                  type: "textStyle",
                  attrs: {
                    fontFamily: "Georgia, Times New Roman, serif",
                    fontSize: "18px",
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, exportOptions);

    expect(html).toContain(
      '<span style="font-family:Georgia, Times New Roman, serif;font-size:18px">선택 스타일</span>',
    );
    expect(html).toContain(
      '<p style="margin:0 0 14px;color:oklch(23.39% 0.012 255.51);font-family:Malgun Gothic, Apple SD Gothic Neo, Segoe UI, sans-serif;font-size:15px',
    );
  });

  it("exports an article canvas so dark DC editor backgrounds do not swallow prose", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "다크모드에서도 보이는 제목" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "본문도 같은 캔버스 위에 있어야 한다." }],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, exportOptions);

    expect(html).toMatch(/^<div style="[^"]*background-color:oklch\(98\.38% 0\.01 97\.33\)/);
    expect(html).toContain("padding:18px");
    expect(html).toContain("box-sizing:border-box");
    expect(html).toContain("다크모드에서도 보이는 제목");
  });

  it("can export DC table-compatible structure for stricter paste surfaces", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "테이블 복붙" }],
        },
        {
          type: "tipBox",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "DC가 table 기반 HTML을 더 끈질기게 살린다." }],
            },
          ],
        },
        {
          type: "linkBox",
          attrs: { href: "https://example.com/reference" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "참고 링크" }],
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      structure: "dcTable",
    });

    expect(html).toMatch(
      /^<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fbfaf2"/,
    );
    expect(html).toContain("<tbody><tr><td");
    expect(html).toContain('bgcolor="#e6fbe4"');
    expect(html).toContain('bgcolor="#e5f6ff"');
    expect(html).toContain("border-collapse:collapse");
    expect(html).toContain("border-left:4px solid");
    expect(html).toContain("테이블 복붙");
    expect(html).toContain("참고 링크");
    expect(html).toContain('href="https://example.com/reference"');
    expect(html).not.toContain("<aside");
    expect(html).not.toMatch(/\sclass=/);
    expect(html).not.toMatch(/\son[a-z]+=/i);
  });

  it("exports DC paste HTML without app-owned attributes or unsafe links", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 99 },
          content: [{ type: "text", text: "깨지면 안 되는 제목" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "위험한 링크",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
        {
          type: "referenceBox",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "앱 class 없이 inline style만 남긴다." }],
            },
          ],
        },
        {
          type: "linkBox",
          attrs: { href: "javascript:alert(1)" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "위험한 링크 박스" }],
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, exportOptions);

    expect(html).toContain("<h2");
    expect(html).not.toContain("<h99");
    expect(html).toContain("위험한 링크");
    expect(html).toContain("위험한 링크 박스");
    expect(html).not.toContain("javascript:");
    expect(html).not.toMatch(/\sclass=/);
    expect(html).not.toMatch(/\sdata-[\w-]+=/);
    expect(html).not.toMatch(/\son[a-z]+=/i);
    expect(html).not.toMatch(/<script\b/i);
    expect(html).toMatch(/<div style="[^"]+">/);
  });

  it("does not export URL-only or empty link boxes as duplicated blank paste artifacts", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "linkBox",
          attrs: { href: "https://example.com/reference" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "https://example.com/reference" }],
            },
          ],
        },
        {
          type: "linkBox",
          attrs: { href: "" },
          content: [
            {
              type: "paragraph",
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, exportOptions);

    expect(html).toContain("LINK");
    expect(html).toContain('href="https://example.com/reference"');
    expect(html).toContain(">example.com/reference</a>");
    expect(html).not.toContain(">https://example.com/reference</");
    expect(html.match(/LINK/g)).toHaveLength(1);
  });
});
