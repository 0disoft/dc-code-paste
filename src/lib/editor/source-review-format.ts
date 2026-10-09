export type SourceReviewState = "unchanged" | "changed" | "untracked";

export function normalizeSourceReviewKey(value: unknown): string {
  return typeof value === "string" && /^\d{1,10}:[a-f0-9]{16}(?::[a-f0-9]{32})?$/.test(value)
    ? value
    : "";
}

/** Compact, synchronous text change indicator; not a source authenticity signature. */
export function sourceReviewKey(text: string): string {
  let first = 2166136261;
  let second = 5381;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second, 33) ^ code;
  }
  return `${text.length}:${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}

export function sourceReviewState(text: string, key: string): SourceReviewState {
  if (!normalizeSourceReviewKey(key)) return "untracked";
  return sourceReviewKey(text) === key.split(":").slice(0, 2).join(":") ? "unchanged" : "changed";
}

/** Distinguish separately connected identical passages so their marks cannot merge. */
export function createSourceReviewKey(text: string): string {
  const identity =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replaceAll("-", "")
      : Array.from({ length: 4 }, () =>
          Math.floor(Math.random() * 0x100000000)
            .toString(16)
            .padStart(8, "0"),
        ).join("");
  return `${sourceReviewKey(text)}:${identity}`;
}
