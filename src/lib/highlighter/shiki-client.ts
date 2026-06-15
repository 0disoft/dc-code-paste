import {
  createHighlighterCore,
  type HighlighterCore,
  type LanguageInput,
  type ThemeInput,
} from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { renderDcHtml, type DcLineDecoration } from "$lib/dc/render-dc-html";
import { highlightedLineIndexes } from "$lib/highlighter/highlight-lines";
import { shikiLanguageFor, type DcLanguageId, type DcThemeId } from "./catalog";

const languageInputs: Record<DcLanguageId, LanguageInput> = {
  c: () => import("@shikijs/langs/c").then((module) => module.default),
  cpp: () => import("@shikijs/langs/cpp").then((module) => module.default),
  csharp: () => import("@shikijs/langs/csharp").then((module) => module.default),
  asm: () => import("@shikijs/langs/asm").then((module) => module.default),
  javascript: () => import("@shikijs/langs/javascript").then((module) => module.default),
  typescript: () => import("@shikijs/langs/typescript").then((module) => module.default),
  jsx: () => import("@shikijs/langs/jsx").then((module) => module.default),
  tsx: () => import("@shikijs/langs/tsx").then((module) => module.default),
  svelte: () => import("@shikijs/langs/svelte").then((module) => module.default),
  astro: () => import("@shikijs/langs/astro").then((module) => module.default),
  html: () => import("@shikijs/langs/html").then((module) => module.default),
  css: () => import("@shikijs/langs/css").then((module) => module.default),
  tailwind: () => import("@shikijs/langs/html").then((module) => module.default),
  unocss: () => import("@shikijs/langs/html").then((module) => module.default),
  php: () => import("@shikijs/langs/php").then((module) => module.default),
  json: () => import("@shikijs/langs/json").then((module) => module.default),
  yaml: () => import("@shikijs/langs/yaml").then((module) => module.default),
  toml: () => import("@shikijs/langs/toml").then((module) => module.default),
  sql: () => import("@shikijs/langs/sql").then((module) => module.default),
  markdown: () => import("@shikijs/langs/markdown").then((module) => module.default),
  mermaid: () => import("@shikijs/langs/mermaid").then((module) => module.default),
  diff: () => import("@shikijs/langs/diff").then((module) => module.default),
  patch: () => import("@shikijs/langs/diff").then((module) => module.default),
  bash: () => import("@shikijs/langs/bash").then((module) => module.default),
  python: () => import("@shikijs/langs/python").then((module) => module.default),
  java: () => import("@shikijs/langs/java").then((module) => module.default),
  go: () => import("@shikijs/langs/go").then((module) => module.default),
  rust: () => import("@shikijs/langs/rust").then((module) => module.default),
  haskell: () => import("@shikijs/langs/haskell").then((module) => module.default),
  scala: () => import("@shikijs/langs/scala").then((module) => module.default),
  zig: () => import("@shikijs/langs/zig").then((module) => module.default),
  julia: () => import("@shikijs/langs/julia").then((module) => module.default),
  mojo: () => import("@shikijs/langs/mojo").then((module) => module.default),
};

const themeInputs: Record<DcThemeId, ThemeInput> = {
  "github-dark": () => import("@shikijs/themes/github-dark").then((module) => module.default),
  "github-light": () => import("@shikijs/themes/github-light").then((module) => module.default),
  "github-dark-dimmed": () =>
    import("@shikijs/themes/github-dark-dimmed").then((module) => module.default),
  "github-dark-high-contrast": () =>
    import("@shikijs/themes/github-dark-high-contrast").then((module) => module.default),
  "github-light-high-contrast": () =>
    import("@shikijs/themes/github-light-high-contrast").then((module) => module.default),
  "vitesse-dark": () => import("@shikijs/themes/vitesse-dark").then((module) => module.default),
  "vitesse-light": () => import("@shikijs/themes/vitesse-light").then((module) => module.default),
  "vitesse-black": () => import("@shikijs/themes/vitesse-black").then((module) => module.default),
  "min-light": () => import("@shikijs/themes/min-light").then((module) => module.default),
  "min-dark": () => import("@shikijs/themes/min-dark").then((module) => module.default),
  dracula: () => import("@shikijs/themes/dracula").then((module) => module.default),
  "dracula-soft": () => import("@shikijs/themes/dracula-soft").then((module) => module.default),
  "one-dark-pro": () => import("@shikijs/themes/one-dark-pro").then((module) => module.default),
  "one-light": () => import("@shikijs/themes/one-light").then((module) => module.default),
  "catppuccin-mocha": () =>
    import("@shikijs/themes/catppuccin-mocha").then((module) => module.default),
  "catppuccin-macchiato": () =>
    import("@shikijs/themes/catppuccin-macchiato").then((module) => module.default),
  "catppuccin-frappe": () =>
    import("@shikijs/themes/catppuccin-frappe").then((module) => module.default),
  "catppuccin-latte": () =>
    import("@shikijs/themes/catppuccin-latte").then((module) => module.default),
  "tokyo-night": () => import("@shikijs/themes/tokyo-night").then((module) => module.default),
  "night-owl": () => import("@shikijs/themes/night-owl").then((module) => module.default),
  "night-owl-light": () =>
    import("@shikijs/themes/night-owl-light").then((module) => module.default),
  nord: () => import("@shikijs/themes/nord").then((module) => module.default),
  "kanagawa-wave": () => import("@shikijs/themes/kanagawa-wave").then((module) => module.default),
  "kanagawa-dragon": () =>
    import("@shikijs/themes/kanagawa-dragon").then((module) => module.default),
  "kanagawa-lotus": () => import("@shikijs/themes/kanagawa-lotus").then((module) => module.default),
  "rose-pine": () => import("@shikijs/themes/rose-pine").then((module) => module.default),
  "rose-pine-moon": () => import("@shikijs/themes/rose-pine-moon").then((module) => module.default),
  "rose-pine-dawn": () => import("@shikijs/themes/rose-pine-dawn").then((module) => module.default),
  "gruvbox-dark-medium": () =>
    import("@shikijs/themes/gruvbox-dark-medium").then((module) => module.default),
  "gruvbox-light-medium": () =>
    import("@shikijs/themes/gruvbox-light-medium").then((module) => module.default),
  "solarized-dark": () => import("@shikijs/themes/solarized-dark").then((module) => module.default),
  "solarized-light": () =>
    import("@shikijs/themes/solarized-light").then((module) => module.default),
  monokai: () => import("@shikijs/themes/monokai").then((module) => module.default),
  "material-theme-palenight": () =>
    import("@shikijs/themes/material-theme-palenight").then((module) => module.default),
  "dark-plus": () => import("@shikijs/themes/dark-plus").then((module) => module.default),
  "light-plus": () => import("@shikijs/themes/light-plus").then((module) => module.default),
};

let highlighterPromise: Promise<HighlighterCore> | undefined;
const languagePromises = new Map<string, Promise<void>>();
const themePromises = new Map<DcThemeId, Promise<void>>();
const lightThemes = new Set<DcThemeId>([
  "github-light",
  "github-light-high-contrast",
  "vitesse-light",
  "min-light",
  "one-light",
  "catppuccin-latte",
  "night-owl-light",
  "kanagawa-lotus",
  "rose-pine-dawn",
  "gruvbox-light-medium",
  "solarized-light",
  "light-plus",
]);

function getHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= createHighlighterCore({
    engine: createJavaScriptRegexEngine(),
  });

  return highlighterPromise;
}

function loadLanguage(highlighter: HighlighterCore, language: DcLanguageId): Promise<void> {
  const shikiLanguage = shikiLanguageFor(language);

  if (highlighter.getLoadedLanguages().includes(shikiLanguage)) {
    return Promise.resolve();
  }

  const existing = languagePromises.get(shikiLanguage);
  if (existing) {
    return existing;
  }

  const loading = highlighter.loadLanguage(languageInputs[language]).catch((error: unknown) => {
    languagePromises.delete(shikiLanguage);
    throw error;
  });

  languagePromises.set(shikiLanguage, loading);
  return loading;
}

function loadTheme(highlighter: HighlighterCore, theme: DcThemeId): Promise<void> {
  if (highlighter.getLoadedThemes().includes(theme)) {
    return Promise.resolve();
  }

  const existing = themePromises.get(theme);
  if (existing) {
    return existing;
  }

  const loading = highlighter.loadTheme(themeInputs[theme]).catch((error: unknown) => {
    themePromises.delete(theme);
    throw error;
  });

  themePromises.set(theme, loading);
  return loading;
}

export type HighlightOptions = {
  language: DcLanguageId;
  theme: DcThemeId;
  showBackground: boolean;
  showLineNumbers: boolean;
  filename?: string;
  fontSize?: string;
  highlightLines?: string;
  additionLines?: string;
  deletionLines?: string;
};

function isLightTheme(theme: DcThemeId) {
  return lightThemes.has(theme);
}

function diffDecorationPalette(theme: DcThemeId) {
  const light = isLightTheme(theme);
  return light
    ? {
        additionBackground: "oklch(93.52% 0.05 145.61 / 0.72)",
        additionForeground: "oklch(36.62% 0.116 145.55)",
        additionBorder: "oklch(61.08% 0.148 145.6)",
        deletionBackground: "oklch(93.29% 0.052 24.96 / 0.78)",
        deletionForeground: "oklch(40.87% 0.133 25.14)",
        deletionBorder: "oklch(62.14% 0.173 26.28)",
        hunkBackground: "oklch(92.31% 0.039 255.19 / 0.78)",
        hunkForeground: "oklch(39.24% 0.095 256.91)",
        hunkBorder: "oklch(61.12% 0.13 254.74)",
      }
    : {
        additionBackground: "oklch(24.12% 0.055 145.21 / 0.86)",
        additionForeground: "oklch(86.72% 0.112 144.92)",
        additionBorder: "oklch(71.44% 0.151 145.1)",
        deletionBackground: "oklch(23.68% 0.056 25.43 / 0.88)",
        deletionForeground: "oklch(85.14% 0.108 25.75)",
        deletionBorder: "oklch(68.76% 0.166 25.64)",
        hunkBackground: "oklch(24.92% 0.045 257.32 / 0.84)",
        hunkForeground: "oklch(84.11% 0.09 254.12)",
        hunkBorder: "oklch(66.24% 0.136 253.1)",
      };
}

type DiffDecorationPalette = ReturnType<typeof diffDecorationPalette>;

function additionDecoration(palette: DiffDecorationPalette) {
  return {
    background: palette.additionBackground,
    foreground: palette.additionForeground,
    borderColor: palette.additionBorder,
  };
}

function deletionDecoration(palette: DiffDecorationPalette) {
  return {
    background: palette.deletionBackground,
    foreground: palette.deletionForeground,
    borderColor: palette.deletionBorder,
  };
}

function diffLineDecorations(code: string, theme: DcThemeId) {
  const palette = diffDecorationPalette(theme);
  return code.split("\n").map((line) => {
    if (line.startsWith("+") && !line.startsWith("+++")) {
      return additionDecoration(palette);
    }

    if (line.startsWith("-") && !line.startsWith("---")) {
      return deletionDecoration(palette);
    }

    if (line.startsWith("@@")) {
      return {
        background: palette.hunkBackground,
        foreground: palette.hunkForeground,
        borderColor: palette.hunkBorder,
      };
    }

    return undefined;
  });
}

function changedLineDecorations(
  code: string,
  theme: DcThemeId,
  additionLines: string | undefined,
  deletionLines: string | undefined,
) {
  const lines = code.split("\n");
  const additionIndexes = highlightedLineIndexes(additionLines, lines.length);
  const deletionIndexes = highlightedLineIndexes(deletionLines, lines.length);

  if (additionIndexes.size === 0 && deletionIndexes.size === 0) {
    return undefined;
  }

  const palette = diffDecorationPalette(theme);

  return lines.map((_, index) => {
    if (deletionIndexes.has(index)) {
      return deletionDecoration(palette);
    }

    if (additionIndexes.has(index)) {
      return additionDecoration(palette);
    }

    return undefined;
  });
}

function highlightedLineDecorations(
  code: string,
  theme: DcThemeId,
  highlightLines: string | undefined,
) {
  const lines = code.split("\n");
  const lineIndexes = highlightedLineIndexes(highlightLines, lines.length);

  if (lineIndexes.size === 0) {
    return undefined;
  }

  const light = isLightTheme(theme);
  const palette = light
    ? {
        background: "oklch(96.4% 0.092 91.8 / 0.86)",
        border: "oklch(75.6% 0.162 91.4)",
      }
    : {
        background: "oklch(30.8% 0.076 91.8 / 0.82)",
        border: "oklch(78.2% 0.142 91.2)",
      };

  return lines.map((_, index) =>
    lineIndexes.has(index)
      ? {
          background: palette.background,
          borderColor: palette.border,
        }
      : undefined,
  );
}

function mergeLineDecorations(
  primary: readonly (DcLineDecoration | undefined)[] | undefined,
  secondary: readonly (DcLineDecoration | undefined)[] | undefined,
) {
  if (!primary) {
    return secondary;
  }

  if (!secondary) {
    return primary;
  }

  return Array.from({ length: Math.max(primary.length, secondary.length) }, (_, index) => {
    return primary[index] ?? secondary[index];
  });
}

export async function highlightForDcHtml(code: string, options: HighlightOptions): Promise<string> {
  const highlighter = await getHighlighter();
  const shikiLanguage = shikiLanguageFor(options.language);
  const sourceCode = code || " ";
  await Promise.all([
    loadLanguage(highlighter, options.language),
    loadTheme(highlighter, options.theme),
  ]);

  const highlighted = highlighter.codeToTokens(sourceCode, {
    lang: shikiLanguage,
    theme: options.theme,
  });
  const diffDecorations =
    shikiLanguage === "diff" ? diffLineDecorations(sourceCode, options.theme) : undefined;
  const changedLines = changedLineDecorations(
    sourceCode,
    options.theme,
    options.additionLines,
    options.deletionLines,
  );
  const lineHighlights = highlightedLineDecorations(
    sourceCode,
    options.theme,
    options.highlightLines,
  );

  return renderDcHtml({
    lines: highlighted.tokens,
    background: highlighted.bg ?? "oklch(18.22% 0.017 258.21)",
    foreground: highlighted.fg ?? "oklch(83.86% 0.011 258.34)",
    filename: options.filename,
    fontSize: options.fontSize,
    showBackground: options.showBackground,
    showLineNumbers: options.showLineNumbers,
    lineDecorations: mergeLineDecorations(
      diffDecorations,
      mergeLineDecorations(changedLines, lineHighlights),
    ),
  });
}
