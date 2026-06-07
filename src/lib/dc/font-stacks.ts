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
  "SUIT",
  "Wanted Sans",
  "Spoqa Han Sans Neo",
  "Spoqa Han Sans",
  "Source Han Sans K",
  "Source Han Sans KR",
  "본고딕",
  "Nanum Gothic",
  "NanumGothic",
  "NanumSquare",
  "NanumSquare Neo",
  "NanumBarunGothic",
  "나눔고딕",
  "나눔스퀘어",
  "나눔바른고딕",
  "IBM Plex Sans KR",
  "Gmarket Sans",
  "Arial Unicode MS",
  "Apple SD Gothic Neo",
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
  "Cascadia Code",
  "Cascadia Mono PL",
  "Cascadia Code PL",
  "D2Coding",
  "D2Coding ligature",
  "D2CodingLigature",
  "나눔고딕코딩",
  "NanumGothicCoding",
  "Nanum Gothic Coding",
  "Noto Sans Mono CJK KR",
  "Noto Sans Mono CJK",
  "Noto Sans Mono",
  "Source Han Mono K",
  "Source Han Mono KR",
  "Sarasa Mono K",
  "Sarasa Gothic K",
  "JetBrains Mono",
  "Fira Code",
  "Fira Mono",
  "Hack",
  "Source Code Pro",
  "IBM Plex Mono",
  "Roboto Mono",
  "Iosevka",
  "Iosevka Fixed",
  "Monaspace Neon",
  "Monaspace Argon",
  "DejaVu Sans Mono",
  "Liberation Mono",
  "Ubuntu Mono",
  "Bitstream Vera Sans Mono",
  "Consolas",
  "SFMono-Regular",
  "Menlo",
  "Monaco",
  "Lucida Console",
  "Courier New",
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

  return stack.join(", ");
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

export const defaultProseFontFamily = safeProseFontFamily();
export const defaultCodeFontFamily = safeCodeFontFamily();
