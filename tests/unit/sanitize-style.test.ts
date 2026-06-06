import { describe, expect, it } from "vitest";
import { sanitizeColor, sanitizeReadableTextColor } from "../../src/lib/dc/sanitize-style";

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

  it("lightens low-contrast text colors on dark backgrounds", () => {
    const readable = sanitizeReadableTextColor(
      "oklch(10% 0.02 255)",
      "oklch(7.2% 0.012 94.1)",
      "oklch(94.12% 0.012 93.37)",
    );
    const lightness = Number(readable.match(/^oklch\((\d+(?:\.\d+)?)%/)?.[1]);

    expect(readable).not.toBe("oklch(10% 0.02 255)");
    expect(lightness).toBeGreaterThan(50);
  });

  it("darkens low-contrast text colors on light backgrounds", () => {
    const readable = sanitizeReadableTextColor(
      "oklch(98% 0.02 90)",
      "oklch(98.38% 0.01 97.33)",
      "oklch(23.39% 0.012 255.51)",
    );
    const lightness = Number(readable.match(/^oklch\((\d+(?:\.\d+)?)%/)?.[1]);

    expect(readable).not.toBe("oklch(98% 0.02 90)");
    expect(lightness).toBeLessThan(80);
  });
});
