import { describe, expect, it } from "vitest";
import { createReferenceListFromText } from "../../src/lib/editor/reference-list";

describe("createReferenceListFromText", () => {
  it("turns markdown links and URL lines into reference items", () => {
    const document = createReferenceListFromText(
      [
        "[공식 문서](https://example.com/docs)",
        "구현 저장소 https://github.com/0disoft/dc-code-paste",
        "https://example.com/plain",
      ].join("\n"),
    );

    expect(document).toEqual({
      type: "referenceList",
      content: [
        {
          type: "referenceItem",
          attrs: { href: "https://example.com/docs" },
          content: [{ type: "text", text: "공식 문서" }],
        },
        {
          type: "referenceItem",
          attrs: { href: "https://github.com/0disoft/dc-code-paste" },
          content: [{ type: "text", text: "구현 저장소" }],
        },
        {
          type: "referenceItem",
          attrs: { href: "https://example.com/plain" },
          content: [{ type: "text", text: "example.com/plain" }],
        },
      ],
    });
  });
});
