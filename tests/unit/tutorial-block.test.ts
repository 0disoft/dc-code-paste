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
          attrs: { number: "01" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "문제 파악" }],
            },
          ],
        },
        {
          type: "tutorialStep",
          attrs: { title: "입출력 계열 고정", number: "02" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "cin/cout만 쓰기로 정한다." }],
            },
          ],
        },
        {
          type: "tutorialStep",
          attrs: { title: "검증", number: "03" },
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

  it("preserves explicit multi-step labels from selected lines", () => {
    const document = createTutorialBlockFromText(
      [
        "04 추가 검증: 작은 입력부터 다시 본다.",
        "5 병목 재측정: 시간 튀는 구간만 따로 잰다.",
        "006 제출 전 확인",
      ].join("\n"),
    );

    expect(document?.content?.map((step) => step.attrs)).toEqual([
      { title: "추가 검증", number: "04" },
      { title: "병목 재측정", number: "05" },
      { number: "006" },
    ]);
  });

  it("keeps title-only tutorial lines editable and parses inline code", () => {
    const document = createTutorialBlockFromText(
      "02 `fcstValue`를 `string`으로 보존하는 `RawItem` 슬라이스로 언마샬한다.",
    );

    expect(document?.content?.[0]).toEqual({
      type: "tutorialStep",
      attrs: { number: "02" },
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "fcstValue", marks: [{ type: "code" }] },
            { type: "text", text: "를 " },
            { type: "text", text: "string", marks: [{ type: "code" }] },
            { type: "text", text: "으로 보존하는 " },
            { type: "text", text: "RawItem", marks: [{ type: "code" }] },
            { type: "text", text: " 슬라이스로 언마샬한다." },
          ],
        },
      ],
    });
  });
});
