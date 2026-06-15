import { describe, expect, it } from "vitest";
import { createComparisonBlockFromText } from "../../src/lib/editor/comparison-block";

describe("createComparisonBlockFromText", () => {
  it("turns labelled selected lines into a two-column comparison block", () => {
    const document = createComparisonBlockFromText(
      ["장점: 빠른 입력은 `코드`가 단순하다.", "단점: 섞어 쓰면 출력 순서가 꼬일 수 있다."].join(
        "\n",
      ),
    );

    expect(document).toEqual({
      type: "comparisonBlock",
      content: [
        {
          type: "comparisonColumn",
          attrs: { side: "left", title: "장점" },
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "빠른 입력은 " },
                { type: "text", text: "코드", marks: [{ type: "code" }] },
                { type: "text", text: "가 단순하다." },
              ],
            },
          ],
        },
        {
          type: "comparisonColumn",
          attrs: { side: "right", title: "단점" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "섞어 쓰면 출력 순서가 꼬일 수 있다." }],
            },
          ],
        },
      ],
    });
  });

  it("splits selected lines around a dashed separator when no labels are present", () => {
    const document = createComparisonBlockFromText(
      ["endl을 반복문 안에서 계속 쓴다.", "---", "\\n 출력으로 바꾼다."].join("\n"),
    );

    expect(document).toMatchObject({
      type: "comparisonBlock",
      content: [
        {
          attrs: { side: "left", title: "Before" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "endl을 반복문 안에서 계속 쓴다." }],
            },
          ],
        },
        {
          attrs: { side: "right", title: "After" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "\\n 출력으로 바꾼다." }],
            },
          ],
        },
      ],
    });
  });
});
