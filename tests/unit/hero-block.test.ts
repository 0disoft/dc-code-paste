import { describe, expect, it } from "vitest";
import { createHeroBlockFromText } from "../../src/lib/editor/hero-block";

describe("createHeroBlockFromText", () => {
  it("turns three selected lines into label, title, and subtitle", () => {
    const document = createHeroBlockFromText(
      [
        "CODEX GUIDE",
        "Codex의 /goal 지시어는 어떻게 쓰는가?",
        "/goal은 작업을 검증 가능한 완료 계약으로 바꾼다.",
      ].join("\n"),
    );

    expect(document).toEqual({
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
    });
  });

  it("leaves the label empty for title and subtitle selections", () => {
    const document = createHeroBlockFromText(
      ["만물큐레이션", "맞춤형 박물관 바이브 해설"].join("\n"),
    );

    expect(document).toMatchObject({
      type: "heroBlock",
      attrs: { label: "" },
      content: [
        {
          type: "heading",
          content: [{ type: "text", text: "만물큐레이션" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "맞춤형 박물관 바이브 해설" }],
        },
      ],
    });
  });

  it("keeps a title-only selection free of sample labels and subtitles", () => {
    expect(createHeroBlockFromText("봄 여행 준비")).toEqual({
      type: "heroBlock",
      attrs: { label: "" },
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "봄 여행 준비" }] },
      ],
    });
  });

  it("preserves an explicit label without inventing a subtitle", () => {
    expect(createHeroBlockFromText("label: 여행 기록\n봄 여행 준비")).toEqual({
      type: "heroBlock",
      attrs: { label: "여행 기록" },
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "봄 여행 준비" }] },
      ],
    });
  });
});
