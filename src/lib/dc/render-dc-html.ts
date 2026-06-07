import { escapeHtml } from "./escape-html";
import { safeCodeFontFamily } from "./font-stacks";
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
  filename?: string;
  fontSize?: string;
  showBackground: boolean;
  showLineNumbers: boolean;
  lineDecorations?: readonly (DcLineDecoration | undefined)[];
};

export type DcLineDecoration = {
  background?: string;
  foreground?: string;
  borderColor?: string;
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

function renderLineNumber(index: number, foreground: string, width: string): string {
  const style = joinStyle({
    color: foreground,
    opacity: "0.45",
    display: "inline-block",
    width,
    "padding-right": "12px",
    "text-align": "right",
    "user-select": "none",
    "box-sizing": "content-box",
    "white-space": "pre",
    "word-break": "normal",
    "overflow-wrap": "normal",
    "font-variant-numeric": "tabular-nums",
    "vertical-align": "top",
  });

  return `<span style="${style}">${index + 1}</span>`;
}

export function renderDcHtml(input: DcRenderInput): string {
  const background = sanitizeColor(input.background, fallbackBackground);
  const foreground = sanitizeColor(input.foreground, fallbackForeground);
  const filename = input.filename?.trim();
  const hasDecorations = input.lineDecorations?.some(Boolean) ?? false;
  const codeFontFamily = safeCodeFontFamily();
  const preStyle = joinStyle({
    "background-color": input.showBackground ? background : undefined,
    color: foreground,
    "font-family": codeFontFamily,
    "font-size": input.fontSize ?? "14px",
    "line-height": "1.58",
    margin: filename ? 0 : "0 0 16px",
    padding: input.showBackground ? "14px 16px" : 0,
    "white-space": "pre-wrap",
    "word-break": "normal",
    "overflow-wrap": "anywhere",
    "tab-size": 4,
  });
  const codeStyle = joinStyle({
    background: "none",
    color: "inherit",
    "font-family": codeFontFamily,
    "font-size": "inherit",
    "line-height": "inherit",
    "white-space": "inherit",
    "word-break": "inherit",
    "overflow-wrap": "inherit",
    "tab-size": 4,
  });

  const lineNumberWidth = `${Math.max(2, String(input.lines.length).length)}ch`;
  const renderedLines = input.lines.map((line, index) => {
    const decoration = input.lineDecorations?.[index];
    const lineForeground = sanitizeColor(decoration?.foreground, foreground);
    const prefix = input.showLineNumbers
      ? renderLineNumber(index, lineForeground, lineNumberWidth)
      : "";
    const body = line.map((token) => renderToken(token, lineForeground)).join("");
    const content = `${prefix}${body || "&nbsp;"}`;

    if (!decoration) {
      if (!hasDecorations) {
        return content;
      }

      const neutralLineStyle = joinStyle({
        display: "block",
        margin: input.showBackground ? "0 -16px" : undefined,
        padding: input.showBackground ? "0 16px" : undefined,
        "box-sizing": "border-box",
      });

      return `<span style="${neutralLineStyle}">${content}</span>`;
    }

    const lineStyle = joinStyle({
      display: "block",
      margin: input.showBackground ? "0 -16px" : undefined,
      padding: input.showBackground ? "0 16px 0 12px" : "0 0 0 8px",
      "background-color": sanitizeColor(decoration.background, "transparent"),
      color: lineForeground,
      "border-left": `4px solid ${sanitizeColor(decoration.borderColor, lineForeground)}`,
      "box-sizing": "border-box",
    });

    return `<span style="${lineStyle}">${content}</span>`;
  });

  const code = `<pre style="${preStyle}"><code style="${codeStyle}">${renderedLines.join("\n")}</code></pre>`;

  if (!filename) {
    return code;
  }

  const wrapperStyle = joinStyle({
    margin: "0 0 16px",
    "border-radius": "7px",
    overflow: "hidden",
    "background-color": input.showBackground ? background : undefined,
  });
  const headerStyle = joinStyle({
    display: "block",
    "background-color": "oklch(20.16% 0.018 257.49)",
    color: "oklch(89.72% 0.019 247.91)",
    "font-family": codeFontFamily,
    "font-size": "12px",
    "font-weight": 800,
    "line-height": 1.2,
    padding: "8px 12px",
    "border-bottom": "1px solid oklch(32.15% 0.026 257.34)",
    "box-sizing": "border-box",
    "white-space": "nowrap",
    overflow: "hidden",
    "text-overflow": "ellipsis",
  });

  return `<div style="${wrapperStyle}"><div style="${headerStyle}">${escapeHtml(filename)}</div>${code}</div>`;
}
