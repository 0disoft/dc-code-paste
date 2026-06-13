import { describe, expect, it } from "vitest";
import { createSummaryBoxFromText } from "../../src/lib/editor/summary-box";

describe("createSummaryBoxFromText", () => {
  it("turns selected bullet-like lines into summary items", () => {
    const document = createSummaryBoxFromText(
      ["- 입력 크기를 먼저 본다.", "2. flush가 반복되는지 확인한다.", "자료 흐름을 줄인다."].join(
        "\n",
      ),
    );

    expect(document).toEqual({
      type: "summaryBox",
      attrs: { label: "동시성 핵심" },
      content: [
        {
          type: "summaryItem",
          content: [{ type: "text", text: "입력 크기를 먼저 본다." }],
        },
        {
          type: "summaryItem",
          content: [{ type: "text", text: "flush가 반복되는지 확인한다." }],
        },
        {
          type: "summaryItem",
          content: [{ type: "text", text: "자료 흐름을 줄인다." }],
        },
      ],
    });
  });
});
