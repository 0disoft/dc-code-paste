import { describe, expect, it } from "vitest";
import {
  buildFontStack,
  codeFallbackFonts,
  proseFallbackFonts,
  safeCodeFontFamily,
  safeDcCodeFontFamily,
  safeDcProseFontFamily,
  safeProseFontFamily,
  serifFallbackFonts,
} from "../../src/lib/dc/font-stacks";

describe("font stacks", () => {
  it("keeps selected prose fonts while appending Korean and system fallbacks", () => {
    const stack = safeProseFontFamily("Inter");
    const fonts = stack.split(", ");

    expect(stack.startsWith("Inter, ")).toBe(true);
    expect(stack).toContain("Malgun Gothic");
    expect(stack).toContain("Pretendard");
    expect(stack).toContain("Noto Sans CJK KR");
    expect(stack).toContain("Nanum Gothic");
    expect(fonts).not.toContain("SUIT");
    expect(fonts).not.toContain("Wanted Sans");
    expect(fonts).not.toContain("Spoqa Han Sans Neo");
    expect(fonts).not.toContain("Spoqa Han Sans");
    expect(fonts).not.toContain("Source Han Sans K");
    expect(fonts).not.toContain("Source Han Sans KR");
    expect(fonts).not.toContain("NanumGothic");
    expect(fonts).not.toContain("NanumSquare");
    expect(fonts).not.toContain("NanumBarunGothic");
    expect(fonts).not.toContain("IBM Plex Sans KR");
    expect(fonts).not.toContain("Gmarket Sans");
    expect(fonts).not.toContain("Arial Unicode MS");
    expect(fonts).not.toContain("Apple SD Gothic Neo");
    expect(stack).toContain("sans-serif");
    expect(fonts.indexOf("Pretendard")).toBeLessThan(fonts.indexOf("Segoe UI"));
    expect(fonts.indexOf("Noto Sans KR")).toBeLessThan(fonts.indexOf("Segoe UI"));
    expect(fonts.indexOf("Segoe UI")).toBeLessThan(fonts.indexOf("Malgun Gothic"));
    expect(fonts).toHaveLength(new Set(["Inter", ...proseFallbackFonts]).size);
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
    const fonts = stack.split(", ");

    expect(stack).toBe(codeFallbackFonts.join(", "));
    expect(fonts.slice(0, 3)).toEqual(["Cascadia Mono", "Pretendard", "D2Coding"]);
    expect(stack).toContain("Consolas");
    expect(stack).toContain("Pretendard");
    expect(stack).toContain("D2Coding");
    expect(stack).toContain("나눔고딕코딩");
    expect(fonts).not.toContain("Cascadia Code");
    expect(fonts).not.toContain("Cascadia Mono PL");
    expect(fonts).not.toContain("Cascadia Code PL");
    expect(fonts).not.toContain("D2Coding ligature");
    expect(fonts).not.toContain("D2CodingLigature");
    expect(fonts).not.toContain("NanumGothicCoding");
    expect(fonts).not.toContain("Nanum Gothic Coding");
    expect(fonts).not.toContain("Noto Sans Mono CJK KR");
    expect(fonts).not.toContain("Noto Sans Mono");
    expect(fonts).not.toContain("Source Han Mono K");
    expect(fonts).not.toContain("Source Han Mono KR");
    expect(fonts).not.toContain("Sarasa Mono K");
    expect(fonts).not.toContain("Sarasa Gothic K");
    expect(fonts).not.toContain("Fira Mono");
    expect(fonts).not.toContain("Iosevka");
    expect(fonts).not.toContain("Iosevka Fixed");
    expect(fonts).not.toContain("Monaspace Neon");
    expect(fonts).not.toContain("Monaspace Argon");
    expect(fonts).not.toContain("DejaVu Sans Mono");
    expect(fonts).not.toContain("Liberation Mono");
    expect(fonts).not.toContain("Ubuntu Mono");
    expect(fonts).not.toContain("Bitstream Vera Sans Mono");
    expect(fonts).not.toContain("SFMono-Regular");
    expect(fonts).not.toContain("Lucida Console");
    expect(fonts).not.toContain("Courier New");
    expect(stack).toContain("Noto Sans Mono CJK");
    expect(stack).toContain("Cascadia Mono");
    expect(stack).toContain("JetBrains Mono");
    expect(stack).toContain("Fira Code");
    expect(stack).toContain("Source Code Pro");
    expect(stack).toContain("monospace");
    expect(fonts.indexOf("Cascadia Mono")).toBeLessThan(fonts.indexOf("Consolas"));
    expect(buildFontStack(["ui-monospace", "Consolas"], "code")).toBe(stack);
  });

  it("keeps DC export font stacks compact enough for inline HTML", () => {
    expect(safeDcProseFontFamily(safeProseFontFamily("Inter"))).toBe(
      "Inter, Malgun Gothic, 맑은 고딕, sans-serif",
    );
    expect(safeDcProseFontFamily()).toBe("Malgun Gothic, 맑은 고딕, sans-serif");
    expect(safeDcProseFontFamily("Georgia, Times New Roman, serif")).toBe("Georgia, Batang, serif");
    expect(safeDcCodeFontFamily()).toBe("Cascadia Mono, Pretendard, D2Coding, monospace");
  });

  it("strips unsafe font-family punctuation before export", () => {
    const stack = safeProseFontFamily('Pretendard";color:red');

    expect(stack.startsWith("Pretendardcolorred, ")).toBe(true);
    expect(stack).toContain("Pretendard");
    expect(stack).not.toContain(";");
    expect(stack).not.toContain(":");

    expect(safeDcProseFontFamily('Pretendard";color:red')).toBe(
      "Pretendardcolorred, Malgun Gothic, 맑은 고딕, sans-serif",
    );
  });
});
