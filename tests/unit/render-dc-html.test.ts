import { describe, expect, it } from "vitest";
import { renderDcHtml } from "../../src/lib/dc/render-dc-html";

describe("renderDcHtml", () => {
  it("renders simple inline-style HTML for rich paste targets", () => {
    const html = renderDcHtml({
      background: "#111111",
      foreground: "#eeeeee",
      showBackground: true,
      showLineNumbers: true,
      lines: [
        [
          { content: "const", color: "#ff0000", fontStyle: 2 },
          { content: " value = ", color: "#eeeeee" },
          { content: "<tag>", color: "#00ff00" },
        ],
      ],
    });

    expect(html).toContain('<pre style="');
    expect(html).toContain("background-color:oklch(");
    expect(html).toContain("color:oklch(");
    expect(html).toContain("font-weight:700");
    expect(html).toContain("&lt;tag&gt;");
    expect(html).toContain(">1</span>");
    expect(html).not.toContain("#");
  });
});
