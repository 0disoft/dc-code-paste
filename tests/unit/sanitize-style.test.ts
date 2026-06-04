import { describe, expect, it } from "vitest";
import { sanitizeColor } from "../../src/lib/dc/sanitize-style";

describe("sanitizeColor", () => {
  it("converts hex colors to oklch for paste HTML", () => {
    expect(sanitizeColor("#ff0000", "oklch(0% 0 0)")).toMatch(/^oklch\(/);
  });

  it("keeps valid oklch colors unchanged", () => {
    expect(sanitizeColor("oklch(72.42% 0.171 22.48)", "oklch(0% 0 0)")).toBe(
      "oklch(72.42% 0.171 22.48)",
    );
  });

  it("rejects non-color style input", () => {
    expect(sanitizeColor("url(javascript:alert(1))", "oklch(0% 0 0)")).toBe("oklch(0% 0 0)");
  });
});
