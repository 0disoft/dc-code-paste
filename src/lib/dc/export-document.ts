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
import { normalizeEditableLinkHref } from "$lib/editor/link";

export type DcExportOptions = {
  theme: DcThemeId;
  bodyFontFamily: string;
  bodyFontSize: string;
  codeFontSize: string;
  showLineNumbers: boolean;
  structure?: DcExportStructure;
};

export type DcExportStructure = "modern" | "dcTable";

const fallbackTextColor = "oklch(23.39% 0.012 255.51)";
const mutedTextColor = "oklch(49.23% 0.026 255.79)";
const linkColor = "oklch(56.77% 0.154 252.96)";
const articleBackground = "oklch(98.38% 0.01 97.33)";
const inlineCodeBackground = "oklch(94.93% 0.016 255.07)";
const inlineCodeText = "oklch(34.86% 0.087 278.64)";

const dcTableFallbackColors = {
  articleBackground: "#fbfaf2",
  tipBackground: "#e6fbe4",
  warningBackground: "#fff1cf",
  referenceBackground: "#e5f6ff",
  emphasisBackground: "#f4eaff",
  quoteBackground: "#edf7ff",
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

function safeFontFamily(value: string): string {
  const normalized = value.trim();

  if (!normalized) {
    return "Malgun Gothic, Apple SD Gothic Neo, Segoe UI, sans-serif";
  }

  return normalized
    .split(",")
    .map((part) => part.trim().replace(/[;"<>]/g, ""))
    .filter(Boolean)
    .join(", ");
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

function renderTextStyle(mark: JSONContent): Record<string, string | undefined> {
  const attrs = mark.attrs ?? {};
  const color =
    typeof attrs.color === "string" ? sanitizeColor(attrs.color, fallbackTextColor) : undefined;
  const fontFamily =
    typeof attrs.fontFamily === "string" ? safeFontFamily(attrs.fontFamily) : undefined;
  const fontSize = typeof attrs.fontSize === "string" ? safeSize(attrs.fontSize, "") : undefined;

  return {
    color,
    "font-family": fontFamily,
    "font-size": fontSize,
  };
}

function applyMarks(text: string, marks: readonly JSONContent[] | undefined): string {
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
        "background-color": inlineCodeBackground,
        color: inlineCodeText,
        "font-family":
          'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace',
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
        color: linkColor,
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
      const style = joinStyle(renderTextStyle(mark));
      if (style) {
        html = `<span style="${style}">${html}</span>`;
      }
    }
  }

  return html;
}

function renderInline(node: JSONContent): string {
  if (node.type === "text") {
    return applyMarks(node.text ?? "", node.marks);
  }

  if (node.type === "hardBreak") {
    return "<br>";
  }

  return childrenOf(node).map(renderInline).join("");
}

function renderInlineChildren(node: JSONContent): string {
  return childrenOf(node).map(renderInline).join("");
}

function renderParagraph(node: JSONContent, options: DcExportOptions): string {
  const style = joinStyle({
    margin: "0 0 14px",
    color: fallbackTextColor,
    "font-family": safeFontFamily(options.bodyFontFamily),
    "font-size": safeSize(options.bodyFontSize, "15px"),
    "line-height": 1.72,
  });

  return `<p style="${style}">${renderInlineChildren(node) || "&nbsp;"}</p>`;
}

function renderHeading(node: JSONContent, options: DcExportOptions): string {
  const level = safeHeadingLevel(node.attrs?.level);
  const size = level === 1 ? "24px" : level === 2 ? "20px" : "17px";
  const style = joinStyle({
    margin: "22px 0 12px",
    color: "oklch(24.19% 0.019 255.77)",
    "font-family": safeFontFamily(options.bodyFontFamily),
    "font-size": size,
    "font-weight": 900,
    "line-height": 1.28,
  });

  return `<h${level} style="${style}">${renderInlineChildren(node)}</h${level}>`;
}

async function renderList(
  node: JSONContent,
  options: DcExportOptions,
  ordered: boolean,
): Promise<string> {
  const tag = ordered ? "ol" : "ul";
  const listStyle = joinStyle({
    margin: "0 0 14px",
    padding: "0 0 0 24px",
    color: fallbackTextColor,
    "font-family": safeFontFamily(options.bodyFontFamily),
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
  const palette = calloutStyles[kind];
  const labelStyle = joinStyle({
    display: "block",
    margin: "0 0 6px",
    color: palette.text,
    "font-size": "12px",
    "font-weight": 900,
    "letter-spacing": "0",
  });
  const body = await Promise.all(childrenOf(node).map((child) => renderBlockAsync(child, options)));
  const content = `<span style="${labelStyle}">${palette.label}</span>${body.join("")}`;

  if (isDcTableStructure(options)) {
    return renderDcTableBlock({
      body: content,
      backgroundColor: palette.background,
      fallbackBackground: dcTableFallbackColors[`${kind}Background`],
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
    "font-family": safeFontFamily(options.bodyFontFamily),
    "font-size": safeSize(options.bodyFontSize, "15px"),
    "line-height": 1.68,
  });

  return `<div style="${wrapperStyle}">${content}</div>`;
}

async function renderLinkBox(node: JSONContent, options: DcExportOptions): Promise<string> {
  const href = safeHref(node.attrs?.href);
  const normalizedLinkHref = normalizedHref(node.attrs?.href);
  const plainBodyText = textOf(node).trim();

  if (!normalizedLinkHref && !plainBodyText) {
    return "";
  }

  const wrapperStyle = joinStyle({
    margin: "0 0 16px",
    padding: "12px 14px",
    border: "1px solid oklch(78.06% 0.088 247.23)",
    "border-left": "4px solid oklch(56.77% 0.154 252.96)",
    "background-color": "oklch(97.5% 0.025 247.64)",
    color: "oklch(28.43% 0.052 249.88)",
    "border-radius": "7px",
    "font-family": safeFontFamily(options.bodyFontFamily),
    "font-size": safeSize(options.bodyFontSize, "15px"),
    "line-height": 1.68,
  });
  const labelStyle = joinStyle({
    display: "block",
    margin: "0 0 6px",
    color: "oklch(32.26% 0.07 249.42)",
    "font-size": "12px",
    "font-weight": 900,
    "letter-spacing": "0",
  });
  const linkStyle = joinStyle({
    display: "inline-block",
    margin: "2px 0 0",
    color: linkColor,
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
      backgroundColor: "oklch(97.5% 0.025 247.64)",
      fallbackBackground: dcTableFallbackColors.referenceBackground,
      border: "1px solid oklch(78.06% 0.088 247.23)",
      borderColor: "oklch(56.77% 0.154 252.96)",
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

  return highlightForDcHtml(textOf(node), {
    language,
    theme: options.theme || defaultTheme,
    showBackground: true,
    showLineNumbers: options.showLineNumbers,
    fontSize: safeSize(options.codeFontSize, "14px"),
  });
}

async function renderBlockAsync(node: JSONContent, options: DcExportOptions): Promise<string> {
  switch (node.type) {
    case "doc": {
      const children = await Promise.all(
        childrenOf(node).map((child) => renderBlockAsync(child, options)),
      );
      return children.join("");
    }
    case "paragraph":
      return renderParagraph(node, options);
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
      return renderCallout(node, options, calloutKindFromNodeName(node.type));
    case "linkBox":
      return renderLinkBox(node, options);
    case "codeBlock":
      return renderCodeBlock(node, options);
    case "blockquote": {
      const children = await Promise.all(
        childrenOf(node).map((child) => renderBlockAsync(child, options)),
      );

      if (isDcTableStructure(options)) {
        return renderDcTableBlock({
          body: children.join(""),
          backgroundColor: "oklch(96.27% 0.036 247.39)",
          fallbackBackground: dcTableFallbackColors.quoteBackground,
          borderColor: "oklch(68.74% 0.127 246.28)",
          padding: "8px 12px",
        });
      }

      const style = joinStyle({
        margin: "0 0 14px",
        padding: "8px 12px",
        "border-left": "3px solid oklch(68.74% 0.127 246.28)",
        color: mutedTextColor,
        "background-color": "oklch(96.27% 0.036 247.39)",
      });
      return `<blockquote style="${style}">${children.join("")}</blockquote>`;
    }
    case "horizontalRule":
      return `<hr style="${joinStyle({ margin: "18px 0", border: 0, "border-top": "1px solid oklch(86.22% 0.014 255.48)" })}">`;
    default:
      return renderInlineChildren(node);
  }
}

export async function exportDocumentToDcHtml(
  document: JSONContent,
  options: DcExportOptions,
): Promise<string> {
  const body = await renderBlockAsync(document, options);
  const wrapperStyle = joinStyle({
    display: "block",
    "background-color": articleBackground,
    color: fallbackTextColor,
    "font-family": safeFontFamily(options.bodyFontFamily),
    "font-size": safeSize(options.bodyFontSize, "15px"),
    "line-height": 1.7,
    padding: "18px",
    "box-sizing": "border-box",
  });

  if (isDcTableStructure(options)) {
    const tableStyle = joinStyle({
      width: "100%",
      "border-collapse": "collapse",
      "background-color": articleBackground,
      color: fallbackTextColor,
      "font-family": safeFontFamily(options.bodyFontFamily),
      "font-size": safeSize(options.bodyFontSize, "15px"),
      "line-height": 1.7,
    });
    const cellStyle = joinStyle({
      padding: "18px",
      "background-color": articleBackground,
      color: fallbackTextColor,
      "font-family": safeFontFamily(options.bodyFontFamily),
      "font-size": safeSize(options.bodyFontSize, "15px"),
      "line-height": 1.7,
      "box-sizing": "border-box",
    });

    return `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${dcTableFallbackColors.articleBackground}" style="${tableStyle}"><tbody><tr><td style="${cellStyle}">${body}</td></tr></tbody></table>`;
  }

  return `<div style="${wrapperStyle}">${body}</div>`;
}
