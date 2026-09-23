const hexColorPattern = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const oklchColorPattern =
  /^oklch\(\s*(?:\d+(?:\.\d+)?%|\d*\.\d+|\d+)\s+\d*(?:\.\d+)?\s+\d+(?:\.\d+)?(?:deg)?(?:\s*\/\s*(?:\d+(?:\.\d+)?%?|0?\.\d+))?\s*\)$/i;
const oklchPartsPattern =
  /^oklch\(\s*((?:\d+(?:\.\d+)?)|(?:\.\d+))(%?)\s+((?:\d+(?:\.\d+)?)|(?:\.\d+))\s+((?:\d+(?:\.\d+)?)|(?:\.\d+))(?:deg)?(?:\s*\/\s*((?:\d+(?:\.\d+)?)|(?:\.\d+))(%?))?\s*\)$/i;
const oklchFunctionPattern =
  /oklch\(\s*(?:\d+(?:\.\d+)?%|\d*\.\d+|\d+)\s+\d*(?:\.\d+)?\s+\d+(?:\.\d+)?(?:deg)?(?:\s*\/\s*(?:\d+(?:\.\d+)?%?|0?\.\d+))?\s*\)/gi;

type OklchColor = {
  lightness: number;
  chroma: number;
  hue: number;
  alpha: number;
};

type SrgbColor = { red: number; green: number; blue: number };
const white: SrgbColor = { red: 1, green: 1, blue: 1 };

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

function linearToSrgb(value: number): number {
  return value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
}

function toHexByte(value: number): string {
  return Math.round(clamp(value, 0, 1) * 255)
    .toString(16)
    .padStart(2, "0");
}

function formatOklch(lightness: number, chroma: number, hue: number, alpha: number): string {
  const lightnessPercent = round(lightness * 100, 2);
  const roundedChroma = round(chroma, 4);
  const roundedHue = round(hue, 2);
  const alphaSuffix = alpha < 1 ? ` / ${round(alpha, 3)}` : "";

  return `oklch(${lightnessPercent}% ${roundedChroma} ${roundedHue}${alphaSuffix})`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseOklch(value: string): OklchColor | undefined {
  const match = oklchPartsPattern.exec(value.trim());

  if (!match) {
    return undefined;
  }

  const lightnessValue = Number.parseFloat(match[1]);
  const lightness = match[2] === "%" ? lightnessValue / 100 : lightnessValue;
  const chroma = Number.parseFloat(match[3]);
  const hue = Number.parseFloat(match[4]);
  const rawAlpha = match[5] ? Number.parseFloat(match[5]) : 1;
  const alpha = match[6] === "%" ? rawAlpha / 100 : rawAlpha;

  if (![lightness, chroma, hue, alpha].every(Number.isFinite)) {
    return undefined;
  }

  return {
    lightness: clamp(lightness, 0, 1),
    chroma: clamp(chroma, 0, 0.4),
    hue: ((hue % 360) + 360) % 360,
    alpha: clamp(alpha, 0, 1),
  };
}

function oklchToLinearRgb(color: OklchColor): { red: number; green: number; blue: number } {
  const hueRadians = (color.hue * Math.PI) / 180;
  const a = Math.cos(hueRadians) * color.chroma;
  const b = Math.sin(hueRadians) * color.chroma;
  const longPrime = color.lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mediumPrime = color.lightness - 0.1055613458 * a - 0.0638541728 * b;
  const shortPrime = color.lightness - 0.0894841775 * a - 1.291485548 * b;
  const long = longPrime ** 3;
  const medium = mediumPrime ** 3;
  const short = shortPrime ** 3;

  return {
    red: clamp(4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short, 0, 1),
    green: clamp(-1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short, 0, 1),
    blue: clamp(-0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short, 0, 1),
  };
}

function oklchToSrgb(color: OklchColor): SrgbColor {
  const rgb = oklchToLinearRgb(color);
  const channel = (value: number) => {
    const srgb = clamp(linearToSrgb(value), 0, 1);
    return srgb > 1 - 0.000001 ? 1 : srgb < 0.000001 ? 0 : srgb;
  };
  return {
    red: channel(rgb.red),
    green: channel(rgb.green),
    blue: channel(rgb.blue),
  };
}

function composite(foreground: SrgbColor, alpha: number, background: SrgbColor): SrgbColor {
  return {
    red: foreground.red * alpha + background.red * (1 - alpha),
    green: foreground.green * alpha + background.green * (1 - alpha),
    blue: foreground.blue * alpha + background.blue * (1 - alpha),
  };
}

function cssColorToSrgb(value: string): { rgb: SrgbColor; alpha: number } | undefined {
  const normalized = value.trim();
  if (hexColorPattern.test(normalized)) {
    const raw = normalized.slice(1);
    const step = raw.length <= 4 ? 1 : 2;
    const byte = (offset: number) =>
      Number.parseInt(expandHexPair(raw.slice(offset, offset + step)), 16) / 255;
    return {
      rgb: { red: byte(0), green: byte(step), blue: byte(step * 2) },
      alpha: raw.length === 4 || raw.length === 8 ? byte(step * 3) : 1,
    };
  }

  const color = parseOklch(normalized);
  return color ? { rgb: oklchToSrgb(color), alpha: color.alpha } : undefined;
}

function visibleSrgb(value: string, background: SrgbColor): SrgbColor | undefined {
  const color = cssColorToSrgb(value);
  return color ? composite(color.rgb, color.alpha, background) : undefined;
}

function srgbToHex(color: SrgbColor): string {
  return `#${toHexByte(color.red)}${toHexByte(color.green)}${toHexByte(color.blue)}`;
}

function quantizeSrgb(color: SrgbColor): SrgbColor {
  return {
    red: Math.round(color.red * 255) / 255,
    green: Math.round(color.green * 255) / 255,
    blue: Math.round(color.blue * 255) / 255,
  };
}

export function compositeColor(value: string, background = "#ffffff"): string | undefined {
  const base = quantizeSrgb(visibleSrgb(background, white) ?? white);
  const visible = visibleSrgb(value, base);
  return visible ? srgbToHex(visible) : undefined;
}

function relativeLuminance(color: SrgbColor): number {
  return (
    0.2126 * srgbToLinear(color.red) +
    0.7152 * srgbToLinear(color.green) +
    0.0722 * srgbToLinear(color.blue)
  );
}

function oklchToHex(value: string, background: SrgbColor): string | undefined {
  const color = visibleSrgb(value, background);

  if (!color) {
    return undefined;
  }

  return srgbToHex(color);
}

function contrastRatio(
  foreground: OklchColor,
  background: OklchColor,
  backdrop: SrgbColor,
): number {
  const visibleBackground = quantizeSrgb(
    composite(oklchToSrgb(background), background.alpha, backdrop),
  );
  const visibleForeground = quantizeSrgb(
    composite(oklchToSrgb(foreground), foreground.alpha, visibleBackground),
  );
  const foregroundLuminance = relativeLuminance(visibleForeground);
  const backgroundLuminance = relativeLuminance(visibleBackground);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

function prefersLightText(background: SrgbColor): boolean {
  const luminance = relativeLuminance(background);
  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.05;
}

function readableFallbackColor(background: OklchColor, backdrop: SrgbColor): string {
  const visibleBackground = composite(oklchToSrgb(background), background.alpha, backdrop);
  return prefersLightText(visibleBackground) ? "oklch(100% 0 0)" : "oklch(0% 0 0)";
}

function adjustReadableTextColor(
  foreground: OklchColor,
  background: OklchColor,
  minContrast: number,
  backdrop: SrgbColor,
): string {
  const visibleBackground = composite(oklchToSrgb(background), background.alpha, backdrop);
  const shouldLighten = prefersLightText(visibleBackground);
  const start = foreground.lightness;
  const end = shouldLighten ? 0.96 : 0.18;
  const direction = shouldLighten ? 1 : -1;
  const chroma = Math.min(foreground.chroma, 0.18);

  for (
    let lightness = start;
    shouldLighten ? lightness <= end : lightness >= end;
    lightness += direction * 0.01
  ) {
    const candidate = {
      ...foreground,
      lightness: clamp(lightness, 0, 1),
      chroma,
      alpha: 1,
    };

    if (contrastRatio(candidate, background, backdrop) >= minContrast) {
      return formatOklch(candidate.lightness, candidate.chroma, candidate.hue, candidate.alpha);
    }
  }

  return readableFallbackColor(background, backdrop);
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

  if (![red, green, blue, alpha].every(Number.isFinite)) {
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

export function sanitizeReadableTextColor(
  value: string | undefined,
  background: string,
  fallback: string,
  minContrast = 4.5,
  backdrop = "#ffffff",
): string {
  const foreground = sanitizeColor(value, fallback);
  const normalizedBackground = sanitizeColor(background, fallback);
  const foregroundColor = parseOklch(foreground);
  const backgroundColor = parseOklch(normalizedBackground);

  if (!foregroundColor || !backgroundColor) {
    return foreground;
  }

  const visibleBackdrop = visibleSrgb(backdrop, white) ?? white;

  if (contrastRatio(foregroundColor, backgroundColor, visibleBackdrop) >= minContrast) {
    return foreground;
  }

  return adjustReadableTextColor(foregroundColor, backgroundColor, minContrast, visibleBackdrop);
}

function pasteSafeStyleValue(value: string, background: SrgbColor): string {
  return value
    .replace(oklchFunctionPattern, (match) => oklchToHex(match, background) ?? match)
    .replace(/#[0-9a-f]{4}(?:[0-9a-f]{4})?\b/gi, (match) =>
      srgbToHex(visibleSrgb(match, background) ?? background),
    );
}

export function joinStyle(
  parts: Record<string, string | number | boolean | undefined>,
  backdrop = "#ffffff",
): string {
  const base = quantizeSrgb(visibleSrgb(backdrop, white) ?? white);
  const backgroundValue = parts["background-color"];
  const visibleBackground =
    typeof backgroundValue === "string"
      ? quantizeSrgb(visibleSrgb(backgroundValue, base) ?? base)
      : base;

  return Object.entries(parts)
    .filter(
      ([, value]) =>
        value !== undefined &&
        value !== false &&
        value !== "" &&
        (typeof value !== "number" || Number.isFinite(value)),
    )
    .map(([property, value]) => {
      const background = property === "background-color" ? base : visibleBackground;
      return `${property}:${pasteSafeStyleValue(String(value), background)}`;
    })
    .join(";");
}
