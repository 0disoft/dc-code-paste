import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { exportDocumentToDcHtml } from "../../src/lib/dc/export-document";
import {
  codeFallbackFonts,
  defaultProseFontFamily,
  safeProseFontFamily,
} from "../../src/lib/dc/font-stacks";

const exportOptions = {
  theme: "github-dark",
  bodyFontFamily: defaultProseFontFamily,
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
          type: "sectionHeading",
          content: [{ type: "text", text: "사용 방법 및 예시" }],
        },
        {
          type: "ctaButton",
          attrs: { href: "https://example.com/start" },
          content: [{ type: "text", text: "바로가기" }],
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
    expect(html).toContain("&ldquo;");
    expect(html).toContain("font-style:italic");
    expect(html).toContain("background-color:transparent");
    expect(html).toContain("사용 방법 및 예시");
    expect(html).toContain('href="https://example.com/start"');
    expect(html).toContain("바로가기");
    expect(html).toContain("<ul");
    expect(html).toContain("<ol");
    expect(html).toContain("<li");
    expect(html).toContain("<hr");
    expect(html).toContain("const");
    expect(html).toMatch(/color:#[0-9a-f]{6}/);
    expect(html).not.toContain("oklch(");
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

  it("exports extended callout variants with distinct labels and table fallbacks", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "successBox",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "성공 케이스" }],
            },
          ],
        },
        {
          type: "failureBox",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "실패 케이스" }],
            },
          ],
        },
        {
          type: "experimentBox",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "실험 값은 " },
                { type: "text", text: "n=1000", marks: [{ type: "code" }] },
                { type: "text", text: "부터 본다." },
              ],
            },
          ],
        },
        {
          type: "conclusionBox",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "결론 문장" }],
            },
          ],
        },
        {
          type: "rebuttalBox",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "반박 문장" }],
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      structure: "dcTable",
    });

    expect(html).toContain("성공");
    expect(html).toContain("실패");
    expect(html).toContain("실험");
    expect(html).toContain("결론");
    expect(html).toContain("반박");
    expect(html).toContain("성공 케이스");
    expect(html).toContain("실패 케이스");
    expect(html).toContain("결론 문장");
    expect(html).toContain("반박 문장");
    expect(html).toContain('bgcolor="#e7faee"');
    expect(html).toContain('bgcolor="#ffe8e5"');
    expect(html).toContain('bgcolor="#eaf1ff"');
    expect(html).toContain('bgcolor="#fff7d9"');
    expect(html).toContain('bgcolor="#ffe9f5"');
    expect(html).toMatch(/background-color:#[0-9a-f]{6}/);
    expect(html).toMatch(/color:#[0-9a-f]{6}/);
    expect(html).not.toContain("oklch(");
    expect(html).not.toContain("<aside");
    expect(html).not.toMatch(/\sclass=/);
    expect(html).not.toMatch(/\sdata-[\w-]+=/);
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
      `<span style="font-family:${safeProseFontFamily("Georgia, Times New Roman, serif")};font-size:18px">선택 스타일</span>`,
    );
    expect(html).toMatch(
      new RegExp(
        `<p style="margin:0 0 14px;color:#[0-9a-f]{6};font-family:${defaultProseFontFamily.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&",
        )};font-size:15px`,
      ),
    );
  });

  it("auto-adjusts selected text colors that would disappear in dark document mode", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "다크모드 안전색",
              marks: [
                {
                  type: "textStyle",
                  attrs: {
                    color: "oklch(10% 0.02 255)",
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      documentTheme: "darkEditorial",
    });
    expect(html).toContain("다크모드 안전색");
    expect(html).not.toContain("color:oklch(10% 0.02 255)");
    expect(html).toMatch(/<span style="color:#[0-9a-f]{6}">다크모드 안전색<\/span>/);
    expect(html).not.toContain("oklch(");
  });

  it("exports CTA button groups with horizontal and vertical table layouts", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "ctaGroup",
          attrs: { layout: "horizontal" },
          content: [
            {
              type: "ctaButton",
              attrs: { href: "https://github.com/0disoft/dc-code-paste" },
              content: [{ type: "text", text: "GitHub" }],
            },
            {
              type: "ctaButton",
              attrs: { href: "https://example.com/source" },
              content: [{ type: "text", text: "원문" }],
            },
          ],
        },
        {
          type: "ctaGroup",
          attrs: { layout: "vertical" },
          content: [
            {
              type: "ctaButton",
              attrs: { href: "https://example.com/download" },
              content: [{ type: "text", text: "다운로드" }],
            },
            {
              type: "ctaButton",
              attrs: { href: "https://example.com/run" },
              content: [{ type: "text", text: "실행하기" }],
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      structure: "dcTable",
    });

    expect(html).toContain("GitHub");
    expect(html).toContain("원문");
    expect(html).toContain("다운로드");
    expect(html).toContain("실행하기");
    expect(html).toContain('href="https://github.com/0disoft/dc-code-paste"');
    expect(html).toContain('href="https://example.com/download"');
    expect(html).toContain("<tr><td");
    expect(html).toContain("border-spacing:0 8px");
    expect(html).toContain("padding:0 8px 8px 0");
    expect(html).not.toMatch(/\sclass=/);
    expect(html).not.toMatch(/\sdata-[\w-]+=/);
    expect(html).not.toMatch(/\son[a-z]+=/i);
  });

  it("exports reference lists as numbered paste-safe link tables", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "referenceList",
          content: [
            {
              type: "referenceItem",
              attrs: { href: "https://example.com/guide" },
              content: [{ type: "text", text: "가이드 원문" }],
            },
            {
              type: "referenceItem",
              attrs: { href: "https://github.com/0disoft/dc-code-paste" },
              content: [{ type: "text", text: "구현 저장소" }],
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      structure: "dcTable",
    });

    expect(html).toContain('bgcolor="#e5f6ff"');
    expect(html).toContain(">01</span>");
    expect(html).toContain(">02</span>");
    expect(html).toContain("가이드 원문");
    expect(html).toContain("구현 저장소");
    expect(html).toContain('href="https://example.com/guide"');
    expect(html).toContain('href="https://github.com/0disoft/dc-code-paste"');
    expect(html).toContain("border-left:4px solid");
    expect(html).not.toMatch(/\sclass=/);
    expect(html).not.toMatch(/\sdata-[\w-]+=/);
    expect(html).not.toMatch(/\son[a-z]+=/i);
  });

  it("exports summary boxes as compact bullet blocks", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "summaryBox",
          content: [
            {
              type: "summaryItem",
              content: [{ type: "text", text: "핵심만 먼저 보여준다." }],
            },
            {
              type: "summaryItem",
              content: [{ type: "text", text: "본문은 아래에서 천천히 풀어낸다." }],
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      structure: "dcTable",
    });

    expect(html).toContain('bgcolor="#fbf6e6"');
    expect(html).toContain("핵심 요약");
    expect(html).toContain("핵심만 먼저 보여준다.");
    expect(html).toContain("본문은 아래에서 천천히 풀어낸다.");
    expect(html).toContain("border-top:4px solid");
    expect(html).toContain("border-radius:999px");
    expect(html).not.toMatch(/\sclass=/);
    expect(html).not.toMatch(/\sdata-[\w-]+=/);
    expect(html).not.toMatch(/\son[a-z]+=/i);
  });

  it("exports hero blocks as paste-safe title panels", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "heroBlock",
          attrs: { label: "CODEX GUIDE" },
          content: [
            {
              type: "heading",
              attrs: { level: 1 },
              content: [{ type: "text", text: "Codex의 /goal 지시어는 어떻게 쓰는가?" }],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "/goal은 작업을 검증 가능한 완료 계약으로 바꾼다." }],
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      structure: "dcTable",
    });

    expect(html).toContain('bgcolor="#fbf6e6"');
    expect(html).toContain("CODEX GUIDE");
    expect(html).toContain("Codex의 /goal 지시어는 어떻게 쓰는가?");
    expect(html).toContain("/goal은 작업을 검증 가능한 완료 계약으로 바꾼다.");
    expect(html).toContain("border-top:4px solid");
    expect(html).toContain("font-size:30px");
    expect(html).not.toMatch(/\sclass=/);
    expect(html).not.toMatch(/\sdata-[\w-]+=/);
    expect(html).not.toMatch(/\son[a-z]+=/i);
  });

  it("exports paragraph-first hero blocks without forcing a title style", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "heroBlock",
          attrs: { label: "CODEX GUIDE" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Codex의 /goal 지시어는 어떻게 쓰는가?" }],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "/goal은 작업을 검증 가능한 완료 계약으로 바꾼다." }],
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      structure: "dcTable",
    });

    expect(html).toContain("CODEX GUIDE");
    expect(html).toContain("Codex의 /goal 지시어는 어떻게 쓰는가?");
    expect(html).toContain("/goal은 작업을 검증 가능한 완료 계약으로 바꾼다.");
    expect(html).not.toContain("font-size:30px");
    expect(html).not.toMatch(/<strong[^>]*>Codex의 \/goal 지시어는 어떻게 쓰는가\?<\/strong>/);
  });

  it("exports tutorial blocks as numbered section cards", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "tutorialBlock",
          content: [
            {
              type: "tutorialStep",
              attrs: { title: "문제 파악" },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "입력 크기와 반복 횟수를 먼저 본다." }],
                },
              ],
            },
            {
              type: "tutorialStep",
              attrs: { title: "병목 좁히기" },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "시간이 튀는 지점만 따로 재본다." }],
                },
              ],
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      structure: "dcTable",
    });

    expect(html).toContain('bgcolor="#fbfaf2"');
    expect(html).toContain(">01</span>");
    expect(html).toContain(">02</span>");
    expect(html).toContain("문제 파악");
    expect(html).toContain("병목 좁히기");
    expect(html).toContain("입력 크기와 반복 횟수를 먼저 본다.");
    expect(html).toContain("시간이 튀는 지점만 따로 재본다.");
    expect(html).toContain("border-left:4px solid");
    expect(html).not.toMatch(/\sclass=/);
    expect(html).not.toMatch(/\sdata-[\w-]+=/);
    expect(html).not.toMatch(/\son[a-z]+=/i);
  });

  it("exports comparison blocks as two-column paste-safe tables", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "comparisonBlock",
          content: [
            {
              type: "comparisonColumn",
              attrs: { side: "left", title: "잘못된 코드" },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "endl을 반복문 안에서 계속 쓴다." }],
                },
              ],
            },
            {
              type: "comparisonColumn",
              attrs: { side: "right", title: "수정 코드" },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "\\n 출력으로 바꾼다." }],
                },
              ],
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      structure: "dcTable",
    });

    expect(html).toContain('<td width="50%"');
    expect(html).toContain('bgcolor="#fff0ee"');
    expect(html).toContain('bgcolor="#e9f9ef"');
    expect(html).toContain("잘못된 코드");
    expect(html).toContain("수정 코드");
    expect(html).toContain("endl을 반복문 안에서 계속 쓴다.");
    expect(html).toContain("\\n 출력으로 바꾼다.");
    expect(html).toContain("border-left:4px solid");
    expect(html).not.toMatch(/\sclass=/);
    expect(html).not.toMatch(/\sdata-[\w-]+=/);
    expect(html).not.toMatch(/\son[a-z]+=/i);
  });

  it("adds viewer-safe fallback stacks to prose and code font declarations", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "폰트 없는 사람도 읽힌다.",
              marks: [
                {
                  type: "textStyle",
                  attrs: {
                    fontFamily: "Pretendard",
                  },
                },
              ],
            },
          ],
        },
        {
          type: "codeBlock",
          attrs: { language: "cpp" },
          content: [{ type: "text", text: "int main() { return 0; }" }],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      bodyFontFamily: "Inter",
    });

    expect(html).toContain(`font-family:${safeProseFontFamily("Inter")}`);
    expect(html).toContain(`font-family:${safeProseFontFamily("Pretendard")}`);
    expect(html).toContain(`font-family:${codeFallbackFonts.join(", ")}`);
  }, 15_000);

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

    expect(html).toMatch(/^<div style="[^"]*background-color:#[0-9a-f]{6}/);
    expect(html).not.toContain("oklch(");
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

  it("can export a dark editorial document theme with table fallbacks", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "만물큐레이션" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "검은 캔버스에서 읽히는 본문" }],
        },
        {
          type: "sectionHeading",
          content: [{ type: "text", text: "사용 방법 및 예시" }],
        },
        {
          type: "referenceBox",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "인라인 " },
                { type: "text", text: "code", marks: [{ type: "code" }] },
                { type: "text", text: " 색상도 박스에 맞춘다." },
              ],
            },
          ],
        },
        {
          type: "ctaButton",
          attrs: { href: "https://example.com/archive" },
          content: [{ type: "text", text: "아카이브 보기" }],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      documentTheme: "darkEditorial",
      structure: "dcTable",
    });

    expect(html).toMatch(
      /^<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#050505"/,
    );
    expect(html).toMatch(/background-color:#[0-9a-f]{6}/);
    expect(html).toMatch(/color:#[0-9a-f]{6}/);
    expect(html).toContain("만물큐레이션");
    expect(html).toContain("사용 방법 및 예시");
    expect(html).toContain("아카이브 보기");
    expect(html).toContain('href="https://example.com/archive"');
    expect(html).toContain('bgcolor="#0c0c0c"');
    expect(html).toMatch(/background-color:#[0-9a-f]{6}/);
    expect(html).toMatch(/color:#[0-9a-f]{6}/);
    expect(html).not.toContain("oklch(");
    expect(html).not.toMatch(/\sclass=/);
    expect(html).not.toMatch(/\sdata-[\w-]+=/);
    expect(html).not.toMatch(/\son[a-z]+=/i);
  });

  it("keeps blockquotes visually distinct from callout boxes in DC table mode", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "느린 코드는 자료 흐름에서 먼저 걸린다." }],
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      structure: "dcTable",
    });

    expect(html).toContain('bgcolor="#fbfaf2"');
    expect(html).toContain("&ldquo;");
    expect(html).toContain("font-style:italic");
    expect(html).toMatch(/border:1px solid #[0-9a-f]{6}/);
    expect(html).toContain("느린 코드는 자료 흐름에서 먼저 걸린다.");
    expect(html).not.toContain("TIP");
    expect(html).not.toContain("주의");
    expect(html).not.toContain("REF");
    expect(html).not.toContain("POINT");
    expect(html).not.toContain('bgcolor="#e5f6ff"');
  });

  it("exports quote style variants as distinct paste-safe blocks", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          attrs: { quoteStyle: "literary" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "문학적 인용" }],
            },
          ],
        },
        {
          type: "blockquote",
          attrs: { quoteStyle: "academic" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "논문식 인용" }],
            },
          ],
        },
        {
          type: "blockquote",
          attrs: { quoteStyle: "pull" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "한 줄 강조 인용" }],
            },
          ],
        },
        {
          type: "blockquote",
          attrs: { quoteStyle: "bigQuote" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "큰따옴표 인용" }],
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      structure: "dcTable",
    });

    expect(html).toContain("문학적 인용");
    expect(html).toContain("논문식 인용");
    expect(html).toContain("한 줄 강조 인용");
    expect(html).toContain("큰따옴표 인용");
    expect(html).toContain("&ldquo;");
    expect(html).toContain(">QUOTE</span>");
    expect(html).toContain("font-size:21px");
    expect(html).toContain("text-align:center");
    expect(html).toContain("font-size:56px");
    expect(html).toContain("background-color:transparent");
    expect(html).not.toMatch(/\sdata-[\w-]+=/);
    expect(html).not.toMatch(/\sclass=/);
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

  it("exports code block line highlights from code block attrs", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: { language: "javascript", highlightLines: "2,4-5" },
          content: [
            {
              type: "text",
              text: "const a = 1;\nconst b = 2;\nconst c = 3;\nconst d = 4;\nconst e = 5;",
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      showLineNumbers: true,
    });

    expect(html).toContain(">2</span>");
    expect(html).toContain(">5</span>");
    expect(html).toContain(">b</span>");
    expect(html).toContain(">d</span>");
    expect(html).toContain(">e</span>");
    expect(html).toMatch(/background-color:#[0-9a-f]{6}/);
    expect(html).toMatch(/border-left:4px solid #[0-9a-f]{6}/);
    expect(html).not.toContain("oklch(");
  }, 15_000);

  it("exports code block filenames from code block attrs", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: { language: "typescript", filename: "vite.config.ts" },
          content: [{ type: "text", text: "export default {};" }],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, exportOptions);

    expect(html).toContain("vite.config.ts");
    expect(html).toMatch(/border-bottom:1px solid #[0-9a-f]{6}/);
    expect(html).not.toContain("oklch(");
    expect(html).toContain("export");
  }, 15_000);
});
