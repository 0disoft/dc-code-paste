import {
  isRelationId,
  maxRelationParts,
  maxRelationTextLength,
  type RelationPart,
} from "./sentence-relations-format.ts";

export type ReadingNote = { id: string; text: string; createdAt: string; parts: RelationPart[] };
export const maxReadingNotes = 128;
export const maxReadingNoteLength = 2000;

export function normalizeReadingNoteText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= maxReadingNoteLength ? text : null;
}

export function normalizeReadingNotes(value: unknown): ReadingNote[] | null {
  if (!Array.isArray(value) || value.length > maxReadingNotes) return null;
  const ids = new Set<string>();
  function takeId(id: unknown): id is string {
    if (!isRelationId(id) || ids.has(id)) return false;
    ids.add(id);
    return true;
  }
  const notes: ReadingNote[] = [];
  for (const note of value) {
    const text = normalizeReadingNoteText(note?.text);
    if (
      !note ||
      !takeId(note.id) ||
      !text ||
      typeof note.createdAt !== "string" ||
      !Number.isFinite(Date.parse(note.createdAt)) ||
      !Array.isArray(note.parts) ||
      !note.parts.length ||
      note.parts.length > maxRelationParts
    )
      return null;
    let length = 0;
    const parts: RelationPart[] = [];
    for (const part of note.parts) {
      if (!part || !takeId(part.id) || typeof part.text !== "string" || !part.text.trim())
        return null;
      length += part.text.length;
      parts.push({ id: part.id, text: part.text });
    }
    if (length > maxRelationTextLength) return null;
    notes.push({ id: note.id, text, createdAt: note.createdAt, parts });
  }
  return notes;
}
