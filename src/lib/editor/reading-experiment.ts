import type { Node } from "@tiptap/pm/model";
import { TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import { closeHistory } from "@tiptap/pm/history";
import { selectedRelationPassage } from "./sentence-relation-commands.ts";
import { createRelationId, normalizeRelationAnchorIds } from "./sentence-relations-format.ts";
import { relationAnchorCatalog } from "./sentence-relations.ts";
import {
  normalizeReadingNotes,
  normalizeReadingNoteText,
  maxReadingNotes,
} from "./reading-notes-format.ts";
import { readingPassages } from "./reading-path.ts";

export type ReadingExperimentUnit = {
  index: number;
  position: number;
  node: Node;
  document: Node;
  text: string;
  code: boolean;
  canNote: boolean;
  intentions: string[];
};

function passageForUnit(state: EditorState, unit: ReadingExperimentUnit) {
  if (unit.document !== state.doc || state.doc.nodeAt(unit.position) !== unit.node) return null;
  if (unit.node.isLeaf || unit.node.type.spec.code || !unit.node.content.size) return null;
  const selection = TextSelection.between(
    state.doc.resolve(unit.position + 1),
    state.doc.resolve(unit.position + unit.node.nodeSize - 1),
  );
  return selectedRelationPassage({ doc: state.doc, schema: state.schema, selection });
}

export function readingExperimentUnits(state: EditorState | undefined): ReadingExperimentUnit[] {
  if (!state) return [];
  const intentions = readingPassages(state.doc);
  const units: ReadingExperimentUnit[] = [];
  state.doc.forEach((node, position, index) => {
    if (!node.textContent.trim() && node.type.name !== "horizontalRule" && !node.attrs.label)
      return;
    const unit: ReadingExperimentUnit = {
      index,
      position,
      node,
      document: state.doc,
      text: node.textBetween(0, node.content.size, "\n"),
      code: node.type.spec.code === true,
      canNote: false,
      intentions: [
        ...new Set(
          intentions
            .filter((passage) => passage.from >= position && passage.to <= position + node.nodeSize)
            .map((passage) => passage.intent),
        ),
      ],
    };
    unit.canNote = !unit.code && !!passageForUnit(state, unit);
    units.push(unit);
  });
  return units;
}

export function createReadingNoteTransaction(
  state: EditorState,
  unit: ReadingExperimentUnit,
  input: string,
): { transaction: Transaction } | { error: string } {
  const passage = passageForUnit(state, unit);
  const notes = normalizeReadingNotes(state.doc.attrs.readingNotes);
  const text = normalizeReadingNoteText(input);
  if (!passage || !notes || !text)
    return {
      error: "메모할 구간이 바뀌었습니다. 본문을 확인하고 2,000자 이내로 메모를 입력해 주세요.",
    };
  if (notes.length >= maxReadingNotes)
    return { error: "한 글에 읽기 메모를 128개까지 저장할 수 있습니다." };
  const note = {
    id: createRelationId(),
    text,
    createdAt: new Date().toISOString(),
    parts: passage.parts.map((part) => ({ id: createRelationId(), text: part.text })),
  };
  if (!normalizeReadingNotes([...notes, note]))
    return { error: "메모를 만들지 못했습니다. 다시 시도해 주세요." };
  const existing = relationAnchorCatalog(state.doc);
  if (note.parts.some((part) => existing.has(part.id)))
    return { error: "메모 표시가 겹칩니다. 다시 시도해 주세요." };
  const type = state.schema.marks.relationAnchor;
  const tr = closeHistory(state.tr);
  for (const [index, part] of passage.parts.entries()) {
    let valid = true;
    state.doc.nodesBetween(part.from, part.to, (node, position) => {
      if (!node.isInline) return;
      const previous = node.marks.find((mark) => mark.type === type)?.attrs.ids ?? [];
      const ids = normalizeRelationAnchorIds([...previous, note.parts[index].id]);
      if (!ids) {
        valid = false;
        return;
      }
      tr.addMark(
        Math.max(part.from, position),
        Math.min(part.to, position + node.nodeSize),
        type.create({ ids }),
      );
    });
    if (!valid) return { error: "메모 표시를 만들지 못했습니다. 관계 표시가 너무 많습니다." };
  }
  tr.setDocAttribute("readingNotes", [...notes, note]).removeStoredMark(type);
  return { transaction: tr };
}

export function removeReadingNoteTransaction(state: EditorState, id: string) {
  const notes = normalizeReadingNotes(state.doc.attrs.readingNotes);
  const note = notes?.find((entry) => entry.id === id);
  const type = state.schema.marks.relationAnchor;
  if (!notes || !note || !type) return null;
  const removed = new Set(note.parts.map((part) => part.id));
  const tr = closeHistory(state.tr);
  state.doc.descendants((node, position) => {
    const mark = node.marks.find((item) => item.type === type);
    if (!mark || !node.isInline) return;
    const ids = (normalizeRelationAnchorIds(mark.attrs.ids) ?? []).filter(
      (identity) => !removed.has(identity),
    );
    if (ids.length === mark.attrs.ids.length) return;
    tr.removeMark(position, position + node.nodeSize, type);
    if (ids.length) tr.addMark(position, position + node.nodeSize, type.create({ ids }));
  });
  return tr
    .setDocAttribute(
      "readingNotes",
      notes.filter((entry) => entry.id !== id),
    )
    .removeStoredMark(type);
}
