import type { JSONContent } from "@tiptap/core";
import { escapeHtml } from "./escape-html";
import { joinStyle, sanitizeReadableTextColor } from "./sanitize-style";
import {
  defaultLanguage,
  defaultTheme,
  isSupportedLanguage,
  type DcThemeId,
} from "$lib/highlighter/catalog";
import type { CalloutKind } from "$lib/editor/callout";
import { calloutKindFromNodeName, normalizeCalloutKind } from "$lib/editor/callout";
import { createCalloutColorPalette, parseCalloutToneColor } from "$lib/editor/callout-palette";
import { normalizeCtaGroupLayout, type CtaGroupLayout } from "$lib/editor/cta-group";
import { normalizeEditableLinkHref } from "$lib/editor/link";
import { normalizeQuoteStyle, type QuoteStyle } from "$lib/editor/quote-style";
import { normalizeTutorialStepNumber } from "$lib/editor/tutorial-block";
import {
  defaultProseFontFamily,
  safeDcInlineCodeFontFamily as safeInlineCodeFontFamily,
  safeDcProseFontFamily as safeProseFontFamily,
} from "./font-stacks";
import { normalizeCodeFilename } from "$lib/highlighter/code-block-metadata";
import { normalizeHighlightLines } from "$lib/highlighter/highlight-lines";

export type DcExportOptions = {
  theme: DcThemeId;
  bodyFontFamily: string;
  bodyFontSize: string;
  codeFontSize: string;
  showLineNumbers: boolean;
  documentTheme?: DcDocumentTheme;
  structure?: DcExportStructure;
  includeAttribution?: boolean;
};

export type DcExportStructure = "dcTable";
export type DcDocumentTheme = "lightLecture" | "darkEditorial";

const fallbackTextColor = "oklch(23.39% 0.012 255.51)";
const linkColor = "oklch(56.77% 0.154 252.96)";
const articleBackground = "oklch(98.38% 0.01 97.33)";
const inlineCodeBackground = "oklch(94.93% 0.016 255.07)";
const inlineCodeText = "oklch(34.86% 0.087 278.64)";
const quoteAccentColor = "oklch(61.2% 0.049 77.83)";
const quoteTextColor = "oklch(37.24% 0.026 77.36)";
const quoteMarkColor = "oklch(74.61% 0.063 77.91)";
const defaultBodyFontSize = "17px";
const defaultCodeFontSize = "15px";
const dcLightPageBackground = "#ffffff";
const dcDarkPageBackground = "#151515";
const dcDarkPanelBackground = "#1b1b1b";
const attributionHref = "https://0disoft.github.io/dc-code-paste/";
const attributionText = "Created with dc-code-paste";

type DocumentPalette = {
  articleBackground: string;
  fallbackBackground: string;
  text: string;
  mutedText: string;
  heading: string;
  link: string;
  divider: string;
  inlineCodeBackground: string;
  inlineCodeText: string;
  quoteBackground: string;
  quoteText: string;
  quoteAccent: string;
  quoteMark: string;
  sectionText: string;
  sectionAccent: string;
  sectionBorder: string;
  ctaBackground: string;
  ctaBorder: string;
  ctaText: string;
  attribution: string;
};

type RenderContext = {
  text?: string;
  background?: string;
  inlineCodeBackground?: string;
  inlineCodeText?: string;
  proseTableSafe?: boolean;
};

function normalizeDocumentTheme(value: DcDocumentTheme | undefined): DcDocumentTheme {
  return value === "darkEditorial" ? "darkEditorial" : "lightLecture";
}

function documentPalette(options: DcExportOptions): DocumentPalette {
  if (normalizeDocumentTheme(options.documentTheme) === "darkEditorial") {
    return {
      articleBackground: dcDarkPageBackground,
      fallbackBackground: dcDarkPageBackground,
      text: "#e8e8e8",
      mutedText: "#b8b8b8",
      heading: "#f4f4f4",
      link: "#8ab4f8",
      divider: "#343434",
      inlineCodeBackground: "#252525",
      inlineCodeText: "#f2f2f2",
      quoteBackground: dcDarkPageBackground,
      quoteText: "#dddddd",
      quoteAccent: "#d7bd77",
      quoteMark: "#c9ad67",
      sectionText: "#f4f4f4",
      sectionAccent: "#d7bd77",
      sectionBorder: "#383838",
      ctaBackground: "oklch(91.44% 0.064 90.52)",
      ctaBorder: "oklch(96.28% 0.022 90.84)",
      ctaText: "oklch(13.77% 0.018 87.82)",
      attribution: "#787878",
    };
  }

  return {
    articleBackground: dcLightPageBackground,
    fallbackBackground: dcLightPageBackground,
    text: fallbackTextColor,
    mutedText: "oklch(43.22% 0.022 255.32)",
    heading: "oklch(24.19% 0.019 255.77)",
    link: linkColor,
    divider: "oklch(86.22% 0.014 255.48)",
    inlineCodeBackground,
    inlineCodeText,
    quoteBackground: articleBackground,
    quoteText: quoteTextColor,
    quoteAccent: quoteAccentColor,
    quoteMark: quoteMarkColor,
    sectionText: "oklch(25.72% 0.021 255.63)",
    sectionAccent: quoteAccentColor,
    sectionBorder: "oklch(83.11% 0.026 78.4)",
    ctaBackground: "oklch(93.5% 0.044 88.16)",
    ctaBorder: "oklch(70.74% 0.08 82.27)",
    ctaText: "oklch(26.32% 0.03 80.84)",
    attribution: "#c9c1b5",
  };
}

const dcTableFallbackColors = {
  articleBackground: dcLightPageBackground,
  tipBackground: "#e6fbe4",
  warningBackground: "#fff1cf",
  referenceBackground: "#e5f6ff",
  emphasisBackground: "#f4eaff",
  successBackground: "#e7faee",
  failureBackground: "#ffe8e5",
  experimentBackground: "#eaf1ff",
  conclusionBackground: "#fff7d9",
  rebuttalBackground: "#ffe9f5",
  quoteBackground: dcLightPageBackground,
};

const calloutStyles: Record<
  CalloutKind,
  {
    label: string;
    background: string;
    border: string;
    text: string;
  }
> = {
  tip: {
    label: "TIP",
    background: "oklch(96.48% 0.047 142.49)",
    border: "oklch(70.89% 0.156 142.5)",
    text: "oklch(30.18% 0.073 145.31)",
  },
  warning: {
    label: "주의",
    background: "oklch(96.87% 0.048 75.17)",
    border: "oklch(73.08% 0.151 60.74)",
    text: "oklch(34.21% 0.082 52.58)",
  },
  reference: {
    label: "REF",
    background: "oklch(96.27% 0.036 247.39)",
    border: "oklch(68.74% 0.127 246.28)",
    text: "oklch(32.26% 0.07 249.42)",
  },
  emphasis: {
    label: "POINT",
    background: "oklch(96.21% 0.036 302.35)",
    border: "oklch(64.73% 0.162 303.08)",
    text: "oklch(33.84% 0.091 303.69)",
  },
  success: {
    label: "성공",
    background: "oklch(96.12% 0.041 152.76)",
    border: "oklch(66.42% 0.152 154.12)",
    text: "oklch(29.24% 0.08 154.12)",
  },
  failure: {
    label: "실패",
    background: "oklch(96.23% 0.039 24.18)",
    border: "oklch(62.42% 0.178 24.04)",
    text: "oklch(34.1% 0.098 24.62)",
  },
  experiment: {
    label: "실험",
    background: "oklch(96.2% 0.032 264.42)",
    border: "oklch(62.11% 0.15 263.9)",
    text: "oklch(31.56% 0.081 264.1)",
  },
  conclusion: {
    label: "결론",
    background: "oklch(96.87% 0.042 94.2)",
    border: "oklch(72.44% 0.119 91.73)",
    text: "oklch(34.5% 0.065 88.3)",
  },
  rebuttal: {
    label: "반박",
    background: "oklch(96.1% 0.038 330.12)",
    border: "oklch(64.8% 0.157 330.2)",
    text: "oklch(34.4% 0.096 329.55)",
  },
};

const darkCalloutStyles: Record<
  CalloutKind,
  {
    label: string;
    background: string;
    border: string;
    text: string;
  }
> = {
  tip: {
    label: "TIP",
    background: "oklch(11.52% 0.012 142.78)",
    border: "oklch(62.6% 0.082 142.04)",
    text: "oklch(90.44% 0.018 143.2)",
  },
  warning: {
    label: "주의",
    background: "oklch(11.9% 0.012 58.76)",
    border: "oklch(64.8% 0.078 69.41)",
    text: "oklch(91.32% 0.02 76.33)",
  },
  reference: {
    label: "REF",
    background: "oklch(11.28% 0.014 245.9)",
    border: "oklch(60.74% 0.082 232.16)",
    text: "oklch(90.58% 0.02 233.82)",
  },
  emphasis: {
    label: "POINT",
    background: "oklch(11.68% 0.015 302.17)",
    border: "oklch(61.88% 0.086 303.45)",
    text: "oklch(91.78% 0.02 303.2)",
  },
  success: {
    label: "성공",
    background: "oklch(11.42% 0.013 154.8)",
    border: "oklch(62.88% 0.084 154.54)",
    text: "oklch(91% 0.02 154.17)",
  },
  failure: {
    label: "실패",
    background: "oklch(11.66% 0.014 24.58)",
    border: "oklch(62.2% 0.09 24.82)",
    text: "oklch(91.88% 0.02 24.92)",
  },
  experiment: {
    label: "실험",
    background: "oklch(11.16% 0.014 264.32)",
    border: "oklch(61.26% 0.084 264.2)",
    text: "oklch(91.16% 0.021 264.14)",
  },
  conclusion: {
    label: "결론",
    background: "oklch(11.84% 0.012 91.22)",
    border: "oklch(66.4% 0.074 91.43)",
    text: "oklch(92.08% 0.018 91.42)",
  },
  rebuttal: {
    label: "반박",
    background: "oklch(11.76% 0.015 330.24)",
    border: "oklch(62.42% 0.088 330.36)",
    text: "oklch(91.82% 0.021 330.24)",
  },
};

function calloutStyleFor(kind: CalloutKind, options: DcExportOptions, node?: JSONContent) {
  const toneColor = parseCalloutToneColor(node?.attrs?.toneColor);

  if (toneColor) {
    const palette = createCalloutColorPalette(
      toneColor,
      kind,
      normalizeDocumentTheme(options.documentTheme) === "darkEditorial" ? "dark" : "light",
    );
    return {
      label: calloutStyles[kind].label,
      background: palette.background,
      border: palette.border,
      text: palette.text,
    };
  }

  return normalizeDocumentTheme(options.documentTheme) === "darkEditorial"
    ? darkCalloutStyles[kind]
    : calloutStyles[kind];
}

function labelFromAttrs(node: JSONContent, fallback: string): string {
  const label = typeof node.attrs?.label === "string" ? node.attrs.label.trim() : "";
  return label || fallback;
}

function calloutFallbackBackground(
  kind: CalloutKind,
  options: DcExportOptions,
  node?: JSONContent,
): string {
  const toneColor = parseCalloutToneColor(node?.attrs?.toneColor);

  if (toneColor) {
    return createCalloutColorPalette(
      toneColor,
      kind,
      normalizeDocumentTheme(options.documentTheme) === "darkEditorial" ? "dark" : "light",
    ).fallbackBackground;
  }

  if (normalizeDocumentTheme(options.documentTheme) === "darkEditorial") {
    return dcDarkPanelBackground;
  }

  return dcTableFallbackColors[`${kind}Background`];
}

const calloutInlineCodeStyles: Record<
  CalloutKind,
  {
    background: string;
    text: string;
  }
> = {
  tip: {
    background: "oklch(34.32% 0.101 145.21)",
    text: "oklch(98.1% 0.011 143.87)",
  },
  warning: {
    background: "oklch(39.74% 0.105 54.78)",
    text: "oklch(98.68% 0.013 76.42)",
  },
  reference: {
    background: "oklch(34.82% 0.092 249.7)",
    text: "oklch(98.22% 0.011 245.12)",
  },
  emphasis: {
    background: "oklch(36.58% 0.112 303.92)",
    text: "oklch(98.29% 0.012 303.21)",
  },
  success: {
    background: "oklch(33.92% 0.103 154.72)",
    text: "oklch(98.12% 0.011 154.48)",
  },
  failure: {
    background: "oklch(36.31% 0.116 24.62)",
    text: "oklch(98.44% 0.013 25.04)",
  },
  experiment: {
    background: "oklch(34.92% 0.104 264.18)",
    text: "oklch(98.18% 0.012 264.12)",
  },
  conclusion: {
    background: "oklch(39.22% 0.092 91.72)",
    text: "oklch(98.48% 0.013 91.12)",
  },
  rebuttal: {
    background: "oklch(36.14% 0.108 330.22)",
    text: "oklch(98.26% 0.012 330.18)",
  },
};

function childrenOf(node: JSONContent): JSONContent[] {
  return Array.isArray(node.content) ? node.content : [];
}

function textOf(node: JSONContent): string {
  if (typeof node.text === "string") {
    return node.text;
  }

  return childrenOf(node).map(textOf).join("");
}

function hasRenderableDocumentContent(node: JSONContent): boolean {
  if (typeof node.text === "string" && node.text.trim()) {
    return true;
  }

  if (node.type === "horizontalRule") {
    return true;
  }

  return childrenOf(node).some(hasRenderableDocumentContent);
}

function safeSize(value: string, fallback: string): string {
  const normalized = value.trim();
  return /^\d{1,2}px$/.test(normalized) ? normalized : fallback;
}

function safeBodyFontSize(options: DcExportOptions): string {
  return safeSize(options.bodyFontSize, defaultBodyFontSize);
}

function proseLabelFont(options: DcExportOptions, lineHeight?: number): string {
  const family = safeProseFontFamily(options.bodyFontFamily).split(",")[0] ?? "Pretendard";
  return lineHeight ? `700 12px/${lineHeight} ${family}` : `700 12px ${family}`;
}

function safeCodeFontSize(options: DcExportOptions): string {
  return safeSize(options.codeFontSize, defaultCodeFontSize);
}

function safeHeadingLevel(value: unknown): 1 | 2 | 3 | 4 | 5 | 6 {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 || value === 6
    ? value
    : 2;
}

function isDcTableStructure(_options: DcExportOptions): boolean {
  return true;
}

function parseStyleDeclaration(part: string): { property: string; value: string } | undefined {
  const separator = part.indexOf(":");

  if (separator === -1) {
    return undefined;
  }

  const property = part.slice(0, separator).trim().toLowerCase();
  const value = part.slice(separator + 1).trim();

  return property && value ? { property, value } : undefined;
}

function styleHasDeclaration(style: string, property: string, value: string): boolean {
  const expectedProperty = property.toLowerCase();

  return style.split(";").some((part) => {
    const declaration = parseStyleDeclaration(part);
    return declaration?.property === expectedProperty && declaration.value === value;
  });
}

function removeStyleDeclaration(style: string, property: string, value: string): string {
  const expectedProperty = property.toLowerCase();

  return style
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => {
      const declaration = parseStyleDeclaration(part);
      return declaration?.property !== expectedProperty || declaration.value !== value;
    })
    .join(";");
}

function canCompactInheritedProseStyle(tagName: string): boolean {
  return tagName === "table" || tagName === "div" || tagName === "section";
}

function compactInheritedProseStyles(html: string, options: DcExportOptions): string {
  const inheritedFontSize = safeBodyFontSize(options);
  const inheritedFontFamily = safeProseFontFamily(options.bodyFontFamily);
  let keptInheritedFontSizeCount = 0;
  let keptInheritedFontFamilyCount = 0;

  return html.replace(
    /<([a-z][\w-]*)([^<>]*?)\sstyle="([^"]*)"/gi,
    (_match, tagName: string, beforeStyle: string, rawStyle: string) => {
      let style = rawStyle;
      const normalizedTagName = tagName.toLowerCase();
      const preservesCellStyle = normalizedTagName === "td" || normalizedTagName === "th";
      const isCompactableWrapper = canCompactInheritedProseStyle(normalizedTagName);

      if (styleHasDeclaration(style, "font-family", inheritedFontFamily)) {
        if (!preservesCellStyle && keptInheritedFontFamilyCount >= 2) {
          style = removeStyleDeclaration(style, "font-family", inheritedFontFamily);
        } else if (
          keptInheritedFontFamilyCount < 2 &&
          (preservesCellStyle || isCompactableWrapper)
        ) {
          keptInheritedFontFamilyCount += 1;
        }
      }

      if (styleHasDeclaration(style, "font-size", inheritedFontSize)) {
        if (!preservesCellStyle && keptInheritedFontSizeCount >= 2) {
          style = removeStyleDeclaration(style, "font-size", inheritedFontSize);
        } else if (keptInheritedFontSizeCount < 2 && (preservesCellStyle || isCompactableWrapper)) {
          keptInheritedFontSizeCount += 1;
        }
      }

      return style ? `<${tagName}${beforeStyle} style="${style}"` : `<${tagName}${beforeStyle}`;
    },
  );
}

function renderAttributionFooter(options: DcExportOptions): string {
  const palette = documentPalette(options);
  const isDarkDocument = normalizeDocumentTheme(options.documentTheme) === "darkEditorial";
  const linkOpacity = isDarkDocument ? 0.34 : 0.18;
  const tableStyle = joinStyle({
    margin: "20px 0 0",
    "border-collapse": "collapse",
  });
  const cellStyle = joinStyle({
    padding: "8px 0 0",
    "text-align": "right",
    color: palette.attribution,
    "font-size": "12px",
    "line-height": 1.4,
  });
  const linkStyle = joinStyle({
    color: palette.attribution,
    opacity: linkOpacity,
    "text-decoration": "none",
  });

  return `<table width="100%" style="${tableStyle}"><tbody><tr><td align="right" style="${cellStyle}"><a href="${attributionHref}" target="_blank" rel="noopener noreferrer" style="${linkStyle}">${attributionText}</a></td></tr></tbody></table>`;
}

function renderDcTableBlock({
  body,
  options,
  backgroundColor,
  fallbackBackground,
  borderColor,
  border,
  borderTop,
  borderBottom,
  padding = "12px 14px",
}: {
  body: string;
  options: DcExportOptions;
  backgroundColor: string;
  fallbackBackground: string;
  borderColor?: string;
  border?: string;
  borderTop?: string;
  borderBottom?: string;
  padding?: string;
}): string {
  const tableStyle = joinStyle({
    width: "100%",
    margin: "0 0 16px",
    "border-collapse": "collapse",
    "background-color": backgroundColor,
    "border-left": borderColor ? `4px solid ${borderColor}` : undefined,
    border,
    "border-top": borderTop,
    "border-bottom": borderBottom,
  });
  const cellStyle = joinStyle({
    padding,
    "background-color": backgroundColor,
    "font-size": safeBodyFontSize(options),
  });

  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${fallbackBackground}" style="${tableStyle}"><tbody><tr><td style="${cellStyle}">${body}</td></tr></tbody></table>`;
}

function renderDcProseCellBlock({
  body,
  options,
  color,
  margin,
  fontSize,
  fontWeight,
  lineHeight,
}: {
  body: string;
  options: DcExportOptions;
  color: string;
  margin: string;
  fontSize: string;
  fontWeight?: number;
  lineHeight: number;
}): string {
  const tableStyle = joinStyle({
    width: "100%",
    margin,
    "border-collapse": "collapse",
  });
  const cellStyle = joinStyle({
    padding: "0",
    color,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": fontSize,
    "font-weight": fontWeight,
    "line-height": lineHeight,
  });

  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="${tableStyle}"><tbody><tr><td style="${cellStyle}">${body}</td></tr></tbody></table>`;
}

function safeHref(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  const href = normalizeEditableLinkHref(trimmed);

  if (!href) {
    return undefined;
  }

  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? escapeHtml(trimmed) : escapeHtml(href);
}

function normalizedHref(value: unknown): string | undefined {
  return typeof value === "string" ? normalizeEditableLinkHref(value) : undefined;
}

function visibleLinkLabel(href: string): string {
  try {
    const url = new URL(href);
    const path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
    return `${url.hostname}${path}` || href;
  } catch {
    return href.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  }
}

function isOnlyHrefText(text: string, href: string): boolean {
  const normalizedText = normalizeEditableLinkHref(text);
  return normalizedText === href;
}

function renderTextStyle(
  mark: JSONContent,
  palette: DocumentPalette,
  context: RenderContext,
): Record<string, string | undefined> {
  const attrs = mark.attrs ?? {};
  const color =
    typeof attrs.color === "string"
      ? sanitizeReadableTextColor(
          attrs.color,
          context.background ?? palette.articleBackground,
          context.text ?? palette.text,
        )
      : undefined;
  const fontFamily =
    typeof attrs.fontFamily === "string" ? safeProseFontFamily(attrs.fontFamily) : undefined;
  const fontSize = typeof attrs.fontSize === "string" ? safeSize(attrs.fontSize, "") : undefined;

  return {
    color,
    "font-family": fontFamily,
    "font-size": fontSize,
  };
}

function applyMarks(
  text: string,
  marks: readonly JSONContent[] | undefined,
  options: DcExportOptions,
  context: RenderContext = {},
): string {
  const palette = documentPalette(options);
  let html = escapeHtml(text).replace(/\n/g, "<br>");

  for (const mark of marks ?? []) {
    if (mark.type === "bold") {
      html = `<strong style="font-weight:700">${html}</strong>`;
      continue;
    }

    if (mark.type === "italic") {
      html = `<em style="font-style:italic">${html}</em>`;
      continue;
    }

    if (mark.type === "code") {
      const style = joinStyle({
        "background-color": context.inlineCodeBackground ?? palette.inlineCodeBackground,
        color: context.inlineCodeText ?? palette.inlineCodeText,
        "font-family": safeInlineCodeFontFamily(),
        "font-size": ".92em",
        "font-weight": 700,
        padding: "1px 4px",
        "border-radius": "4px",
      });
      html = `<code style="${style}">${html}</code>`;
      continue;
    }

    if (mark.type === "link") {
      const href = safeHref(mark.attrs?.href);
      const style = joinStyle({
        color: palette.link,
        "font-weight": 700,
        "text-decoration": "underline",
        "text-underline-offset": "2px",
      });

      if (href) {
        html = `<a href="${href}" target="_blank" rel="noopener noreferrer" style="${style}">${html}</a>`;
      }
      continue;
    }

    if (mark.type === "textStyle") {
      const style = joinStyle(renderTextStyle(mark, palette, context));
      if (style) {
        html = `<span style="${style}">${html}</span>`;
      }
    }
  }

  return html;
}

function renderInline(
  node: JSONContent,
  options: DcExportOptions,
  context: RenderContext = {},
): string {
  if (node.type === "text") {
    return applyMarks(node.text ?? "", node.marks, options, context);
  }

  if (node.type === "hardBreak") {
    return "<br>";
  }

  return childrenOf(node)
    .map((child) => renderInline(child, options, context))
    .join("");
}

function renderInlineChildren(
  node: JSONContent,
  options: DcExportOptions,
  context: RenderContext = {},
): string {
  return childrenOf(node)
    .map((child) => renderInline(child, options, context))
    .join("");
}

function renderParagraph(
  node: JSONContent,
  options: DcExportOptions,
  context: RenderContext = {},
): string {
  const palette = documentPalette(options);
  const body = renderInlineChildren(node, options, context) || "&nbsp;";

  if (isDcTableStructure(options) && context.proseTableSafe) {
    return renderDcProseCellBlock({
      body,
      options,
      color: context.text ?? palette.text,
      margin: "0 0 14px",
      fontSize: safeBodyFontSize(options),
      lineHeight: 1.72,
    });
  }

  const paragraphStyle = joinStyle({
    margin: "0 0 14px",
  });
  const textStyle = joinStyle({
    color: context.text ?? palette.text,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": safeBodyFontSize(options),
    "line-height": 1.72,
  });

  return `<p style="${paragraphStyle}"><span style="${textStyle}">${body}</span></p>`;
}

function renderHeading(node: JSONContent, options: DcExportOptions): string {
  const palette = documentPalette(options);
  const level = safeHeadingLevel(node.attrs?.level);
  const size = level === 1 ? "24px" : level === 2 ? "20px" : "17px";
  const style = joinStyle({
    margin: "22px 0 12px",
    color: palette.heading,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": size,
    "font-weight": 700,
    "line-height": 1.28,
  });
  const body = renderInlineChildren(node, options) || "&nbsp;";

  if (isDcTableStructure(options)) {
    return renderDcProseCellBlock({
      body,
      options,
      color: palette.heading,
      margin: "22px 0 12px",
      fontSize: size,
      fontWeight: 700,
      lineHeight: 1.28,
    });
  }

  return `<h${level} style="${style}">${body}</h${level}>`;
}

async function renderList(
  node: JSONContent,
  options: DcExportOptions,
  ordered: boolean,
): Promise<string> {
  const palette = documentPalette(options);
  const listItemContext: RenderContext = {
    text: palette.text,
    background: palette.articleBackground,
    inlineCodeBackground: palette.inlineCodeBackground,
    inlineCodeText: palette.inlineCodeText,
    proseTableSafe: true,
  };

  if (isDcTableStructure(options)) {
    const proseFontFamily = safeProseFontFamily(options.bodyFontFamily);
    const bodyFontSize = safeBodyFontSize(options);
    const tableStyle = joinStyle({
      width: "100%",
      margin: "0 0 14px",
      "border-collapse": "collapse",
    });
    const markerCellStyle = joinStyle({
      width: "22px",
      padding: "0 9px 7px 0",
      color: palette.text,
      "font-family": proseFontFamily,
      "font-size": bodyFontSize,
      "line-height": 1.7,
      "text-align": ordered ? "right" : "center",
      "vertical-align": "top",
      "white-space": "nowrap",
    });
    const markerTextStyle = joinStyle({
      color: palette.text,
      "font-family": proseFontFamily,
      "font-size": bodyFontSize,
      "line-height": 1.7,
      "white-space": "nowrap",
    });
    const bodyCellStyle = joinStyle({
      padding: "0 0 7px",
      color: palette.text,
      "font-family": proseFontFamily,
      "font-size": bodyFontSize,
      "line-height": 1.7,
      "vertical-align": "top",
    });
    const bodyTextStyle = joinStyle({
      color: palette.text,
      "font-family": proseFontFamily,
      "font-size": bodyFontSize,
      "line-height": 1.7,
    });
    const rows = await Promise.all(
      childrenOf(node).map(async (item, index) => {
        const marker = ordered ? `${index + 1}.` : "&bull;";
        const body = await renderListItemBody(item, options, listItemContext, bodyTextStyle);

        return `<tr><td width="22" style="${markerCellStyle}"><span style="${markerTextStyle}">${marker}</span></td><td style="${bodyCellStyle}">${body}</td></tr>`;
      }),
    );

    return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="${tableStyle}"><tbody>${rows.join("")}</tbody></table>`;
  }

  const tag = ordered ? "ol" : "ul";
  const listStyle = joinStyle({
    margin: "0 0 14px",
    padding: "0 0 0 24px",
    color: palette.text,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": safeBodyFontSize(options),
    "line-height": 1.7,
  });
  const items = await Promise.all(
    childrenOf(node).map(async (item) => {
      const body = await Promise.all(
        childrenOf(item).map((child) => renderBlockAsync(child, options)),
      );
      return `<li style="margin:0 0 6px">${body.join("")}</li>`;
    }),
  );

  return `<${tag} style="${listStyle}">${items.join("")}</${tag}>`;
}

async function renderListItemBody(
  item: JSONContent,
  options: DcExportOptions,
  context: RenderContext,
  textStyle: string,
): Promise<string> {
  const parts = await Promise.all(
    childrenOf(item).map(async (child) => {
      if (child.type === "paragraph") {
        const body = renderInlineChildren(child, options, context) || "&nbsp;";
        return `<span style="${textStyle}">${body}</span>`;
      }

      return renderBlockAsync(child, options, context);
    }),
  );
  const body = parts.filter(Boolean).join("<br>");

  return body || "&nbsp;";
}

function renderDataTable(node: JSONContent, options: DcExportOptions): string {
  const palette = documentPalette(options);
  const isDarkEditorial = normalizeDocumentTheme(options.documentTheme) === "darkEditorial";
  const tableBorder = isDarkEditorial ? "#3a3a3a" : "#d8d2c4";
  const headerBackground = isDarkEditorial ? "#242424" : "#f3eadb";
  const cellBackground = isDarkEditorial ? dcDarkPageBackground : dcLightPageBackground;
  const tableStyle = joinStyle({
    width: "100%",
    margin: "0 0 16px",
    "border-collapse": "collapse",
    "table-layout": "fixed",
    color: palette.text,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": safeBodyFontSize(options),
    "line-height": 1.62,
  });
  const rows = childrenOf(node)
    .map((row) => {
      const cells = childrenOf(row)
        .map((cell) => {
          const isHeader = cell.attrs?.header === true;
          const tag = isHeader ? "th" : "td";
          const cellStyle = joinStyle({
            padding: isHeader ? "8px 10px" : "9px 10px",
            border: `1px solid ${tableBorder}`,
            "background-color": isHeader ? headerBackground : cellBackground,
            color: isHeader ? palette.heading : undefined,
            "font-family": safeProseFontFamily(options.bodyFontFamily),
            "font-size": safeBodyFontSize(options),
            "font-weight": isHeader ? 700 : undefined,
            "line-height": 1.62,
            "text-align": "left",
            "vertical-align": "top",
            "word-break": "keep-all",
            "overflow-wrap": "break-word",
          });
          const body = renderInlineChildren(cell, options, {
            text: isHeader ? palette.heading : palette.text,
            background: isHeader ? headerBackground : cellBackground,
            inlineCodeBackground: palette.inlineCodeBackground,
            inlineCodeText: palette.inlineCodeText,
          });

          return `<${tag} style="${cellStyle}">${body || "&nbsp;"}</${tag}>`;
        })
        .join("");

      return cells ? `<tr>${cells}</tr>` : "";
    })
    .filter(Boolean)
    .join("");

  return rows
    ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${palette.fallbackBackground}" style="${tableStyle}"><tbody>${rows}</tbody></table>`
    : "";
}

async function renderCallout(
  node: JSONContent,
  options: DcExportOptions,
  explicitKind?: CalloutKind,
): Promise<string> {
  const kind = explicitKind ?? normalizeCalloutKind(node.attrs?.kind);
  const palette = calloutStyleFor(kind, options, node);
  const customToneColor = parseCalloutToneColor(node.attrs?.toneColor);
  const customPalette = customToneColor
    ? createCalloutColorPalette(
        customToneColor,
        kind,
        normalizeDocumentTheme(options.documentTheme) === "darkEditorial" ? "dark" : "light",
      )
    : undefined;
  const codePalette = customPalette
    ? {
        background: customPalette.inlineCodeBackground,
        text: customPalette.inlineCodeText,
      }
    : calloutInlineCodeStyles[kind];
  const childContext: RenderContext = {
    text: palette.text,
    background: palette.background,
    inlineCodeBackground: codePalette.background,
    inlineCodeText: codePalette.text,
  };
  const labelStyle = joinStyle({
    display: "block",
    margin: "0 0 6px",
    color: palette.text,
    font: proseLabelFont(options),
    "letter-spacing": "0",
  });
  const body = await Promise.all(
    childrenOf(node).map((child) => renderBlockAsync(child, options, childContext)),
  );
  const content = `<span style="${labelStyle}">${escapeHtml(labelFromAttrs(node, palette.label))}</span>${body.join("")}`;

  if (isDcTableStructure(options)) {
    return renderDcTableBlock({
      body: content,
      options,
      backgroundColor: palette.background,
      fallbackBackground: calloutFallbackBackground(kind, options, node),
      borderColor: palette.border,
    });
  }

  const wrapperStyle = joinStyle({
    margin: "0 0 16px",
    padding: "12px 14px",
    "border-left": `4px solid ${palette.border}`,
    "background-color": palette.background,
    color: palette.text,
    "border-radius": "7px",
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": safeBodyFontSize(options),
    "line-height": 1.68,
  });

  return `<div style="${wrapperStyle}">${content}</div>`;
}

async function renderLinkBox(node: JSONContent, options: DcExportOptions): Promise<string> {
  const palette = documentPalette(options);
  const isDarkEditorial = normalizeDocumentTheme(options.documentTheme) === "darkEditorial";
  const boxBackground = isDarkEditorial ? "oklch(10.35% 0.015 93.61)" : "oklch(97.5% 0.025 247.64)";
  const boxText = isDarkEditorial ? "oklch(90.9% 0.024 237.46)" : "oklch(28.43% 0.052 249.88)";
  const boxBorder = isDarkEditorial ? "oklch(34.06% 0.044 236.72)" : "oklch(78.06% 0.088 247.23)";
  const boxAccent = isDarkEditorial ? "oklch(74.22% 0.14 232.34)" : "oklch(56.77% 0.154 252.96)";
  const href = safeHref(node.attrs?.href);
  const normalizedLinkHref = normalizedHref(node.attrs?.href);
  const plainBodyText = textOf(node).trim();

  if (!normalizedLinkHref && !plainBodyText) {
    return "";
  }

  const wrapperStyle = joinStyle({
    margin: "0 0 16px",
    padding: "12px 14px",
    border: `1px solid ${boxBorder}`,
    "border-left": `4px solid ${boxAccent}`,
    "background-color": boxBackground,
    color: boxText,
    "border-radius": "7px",
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": safeBodyFontSize(options),
    "line-height": 1.68,
  });
  const labelStyle = joinStyle({
    display: "block",
    margin: "0 0 6px",
    color: isDarkEditorial ? "oklch(79.74% 0.124 233.36)" : "oklch(32.26% 0.07 249.42)",
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": "12px",
    "font-weight": 700,
    "letter-spacing": "0",
  });
  const linkStyle = joinStyle({
    display: "inline-block",
    margin: "2px 0 0",
    color: palette.link,
    "font-weight": 700,
    "text-decoration": "underline",
    "text-underline-offset": "2px",
  });
  const body =
    normalizedLinkHref && isOnlyHrefText(plainBodyText, normalizedLinkHref)
      ? []
      : await Promise.all(
          childrenOf(node).map((child) =>
            renderBlockAsync(child, options, { text: boxText, background: boxBackground }),
          ),
        );
  const bodyHtml = body.join("");
  const action = href
    ? `<a href="${href}" target="_blank" rel="noopener noreferrer" style="${linkStyle}">${escapeHtml(visibleLinkLabel(normalizedLinkHref ?? href))}</a>`
    : "";

  if (!bodyHtml && !action) {
    return "";
  }

  const content = `<span style="${labelStyle}">LINK</span>${bodyHtml}${action}`;

  if (isDcTableStructure(options)) {
    return renderDcTableBlock({
      body: content,
      options,
      backgroundColor: boxBackground,
      fallbackBackground: isDarkEditorial ? "#0b0b0b" : dcTableFallbackColors.referenceBackground,
      border: `1px solid ${boxBorder}`,
      borderColor: boxAccent,
    });
  }

  return `<div style="${wrapperStyle}">${content}</div>`;
}

async function renderCodeBlock(node: JSONContent, options: DcExportOptions): Promise<string> {
  const { highlightForDcHtml } = await import("$lib/highlighter/shiki-client");
  const language =
    typeof node.attrs?.language === "string" && isSupportedLanguage(node.attrs.language)
      ? node.attrs.language
      : defaultLanguage;
  const highlightLines = normalizeHighlightLines(node.attrs?.highlightLines);
  const additionLines = normalizeHighlightLines(node.attrs?.additionLines);
  const deletionLines = normalizeHighlightLines(node.attrs?.deletionLines);
  const filename = normalizeCodeFilename(node.attrs?.filename);

  return highlightForDcHtml(textOf(node), {
    language,
    theme: options.theme || defaultTheme,
    showBackground: true,
    showLineNumbers: options.showLineNumbers,
    filename,
    fontSize: safeCodeFontSize(options),
    highlightLines,
    additionLines,
    deletionLines,
  });
}

async function renderBlockquote(node: JSONContent, options: DcExportOptions): Promise<string> {
  const palette = documentPalette(options);
  const quoteStyle = normalizeQuoteStyle(node.attrs?.quoteStyle);
  const quoteParagraphStyle = joinStyle({
    margin: quoteStyle === "pull" ? 0 : "0 0 8px",
    color: quoteStyle === "pull" ? palette.heading : palette.quoteText,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": quoteStyle === "pull" ? "21px" : safeBodyFontSize(options),
    "font-style": quoteStyle === "academic" || quoteStyle === "pull" ? undefined : "italic",
    "font-weight": quoteStyle === "pull" ? 700 : undefined,
    "line-height": quoteStyle === "pull" ? 1.48 : 1.78,
    "text-align": quoteStyle === "pull" ? "center" : undefined,
  });
  const children = await Promise.all(
    childrenOf(node).map((child) => {
      if (child.type === "paragraph") {
        return `<p style="${quoteParagraphStyle}">${renderInlineChildren(child, options, { text: palette.quoteText, background: palette.quoteBackground }) || "&nbsp;"}</p>`;
      }

      return renderBlockAsync(child, options, {
        text: palette.quoteText,
        background: palette.quoteBackground,
      });
    }),
  );
  const body = children.join("");
  const content = renderQuoteContent(quoteStyle, body, palette, options);

  if (isDcTableStructure(options)) {
    return renderDcTableBlock({
      body: content,
      options,
      backgroundColor: quoteBackground(quoteStyle, palette),
      fallbackBackground: quoteFallbackBackground(options),
      border: quoteStyle === "pull" ? undefined : quoteTableBorder(quoteStyle, palette),
      borderTop: quoteStyle === "pull" ? quoteTableBorder(quoteStyle, palette) : undefined,
      borderBottom: quoteStyle === "pull" ? quoteTableBorder(quoteStyle, palette) : undefined,
      borderColor: quoteTableAccent(quoteStyle, palette),
      padding: quotePadding(quoteStyle),
    });
  }

  const style = quoteWrapperStyle(quoteStyle, palette, options);
  const tag = quoteStyle === "pull" ? "div" : "blockquote";
  return `<${tag} style="${style}">${content}</${tag}>`;
}

function quoteFallbackBackground(options: DcExportOptions): string {
  return normalizeDocumentTheme(options.documentTheme) === "darkEditorial"
    ? dcDarkPageBackground
    : dcTableFallbackColors.quoteBackground;
}

function quoteBackground(quoteStyle: QuoteStyle, palette: DocumentPalette): string {
  if (quoteStyle === "bigQuote") {
    return palette.quoteBackground;
  }

  if (quoteStyle === "academic") {
    return "transparent";
  }

  return quoteStyle === "pull" ? palette.articleBackground : palette.quoteBackground;
}

function quoteTableAccent(quoteStyle: QuoteStyle, palette: DocumentPalette): string | undefined {
  return quoteStyle === "pull" ? undefined : palette.quoteAccent;
}

function quoteTableBorder(quoteStyle: QuoteStyle, palette: DocumentPalette): string | undefined {
  if (quoteStyle === "academic") {
    return `1px solid ${palette.sectionBorder}`;
  }

  if (quoteStyle === "bigQuote" || quoteStyle === "literary") {
    return `1px solid ${palette.quoteAccent}`;
  }

  return `1px solid ${palette.divider}`;
}

function quotePadding(quoteStyle: QuoteStyle): string {
  if (quoteStyle === "pull") {
    return "18px 20px";
  }

  if (quoteStyle === "bigQuote") {
    return "18px 18px 16px";
  }

  return quoteStyle === "academic" ? "12px 16px" : "14px 16px";
}

function renderQuoteContent(
  quoteStyle: QuoteStyle,
  body: string,
  palette: DocumentPalette,
  options: DcExportOptions,
): string {
  const quoteMarkStyle = joinStyle({
    display: "inline-block",
    color: palette.quoteMark,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": "34px",
    "font-weight": 700,
    "line-height": 1,
    "vertical-align": "top",
    margin: "0 8px 0 0",
  });
  const contentStyle = joinStyle({
    display: "inline-block",
    width: "calc(100% - 46px)",
    "vertical-align": "top",
  });

  if (quoteStyle === "literary") {
    return `<span style="${quoteMarkStyle}">&ldquo;</span><div style="${contentStyle}">${body}</div>`;
  }

  if (quoteStyle === "bigQuote") {
    const bigMarkStyle = joinStyle({
      display: "block",
      color: palette.quoteMark,
      "font-family": safeProseFontFamily(options.bodyFontFamily),
      "font-size": "56px",
      "font-weight": 700,
      "line-height": 0.82,
      margin: "0 0 4px",
    });

    return `<span style="${bigMarkStyle}">&ldquo;</span>${body}`;
  }

  if (quoteStyle === "academic") {
    const labelStyle = joinStyle({
      display: "block",
      margin: "0 0 7px",
      color: palette.mutedText,
      "font-family": safeProseFontFamily(options.bodyFontFamily),
      "font-size": "12px",
      "font-weight": 700,
      "letter-spacing": "0",
    });

    return `<span style="${labelStyle}">QUOTE</span>${body}`;
  }

  return body;
}

function quoteWrapperStyle(
  quoteStyle: QuoteStyle,
  palette: DocumentPalette,
  options: DcExportOptions,
): string {
  if (quoteStyle === "academic") {
    return joinStyle({
      margin: "0 0 18px",
      padding: "12px 16px",
      "border-left": `4px solid ${palette.quoteAccent}`,
      "border-top": `1px solid ${palette.sectionBorder}`,
      "border-bottom": `1px solid ${palette.sectionBorder}`,
      color: palette.quoteText,
      "background-color": "transparent",
      "font-family": safeProseFontFamily(options.bodyFontFamily),
      "font-size": safeBodyFontSize(options),
      "line-height": 1.78,
    });
  }

  if (quoteStyle === "pull") {
    return joinStyle({
      margin: "20px 0",
      padding: "18px 20px",
      border: `1px solid ${palette.divider}`,
      "border-left": 0,
      "border-right": 0,
      color: palette.heading,
      "background-color": "transparent",
      "font-family": safeProseFontFamily(options.bodyFontFamily),
      "font-size": "21px",
      "font-weight": 700,
      "line-height": 1.48,
      "text-align": "center",
    });
  }

  if (quoteStyle === "bigQuote") {
    return joinStyle({
      margin: "0 0 18px",
      padding: "18px 18px 16px",
      border: `1px solid ${palette.quoteAccent}`,
      "border-left": `4px solid ${palette.quoteAccent}`,
      color: palette.quoteText,
      "background-color": palette.quoteBackground,
      "font-family": safeProseFontFamily(options.bodyFontFamily),
      "font-size": safeBodyFontSize(options),
      "font-style": "italic",
      "line-height": 1.78,
    });
  }

  return joinStyle({
    margin: "0 0 18px",
    padding: "13px 16px",
    "border-left": `3px solid ${palette.quoteAccent}`,
    "border-top": `1px solid ${palette.quoteAccent}`,
    "border-bottom": `1px solid ${palette.quoteAccent}`,
    color: palette.quoteText,
    "background-color": "transparent",
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": safeBodyFontSize(options),
    "font-style": "italic",
    "line-height": 1.78,
  });
}

async function renderSectionHeading(node: JSONContent, options: DcExportOptions): Promise<string> {
  const palette = documentPalette(options);
  const content = renderInlineChildren(node, options, {
    text: palette.sectionText,
    background: palette.articleBackground,
  });
  const body = `<strong style="${joinStyle({
    color: palette.sectionText,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": "20px",
    "font-weight": 700,
    "line-height": 1.35,
  })}">${content || "&nbsp;"}</strong>`;

  if (isDcTableStructure(options)) {
    return renderDcTableBlock({
      body,
      options,
      backgroundColor: palette.articleBackground,
      fallbackBackground: palette.fallbackBackground,
      borderColor: palette.sectionAccent,
      padding: "4px 0 4px 14px",
    });
  }

  const style = joinStyle({
    margin: "24px 0 14px",
    padding: "4px 0 4px 14px",
    "border-left": `4px solid ${palette.sectionAccent}`,
    color: palette.sectionText,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": "20px",
    "font-weight": 700,
    "line-height": 1.35,
  });

  return `<div style="${style}">${content || "&nbsp;"}</div>`;
}

function renderCtaButtonAnchor(
  node: JSONContent,
  options: DcExportOptions,
  overrides: Record<string, string | number | undefined> = {},
): string {
  const palette = documentPalette(options);
  const href = safeHref(node.attrs?.href);
  const label =
    renderInlineChildren(node, options, {
      text: palette.ctaText,
      background: palette.ctaBackground,
    }) || "바로가기";

  if (!href) {
    return "";
  }

  const style = joinStyle({
    display: "inline-block",
    margin: "0 10px 16px 0",
    padding: "11px 22px",
    border: `1px solid ${palette.ctaBorder}`,
    "background-color": palette.ctaBackground,
    color: palette.ctaText,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": safeBodyFontSize(options),
    "font-weight": 700,
    "line-height": 1.2,
    "text-decoration": "none",
    ...overrides,
  });

  return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="${style}">${label}</a>`;
}

function renderCtaButton(node: JSONContent, options: DcExportOptions): string {
  return renderCtaButtonAnchor(node, options);
}

async function renderCtaGroup(node: JSONContent, options: DcExportOptions): Promise<string> {
  const layout = normalizeCtaGroupLayout(node.attrs?.layout);
  const buttons = childrenOf(node).filter((child) => child.type === "ctaButton");

  if (buttons.length === 0) {
    return "";
  }

  if (isDcTableStructure(options)) {
    return renderCtaGroupTable(buttons, options, layout);
  }

  const wrapperStyle = joinStyle({
    margin: "0 0 16px",
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": safeBodyFontSize(options),
    "line-height": 1.2,
  });
  const body =
    layout === "vertical"
      ? buttons
          .map(
            (button) =>
              `<div style="margin:0 0 8px">${renderCtaButtonAnchor(button, options, { margin: 0 })}</div>`,
          )
          .join("")
      : buttons
          .map((button) => renderCtaButtonAnchor(button, options, { margin: "0 8px 8px 0" }))
          .join("");

  return `<div style="${wrapperStyle}">${body}</div>`;
}

function renderCtaGroupTable(
  buttons: JSONContent[],
  options: DcExportOptions,
  layout: CtaGroupLayout,
): string {
  const palette = documentPalette(options);
  const tableStyle = joinStyle({
    width: layout === "vertical" ? undefined : "auto",
    margin: "0 0 16px",
    "border-collapse": "separate",
    "border-spacing": layout === "vertical" ? "0 8px" : "0",
    "background-color": "transparent",
  });

  if (layout === "vertical") {
    const rows = buttons
      .map(
        (button) =>
          `<tr><td style="padding:0">${renderCtaButtonAnchor(button, options, { display: "inline-block", margin: 0 })}</td></tr>`,
      )
      .join("");

    return `<table cellpadding="0" cellspacing="0" border="0" bgcolor="${palette.fallbackBackground}" style="${tableStyle}"><tbody>${rows}</tbody></table>`;
  }

  const cells = buttons
    .map(
      (button) =>
        `<td style="padding:0 8px 8px 0">${renderCtaButtonAnchor(button, options, { margin: 0 })}</td>`,
    )
    .join("");

  return `<table cellpadding="0" cellspacing="0" border="0" bgcolor="${palette.fallbackBackground}" style="${tableStyle}"><tbody><tr>${cells}</tr></tbody></table>`;
}

function referenceListPalette(options: DcExportOptions) {
  if (normalizeDocumentTheme(options.documentTheme) === "darkEditorial") {
    return {
      background: dcDarkPanelBackground,
      fallbackBackground: dcDarkPanelBackground,
      border: "#353535",
      badgeBackground: "oklch(74.22% 0.14 232.34)",
      badgeFallbackBackground: "#38bdf8",
      badgeText: "oklch(8.61% 0.019 237.62)",
      itemDivider: "#303030",
      text: "oklch(91.87% 0.029 233.82)",
      mutedText: "oklch(70.88% 0.035 235.94)",
    };
  }

  return {
    background: "oklch(97.5% 0.025 247.64)",
    fallbackBackground: dcTableFallbackColors.referenceBackground,
    border: "oklch(78.06% 0.088 247.23)",
    badgeBackground: "oklch(56.77% 0.154 252.96)",
    badgeFallbackBackground: "#2478ce",
    badgeText: "oklch(99.21% 0.006 247.8)",
    itemDivider: "oklch(88.91% 0.035 247.16)",
    text: "oklch(28.43% 0.052 249.88)",
    mutedText: "oklch(47.08% 0.048 249.16)",
  };
}

function renderReferenceItemBody(
  node: JSONContent,
  options: DcExportOptions,
  textColor: string,
  backgroundColor: string,
): string {
  const documentColors = documentPalette(options);
  const href = safeHref(node.attrs?.href);
  const normalizedLinkHref = normalizedHref(node.attrs?.href);
  const fallbackLabel = normalizedLinkHref ? visibleLinkLabel(normalizedLinkHref) : "참고 자료";
  const label =
    renderInlineChildren(node, options, { text: textColor, background: backgroundColor }) ||
    escapeHtml(fallbackLabel);
  const linkStyle = joinStyle({
    color: documentColors.link,
    display: "inline-block",
    margin: "0",
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": safeBodyFontSize(options),
    "font-weight": 700,
    "line-height": 1.18,
    "text-decoration": "underline",
    "text-underline-offset": "2px",
    "vertical-align": "middle",
  });

  return href
    ? `<a href="${href}" target="_blank" rel="noopener noreferrer" style="${linkStyle}">${label}</a>`
    : label;
}

function renderDcRoundedBadge({
  text,
  backgroundColor,
  fallbackBackgroundColor,
  textColor,
  width,
  height,
  fontSize,
}: {
  text: string;
  backgroundColor: string;
  fallbackBackgroundColor: string;
  textColor: string;
  width: number;
  height: number;
  fontSize: number;
}): string {
  const sideWidth = Math.max(4, Math.round(width * 0.22));
  const outerTableStyle = joinStyle({
    display: "inline-table",
    "border-collapse": "collapse",
    "vertical-align": "middle",
  });
  const sideCellStyle = joinStyle({
    width: `${sideWidth}px`,
    height: `${height}px`,
    padding: "0",
    "background-color": backgroundColor,
    "font-size": "0",
    "line-height": "0",
  });
  const textStyle = joinStyle({
    height: `${height}px`,
    padding: "0",
    "background-color": backgroundColor,
    color: textColor,
    "font-family": safeProseFontFamily(defaultProseFontFamily),
    "font-size": `${fontSize}px`,
    "font-weight": 700,
    "line-height": `${height}px`,
    "vertical-align": "middle",
    "white-space": "nowrap",
  });
  const spanStyle = joinStyle({
    display: "inline-block",
    height: `${height}px`,
    color: textColor,
    "font-family": safeProseFontFamily(defaultProseFontFamily),
    "font-size": `${fontSize}px`,
    "font-weight": 700,
    "line-height": `${height}px`,
    "white-space": "nowrap",
  });

  return `<table cellpadding="0" cellspacing="0" border="0" bgcolor="${fallbackBackgroundColor}" style="${outerTableStyle}"><tbody><tr><td width="${sideWidth}" height="${height}" bgcolor="${fallbackBackgroundColor}" style="${sideCellStyle}">&nbsp;</td><td height="${height}" valign="middle" bgcolor="${fallbackBackgroundColor}" style="${textStyle}"><span style="${spanStyle}">${escapeHtml(text)}</span></td><td width="${sideWidth}" height="${height}" bgcolor="${fallbackBackgroundColor}" style="${sideCellStyle}">&nbsp;</td></tr></tbody></table>`;
}

async function renderReferenceList(node: JSONContent, options: DcExportOptions): Promise<string> {
  const items = childrenOf(node).filter((child) => child.type === "referenceItem");

  if (items.length === 0) {
    return "";
  }

  return isDcTableStructure(options)
    ? renderReferenceListTable(items, options)
    : renderReferenceListModern(items, options);
}

function renderReferenceListModern(items: JSONContent[], options: DcExportOptions): string {
  const palette = referenceListPalette(options);
  const listStyle = joinStyle({
    margin: "0 0 16px",
    padding: "0",
    "list-style": "none",
    border: `1px solid ${palette.border}`,
    "border-left": `4px solid ${palette.badgeBackground}`,
    "border-radius": "7px",
    "background-color": palette.background,
    color: palette.text,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": safeBodyFontSize(options),
    "line-height": 1.62,
  });
  const itemStyle = joinStyle({
    display: "table",
    width: "100%",
    margin: "0",
    padding: "0",
    "border-bottom": `1px solid ${palette.itemDivider}`,
    "box-sizing": "border-box",
  });
  const lastItemStyle = joinStyle({
    display: "table",
    width: "100%",
    margin: "0",
    padding: "0",
    "box-sizing": "border-box",
  });
  const badgeCellStyle = joinStyle({
    display: "table-cell",
    width: "42px",
    padding: "12px 0 12px 12px",
    "vertical-align": "middle",
  });
  const badgeStyle = joinStyle({
    display: "inline-block",
    "min-width": "30px",
    height: "18px",
    padding: "0",
    "border-radius": "4px",
    "background-color": palette.badgeBackground,
    color: palette.badgeText,
    "font-size": "11px",
    "font-weight": 700,
    "line-height": "18px",
    "text-align": "center",
    "vertical-align": "middle",
  });
  const labelCellStyle = joinStyle({
    display: "table-cell",
    padding: "11px 14px 11px 0",
    color: palette.text,
    "line-height": 1.18,
    "vertical-align": "middle",
  });
  const body = items
    .map((item, index) => {
      const rowStyle = index === items.length - 1 ? lastItemStyle : itemStyle;
      const number = String(index + 1).padStart(2, "0");
      const content = renderReferenceItemBody(item, options, palette.text, palette.background);

      return `<li style="${rowStyle}"><span style="${badgeCellStyle}"><span style="${badgeStyle}">${number}</span></span><span style="${labelCellStyle}">${content}</span></li>`;
    })
    .join("");

  return `<ol style="${listStyle}">${body}</ol>`;
}

function renderReferenceListTable(items: JSONContent[], options: DcExportOptions): string {
  const palette = referenceListPalette(options);
  const tableStyle = joinStyle({
    width: "100%",
    margin: "0 0 16px",
    "border-collapse": "collapse",
    "background-color": palette.background,
    border: `1px solid ${palette.border}`,
    "border-left": `4px solid ${palette.badgeBackground}`,
  });
  const badgeCellStyle = joinStyle({
    width: "42px",
    padding: "10px 0 10px 12px",
    "border-bottom": `1px solid ${palette.itemDivider}`,
    "vertical-align": "middle",
  });
  const lastBadgeCellStyle = joinStyle({
    width: "42px",
    padding: "10px 0 10px 12px",
    "vertical-align": "middle",
  });
  const itemCellStyle = joinStyle({
    padding: "10px 14px 10px 0",
    "border-bottom": `1px solid ${palette.itemDivider}`,
    color: palette.text,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": safeBodyFontSize(options),
    "line-height": 1.18,
    "vertical-align": "middle",
  });
  const lastItemCellStyle = joinStyle({
    padding: "10px 14px 10px 0",
    color: palette.text,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": safeBodyFontSize(options),
    "line-height": 1.18,
    "vertical-align": "middle",
  });
  const rows = items
    .map((item, index) => {
      const number = String(index + 1).padStart(2, "0");
      const badgeTdStyle = index === items.length - 1 ? lastBadgeCellStyle : badgeCellStyle;
      const itemTdStyle = index === items.length - 1 ? lastItemCellStyle : itemCellStyle;
      const content = renderReferenceItemBody(item, options, palette.text, palette.background);
      const badge = renderDcRoundedBadge({
        text: number,
        backgroundColor: palette.badgeBackground,
        fallbackBackgroundColor: palette.badgeFallbackBackground,
        textColor: palette.badgeText,
        width: 30,
        height: 18,
        fontSize: 11,
      });

      return `<tr><td style="${badgeTdStyle}">${badge}</td><td style="${itemTdStyle}">${content}</td></tr>`;
    })
    .join("");

  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${palette.fallbackBackground}" style="${tableStyle}"><tbody>${rows}</tbody></table>`;
}

function summaryBoxPalette(options: DcExportOptions) {
  if (normalizeDocumentTheme(options.documentTheme) === "darkEditorial") {
    return {
      background: dcDarkPanelBackground,
      fallbackBackground: dcDarkPanelBackground,
      border: "#353535",
      accent: "oklch(84.08% 0.11 84.51)",
      label: "oklch(88.91% 0.091 87.72)",
      text: "oklch(94.12% 0.012 93.37)",
      mutedText: "oklch(72.14% 0.024 86.7)",
      bulletBackground: "oklch(84.08% 0.11 84.51)",
      bulletText: "oklch(10.18% 0.015 94.76)",
    };
  }

  return {
    background: "oklch(97.68% 0.02 91.92)",
    fallbackBackground: "#fbf6e6",
    border: "oklch(84.22% 0.041 88.36)",
    accent: "oklch(61.2% 0.049 77.83)",
    label: "oklch(36.42% 0.042 78.12)",
    text: "oklch(25.72% 0.021 255.63)",
    mutedText: "oklch(45.61% 0.026 79.44)",
    bulletBackground: "oklch(61.2% 0.049 77.83)",
    bulletText: "oklch(99.1% 0.006 93.08)",
  };
}

async function renderSummaryBox(node: JSONContent, options: DcExportOptions): Promise<string> {
  const items = childrenOf(node).filter((child) => child.type === "summaryItem");
  const label = labelFromAttrs(node, "핵심 요약");

  if (items.length === 0) {
    return "";
  }

  return isDcTableStructure(options)
    ? renderSummaryBoxTable(items, options, label)
    : renderSummaryBoxModern(items, options, label);
}

function renderSummaryItemContent(
  node: JSONContent,
  options: DcExportOptions,
  textColor: string,
  backgroundColor: string,
): string {
  return (
    renderInlineChildren(node, options, { text: textColor, background: backgroundColor }) ||
    "&nbsp;"
  );
}

function renderSummaryBoxModern(
  items: JSONContent[],
  options: DcExportOptions,
  label: string,
): string {
  const palette = summaryBoxPalette(options);
  const wrapperStyle = joinStyle({
    margin: "0 0 18px",
    padding: "14px 16px",
    border: `1px solid ${palette.border}`,
    "border-top": `4px solid ${palette.accent}`,
    "background-color": palette.background,
    color: palette.text,
    "border-radius": "7px",
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": safeBodyFontSize(options),
    "line-height": 1.62,
  });
  const labelStyle = joinStyle({
    display: "block",
    margin: "0 0 9px",
    color: palette.label,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": "12px",
    "font-weight": 700,
    "letter-spacing": "0",
  });
  const listStyle = joinStyle({
    margin: "0",
    padding: "0",
    "list-style": "none",
  });
  const itemStyle = joinStyle({
    display: "table",
    width: "100%",
    margin: "0 0 7px",
  });
  const bulletCellStyle = joinStyle({
    display: "table-cell",
    width: "28px",
    "vertical-align": "top",
  });
  const bulletStyle = joinStyle({
    display: "block",
    width: "8px",
    height: "8px",
    margin: "8px 0 0",
    "line-height": 0,
    "border-radius": "999px",
    "background-color": palette.bulletBackground,
  });
  const contentCellStyle = joinStyle({
    display: "table-cell",
    color: palette.text,
    "vertical-align": "top",
  });
  const body = items
    .map((item) => {
      const content = renderSummaryItemContent(item, options, palette.text, palette.background);
      return `<li style="${itemStyle}"><span style="${bulletCellStyle}"><span style="${bulletStyle}"></span></span><span style="${contentCellStyle}">${content}</span></li>`;
    })
    .join("");

  return `<section style="${wrapperStyle}"><span style="${labelStyle}">${escapeHtml(label)}</span><ul style="${listStyle}">${body}</ul></section>`;
}

function renderSummaryBoxTable(
  items: JSONContent[],
  options: DcExportOptions,
  label: string,
): string {
  const palette = summaryBoxPalette(options);
  const tableStyle = joinStyle({
    width: "100%",
    margin: "0 0 18px",
    "border-collapse": "collapse",
    "background-color": palette.background,
    border: `1px solid ${palette.border}`,
    "border-top": `4px solid ${palette.accent}`,
  });
  const labelCellStyle = joinStyle({
    padding: "12px 16px 5px",
    color: palette.label,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": "12px",
    "font-weight": 700,
    "line-height": 1.2,
  });
  const itemCellStyle = joinStyle({
    padding: "5px 16px",
    color: palette.text,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": safeBodyFontSize(options),
    "line-height": 1.62,
    "vertical-align": "top",
  });
  const lastItemCellStyle = joinStyle({
    padding: "5px 16px 13px",
    color: palette.text,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": safeBodyFontSize(options),
    "line-height": 1.62,
    "vertical-align": "top",
  });
  const rows = items
    .map((item, index) => {
      const content = renderSummaryItemContent(item, options, palette.text, palette.background);
      const isLast = index === items.length - 1;
      const bulletStyle = joinStyle({
        color: palette.bulletBackground,
        "font-size": "20px",
        "font-weight": 700,
        "line-height": 1,
        "vertical-align": "middle",
      });

      return `<tr><td style="${isLast ? lastItemCellStyle : itemCellStyle}"><span style="${bulletStyle}">&bull;</span>&nbsp;&nbsp;${content}</td></tr>`;
    })
    .join("");

  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${palette.fallbackBackground}" style="${tableStyle}"><tbody><tr><td style="${labelCellStyle}">${escapeHtml(label)}</td></tr>${rows}</tbody></table>`;
}

function heroBlockPalette(options: DcExportOptions) {
  if (normalizeDocumentTheme(options.documentTheme) === "darkEditorial") {
    return {
      background: dcDarkPageBackground,
      fallbackBackground: dcDarkPageBackground,
      border: "#383838",
      accent: "oklch(84.08% 0.11 84.51)",
      label: "oklch(84.08% 0.11 84.51)",
      title: "oklch(98.32% 0.006 93.08)",
      subtitle: "oklch(78.72% 0.023 86.9)",
    };
  }

  return {
    background: "oklch(97.68% 0.02 91.92)",
    fallbackBackground: "#fbf6e6",
    border: "oklch(84.22% 0.041 88.36)",
    accent: "oklch(61.2% 0.049 77.83)",
    label: "oklch(45.61% 0.026 79.44)",
    title: "oklch(24.19% 0.019 255.77)",
    subtitle: "oklch(43.22% 0.022 255.32)",
  };
}

function heroBlockLabel(node: JSONContent): string {
  return labelFromAttrs(node, "CODING GUIDE");
}

function heroTextChildren(node: JSONContent): JSONContent[] {
  return childrenOf(node).filter((child) => textOf(child).trim().length > 0);
}

function heroContentParts(node: JSONContent): {
  titleNode: JSONContent | undefined;
  subtitleNodes: JSONContent[];
  bodyNodes: JSONContent[];
} {
  const content = heroTextChildren(node);
  const titleIndex = content.findIndex(isHeroTitleNode);
  const titleNode = titleIndex >= 0 ? content[titleIndex] : undefined;
  const beforeTitle = titleIndex >= 0 ? content.slice(0, titleIndex) : [];
  const afterTitle = titleIndex >= 0 ? content.slice(titleIndex + 1) : content;
  const firstBodyIndex = afterTitle.findIndex((child) => child.type !== "paragraph");

  if (firstBodyIndex === -1) {
    return {
      titleNode,
      subtitleNodes: afterTitle,
      bodyNodes: beforeTitle,
    };
  }

  return {
    titleNode,
    subtitleNodes: afterTitle.slice(0, firstBodyIndex),
    bodyNodes: [...beforeTitle, ...afterTitle.slice(firstBodyIndex)],
  };
}

function renderHeroInline(
  node: JSONContent | undefined,
  options: DcExportOptions,
  textColor: string,
  backgroundColor: string,
): string {
  if (!node) {
    return "";
  }

  return renderInlineChildren(node, options, { text: textColor, background: backgroundColor });
}

function renderHeroSubtitle(
  nodes: JSONContent[],
  options: DcExportOptions,
  textColor: string,
  backgroundColor: string,
): string {
  return nodes
    .map((node) => renderHeroInline(node, options, textColor, backgroundColor))
    .filter(Boolean)
    .join("<br>");
}

function isHeroTitleNode(node: JSONContent | undefined): boolean {
  return node?.type === "heading";
}

function renderHeroContentHtml(
  titleHtml: string,
  subtitleHtml: string,
  fallbackTitleStyle: string,
  hasBody: boolean,
): string {
  if (titleHtml || subtitleHtml) {
    return `${titleHtml}${subtitleHtml}`;
  }

  if (hasBody) {
    return "";
  }

  return `<strong style="${fallbackTitleStyle}">강의 노트</strong>`;
}

async function renderHeroBlock(node: JSONContent, options: DcExportOptions): Promise<string> {
  return isDcTableStructure(options)
    ? renderHeroBlockTable(node, options)
    : renderHeroBlockModern(node, options);
}

async function renderHeroBodyBlocks(
  nodes: JSONContent[],
  options: DcExportOptions,
  textColor: string,
  backgroundColor: string,
): Promise<string> {
  const body = await Promise.all(
    nodes.map((child) =>
      renderBlockAsync(child, options, {
        text: textColor,
        background: backgroundColor,
      }),
    ),
  );

  return body.join("");
}

async function renderHeroBlockModern(node: JSONContent, options: DcExportOptions): Promise<string> {
  const palette = heroBlockPalette(options);
  const { titleNode, subtitleNodes, bodyNodes } = heroContentParts(node);
  const title = renderHeroInline(titleNode, options, palette.title, palette.background);
  const subtitle = renderHeroSubtitle(subtitleNodes, options, palette.subtitle, palette.background);
  const wrapperStyle = joinStyle({
    margin: "0 0 22px",
    padding: "22px 24px",
    border: `1px solid ${palette.border}`,
    "border-top": `4px solid ${palette.accent}`,
    "background-color": palette.background,
    color: palette.title,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "box-sizing": "border-box",
  });
  const labelStyle = joinStyle({
    display: "block",
    margin: "0 0 16px",
    color: palette.label,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": "12px",
    "font-weight": 700,
    "line-height": 1.2,
    "letter-spacing": "0",
  });
  const titleStyle = joinStyle({
    display: "block",
    margin: "0 0 12px",
    color: palette.title,
    "font-size": "28px",
    "font-weight": 700,
    "line-height": 1.22,
  });
  const subtitleStyle = joinStyle({
    display: "block",
    color: palette.subtitle,
    "font-size": safeBodyFontSize(options),
    "font-weight": 700,
    "line-height": 1.62,
  });
  const titleHtml = title ? `<strong style="${titleStyle}">${title}</strong>` : "";
  const subtitleHtml = subtitle ? `<span style="${subtitleStyle}">${subtitle}</span>` : "";
  const body = await renderHeroBodyBlocks(bodyNodes, options, palette.subtitle, palette.background);
  const contentHtml = renderHeroContentHtml(titleHtml, subtitleHtml, titleStyle, Boolean(body));
  const bodyHtml = body ? `<div style="margin:16px 0 0">${body}</div>` : "";

  return `<section style="${wrapperStyle}"><span style="${labelStyle}">${escapeHtml(heroBlockLabel(node))}</span>${contentHtml}${bodyHtml}</section>`;
}

async function renderHeroBlockTable(node: JSONContent, options: DcExportOptions): Promise<string> {
  const palette = heroBlockPalette(options);
  const { titleNode, subtitleNodes, bodyNodes } = heroContentParts(node);
  const title = renderHeroInline(titleNode, options, palette.title, palette.background);
  const subtitle = renderHeroSubtitle(subtitleNodes, options, palette.subtitle, palette.background);
  const tableStyle = joinStyle({
    width: "100%",
    margin: "0 0 22px",
    "border-collapse": "collapse",
    "background-color": palette.background,
    border: `1px solid ${palette.border}`,
    "border-top": `4px solid ${palette.accent}`,
  });
  const cellBaseStyle = {
    "background-color": palette.background,
    color: palette.title,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "box-sizing": "border-box",
  };
  const labelStyle = joinStyle({
    color: palette.label,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": "12px",
    "font-weight": 700,
    "line-height": 1.2,
  });
  const titleStyle = joinStyle({
    color: palette.title,
    "font-size": "28px",
    "font-weight": 700,
    "line-height": 1.22,
  });
  const subtitleStyle = joinStyle({
    color: palette.subtitle,
    "font-size": safeBodyFontSize(options),
    "font-weight": 700,
    "line-height": 1.62,
  });
  const labelCellStyle = joinStyle({
    ...cellBaseStyle,
    padding: "22px 24px 12px",
  });
  const titleCellStyle = joinStyle({
    ...cellBaseStyle,
    padding: subtitle ? "0 24px 10px" : "0 24px 22px",
  });
  const subtitleCellStyle = joinStyle({
    ...cellBaseStyle,
    padding: "0 24px 22px",
  });
  const bodyCellStyle = joinStyle({
    ...cellBaseStyle,
    padding: "0 24px 22px",
  });
  const rows = [
    `<tr><td style="${labelCellStyle}"><span style="${labelStyle}">${escapeHtml(heroBlockLabel(node))}</span></td></tr>`,
  ];

  if (title) {
    rows.push(
      `<tr><td style="${titleCellStyle}"><strong style="${titleStyle}">${title}</strong></td></tr>`,
    );
  }

  if (subtitle) {
    rows.push(
      `<tr><td style="${subtitleCellStyle}"><span style="${subtitleStyle}">${subtitle}</span></td></tr>`,
    );
  }

  if (!title && !subtitle && bodyNodes.length === 0) {
    rows.push(
      `<tr><td style="${titleCellStyle}"><strong style="${titleStyle}">강의 노트</strong></td></tr>`,
    );
  }

  if (bodyNodes.length > 0) {
    const body = await renderHeroBodyBlocks(
      bodyNodes,
      options,
      palette.subtitle,
      palette.background,
    );
    rows.push(`<tr><td style="${bodyCellStyle}">${body}</td></tr>`);
  }

  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${palette.fallbackBackground}" style="${tableStyle}"><tbody>${rows.join("")}</tbody></table>`;
}

function tutorialBlockPalette(options: DcExportOptions) {
  if (normalizeDocumentTheme(options.documentTheme) === "darkEditorial") {
    return {
      background: dcDarkPageBackground,
      fallbackBackground: dcDarkPageBackground,
      cardBackground: dcDarkPanelBackground,
      cardFallbackBackground: dcDarkPanelBackground,
      border: "#353535",
      accent: "oklch(84.08% 0.11 84.51)",
      accentFallback: "#f7d66f",
      numberText: "oklch(10.18% 0.015 94.76)",
      title: "oklch(97.22% 0.008 92.87)",
      text: "oklch(88.62% 0.016 91.83)",
      mutedText: "oklch(71.26% 0.021 84.88)",
    };
  }

  return {
    background: "oklch(98.38% 0.01 97.33)",
    fallbackBackground: dcTableFallbackColors.articleBackground,
    cardBackground: "oklch(99.1% 0.009 93.08)",
    cardFallbackBackground: dcLightPageBackground,
    border: "oklch(85.31% 0.027 84.92)",
    accent: "oklch(61.2% 0.049 77.83)",
    accentFallback: "#948163",
    numberText: "oklch(99.1% 0.006 93.08)",
    title: "oklch(25.72% 0.021 255.63)",
    text: "oklch(31.82% 0.02 255.28)",
    mutedText: "oklch(45.61% 0.026 79.44)",
  };
}

function comparisonBlockPalette(options: DcExportOptions) {
  if (normalizeDocumentTheme(options.documentTheme) === "darkEditorial") {
    return {
      background: dcDarkPageBackground,
      fallbackBackground: dcDarkPageBackground,
      leftBackground: "oklch(13.02% 0.026 24.58)",
      leftFallbackBackground: "#160b0a",
      leftBorder: "oklch(75.02% 0.17 24.82)",
      leftBorderFallback: "#f87171",
      leftTitle: "oklch(93.14% 0.03 24.92)",
      rightBackground: "oklch(12.42% 0.022 154.8)",
      rightFallbackBackground: "#07130d",
      rightBorder: "oklch(76.71% 0.151 154.54)",
      rightBorderFallback: "#4ade80",
      rightTitle: "oklch(92.34% 0.029 154.17)",
      text: "oklch(91.88% 0.016 91.83)",
      divider: "#353535",
    };
  }

  return {
    background: "oklch(98.38% 0.01 97.33)",
    fallbackBackground: dcTableFallbackColors.articleBackground,
    leftBackground: "oklch(97.18% 0.032 24.18)",
    leftFallbackBackground: "#fff0ee",
    leftBorder: "oklch(62.42% 0.178 24.04)",
    leftBorderFallback: "#ef4444",
    leftTitle: "oklch(34.1% 0.098 24.62)",
    rightBackground: "oklch(96.78% 0.033 154.76)",
    rightFallbackBackground: "#e9f9ef",
    rightBorder: "oklch(66.42% 0.152 154.12)",
    rightBorderFallback: "#22c55e",
    rightTitle: "oklch(29.24% 0.08 154.12)",
    text: "oklch(31.82% 0.02 255.28)",
    divider: "oklch(85.31% 0.027 84.92)",
  };
}

function tutorialStepTitle(node: JSONContent): string {
  if (typeof node.attrs?.title === "string" && node.attrs.title.trim()) {
    return node.attrs.title.trim();
  }

  return "";
}

function tutorialStepNumber(node: JSONContent, index: number): string {
  return normalizeTutorialStepNumber(node.attrs?.number, index + 1);
}

async function renderTutorialBlock(node: JSONContent, options: DcExportOptions): Promise<string> {
  const steps = childrenOf(node).filter((child) => child.type === "tutorialStep");

  if (steps.length === 0) {
    return "";
  }

  return isDcTableStructure(options)
    ? renderTutorialBlockTable(steps, options)
    : renderTutorialBlockModern(steps, options);
}

async function renderTutorialStepBody(
  step: JSONContent,
  options: DcExportOptions,
  textColor: string,
  backgroundColor: string,
): Promise<string> {
  const body = await Promise.all(
    childrenOf(step).map((child) =>
      renderBlockAsync(child, options, { text: textColor, background: backgroundColor }),
    ),
  );

  return body.join("");
}

async function renderTutorialBlockModern(
  steps: JSONContent[],
  options: DcExportOptions,
): Promise<string> {
  const palette = tutorialBlockPalette(options);
  const wrapperStyle = joinStyle({
    margin: "0 0 18px",
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": safeBodyFontSize(options),
    "line-height": 1.66,
  });
  const cardStyle = joinStyle({
    margin: "0 0 12px",
    padding: "14px 16px",
    border: `1px solid ${palette.border}`,
    "border-left": `4px solid ${palette.accent}`,
    "border-radius": "7px",
    "background-color": palette.cardBackground,
    color: palette.text,
  });
  const headStyle = joinStyle({
    display: "table",
    width: "100%",
    margin: "0 0 8px",
  });
  const numberCellStyle = joinStyle({
    display: "table-cell",
    width: "42px",
    "vertical-align": "top",
  });
  const numberStyle = joinStyle({
    display: "inline-block",
    "min-width": "34px",
    height: "22px",
    padding: "0",
    "border-radius": "4px",
    "background-color": palette.accent,
    color: palette.numberText,
    "font-size": "12px",
    "font-weight": 700,
    "line-height": "22px",
    "text-align": "center",
  });
  const titleStyle = joinStyle({
    display: "table-cell",
    color: palette.title,
    "font-size": "18px",
    "font-weight": 700,
    "line-height": 1.32,
    "vertical-align": "middle",
  });
  const bodyStyle = joinStyle({
    color: palette.text,
    "padding-left": "34px",
  });
  const cards = await Promise.all(
    steps.map(async (step, index) => {
      const number = tutorialStepNumber(step, index);
      const title = escapeHtml(tutorialStepTitle(step));
      const body = await renderTutorialStepBody(
        step,
        options,
        palette.text,
        palette.cardBackground,
      );
      const bodyHtml = body ? `<div style="${bodyStyle}">${body}</div>` : "";
      const titleHtml = title ? `<strong style="${titleStyle}">${title}</strong>` : "";

      return `<section style="${cardStyle}"><div style="${headStyle}"><span style="${numberCellStyle}"><span style="${numberStyle}">${number}</span></span>${titleHtml}</div>${bodyHtml}</section>`;
    }),
  );

  return `<div style="${wrapperStyle}">${cards.join("")}</div>`;
}

async function renderTutorialBlockTable(
  steps: JSONContent[],
  options: DcExportOptions,
): Promise<string> {
  const palette = tutorialBlockPalette(options);
  const cardTableStyle = joinStyle({
    width: "100%",
    margin: "0 0 12px",
    "border-collapse": "collapse",
    "background-color": palette.cardBackground,
    border: `1px solid ${palette.border}`,
    "border-left": `4px solid ${palette.accent}`,
  });
  const numberCellStyle = joinStyle({
    width: "62px",
    padding: "14px 0 8px 28px",
    "vertical-align": "middle",
  });
  const headCellStyle = joinStyle({
    padding: "14px 16px 8px 0",
    color: palette.title,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": "18px",
    "font-weight": 700,
    "line-height": 1.32,
    "vertical-align": "middle",
  });
  const titleStyle = joinStyle({
    color: palette.title,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": "18px",
    "font-weight": 700,
    "line-height": 1.32,
    "vertical-align": "middle",
  });
  const bodyCellStyle = joinStyle({
    padding: "0 16px 14px 0",
    color: palette.text,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": safeBodyFontSize(options),
    "line-height": 1.66,
  });
  const bodySpacerCellStyle = joinStyle({
    width: "62px",
    padding: "0",
  });
  const cards = await Promise.all(
    steps.map(async (step, index) => {
      const number = tutorialStepNumber(step, index);
      const title = escapeHtml(tutorialStepTitle(step));
      const body = await renderTutorialStepBody(
        step,
        options,
        palette.text,
        palette.cardBackground,
      );
      const badge = renderDcRoundedBadge({
        text: number,
        backgroundColor: palette.accent,
        fallbackBackgroundColor: palette.accentFallback,
        textColor: palette.numberText,
        width: 34,
        height: 22,
        fontSize: 12,
      });
      const bodyRow = body
        ? `<tr><td style="${bodySpacerCellStyle}">&nbsp;</td><td style="${bodyCellStyle}">${body}</td></tr>`
        : "";
      const titleHtml = title ? `<strong style="${titleStyle}">${title}</strong>` : "&nbsp;";

      return `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${palette.cardFallbackBackground}" style="${cardTableStyle}"><tbody><tr><td style="${numberCellStyle}">${badge}</td><td style="${headCellStyle}">${titleHtml}</td></tr>${bodyRow}</tbody></table>`;
    }),
  );

  return cards.join("");
}

function comparisonColumnTitle(node: JSONContent, fallback: string): string {
  if (typeof node.attrs?.title === "string" && node.attrs.title.trim()) {
    return node.attrs.title.trim();
  }

  return fallback;
}

async function renderComparisonColumnBody(
  column: JSONContent,
  options: DcExportOptions,
  textColor: string,
  backgroundColor: string,
): Promise<string> {
  const body = await Promise.all(
    childrenOf(column).map((child) =>
      renderBlockAsync(child, options, { text: textColor, background: backgroundColor }),
    ),
  );

  return body.join("");
}

async function renderComparisonBlock(node: JSONContent, options: DcExportOptions): Promise<string> {
  const columns = childrenOf(node)
    .filter((child) => child.type === "comparisonColumn")
    .slice(0, 2);

  if (columns.length < 2) {
    return "";
  }

  return isDcTableStructure(options)
    ? renderComparisonBlockTable(columns, options)
    : renderComparisonBlockModern(columns, options);
}

async function renderComparisonBlockModern(
  columns: JSONContent[],
  options: DcExportOptions,
): Promise<string> {
  const palette = comparisonBlockPalette(options);
  const wrapperStyle = joinStyle({
    display: "table",
    width: "100%",
    margin: "0 0 18px",
    "border-spacing": "10px 0",
    "table-layout": "fixed",
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": safeBodyFontSize(options),
    "line-height": 1.64,
  });
  const titleStyle = (color: string) =>
    joinStyle({
      display: "block",
      margin: "0 0 8px",
      color,
      "font-size": "12px",
      "font-weight": 700,
      "letter-spacing": "0",
    });
  const columnStyle = (side: "left" | "right") => {
    const isRight = side === "right";

    return joinStyle({
      display: "table-cell",
      width: "50%",
      padding: "13px 15px",
      border: `1px solid ${palette.divider}`,
      "border-left": `4px solid ${isRight ? palette.rightBorder : palette.leftBorder}`,
      "background-color": isRight ? palette.rightBackground : palette.leftBackground,
      color: palette.text,
      "border-radius": "7px",
      "vertical-align": "top",
    });
  };
  const renderedColumns = await Promise.all(
    columns.map(async (column, index) => {
      const side = index === 1 ? "right" : "left";
      const title = escapeHtml(
        comparisonColumnTitle(column, side === "right" ? "After" : "Before"),
      );
      const backgroundColor = side === "right" ? palette.rightBackground : palette.leftBackground;
      const body = await renderComparisonColumnBody(column, options, palette.text, backgroundColor);
      const titleColor = side === "right" ? palette.rightTitle : palette.leftTitle;

      return `<section style="${columnStyle(side)}"><strong style="${titleStyle(titleColor)}">${title}</strong>${body}</section>`;
    }),
  );

  return `<div style="${wrapperStyle}">${renderedColumns.join("")}</div>`;
}

async function renderComparisonBlockTable(
  columns: JSONContent[],
  options: DcExportOptions,
): Promise<string> {
  const palette = comparisonBlockPalette(options);
  const tableStyle = joinStyle({
    width: "100%",
    margin: "0 0 18px",
    "border-collapse": "collapse",
    "background-color": palette.background,
    "table-layout": "fixed",
  });
  const titleStyle = (color: string) =>
    joinStyle({
      display: "block",
      margin: "0 0 8px",
      color,
      "font-family": safeProseFontFamily(options.bodyFontFamily),
      "font-size": "12px",
      "font-weight": 700,
      "line-height": 1.2,
    });
  const cellStyle = (side: "left" | "right") => {
    const isRight = side === "right";

    return joinStyle({
      width: "49%",
      padding: "13px 15px",
      border: `1px solid ${palette.divider}`,
      "border-left": "0",
      "background-color": isRight ? palette.rightBackground : palette.leftBackground,
      color: palette.text,
      "font-family": safeProseFontFamily(options.bodyFontFamily),
      "font-size": safeBodyFontSize(options),
      "line-height": 1.64,
      "vertical-align": "top",
    });
  };
  const spacerCellStyle = joinStyle({
    width: "2%",
    padding: "0",
    "font-size": "0",
    "line-height": "0",
    "background-color": palette.background,
  });
  const accentCellStyle = (side: "left" | "right") => {
    const isRight = side === "right";

    return joinStyle({
      width: "4px",
      padding: "0",
      "background-color": isRight ? palette.rightBorder : palette.leftBorder,
      "font-size": "0",
      "line-height": "0",
    });
  };
  const cells = await Promise.all(
    columns.map(async (column, index) => {
      const side = index === 1 ? "right" : "left";
      const isRight = side === "right";
      const fallbackBackground = isRight
        ? palette.rightFallbackBackground
        : palette.leftFallbackBackground;
      const accentColor = isRight ? palette.rightBorderFallback : palette.leftBorderFallback;
      const title = escapeHtml(
        comparisonColumnTitle(column, side === "right" ? "After" : "Before"),
      );
      const titleColor = side === "right" ? palette.rightTitle : palette.leftTitle;
      const backgroundColor = side === "right" ? palette.rightBackground : palette.leftBackground;
      const body = await renderComparisonColumnBody(column, options, palette.text, backgroundColor);

      return `<td width="4" bgcolor="${accentColor}" style="${accentCellStyle(side)}">&nbsp;</td><td width="49%" bgcolor="${fallbackBackground}" style="${cellStyle(side)}"><strong style="${titleStyle(titleColor)}">${title}</strong>${body}</td>`;
    }),
  );

  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${palette.fallbackBackground}" style="${tableStyle}"><tbody><tr>${cells[0]}<td width="2%" bgcolor="${palette.fallbackBackground}" style="${spacerCellStyle}">&nbsp;</td>${cells[1]}</tr></tbody></table>`;
}

async function renderBlockAsync(
  node: JSONContent,
  options: DcExportOptions,
  context: RenderContext = {},
): Promise<string> {
  switch (node.type) {
    case "doc": {
      const children = await Promise.all(
        childrenOf(node).map((child) => renderBlockAsync(child, options, context)),
      );
      return children.join("");
    }
    case "paragraph":
      return renderParagraph(node, options, context);
    case "heading":
      return renderHeading(node, options);
    case "bulletList":
      return renderList(node, options, false);
    case "orderedList":
      return renderList(node, options, true);
    case "calloutBox":
      return renderCallout(node, options);
    case "tipBox":
    case "warningBox":
    case "referenceBox":
    case "emphasisBox":
    case "successBox":
    case "failureBox":
    case "experimentBox":
    case "conclusionBox":
    case "rebuttalBox":
      return renderCallout(node, options, calloutKindFromNodeName(node.type));
    case "linkBox":
      return renderLinkBox(node, options);
    case "sectionHeading":
      return renderSectionHeading(node, options);
    case "ctaButton":
      return renderCtaButton(node, options);
    case "ctaGroup":
      return renderCtaGroup(node, options);
    case "referenceList":
      return renderReferenceList(node, options);
    case "summaryBox":
      return renderSummaryBox(node, options);
    case "heroBlock":
      return renderHeroBlock(node, options);
    case "tutorialBlock":
      return renderTutorialBlock(node, options);
    case "comparisonBlock":
      return renderComparisonBlock(node, options);
    case "dcDataTable":
      return renderDataTable(node, options);
    case "codeBlock":
      return renderCodeBlock(node, options);
    case "blockquote":
      return renderBlockquote(node, options);
    case "horizontalRule":
      return `<hr style="${joinStyle({ margin: "18px 0", border: 0, "border-top": `1px solid ${documentPalette(options).divider}` })}">`;
    default:
      return renderInlineChildren(node, options, context);
  }
}

export async function exportDocumentToDcHtml(
  document: JSONContent,
  options: DcExportOptions,
): Promise<string> {
  if (!hasRenderableDocumentContent(document)) {
    return "";
  }

  const palette = documentPalette(options);
  const body = await renderBlockAsync(document, options, { proseTableSafe: true });
  const bodyWithAttribution = options.includeAttribution
    ? `${body}${renderAttributionFooter(options)}`
    : body;
  const wrapperStyle = joinStyle({
    display: "block",
    "background-color": palette.articleBackground,
    color: palette.text,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": safeBodyFontSize(options),
    "line-height": 1.7,
    padding: "18px",
    "box-sizing": "border-box",
  });

  if (isDcTableStructure(options)) {
    const tableStyle = joinStyle({
      width: "100%",
      "border-collapse": "collapse",
      "background-color": palette.articleBackground,
      color: palette.text,
      "font-family": safeProseFontFamily(options.bodyFontFamily),
      "font-size": safeBodyFontSize(options),
      "line-height": 1.7,
    });
    const cellStyle = joinStyle({
      padding: "18px",
      "background-color": palette.articleBackground,
      color: palette.text,
      "font-family": safeProseFontFamily(options.bodyFontFamily),
      "font-size": safeBodyFontSize(options),
      "line-height": 1.7,
      "box-sizing": "border-box",
    });

    return compactInheritedProseStyles(
      `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${palette.fallbackBackground}" style="${tableStyle}"><tbody><tr><td style="${cellStyle}">${bodyWithAttribution}</td></tr></tbody></table>`,
      options,
    );
  }

  return compactInheritedProseStyles(
    `<div style="${wrapperStyle}">${bodyWithAttribution}</div>`,
    options,
  );
}
