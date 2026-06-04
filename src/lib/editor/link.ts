const allowedProtocols = new Set(["http:", "https:", "mailto:"]);
const schemePattern = /^[a-z][a-z0-9+.-]*:/i;

function hasUnsafeWhitespace(value: string): boolean {
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;

    if (codePoint <= 0x1f || char.trim() === "") {
      return true;
    }
  }

  return false;
}

function candidateHref(value: string): string {
  if (value.startsWith("//")) {
    return `https:${value}`;
  }

  if (schemePattern.test(value)) {
    return value;
  }

  return `https://${value}`;
}

export function normalizeEditableLinkHref(value: string): string | undefined {
  const trimmed = value.trim();

  if (!trimmed || hasUnsafeWhitespace(trimmed)) {
    return undefined;
  }

  try {
    const url = new URL(candidateHref(trimmed));

    if (!allowedProtocols.has(url.protocol)) {
      return undefined;
    }

    if ((url.protocol === "http:" || url.protocol === "https:") && !url.hostname) {
      return undefined;
    }

    if (url.protocol === "mailto:" && !url.pathname) {
      return undefined;
    }

    return url.toString();
  } catch {
    return undefined;
  }
}
