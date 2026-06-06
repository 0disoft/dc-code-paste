import { describe, expect, it } from "vitest";
import { createTutorialBlockFromText } from "../../src/lib/editor/tutorial-block";

describe("createTutorialBlockFromText", () => {
  it("turns selected lines into numbered tutorial steps", () => {
    const document = createTutorialBlockFromText(
      [
        "01 문제 파악",
        "입출력 계열 고정: cin/cout만 쓰기로 정한다.",
        "검증 - 기본 코드로 먼저 맞춘다.",
      ].join("\n"),
    );

    expect(document).toEqual({
      type: "tutorialBlock",
      content: [
        {
          type: "tutorialStep",
          attrs: { title: "문제 파악" },
          content: [],
        },
        {
          type: "tutorialStep",
          attrs: { title: "입출력 계열 고정" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "cin/cout만 쓰기로 정한다." }],
            },
          ],
        },
        {
          type: "tutorialStep",
          attrs: { title: "검증" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "기본 코드로 먼저 맞춘다." }],
            },
          ],
        },
      ],
    });
  });
});
