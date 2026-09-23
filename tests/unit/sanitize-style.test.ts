import { describe, expect, it } from "vitest";
import {
  compositeColor,
  joinStyle,
  sanitizeColor,
  sanitizeReadableTextColor,
} from "../../src/lib/dc/sanitize-style";

function contrastOfHex(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((index) => {
      const value = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe("sanitizeColor", () => {
  it("converts hex colors to oklch for internal contrast checks", () => {
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

  it.each([
    ["#ffffff", "#ffffff"],
    ["#000000", "#000000"],
    ["oklch(0% 0 0 / 0.5)", "#ffffff"],
  ])("checks contrast after compositing on %s", (background, backdrop) => {
    const candidate = sanitizeReadableTextColor(
      "oklch(50% 0 0 / 0.1)",
      background,
      "#000000",
      4.5,
      backdrop,
    );
    const visibleBackground = compositeColor(background, backdrop);
    expect(visibleBackground).toBeDefined();
    const visibleForeground = compositeColor(candidate, visibleBackground);
    expect(visibleForeground).toBeDefined();
    expect(contrastOfHex(visibleForeground!, visibleBackground!)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("joinStyle", () => {
  it("serializes oklch colors as hex for paste targets that reject modern color functions", () => {
    const style = joinStyle({
      color: "oklch(72.42% 0.171 22.48)",
      border: "1px solid oklch(24% 0.05 25 / 0.8)",
      "font-weight": 800,
    });

    expect(style).toMatch(/^color:#[0-9a-f]{6};border:1px solid #[0-9a-f]{6};font-weight:800$/);
    expect(style).not.toContain("oklch(");
  });

  it("composites translucent colors onto the actual background before emitting hex", () => {
    expect(compositeColor("oklch(0% 0 0 / 0)", "#ffffff")).toBe("#ffffff");
    expect(compositeColor("oklch(0% 0 0 / 0.1)", "#ffffff")).toBe("#e6e6e6");
    expect(compositeColor("oklch(100% 0 0 / 0.5)", "#000000")).toBe("#808080");
    expect(compositeColor("oklch(0% 0 0 / 1)", "#ffffff")).toBe("#000000");
    expect(compositeColor("#f008", "#ffffff")).toBe("#ff7777");
    expect(compositeColor("#ff000080", "#000000")).toBe("#800000");
  });

  it("uses the emitted backdrop for text and border colors", () => {
    expect(joinStyle({ "background-color": "#000000", color: "#ffffff80" })).toBe(
      "background-color:#000000;color:#808080",
    );
    expect(joinStyle({ color: "oklch(0% 0 0 / 0.5)" }, "#ffffff")).toBe("color:#808080");
    expect(joinStyle({ color: "oklch(100% 0 0 / 0.5)" }, "#000000")).toBe("color:#808080");
  });

  it("drops non-finite style numbers and invalid color tokens", () => {
    expect(
      joinStyle({ opacity: Number.NaN, width: Number.POSITIVE_INFINITY, color: "#000000" }),
    ).toBe("color:#000000");
    expect(sanitizeColor("oklch(Infinity 0 0)", "#ffffff")).toBe("#ffffff");
  });
});
