import type { Editor } from "@tiptap/core";
import { Fragment } from "@tiptap/pm/model";
import { TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import { closeHistory } from "@tiptap/pm/history";
import { createRelationId, normalizeRelationAnchorIds } from "./sentence-relations-format.ts";
import { thoughtFragmentAnchorCatalog } from "./thought-fragments.ts";
import { defaultLanguage, isSupportedLanguage } from "#lib/highlighter/catalog.ts";
import {
  normalizeThoughtFragments,
  normalizeThoughtFragmentText,
  maxThoughtFragments,
  maxThoughtFragmentUses,
  maxThoughtFragmentParts,
  type ThoughtFragmentUse,
} from "./thought-fragments-format.ts";

type Result = { transaction?: Transaction } | { error: string };
const read = (state: EditorState) => normalizeThoughtFragments(state.doc.attrs.thoughtFragments);
const invalid = () => ({
  error: "조각을 8,000자 이내로 적어 주세요. 비어 있는 조각은 보관할 수 없습니다.",
});

export function addThoughtFragmentTransaction(state: EditorState, input: unknown): Result {
  const fragments = read(state);
  const text = normalizeThoughtFragmentText(input);
  if (!fragments || text === null) return invalid();
  if (fragments.length >= maxThoughtFragments)
    return { error: "한 글에 생각 조각을 64개까지 보관할 수 있습니다." };
  const next = [
    ...fragments,
    { id: createRelationId(), text, createdAt: new Date().toISOString(), uses: [] },
  ];
  if (!normalizeThoughtFragments(next))
    return { error: "조각 보관 한도를 넘었습니다. 사용하지 않는 조각을 정리해 주세요." };
  return { transaction: closeHistory(state.tr).setDocAttribute("thoughtFragments", next) };
}

export function captureThoughtFragmentSelectionTransaction(state: EditorState): Result {
  const { from, to, empty } = state.selection;
  if (empty) return { error: "보관할 글이나 코드를 먼저 선택해 주세요." };
  // Keep indentation and hard breaks. Capturing is a private snapshot, not a cut or
  // an insertion: partial selections must not acquire whole-block usage anchors.
  const text = state.doc.textBetween(from, to, "\n", "\n");
  return addThoughtFragmentTransaction(state, text);
}

export function updateThoughtFragmentTransaction(
  state: EditorState,
  id: string,
  input: unknown,
  expected: string,
): Result {
  const fragments = read(state);
  const current = fragments?.find((fragment) => fragment.id === id);
  const text = normalizeThoughtFragmentText(input);
  if (!fragments || !current || current.text !== expected)
    return { error: "조각이 바뀌었습니다. 보관된 내용을 다시 확인해 주세요." };
  if (text === null) return invalid();
  if (current.text === text) return {};
  const next = fragments.map((fragment) => (fragment.id === id ? { ...fragment, text } : fragment));
  if (!normalizeThoughtFragments(next))
    return { error: "조각 보관 한도를 넘었습니다. 사용하지 않는 조각을 정리해 주세요." };
  return { transaction: closeHistory(state.tr).setDocAttribute("thoughtFragments", next) };
}

export function removeThoughtFragmentTransaction(state: EditorState, id: string): Result {
  const fragments = read(state);
  const current = fragments?.find((fragment) => fragment.id === id);
  if (!fragments || !current) return { error: "삭제할 조각이 없습니다." };
  const ids = new Set(current.uses.flatMap((use) => use.parts.map((part) => part.id)));
  const tr = closeHistory(state.tr).setDocAttribute(
    "thoughtFragments",
    fragments.filter((fragment) => fragment.id !== id),
  );
  state.doc.descendants((node, position) => {
    const previous = normalizeRelationAnchorIds(node.attrs.thoughtFragmentAnchors);
    if (!previous?.some((anchor) => ids.has(anchor))) return;
    tr.setNodeAttribute(
      position,
      "thoughtFragmentAnchors",
      previous.filter((anchor) => !ids.has(anchor)),
    );
  });
  return { transaction: tr };
}

export function insertThoughtFragmentTransaction(
  state: EditorState,
  id: string,
  kind: "prose" | "code",
  language = defaultLanguage,
): Result {
  const fragments = read(state);
  const source = fragments?.find((fragment) => fragment.id === id);
  if (!fragments || !source || !["prose", "code"].includes(kind) || !isSupportedLanguage(language))
    return { error: "본문에 넣을 조각을 다시 확인해 주세요." };
  if (source.uses.length >= maxThoughtFragmentUses)
    return { error: "한 조각을 8번까지 연결해 넣을 수 있습니다." };
  const texts = kind === "code" ? [source.text] : source.text.split("\n");
  if (texts.length > maxThoughtFragmentParts)
    return { error: "글로 넣을 조각은 128줄까지 지원합니다. 조각을 나누거나 코드로 넣어 주세요." };
  const use: ThoughtFragmentUse = {
    id: createRelationId(),
    kind,
    parts: texts.map((text) => ({ id: createRelationId(), text })),
  };
  const next = fragments.map((fragment) =>
    fragment.id === id ? { ...fragment, uses: [...fragment.uses, use] } : fragment,
  );
  if (!normalizeThoughtFragments(next))
    return { error: "조각 연결 보관 한도를 넘었습니다. 사용하지 않는 조각을 정리해 주세요." };
  const nodes = use.parts.map((part) =>
    state.schema.nodes[kind === "code" ? "codeBlock" : "paragraph"].create(
      { thoughtFragmentAnchors: [part.id], ...(kind === "code" ? { language } : {}) },
      part.text ? state.schema.text(part.text) : undefined,
    ),
  );
  const cursor = state.selection.$head;
  const position = cursor.depth ? cursor.after(1) : cursor.pos;
  const index = cursor.depth ? cursor.index(0) + 1 : cursor.index();
  const content = Fragment.fromArray(nodes);
  if (!state.doc.canReplace(index, index, content))
    return { error: "이 위치에는 조각을 넣을 수 없습니다." };
  const tr = closeHistory(state.tr)
    .insert(position, content)
    .setDocAttribute("thoughtFragments", next);
  tr.setSelection(TextSelection.create(tr.doc, position + 1));
  return { transaction: tr.scrollIntoView() };
}

export function navigateThoughtFragmentAnchor(editor: Editor, id: string): boolean {
  const matches = thoughtFragmentAnchorCatalog(editor.state.doc).get(id);
  if (matches?.length !== 1) return false;
  const match = matches[0];
  const selection = TextSelection.between(
    editor.state.doc.resolve(match.from + 1),
    editor.state.doc.resolve(match.to - 1),
  );
  editor.view.dispatch(editor.state.tr.setSelection(selection).scrollIntoView());
  editor.view.focus();
  return true;
}
