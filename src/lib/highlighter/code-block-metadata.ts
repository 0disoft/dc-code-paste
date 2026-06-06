export function normalizeCodeFilename(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .split("")
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint > 31 && codePoint !== 127;
    })
    .join("")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}
