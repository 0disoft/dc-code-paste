import {
  createHighlighterCore,
  type HighlighterCore,
  type LanguageInput,
  type ThemeInput,
} from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { renderDcHtml } from "$lib/dc/render-dc-html";
import type { DcLanguageId, DcThemeId } from "./catalog";

const languageInputs: Record<DcLanguageId, LanguageInput> = {
  c: () => import("@shikijs/langs/c").then((module) => module.default),
  cpp: () => import("@shikijs/langs/cpp").then((module) => module.default),
  csharp: () => import("@shikijs/langs/csharp").then((module) => module.default),
  javascript: () => import("@shikijs/langs/javascript").then((module) => module.default),
  typescript: () => import("@shikijs/langs/typescript").then((module) => module.default),
  svelte: () => import("@shikijs/langs/svelte").then((module) => module.default),
  html: () => import("@shikijs/langs/html").then((module) => module.default),
  css: () => import("@shikijs/langs/css").then((module) => module.default),
  php: () => import("@shikijs/langs/php").then((module) => module.default),
  json: () => import("@shikijs/langs/json").then((module) => module.default),
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
  "vitesse-dark": () => import("@shikijs/themes/vitesse-dark").then((module) => module.default),
  "min-light": () => import("@shikijs/themes/min-light").then((module) => module.default),
  dracula: () => import("@shikijs/themes/dracula").then((module) => module.default),
  "one-dark-pro": () => import("@shikijs/themes/one-dark-pro").then((module) => module.default),
};

let highlighterPromise: Promise<HighlighterCore> | undefined;
const languagePromises = new Map<DcLanguageId, Promise<void>>();
const themePromises = new Map<DcThemeId, Promise<void>>();

function getHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= createHighlighterCore({
    engine: createJavaScriptRegexEngine(),
  });

  return highlighterPromise;
}

function loadLanguage(highlighter: HighlighterCore, language: DcLanguageId): Promise<void> {
  if (highlighter.getLoadedLanguages().includes(language)) {
    return Promise.resolve();
  }

  const existing = languagePromises.get(language);
  if (existing) {
    return existing;
  }

  const loading = highlighter.loadLanguage(languageInputs[language]).catch((error: unknown) => {
    languagePromises.delete(language);
    throw error;
  });

  languagePromises.set(language, loading);
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
  fontSize?: string;
};

export async function highlightForDcHtml(code: string, options: HighlightOptions): Promise<string> {
  const highlighter = await getHighlighter();
  await Promise.all([
    loadLanguage(highlighter, options.language),
    loadTheme(highlighter, options.theme),
  ]);

  const highlighted = highlighter.codeToTokens(code || " ", {
    lang: options.language,
    theme: options.theme,
  });

  return renderDcHtml({
    lines: highlighted.tokens,
    background: highlighted.bg ?? "oklch(18.22% 0.017 258.21)",
    foreground: highlighted.fg ?? "oklch(83.86% 0.011 258.34)",
    fontSize: options.fontSize,
    showBackground: options.showBackground,
    showLineNumbers: options.showLineNumbers,
  });
}
