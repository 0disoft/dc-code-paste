const hexColorPattern = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const oklchColorPattern =
  /^oklch\(\s*(?:\d+(?:\.\d+)?%|\d*\.\d+|\d+)\s+\d*(?:\.\d+)?\s+\d+(?:\.\d+)?(?:deg)?(?:\s*\/\s*(?:\d+(?:\.\d+)?%?|0?\.\d+))?\s*\)$/i;

function expandHexPair(value: string): string {
  return value.length === 1 ? `${value}${value}` : value;
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function srgbToLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function formatOklch(lightness: number, chroma: number, hue: number, alpha: number): string {
  const lightnessPercent = round(lightness * 100, 2);
  const roundedChroma = round(chroma, 4);
  const roundedHue = round(hue, 2);
  const alphaSuffix = alpha < 1 ? ` / ${round(alpha, 3)}` : "";

  return `oklch(${lightnessPercent}% ${roundedChroma} ${roundedHue}${alphaSuffix})`;
}

function hexToOklch(value: string): string | undefined {
  const raw = value.slice(1);
  const step = raw.length <= 4 ? 1 : 2;
  const red = Number.parseInt(expandHexPair(raw.slice(0, step)), 16) / 255;
  const green = Number.parseInt(expandHexPair(raw.slice(step, step * 2)), 16) / 255;
  const blue = Number.parseInt(expandHexPair(raw.slice(step * 2, step * 3)), 16) / 255;
  const alphaText =
    raw.length === 4 || raw.length === 8 ? raw.slice(step * 3, step * 4) : undefined;
  const alpha = alphaText ? Number.parseInt(expandHexPair(alphaText), 16) / 255 : 1;

  if ([red, green, blue, alpha].some((part) => Number.isNaN(part))) {
    return undefined;
  }

  const linearRed = srgbToLinear(red);
  const linearGreen = srgbToLinear(green);
  const linearBlue = srgbToLinear(blue);

  const long = 0.4122214708 * linearRed + 0.5363325363 * linearGreen + 0.0514459929 * linearBlue;
  const medium = 0.2119034982 * linearRed + 0.6806995451 * linearGreen + 0.1073969566 * linearBlue;
  const short = 0.0883024619 * linearRed + 0.2817188376 * linearGreen + 0.6299787005 * linearBlue;

  const longRoot = Math.cbrt(long);
  const mediumRoot = Math.cbrt(medium);
  const shortRoot = Math.cbrt(short);

  const lightness = 0.2104542553 * longRoot + 0.793617785 * mediumRoot - 0.0040720468 * shortRoot;
  const a = 1.9779984951 * longRoot - 2.428592205 * mediumRoot + 0.4505937099 * shortRoot;
  const b = 0.0259040371 * longRoot + 0.7827717662 * mediumRoot - 0.808675766 * shortRoot;
  const chroma = Math.sqrt(a * a + b * b);
  const rawHue = (Math.atan2(b, a) * 180) / Math.PI;
  const hue = rawHue < 0 ? rawHue + 360 : rawHue;

  return formatOklch(lightness, chroma, chroma < 0.0001 ? 0 : hue, alpha);
}

export function sanitizeColor(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim();
  if (oklchColorPattern.test(normalized)) {
    return normalized;
  }

  if (hexColorPattern.test(normalized)) {
    return hexToOklch(normalized) ?? fallback;
  }

  return fallback;
}

export function joinStyle(parts: Record<string, string | number | boolean | undefined>): string {
  return Object.entries(parts)
    .filter(([, value]) => value !== undefined && value !== false && value !== "")
    .map(([property, value]) => `${property}:${String(value)}`)
    .join(";");
}
