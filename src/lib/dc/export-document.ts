import type { JSONContent } from "@tiptap/core";
import { escapeHtml } from "./escape-html";
import { joinStyle, sanitizeColor } from "./sanitize-style";
import {
  defaultLanguage,
  defaultTheme,
  isSupportedLanguage,
  type DcThemeId,
} from "$lib/highlighter/catalog";
import type { CalloutKind } from "$lib/editor/callout";
import { calloutKindFromNodeName, normalizeCalloutKind } from "$lib/editor/callout";
import { normalizeCtaGroupLayout, type CtaGroupLayout } from "$lib/editor/cta-group";
import { normalizeEditableLinkHref } from "$lib/editor/link";
import { normalizeQuoteStyle, type QuoteStyle } from "$lib/editor/quote-style";
import { safeCodeFontFamily, safeProseFontFamily } from "./font-stacks";
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
};

export type DcExportStructure = "modern" | "dcTable";
export type DcDocumentTheme = "lightLecture" | "darkEditorial";

const fallbackTextColor = "oklch(23.39% 0.012 255.51)";
const linkColor = "oklch(56.77% 0.154 252.96)";
const articleBackground = "oklch(98.38% 0.01 97.33)";
const inlineCodeBackground = "oklch(94.93% 0.016 255.07)";
const inlineCodeText = "oklch(34.86% 0.087 278.64)";
const quoteAccentColor = "oklch(61.2% 0.049 77.83)";
const quoteTextColor = "oklch(37.24% 0.026 77.36)";
const quoteMarkColor = "oklch(74.61% 0.063 77.91)";

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
};

type RenderContext = {
  text?: string;
  inlineCodeBackground?: string;
  inlineCodeText?: string;
};

function normalizeDocumentTheme(value: DcDocumentTheme | undefined): DcDocumentTheme {
  return value === "darkEditorial" ? "darkEditorial" : "lightLecture";
}

function documentPalette(options: DcExportOptions): DocumentPalette {
  if (normalizeDocumentTheme(options.documentTheme) === "darkEditorial") {
    return {
      articleBackground: "oklch(7.2% 0.012 94.1)",
      fallbackBackground: "#050505",
      text: "oklch(94.12% 0.012 93.37)",
      mutedText: "oklch(71.26% 0.021 84.88)",
      heading: "oklch(98.32% 0.006 93.08)",
      link: "oklch(83.57% 0.141 84.66)",
      divider: "oklch(34.91% 0.033 83.29)",
      inlineCodeBackground: "oklch(18.92% 0.02 83.18)",
      inlineCodeText: "oklch(96.51% 0.015 91.73)",
      quoteBackground: "oklch(9.76% 0.011 94.84)",
      quoteText: "oklch(87.91% 0.018 86.38)",
      quoteAccent: "oklch(84.08% 0.11 84.51)",
      quoteMark: "oklch(80.12% 0.097 84.88)",
      sectionText: "oklch(97.22% 0.008 92.87)",
      sectionAccent: "oklch(88.91% 0.091 87.72)",
      sectionBorder: "oklch(35.04% 0.033 84.06)",
      ctaBackground: "oklch(91.44% 0.064 90.52)",
      ctaBorder: "oklch(96.28% 0.022 90.84)",
      ctaText: "oklch(13.77% 0.018 87.82)",
    };
  }

  return {
    articleBackground,
    fallbackBackground: dcTableFallbackColors.articleBackground,
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
  };
}

const dcTableFallbackColors = {
  articleBackground: "#fbfaf2",
  tipBackground: "#e6fbe4",
  warningBackground: "#fff1cf",
  referenceBackground: "#e5f6ff",
  emphasisBackground: "#f4eaff",
  successBackground: "#e7faee",
  failureBackground: "#ffe8e5",
  experimentBackground: "#eaf1ff",
  conclusionBackground: "#fff7d9",
  rebuttalBackground: "#ffe9f5",
  quoteBackground: "#fbfaf2",
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
    background: "oklch(11.88% 0.018 142.78)",
    border: "oklch(76.13% 0.153 142.04)",
    text: "oklch(91.89% 0.026 143.2)",
  },
  warning: {
    label: "주의",
    background: "oklch(12.26% 0.018 58.76)",
    border: "oklch(78.46% 0.145 69.41)",
    text: "oklch(92.96% 0.03 76.33)",
  },
  reference: {
    label: "REF",
    background: "oklch(11.62% 0.021 245.9)",
    border: "oklch(72.52% 0.142 232.16)",
    text: "oklch(91.87% 0.029 233.82)",
  },
  emphasis: {
    label: "POINT",
    background: "oklch(12.04% 0.022 302.17)",
    border: "oklch(73.79% 0.151 303.45)",
    text: "oklch(93.04% 0.029 303.2)",
  },
  success: {
    label: "성공",
    background: "oklch(11.76% 0.02 154.8)",
    border: "oklch(76.71% 0.151 154.54)",
    text: "oklch(92.34% 0.029 154.17)",
  },
  failure: {
    label: "실패",
    background: "oklch(12.02% 0.021 24.58)",
    border: "oklch(75.02% 0.17 24.82)",
    text: "oklch(93.14% 0.03 24.92)",
  },
  experiment: {
    label: "실험",
    background: "oklch(11.48% 0.022 264.32)",
    border: "oklch(73.44% 0.145 264.2)",
    text: "oklch(92.52% 0.031 264.14)",
  },
  conclusion: {
    label: "결론",
    background: "oklch(12.18% 0.018 91.22)",
    border: "oklch(80.18% 0.126 91.43)",
    text: "oklch(93.56% 0.027 91.42)",
  },
  rebuttal: {
    label: "반박",
    background: "oklch(12.11% 0.023 330.24)",
    border: "oklch(75.91% 0.154 330.36)",
    text: "oklch(93.11% 0.031 330.24)",
  },
};

function calloutStyleFor(kind: CalloutKind, options: DcExportOptions) {
  return normalizeDocumentTheme(options.documentTheme) === "darkEditorial"
    ? darkCalloutStyles[kind]
    : calloutStyles[kind];
}

function calloutFallbackBackground(kind: CalloutKind, options: DcExportOptions): string {
  if (normalizeDocumentTheme(options.documentTheme) === "darkEditorial") {
    return "#0c0c0c";
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

function safeSize(value: string, fallback: string): string {
  const normalized = value.trim();
  return /^\d{1,2}px$/.test(normalized) ? normalized : fallback;
}

function safeHeadingLevel(value: unknown): 1 | 2 | 3 | 4 | 5 | 6 {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 || value === 6
    ? value
    : 2;
}

function isDcTableStructure(options: DcExportOptions): boolean {
  return options.structure === "dcTable";
}

function renderDcTableBlock({
  body,
  backgroundColor,
  fallbackBackground,
  borderColor,
  border,
  padding = "12px 14px",
}: {
  body: string;
  backgroundColor: string;
  fallbackBackground: string;
  borderColor?: string;
  border?: string;
  padding?: string;
}): string {
  const tableStyle = joinStyle({
    width: "100%",
    margin: "0 0 16px",
    "border-collapse": "collapse",
    "background-color": backgroundColor,
    "border-left": borderColor ? `4px solid ${borderColor}` : undefined,
    border,
  });
  const cellStyle = joinStyle({
    padding,
    "background-color": backgroundColor,
  });

  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${fallbackBackground}" style="${tableStyle}"><tbody><tr><td style="${cellStyle}">${body}</td></tr></tbody></table>`;
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
): Record<string, string | undefined> {
  const attrs = mark.attrs ?? {};
  const color =
    typeof attrs.color === "string" ? sanitizeColor(attrs.color, palette.text) : undefined;
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
      html = `<strong style="font-weight:800">${html}</strong>`;
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
        "font-family": safeCodeFontFamily(),
        "font-size": "0.92em",
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
      const style = joinStyle(renderTextStyle(mark, palette));
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
  const style = joinStyle({
    margin: "0 0 14px",
    color: context.text ?? palette.text,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": safeSize(options.bodyFontSize, "15px"),
    "line-height": 1.72,
  });

  return `<p style="${style}">${renderInlineChildren(node, options, context) || "&nbsp;"}</p>`;
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
    "font-weight": 900,
    "line-height": 1.28,
  });

  return `<h${level} style="${style}">${renderInlineChildren(node, options)}</h${level}>`;
}

async function renderList(
  node: JSONContent,
  options: DcExportOptions,
  ordered: boolean,
): Promise<string> {
  const palette = documentPalette(options);
  const tag = ordered ? "ol" : "ul";
  const listStyle = joinStyle({
    margin: "0 0 14px",
    padding: "0 0 0 24px",
    color: palette.text,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": safeSize(options.bodyFontSize, "15px"),
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

async function renderCallout(
  node: JSONContent,
  options: DcExportOptions,
  explicitKind?: CalloutKind,
): Promise<string> {
  const kind = explicitKind ?? normalizeCalloutKind(node.attrs?.kind);
  const palette = calloutStyleFor(kind, options);
  const codePalette = calloutInlineCodeStyles[kind];
  const childContext: RenderContext = {
    text: palette.text,
    inlineCodeBackground: codePalette.background,
    inlineCodeText: codePalette.text,
  };
  const labelStyle = joinStyle({
    display: "block",
    margin: "0 0 6px",
    color: palette.text,
    "font-size": "12px",
    "font-weight": 900,
    "letter-spacing": "0",
  });
  const body = await Promise.all(
    childrenOf(node).map((child) => renderBlockAsync(child, options, childContext)),
  );
  const content = `<span style="${labelStyle}">${palette.label}</span>${body.join("")}`;

  if (isDcTableStructure(options)) {
    return renderDcTableBlock({
      body: content,
      backgroundColor: palette.background,
      fallbackBackground: calloutFallbackBackground(kind, options),
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
    "font-size": safeSize(options.bodyFontSize, "15px"),
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
    "font-size": safeSize(options.bodyFontSize, "15px"),
    "line-height": 1.68,
  });
  const labelStyle = joinStyle({
    display: "block",
    margin: "0 0 6px",
    color: isDarkEditorial ? "oklch(79.74% 0.124 233.36)" : "oklch(32.26% 0.07 249.42)",
    "font-size": "12px",
    "font-weight": 900,
    "letter-spacing": "0",
  });
  const linkStyle = joinStyle({
    display: "inline-block",
    margin: "2px 0 0",
    color: palette.link,
    "font-weight": 800,
    "text-decoration": "underline",
    "text-underline-offset": "2px",
  });
  const body =
    normalizedLinkHref && isOnlyHrefText(plainBodyText, normalizedLinkHref)
      ? []
      : await Promise.all(childrenOf(node).map((child) => renderBlockAsync(child, options)));
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
  const filename = normalizeCodeFilename(node.attrs?.filename);

  return highlightForDcHtml(textOf(node), {
    language,
    theme: options.theme || defaultTheme,
    showBackground: true,
    showLineNumbers: options.showLineNumbers,
    filename,
    fontSize: safeSize(options.codeFontSize, "14px"),
    highlightLines,
  });
}

async function renderBlockquote(node: JSONContent, options: DcExportOptions): Promise<string> {
  const palette = documentPalette(options);
  const quoteStyle = normalizeQuoteStyle(node.attrs?.quoteStyle);
  const quoteParagraphStyle = joinStyle({
    margin: quoteStyle === "pull" ? 0 : "0 0 8px",
    color: quoteStyle === "pull" ? palette.heading : palette.quoteText,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": quoteStyle === "pull" ? "21px" : safeSize(options.bodyFontSize, "15px"),
    "font-style": quoteStyle === "academic" || quoteStyle === "pull" ? undefined : "italic",
    "font-weight": quoteStyle === "pull" ? 900 : undefined,
    "line-height": quoteStyle === "pull" ? 1.48 : 1.78,
    "text-align": quoteStyle === "pull" ? "center" : undefined,
  });
  const children = await Promise.all(
    childrenOf(node).map((child) => {
      if (child.type === "paragraph") {
        return `<p style="${quoteParagraphStyle}">${renderInlineChildren(child, options, { text: palette.quoteText }) || "&nbsp;"}</p>`;
      }

      return renderBlockAsync(child, options, { text: palette.quoteText });
    }),
  );
  const body = children.join("");
  const content = renderQuoteContent(quoteStyle, body, palette, options);

  if (isDcTableStructure(options)) {
    return renderDcTableBlock({
      body: content,
      backgroundColor: quoteBackground(quoteStyle, palette),
      fallbackBackground: quoteFallbackBackground(options),
      border: quoteTableBorder(quoteStyle, palette),
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
    ? documentPalette(options).fallbackBackground
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
    "font-weight": 900,
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
      "font-weight": 900,
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
      "font-weight": 900,
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
      "font-size": safeSize(options.bodyFontSize, "15px"),
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
      "font-weight": 900,
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
      "font-size": safeSize(options.bodyFontSize, "15px"),
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
    "font-size": safeSize(options.bodyFontSize, "15px"),
    "font-style": "italic",
    "line-height": 1.78,
  });
}

async function renderSectionHeading(node: JSONContent, options: DcExportOptions): Promise<string> {
  const palette = documentPalette(options);
  const content = renderInlineChildren(node, options, { text: palette.sectionText });
  const body = `<strong style="${joinStyle({
    color: palette.sectionText,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": "20px",
    "font-weight": 900,
    "line-height": 1.35,
  })}">${content || "&nbsp;"}</strong>`;

  if (isDcTableStructure(options)) {
    return renderDcTableBlock({
      body,
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
    "font-weight": 900,
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
  const label = renderInlineChildren(node, options, { text: palette.ctaText }) || "바로가기";

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
    "font-size": safeSize(options.bodyFontSize, "15px"),
    "font-weight": 900,
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
    "font-size": safeSize(options.bodyFontSize, "15px"),
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
      background: "oklch(9.8% 0.014 94.7)",
      fallbackBackground: "#090909",
      border: "oklch(34.06% 0.044 236.72)",
      badgeBackground: "oklch(74.22% 0.14 232.34)",
      badgeText: "oklch(8.61% 0.019 237.62)",
      itemDivider: "oklch(24.21% 0.025 236.68)",
      text: "oklch(91.87% 0.029 233.82)",
      mutedText: "oklch(70.88% 0.035 235.94)",
    };
  }

  return {
    background: "oklch(97.5% 0.025 247.64)",
    fallbackBackground: dcTableFallbackColors.referenceBackground,
    border: "oklch(78.06% 0.088 247.23)",
    badgeBackground: "oklch(56.77% 0.154 252.96)",
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
): string {
  const documentColors = documentPalette(options);
  const href = safeHref(node.attrs?.href);
  const normalizedLinkHref = normalizedHref(node.attrs?.href);
  const fallbackLabel = normalizedLinkHref ? visibleLinkLabel(normalizedLinkHref) : "참고 자료";
  const label =
    renderInlineChildren(node, options, { text: textColor }) || escapeHtml(fallbackLabel);
  const linkStyle = joinStyle({
    color: documentColors.link,
    "font-weight": 850,
    "text-decoration": "underline",
    "text-underline-offset": "2px",
  });

  return href
    ? `<a href="${href}" target="_blank" rel="noopener noreferrer" style="${linkStyle}">${label}</a>`
    : label;
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
    "font-size": safeSize(options.bodyFontSize, "15px"),
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
    "vertical-align": "top",
  });
  const badgeStyle = joinStyle({
    display: "inline-block",
    "min-width": "26px",
    padding: "2px 0",
    "border-radius": "999px",
    "background-color": palette.badgeBackground,
    color: palette.badgeText,
    "font-size": "11px",
    "font-weight": 900,
    "line-height": 1.2,
    "text-align": "center",
  });
  const labelCellStyle = joinStyle({
    display: "table-cell",
    padding: "11px 14px 11px 0",
    color: palette.text,
    "vertical-align": "top",
  });
  const body = items
    .map((item, index) => {
      const rowStyle = index === items.length - 1 ? lastItemStyle : itemStyle;
      const number = String(index + 1).padStart(2, "0");
      const content = renderReferenceItemBody(item, options, palette.text);

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
    "vertical-align": "top",
  });
  const lastBadgeCellStyle = joinStyle({
    width: "42px",
    padding: "10px 0 10px 12px",
    "vertical-align": "top",
  });
  const badgeStyle = joinStyle({
    display: "inline-block",
    "min-width": "26px",
    padding: "2px 0",
    "border-radius": "999px",
    "background-color": palette.badgeBackground,
    color: palette.badgeText,
    "font-size": "11px",
    "font-weight": 900,
    "line-height": 1.2,
    "text-align": "center",
  });
  const itemCellStyle = joinStyle({
    padding: "10px 14px 10px 0",
    "border-bottom": `1px solid ${palette.itemDivider}`,
    color: palette.text,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": safeSize(options.bodyFontSize, "15px"),
    "line-height": 1.62,
    "vertical-align": "top",
  });
  const lastItemCellStyle = joinStyle({
    padding: "10px 14px 10px 0",
    color: palette.text,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": safeSize(options.bodyFontSize, "15px"),
    "line-height": 1.62,
    "vertical-align": "top",
  });
  const rows = items
    .map((item, index) => {
      const number = String(index + 1).padStart(2, "0");
      const badgeTdStyle = index === items.length - 1 ? lastBadgeCellStyle : badgeCellStyle;
      const itemTdStyle = index === items.length - 1 ? lastItemCellStyle : itemCellStyle;
      const content = renderReferenceItemBody(item, options, palette.text);

      return `<tr><td style="${badgeTdStyle}"><span style="${badgeStyle}">${number}</span></td><td style="${itemTdStyle}">${content}</td></tr>`;
    })
    .join("");

  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${palette.fallbackBackground}" style="${tableStyle}"><tbody>${rows}</tbody></table>`;
}

function summaryBoxPalette(options: DcExportOptions) {
  if (normalizeDocumentTheme(options.documentTheme) === "darkEditorial") {
    return {
      background: "oklch(10.18% 0.015 94.76)",
      fallbackBackground: "#090909",
      border: "oklch(36.21% 0.032 84.68)",
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

  if (items.length === 0) {
    return "";
  }

  return isDcTableStructure(options)
    ? renderSummaryBoxTable(items, options)
    : renderSummaryBoxModern(items, options);
}

function renderSummaryItemContent(
  node: JSONContent,
  options: DcExportOptions,
  textColor: string,
): string {
  return renderInlineChildren(node, options, { text: textColor }) || "&nbsp;";
}

function renderSummaryBoxModern(items: JSONContent[], options: DcExportOptions): string {
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
    "font-size": safeSize(options.bodyFontSize, "15px"),
    "line-height": 1.62,
  });
  const labelStyle = joinStyle({
    display: "block",
    margin: "0 0 9px",
    color: palette.label,
    "font-size": "12px",
    "font-weight": 900,
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
    width: "22px",
    "vertical-align": "top",
  });
  const bulletStyle = joinStyle({
    display: "inline-block",
    width: "8px",
    height: "8px",
    margin: "8px 0 0",
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
      const content = renderSummaryItemContent(item, options, palette.text);
      return `<li style="${itemStyle}"><span style="${bulletCellStyle}"><span style="${bulletStyle}"></span></span><span style="${contentCellStyle}">${content}</span></li>`;
    })
    .join("");

  return `<section style="${wrapperStyle}"><span style="${labelStyle}">핵심 요약</span><ul style="${listStyle}">${body}</ul></section>`;
}

function renderSummaryBoxTable(items: JSONContent[], options: DcExportOptions): string {
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
    "font-weight": 900,
    "line-height": 1.2,
  });
  const bulletCellStyle = joinStyle({
    width: "30px",
    padding: "6px 0 6px 16px",
    "vertical-align": "top",
  });
  const lastBulletCellStyle = joinStyle({
    width: "30px",
    padding: "6px 0 14px 16px",
    "vertical-align": "top",
  });
  const bulletStyle = joinStyle({
    display: "inline-block",
    width: "8px",
    height: "8px",
    margin: "8px 0 0",
    "border-radius": "999px",
    "background-color": palette.bulletBackground,
  });
  const itemCellStyle = joinStyle({
    padding: "5px 16px 5px 0",
    color: palette.text,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": safeSize(options.bodyFontSize, "15px"),
    "line-height": 1.62,
    "vertical-align": "top",
  });
  const lastItemCellStyle = joinStyle({
    padding: "5px 16px 13px 0",
    color: palette.text,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": safeSize(options.bodyFontSize, "15px"),
    "line-height": 1.62,
    "vertical-align": "top",
  });
  const rows = items
    .map((item, index) => {
      const content = renderSummaryItemContent(item, options, palette.text);
      const isLast = index === items.length - 1;
      return `<tr><td style="${isLast ? lastBulletCellStyle : bulletCellStyle}"><span style="${bulletStyle}"></span></td><td style="${isLast ? lastItemCellStyle : itemCellStyle}">${content}</td></tr>`;
    })
    .join("");

  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${palette.fallbackBackground}" style="${tableStyle}"><tbody><tr><td colspan="2" style="${labelCellStyle}">핵심 요약</td></tr>${rows}</tbody></table>`;
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
  const palette = documentPalette(options);
  const body = await renderBlockAsync(document, options);
  const wrapperStyle = joinStyle({
    display: "block",
    "background-color": palette.articleBackground,
    color: palette.text,
    "font-family": safeProseFontFamily(options.bodyFontFamily),
    "font-size": safeSize(options.bodyFontSize, "15px"),
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
      "font-size": safeSize(options.bodyFontSize, "15px"),
      "line-height": 1.7,
    });
    const cellStyle = joinStyle({
      padding: "18px",
      "background-color": palette.articleBackground,
      color: palette.text,
      "font-family": safeProseFontFamily(options.bodyFontFamily),
      "font-size": safeSize(options.bodyFontSize, "15px"),
      "line-height": 1.7,
      "box-sizing": "border-box",
    });

    return `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${palette.fallbackBackground}" style="${tableStyle}"><tbody><tr><td style="${cellStyle}">${body}</td></tr></tbody></table>`;
  }

  return `<div style="${wrapperStyle}">${body}</div>`;
}
