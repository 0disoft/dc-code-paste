import type { CalloutKind } from "./callout";

type RgbColor = {
  red: number;
  green: number;
  blue: number;
};

export type CalloutColorPalette = {
  border: string;
  background: string;
  fallbackBackground: string;
  text: string;
  inlineCodeBackground: string;
  inlineCodeText: string;
};

const hexColorPattern = /^#[0-9a-f]{6}$/i;

export const defaultCalloutToneColors: Record<CalloutKind, string> = {
  tip: "#16a34a",
  warning: "#d97706",
  reference: "#2563eb",
  emphasis: "#9333ea",
  success: "#15803d",
  failure: "#dc2626",
  experiment: "#4f46e5",
  conclusion: "#a16207",
  rebuttal: "#db2777",
};

function clampByte(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function hexToRgb(value: string): RgbColor {
  return {
    red: Number.parseInt(value.slice(1, 3), 16),
    green: Number.parseInt(value.slice(3, 5), 16),
    blue: Number.parseInt(value.slice(5, 7), 16),
  };
}

function rgbToHex(color: RgbColor): string {
  return `#${clampByte(color.red).toString(16).padStart(2, "0")}${clampByte(color.green)
    .toString(16)
    .padStart(2, "0")}${clampByte(color.blue).toString(16).padStart(2, "0")}`;
}

function mixHex(foreground: string, background: string, foregroundWeight: number): string {
  const foregroundColor = hexToRgb(foreground);
  const backgroundColor = hexToRgb(background);
  const weight = Math.min(1, Math.max(0, foregroundWeight));

  return rgbToHex({
    red: foregroundColor.red * weight + backgroundColor.red * (1 - weight),
    green: foregroundColor.green * weight + backgroundColor.green * (1 - weight),
    blue: foregroundColor.blue * weight + backgroundColor.blue * (1 - weight),
  });
}

function relativeLuminance(value: string): number {
  const { red, green, blue } = hexToRgb(value);
  const channels = [red, green, blue].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function readableTextFor(background: string): string {
  return relativeLuminance(background) < 0.42 ? "#f8fafc" : "#111827";
}

export function parseCalloutToneColor(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  return hexColorPattern.test(normalized) ? normalized : undefined;
}

export function defaultCalloutToneColor(kind: CalloutKind): string {
  return defaultCalloutToneColors[kind];
}

export function normalizeCalloutToneColor(value: unknown, kind: CalloutKind): string {
  return parseCalloutToneColor(value) ?? defaultCalloutToneColor(kind);
}

export function createCalloutColorPalette(
  value: unknown,
  kind: CalloutKind,
  mode: "light" | "dark",
): CalloutColorPalette {
  const accent = normalizeCalloutToneColor(value, kind);

  if (mode === "dark") {
    const background = mixHex(accent, "#050505", 0.2);
    const inlineCodeBackground = mixHex(accent, "#0f172a", 0.62);

    return {
      border: mixHex(accent, "#ffffff", 0.82),
      background,
      fallbackBackground: background,
      text: readableTextFor(background),
      inlineCodeBackground,
      inlineCodeText: readableTextFor(inlineCodeBackground),
    };
  }

  const background = mixHex(accent, "#ffffff", 0.14);
  const inlineCodeBackground = mixHex(accent, "#111827", 0.58);

  return {
    border: accent,
    background,
    fallbackBackground: background,
    text: readableTextFor(background),
    inlineCodeBackground,
    inlineCodeText: readableTextFor(inlineCodeBackground),
  };
}

export function calloutEditorStyleAttribute(value: unknown, kind: CalloutKind): string {
  const light = createCalloutColorPalette(value, kind, "light");
  const dark = createCalloutColorPalette(value, kind, "dark");

  return [
    `--dc-callout-border:${light.border}`,
    `--dc-callout-background:${light.background}`,
    `--dc-callout-text:${light.text}`,
    `--dc-callout-dark-border:${dark.border}`,
    `--dc-callout-dark-background:${dark.background}`,
    `--dc-callout-dark-text:${dark.text}`,
  ].join(";");
}
