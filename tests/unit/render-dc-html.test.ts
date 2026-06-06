import { describe, expect, it } from "vitest";
import { codeFallbackFonts } from "../../src/lib/dc/font-stacks";
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
    expect(html).toContain("margin:0 0 16px");
    expect(html).toContain("background-color:oklch(");
    expect(html).toContain("color:oklch(");
    expect(html).toContain("font-weight:700");
    expect(html).toContain(`font-family:${codeFallbackFonts.join(", ")}`);
    expect(html).toContain("&lt;tag&gt;");
    expect(html).toContain(">1</span>");
    expect(html).not.toContain("#");
  });

  it("keeps multi-digit line numbers from wrapping under global border-box styles", () => {
    const html = renderDcHtml({
      background: "#111111",
      foreground: "#eeeeee",
      showBackground: true,
      showLineNumbers: true,
      lines: Array.from({ length: 12 }, (_, index) => [
        { content: `line ${index + 1}`, color: "#eeeeee" },
      ]),
    });

    expect(html).toContain("width:2ch");
    expect(html).toContain("box-sizing:content-box");
    expect(html).toContain("white-space:pre");
    expect(html).toContain("overflow-wrap:normal");
    expect(html).toContain(">10</span>");
    expect(html).toContain(">12</span>");
  });

  it("keeps space after code blocks before the next exported block", () => {
    const html = renderDcHtml({
      background: "#111111",
      foreground: "#eeeeee",
      showBackground: true,
      showLineNumbers: false,
      lines: [[{ content: "int main() { return 0; }", color: "#eeeeee" }]],
    });

    expect(html).toContain("margin:0 0 16px");
    expect(html).not.toContain("margin:0;");
  });
});
