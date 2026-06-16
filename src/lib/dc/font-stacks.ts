const genericFontFamilies = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
]);

const serifSignals = new Set(["georgia", "noto serif kr", "times new roman"]);

const codeSignals = new Set([
  "cascadia code",
  "cascadia mono",
  "cascadia code pl",
  "cascadia mono pl",
  "consolas",
  "courier new",
  "d2coding",
  "d2coding ligature",
  "d2codingligature",
  "fira code",
  "hack",
  "jetbrains mono",
  "menlo",
  "monaco",
  "nanum gothic coding",
  "nanumgothiccoding",
  "noto sans mono cjk kr",
  "source code pro",
  "sfmono-regular",
  "나눔고딕코딩",
]);

export const proseFallbackFonts = [
  "Pretendard",
  "Noto Sans KR",
  "Noto Sans CJK KR",
  "본고딕",
  "Nanum Gothic",
  "NanumSquare Neo",
  "나눔고딕",
  "나눔스퀘어",
  "나눔바른고딕",
  "AppleGothic",
  "Segoe UI",
  "Malgun Gothic",
  "맑은 고딕",
  "Noto Sans",
  "Arial",
  "Helvetica Neue",
  "Helvetica",
  "sans-serif",
] as const;

export const serifFallbackFonts = [
  "Noto Serif CJK KR",
  "Noto Serif KR",
  "Noto Serif",
  "Source Han Serif K",
  "Source Han Serif KR",
  "본명조",
  "Nanum Myeongjo",
  "NanumMyeongjo",
  "나눔명조",
  "AppleMyungjo",
  "Apple Myungjo",
  "Georgia",
  "Times New Roman",
  "Times",
  "serif",
] as const;

export const codeFallbackFonts = [
  "Cascadia Mono",
  "Pretendard",
  "D2Coding",
  "나눔고딕코딩",
  "Noto Sans Mono CJK",
  "JetBrains Mono",
  "Fira Code",
  "Hack",
  "Source Code Pro",
  "IBM Plex Mono",
  "Roboto Mono",
  "Consolas",
  "Menlo",
  "Monaco",
  "monospace",
] as const;

export const inlineCodeFallbackFonts = [
  "D2Coding",
  "Pretendard",
  "Cascadia Mono",
  "나눔고딕코딩",
  "Noto Sans Mono CJK",
  "JetBrains Mono",
  "Fira Code",
  "Hack",
  "Source Code Pro",
  "IBM Plex Mono",
  "Roboto Mono",
  "Consolas",
  "Menlo",
  "Monaco",
  "monospace",
] as const;

function normalizeFontName(value: string): string {
  return value
    .trim()
    .replace(/[;'"<>:{}()]/g, "")
    .replace(/\s+/g, " ");
}

function fontKey(value: string): string {
  return value.toLowerCase();
}

function parseFontFamily(value: string): string[] {
  return value.split(",").map(normalizeFontName).filter(Boolean);
}

function hasAnySignal(fonts: readonly string[], signals: ReadonlySet<string>): boolean {
  return fonts.some((font) => signals.has(fontKey(font)));
}

function appendFallbackFonts(
  primaryFonts: readonly string[],
  fallbackFonts: readonly string[],
  separator = ", ",
): string {
  const seen = new Set<string>();
  const stack: string[] = [];

  for (const font of primaryFonts) {
    const key = fontKey(font);

    if (!font || seen.has(key) || genericFontFamilies.has(key)) {
      continue;
    }

    seen.add(key);
    stack.push(font);
  }

  for (const font of fallbackFonts) {
    const key = fontKey(font);

    if (!font || seen.has(key)) {
      continue;
    }

    seen.add(key);
    stack.push(font);
  }

  return stack.join(separator);
}

function fallbackFontsFor(
  primaryFonts: readonly string[],
  mode: "prose" | "code",
): readonly string[] {
  if (mode === "code" || hasAnySignal(primaryFonts, codeSignals)) {
    return codeFallbackFonts;
  }

  if (hasAnySignal(primaryFonts, serifSignals)) {
    return serifFallbackFonts;
  }

  return proseFallbackFonts;
}

function compactProseFallbackFonts(primaryFonts: readonly string[]): readonly string[] {
  if (hasAnySignal(primaryFonts, serifSignals)) {
    return ["Batang", "serif"];
  }

  return ["sans-serif"];
}

export function buildFontStack(
  primaryFonts: readonly string[],
  mode: "prose" | "code" = "prose",
): string {
  const normalizedPrimaryFonts = primaryFonts.map(normalizeFontName).filter(Boolean);

  return appendFallbackFonts(
    mode === "code" ? [] : normalizedPrimaryFonts,
    fallbackFontsFor(normalizedPrimaryFonts, mode),
  );
}

export function safeProseFontFamily(value = ""): string {
  return buildFontStack(parseFontFamily(value), "prose");
}

export function safeCodeFontFamily(value = ""): string {
  return buildFontStack(parseFontFamily(value), "code");
}

export function safeInlineCodeFontFamily(): string {
  return appendFallbackFonts([], inlineCodeFallbackFonts);
}

export function safeDcProseFontFamily(value = ""): string {
  const primaryFonts = parseFontFamily(value);
  const selectedFonts = primaryFonts.length > 0 ? primaryFonts : ["Malgun Gothic"];

  return appendFallbackFonts(
    selectedFonts.slice(0, 1),
    compactProseFallbackFonts(selectedFonts),
    ",",
  );
}

export function safeDcCodeFontFamily(): string {
  return appendFallbackFonts([], ["Cascadia Mono", "D2Coding", "monospace"], ",");
}

export function safeDcInlineCodeFontFamily(): string {
  return appendFallbackFonts([], ["D2Coding", "monospace"], ",");
}

export const defaultProseFontFamily = safeProseFontFamily();
export const defaultCodeFontFamily = safeCodeFontFamily();
