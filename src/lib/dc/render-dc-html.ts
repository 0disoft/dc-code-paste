import { escapeHtml } from "./escape-html";
import { joinStyle, sanitizeColor } from "./sanitize-style";

export type DcToken = {
  content: string;
  color?: string;
  fontStyle?: number;
};

export type DcRenderInput = {
  lines: readonly (readonly DcToken[])[];
  background: string;
  foreground: string;
  fontSize?: string;
  showBackground: boolean;
  showLineNumbers: boolean;
};

const fallbackBackground = "oklch(18.22% 0.017 258.21)";
const fallbackForeground = "oklch(83.86% 0.011 258.34)";

function normalizeTokenContent(content: string): string {
  return content.replace(/\t/g, "    ");
}

function tokenStyle(token: DcToken, foreground: string): string {
  const fontStyle = token.fontStyle ?? 0;
  return joinStyle({
    color: sanitizeColor(token.color, foreground),
    "font-style": fontStyle > 0 && (fontStyle & 1) === 1 ? "italic" : undefined,
    "font-weight": fontStyle > 0 && (fontStyle & 2) === 2 ? 700 : undefined,
    "text-decoration": fontStyle > 0 && (fontStyle & 4) === 4 ? "underline" : undefined,
  });
}

function renderToken(token: DcToken, foreground: string): string {
  const content = escapeHtml(normalizeTokenContent(token.content));
  if (!content) {
    return "";
  }

  return `<span style="${tokenStyle(token, foreground)}">${content}</span>`;
}

function renderLineNumber(index: number, foreground: string): string {
  const style = joinStyle({
    color: foreground,
    opacity: "0.45",
    display: "inline-block",
    width: "3ch",
    "padding-right": "12px",
    "text-align": "right",
    "user-select": "none",
  });

  return `<span style="${style}">${index + 1}</span>`;
}

export function renderDcHtml(input: DcRenderInput): string {
  const background = sanitizeColor(input.background, fallbackBackground);
  const foreground = sanitizeColor(input.foreground, fallbackForeground);
  const preStyle = joinStyle({
    "background-color": input.showBackground ? background : undefined,
    color: foreground,
    "font-family":
      'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace',
    "font-size": input.fontSize ?? "14px",
    "line-height": "1.58",
    margin: 0,
    padding: input.showBackground ? "14px 16px" : 0,
    "white-space": "pre-wrap",
    "word-break": "normal",
    "overflow-wrap": "anywhere",
    "tab-size": 4,
  });

  const renderedLines = input.lines.map((line, index) => {
    const prefix = input.showLineNumbers ? renderLineNumber(index, foreground) : "";
    const body = line.map((token) => renderToken(token, foreground)).join("");
    return `${prefix}${body || "&nbsp;"}`;
  });

  return `<pre style="${preStyle}"><code>${renderedLines.join("\n")}</code></pre>`;
}
