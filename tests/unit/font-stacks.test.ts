import { describe, expect, it } from "vitest";
import {
  buildFontStack,
  codeFallbackFonts,
  proseFallbackFonts,
  safeCodeFontFamily,
  safeProseFontFamily,
  serifFallbackFonts,
} from "../../src/lib/dc/font-stacks";

describe("font stacks", () => {
  it("keeps selected prose fonts while appending Korean and system fallbacks", () => {
    const stack = safeProseFontFamily("Inter");

    expect(stack.startsWith("Inter, ")).toBe(true);
    expect(stack).toContain("Malgun Gothic");
    expect(stack).toContain("Apple SD Gothic Neo");
    expect(stack).toContain("Pretendard");
    expect(stack).toContain("Noto Sans CJK KR");
    expect(stack).toContain("Nanum Gothic");
    expect(stack).toContain("Spoqa Han Sans Neo");
    expect(stack).toContain("IBM Plex Sans KR");
    expect(stack).toContain("sans-serif");
    expect(stack.split(", ")).toHaveLength(new Set(["Inter", ...proseFallbackFonts]).size);
  });

  it("uses serif fallbacks for serif-like prose selections", () => {
    const stack = safeProseFontFamily("Georgia, Times New Roman, serif");

    expect(stack.startsWith("Georgia, Times New Roman, ")).toBe(true);
    expect(stack).toContain("Noto Serif CJK KR");
    expect(stack).toContain("Nanum Myeongjo");
    expect(stack).toContain("AppleMyungjo");
    expect(stack).toContain("Source Han Serif KR");
    expect(stack).toContain("serif");
    expect(stack.split(", ")).toHaveLength(
      new Set(["Georgia", "Times New Roman", ...serifFallbackFonts]).size,
    );
  });

  it("uses coding fallbacks for code-like selections", () => {
    const stack = safeCodeFontFamily();

    expect(stack).toBe(codeFallbackFonts.join(", "));
    expect(stack).toContain("Consolas");
    expect(stack).toContain("D2Coding");
    expect(stack).toContain("나눔고딕코딩");
    expect(stack).toContain("Nanum Gothic Coding");
    expect(stack).toContain("Noto Sans Mono CJK KR");
    expect(stack).toContain("Cascadia Code");
    expect(stack).toContain("JetBrains Mono");
    expect(stack).toContain("Fira Code");
    expect(stack).toContain("Source Code Pro");
    expect(stack).toContain("monospace");
    expect(buildFontStack(["ui-monospace", "Consolas"], "code")).toBe(stack);
  });

  it("strips unsafe font-family punctuation before export", () => {
    const stack = safeProseFontFamily('Pretendard";color:red');

    expect(stack.startsWith("Pretendardcolorred, ")).toBe(true);
    expect(stack).toContain("Pretendard");
    expect(stack).not.toContain(";");
    expect(stack).not.toContain(":");
  });
});
