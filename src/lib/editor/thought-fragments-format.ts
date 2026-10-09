import { isRelationId } from "./sentence-relations-format.ts";

export type ThoughtFragmentPart = { id: string; text: string };
export type ThoughtFragmentUse = {
  id: string;
  kind: "prose" | "code";
  parts: ThoughtFragmentPart[];
};
export type ThoughtFragment = {
  id: string;
  text: string;
  createdAt: string;
  uses: ThoughtFragmentUse[];
};
export const maxThoughtFragments = 64;
export const maxThoughtFragmentLength = 8000;
export const maxThoughtFragmentUses = 8;
export const maxThoughtFragmentParts = 128;
const maxPrivateFragmentText = 256_000;

export function normalizeThoughtFragmentText(value: unknown): string | null {
  if (typeof value !== "string" || value.length > maxThoughtFragmentLength || !value.trim())
    return null;
  return value.replace(/\r\n?/g, "\n");
}

export function normalizeThoughtFragments(value: unknown): ThoughtFragment[] | null {
  if (!Array.isArray(value) || value.length > maxThoughtFragments) return null;
  const identities = new Set<string>();
  let totalText = 0;
  function identity(id: unknown): id is string {
    if (!isRelationId(id) || identities.has(id)) return false;
    identities.add(id);
    return true;
  }
  const fragments: ThoughtFragment[] = [];
  for (const fragment of value) {
    const text = normalizeThoughtFragmentText(fragment?.text);
    if (
      !fragment ||
      !identity(fragment.id) ||
      text === null ||
      typeof fragment.createdAt !== "string" ||
      !Number.isFinite(Date.parse(fragment.createdAt)) ||
      !Array.isArray(fragment.uses) ||
      fragment.uses.length > maxThoughtFragmentUses
    )
      return null;
    totalText += text.length;
    const uses: ThoughtFragmentUse[] = [];
    for (const use of fragment.uses) {
      if (
        !use ||
        !identity(use.id) ||
        !["prose", "code"].includes(use.kind) ||
        !Array.isArray(use.parts) ||
        !use.parts.length ||
        use.parts.length > maxThoughtFragmentParts ||
        (use.kind === "code" && use.parts.length !== 1)
      )
        return null;
      const parts: ThoughtFragmentPart[] = [];
      let length = 0;
      for (const part of use.parts) {
        if (!part || !identity(part.id) || typeof part.text !== "string") return null;
        length += part.text.length;
        parts.push({ id: part.id, text: part.text });
      }
      if (!length || length > maxThoughtFragmentLength) return null;
      totalText += length;
      uses.push({ id: use.id, kind: use.kind, parts });
    }
    if (totalText > maxPrivateFragmentText) return null;
    fragments.push({ id: fragment.id, text, createdAt: fragment.createdAt, uses });
  }
  return fragments;
}
