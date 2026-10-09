import type { Editor } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import { closeHistory } from "@tiptap/pm/history";
import {
  createRelationId,
  isSentenceRelationKind,
  maxRelationParts,
  maxRelationTextLength,
  maxSentenceRelations,
  normalizeRelationAnchorIds,
  normalizeSentenceRelations,
  type RelationPart,
  type SentenceRelationKind,
} from "./sentence-relations-format.ts";
import { relationAnchorCatalog, type RelationAnchor } from "./sentence-relations.ts";

type SelectedPart = { from: number; to: number; text: string };
export type SelectedRelationPassage = { document: Node; parts: SelectedPart[] };

export function selectedRelationPassage(
  state: EditorState | undefined,
): SelectedRelationPassage | null {
  const type = state?.schema.marks.relationAnchor;
  if (!state || !type || state.selection.empty) return null;
  const parts: SelectedPart[] = [];
  state.doc.nodesBetween(state.selection.from, state.selection.to, (block, position) => {
    if (block.type.spec.code) return false;
    if (!block.isTextblock) return;
    if (!block.type.allowsMarkType(type)) return false;
    let current: SelectedPart | undefined;
    block.forEach((node, offset) => {
      const start = position + 1 + offset;
      const from = Math.max(start, state.selection.from);
      const to = Math.min(start + node.nodeSize, state.selection.to);
      if (from >= to) return;
      if (node.marks.some((mark) => mark.type.name === "code")) {
        current = undefined;
        return;
      }
      const text = (node.isText ? node.text! : node.type.name === "hardBreak" ? "\n" : "").slice(
        from - start,
        to - start,
      );
      if (!text) {
        current = undefined;
        return;
      }
      if (current?.to === from) {
        current.to = to;
        current.text += text;
      } else {
        current = { from, to, text };
        parts.push(current);
      }
    });
    return false;
  });
  const visible = parts.filter((part) => part.text.trim());
  if (
    !visible.length ||
    visible.length > maxRelationParts ||
    visible.reduce((length, part) => length + part.text.length, 0) > maxRelationTextLength
  )
    return null;
  return { document: state.doc, parts: visible };
}

export function mapSelectedRelationPassage(
  passage: SelectedRelationPassage,
  tr: Transaction,
): SelectedRelationPassage | null {
  if (passage.document !== tr.before) return null;
  const parts: SelectedPart[] = [];
  for (const part of passage.parts) {
    const from = tr.mapping.mapResult(part.from, 1);
    const to = tr.mapping.mapResult(part.to, -1);
    if (
      from.deletedAcross ||
      to.deletedAcross ||
      from.pos >= to.pos ||
      tr.doc.textBetween(from.pos, to.pos, "\n", "\n") !== part.text
    )
      return null;
    parts.push({ from: from.pos, to: to.pos, text: part.text });
  }
  return { document: tr.doc, parts };
}

export function createSentenceRelationTransaction(
  state: EditorState,
  claim: SelectedRelationPassage,
  kind: SentenceRelationKind,
  identity = createRelationId,
): { transaction: Transaction } | { error: string } {
  const related = selectedRelationPassage(state);
  const relations = normalizeSentenceRelations(state.doc.attrs.sentenceRelations);
  if (!relations || !isSentenceRelationKind(kind) || claim.document !== state.doc || !related)
    return { error: "연결할 글 구간을 다시 선택해 주세요. 구간은 8,000자까지 선택할 수 있습니다." };
  if (
    claim.parts.some((first) =>
      related.parts.some((second) => first.from < second.to && first.to > second.from),
    )
  )
    return { error: "처음 선택한 구간과 겹치지 않는 구간을 선택해 주세요." };
  if (relations.length >= maxSentenceRelations)
    return { error: "한 글에 관계를 128개까지 연결할 수 있습니다." };
  const makeParts = (parts: SelectedPart[]): RelationPart[] =>
    parts.map((part) => ({ id: identity(), text: part.text }));
  const relation = {
    id: identity(),
    kind,
    claim: makeParts(claim.parts),
    related: makeParts(related.parts),
  };
  if (!normalizeSentenceRelations([...relations, relation]))
    return { error: "관계 표시를 만들지 못했습니다. 다시 연결해 주세요." };
  const existing = relationAnchorCatalog(state.doc);
  if ([...relation.claim, ...relation.related].some((part) => existing.has(part.id)))
    return { error: "관계 표시가 겹칩니다. 다시 연결해 주세요." };
  const type = state.schema.marks.relationAnchor;
  const tr = closeHistory(state.tr);
  function anchor(parts: SelectedPart[], references: RelationPart[]) {
    for (const [index, part] of parts.entries()) {
      let valid = true;
      tr.doc.nodesBetween(part.from, part.to, (node, position, parent) => {
        if (!node.isInline) return;
        if (
          (!node.isText && node.type.name !== "hardBreak") ||
          !parent?.type.allowsMarkType(type) ||
          node.marks.some((mark) => mark.type.name === "code")
        ) {
          valid = false;
          return;
        }
        const previous = node.marks.find((mark) => mark.type === type)?.attrs.ids ?? [];
        const ids = normalizeRelationAnchorIds([...previous, references[index].id]);
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
      if (!valid) return false;
    }
    return true;
  }
  if (!anchor(claim.parts, relation.claim) || !anchor(related.parts, relation.related))
    return { error: "연결 구간이 바뀌었습니다. 글에서 구간을 다시 선택해 주세요." };
  tr.setDocAttribute("sentenceRelations", [...relations, relation]).removeStoredMark(type);
  return { transaction: tr };
}

export function removeSentenceRelationTransaction(state: EditorState, identity: string) {
  const relations = normalizeSentenceRelations(state.doc.attrs.sentenceRelations);
  const relation = relations?.find((item) => item.id === identity);
  const type = state.schema.marks.relationAnchor;
  if (!relations || !relation || !type) return null;
  const removed = new Set([...relation.claim, ...relation.related].map((part) => part.id));
  const tr = closeHistory(state.tr);
  state.doc.descendants((node, position) => {
    const mark = node.marks.find((item) => item.type === type);
    if (!mark || !node.isInline) return;
    const ids = (normalizeRelationAnchorIds(mark.attrs.ids) ?? []).filter((id) => !removed.has(id));
    if (ids.length === mark.attrs.ids.length) return;
    tr.removeMark(position, position + node.nodeSize, type);
    if (ids.length) tr.addMark(position, position + node.nodeSize, type.create({ ids }));
  });
  tr.setDocAttribute(
    "sentenceRelations",
    relations.filter((item) => item.id !== identity),
  ).removeStoredMark(type);
  return tr;
}

export function navigateRelationAnchor(editor: Editor, anchor: RelationAnchor) {
  if (editor.isDestroyed) return false;
  const current = relationAnchorCatalog(editor.state.doc).get(anchor.id);
  if (
    current?.length !== 1 ||
    current[0].from !== anchor.from ||
    current[0].to !== anchor.to ||
    current[0].text !== anchor.text
  )
    return false;
  editor.view.dispatch(
    editor.state.tr
      .setSelection(TextSelection.create(editor.state.doc, anchor.from, anchor.to))
      .setMeta("addToHistory", false)
      .scrollIntoView(),
  );
  editor.view.focus();
  return true;
}
