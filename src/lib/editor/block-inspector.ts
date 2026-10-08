import { Extension, type Editor } from "@tiptap/core";
import type { Node, ResolvedPos } from "@tiptap/pm/model";
import { NodeSelection, Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { normalizeBlockAppearance, type BlockAppearance } from "./block-appearance";

const labels: Record<string, string> = {
  paragraph: "문단",
  heading: "제목",
  sectionHeading: "섹션 제목",
  summaryBox: "요약 블록",
  blockquote: "인용",
  codeBlock: "코드블록",
  linkBox: "링크박스",
  heroBlock: "글 머리",
  comparisonBlock: "비교",
  tutorialBlock: "튜토리얼",
  referenceList: "자료목록",
  ctaButton: "버튼",
  ctaGroup: "버튼묶음",
  tipBox: "콜아웃",
  warningBox: "콜아웃",
  referenceBox: "콜아웃",
  emphasisBox: "콜아웃",
  successBox: "콜아웃",
  failureBox: "콜아웃",
  experimentBox: "콜아웃",
  conclusionBox: "콜아웃",
  rebuttalBox: "콜아웃",
};

function targetAt(position: ResolvedPos): { node: Node; pos: number } | undefined {
  let result: { node: Node; pos: number } | undefined;
  for (let depth = position.depth; depth > 0; depth--) {
    const node = position.node(depth);
    if (labels[node.type.name]) {
      result ??= { node, pos: position.before(depth) };
      if (node.type.name !== "paragraph" && node.type.name !== "heading")
        return { node, pos: position.before(depth) };
    }
  }
  return result;
}

export function selectedBlockTarget(editor: Editor) {
  const selection = editor.state.selection;
  return selection instanceof NodeSelection && labels[selection.node.type.name]
    ? { node: selection.node, pos: selection.from }
    : targetAt(selection.$from);
}

export function selectedBlockInfo(editor: Editor | undefined) {
  const target = editor ? selectedBlockTarget(editor) : undefined;
  if (!target) return null;
  return {
    type: target.node.type.name,
    label: labels[target.node.type.name],
    hasAppearance: target.node.type.name === "summaryBox",
    hasCustomTone: target.node.attrs.tone != null,
    ...normalizeBlockAppearance(target.node.attrs),
  };
}

export function setSelectedBlockAppearance(editor: Editor, values: Partial<BlockAppearance>) {
  const target = selectedBlockTarget(editor);
  if (target?.node.type.name !== "summaryBox") return false;
  const normalized = normalizeBlockAppearance({ ...target.node.attrs, ...values });
  const next = { ...target.node.attrs };
  for (const key of ["tone", "alignment", "spacing"] as const) {
    if (values[key] !== undefined) next[key] = normalized[key];
  }
  editor.view.dispatch(editor.state.tr.setNodeMarkup(target.pos, undefined, next));
  return true;
}

export const SelectedBlockDecoration = Extension.create({
  name: "selectedBlockDecoration",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const target =
              state.selection instanceof NodeSelection
                ? { node: state.selection.node, pos: state.selection.from }
                : targetAt(state.selection.$from);
            if (!target || !target.node.isBlock) return DecorationSet.empty;
            return DecorationSet.create(state.doc, [
              Decoration.node(target.pos, target.pos + target.node.nodeSize, {
                class: "dc-selected-block",
              }),
            ]);
          },
        },
      }),
    ];
  },
});

export const paletteBlockKinds = [
  "heading",
  "paragraph",
  "summary",
  "quote",
  "code",
  "link",
  "hero",
  "callout",
  "comparison",
  "tutorial",
  "references",
  "cta",
  "ctaGroup",
  "divider",
] as const;
export type PaletteBlockKind = (typeof paletteBlockKinds)[number];
export function isPaletteBlockKind(value: string): value is PaletteBlockKind {
  return paletteBlockKinds.some((kind) => kind === value);
}
