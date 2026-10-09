export const sentenceRelationKinds = [
  { value: "evidence", label: "근거" },
  { value: "condition", label: "조건" },
  { value: "counterpoint", label: "반론" },
  { value: "custom", label: "직접 이름 붙이기" },
] as const;
export type SentenceRelationKind = (typeof sentenceRelationKinds)[number]["value"];
export type RelationPart = { id: string; text: string };
export type SentenceRelation = {
  id: string;
  kind: SentenceRelationKind;
  label?: string;
  claim: RelationPart[];
  related: RelationPart[];
};
export const maxSentenceRelations = 128;
export const maxRelationParts = 128;
export const maxRelationTextLength = 8000;
export const maxRelationLabelLength = 80;

export function normalizeCustomRelationLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const label = value.trim();
  const containsControl = Array.from(label).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
  return label && label.length <= maxRelationLabelLength && !containsControl ? label : null;
}

export function sentenceRelationLabel(relation: Pick<SentenceRelation, "kind" | "label">): string {
  return relation.kind === "custom"
    ? (normalizeCustomRelationLabel(relation.label) ?? "함께 읽기")
    : sentenceRelationKinds.find((item) => item.value === relation.kind)!.label;
}

export function isSentenceRelationKind(value: unknown): value is SentenceRelationKind {
  return sentenceRelationKinds.some((item) => item.value === value);
}
export function isRelationId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9_-]{1,80}$/i.test(value);
}
export function normalizeRelationAnchorIds(value: unknown): string[] | null {
  if (
    !Array.isArray(value) ||
    value.length > maxSentenceRelations ||
    !value.every(isRelationId) ||
    new Set(value).size !== value.length
  )
    return null;
  return [...value].sort();
}

export function normalizeSentenceRelations(value: unknown): SentenceRelation[] | null {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > maxSentenceRelations) return null;
  const identities = new Set<string>();
  function takeId(id: unknown): id is string {
    if (!isRelationId(id) || identities.has(id)) return false;
    identities.add(id);
    return true;
  }
  function parts(value: unknown): RelationPart[] | null {
    if (!Array.isArray(value) || !value.length || value.length > maxRelationParts) return null;
    const result: RelationPart[] = [];
    let length = 0;
    for (const part of value) {
      if (
        !part ||
        typeof part !== "object" ||
        !takeId(part.id) ||
        typeof part.text !== "string" ||
        !part.text.trim()
      )
        return null;
      length += part.text.length;
      if (length > maxRelationTextLength) return null;
      result.push({ id: part.id, text: part.text });
    }
    return result;
  }
  const result: SentenceRelation[] = [];
  for (const relation of value) {
    if (
      !relation ||
      typeof relation !== "object" ||
      !takeId(relation.id) ||
      !isSentenceRelationKind(relation.kind)
    )
      return null;
    const claim = parts(relation.claim);
    const related = parts(relation.related);
    if (!claim || !related) return null;
    const label = relation.kind === "custom" ? normalizeCustomRelationLabel(relation.label) : null;
    if (relation.kind === "custom" ? !label : relation.label !== undefined) return null;
    result.push({
      id: relation.id,
      kind: relation.kind,
      ...(label ? { label } : {}),
      claim,
      related,
    });
  }
  return result;
}

export function createRelationId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `relation_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}
