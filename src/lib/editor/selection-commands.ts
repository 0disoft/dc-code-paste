import type { Command } from "@tiptap/core";
import type { Fragment, Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { calloutNodeNameByKind, type CalloutKind } from "./callout";

type Dispatch = (transaction: Transaction) => void;

function fragmentHasOnlyBlocks(fragment: Fragment): boolean {
  if (fragment.childCount === 0) {
    return false;
  }

  for (let index = 0; index < fragment.childCount; index += 1) {
    if (!fragment.child(index).isBlock) {
      return false;
    }
  }

  return true;
}

function selectedBlockContent(state: EditorState): Fragment | undefined {
  const { selection } = state;

  if (selection.empty) {
    return undefined;
  }

  const content = selection.content().content;

  return fragmentHasOnlyBlocks(content) ? content : undefined;
}

function selectedInlineContent(state: EditorState): Fragment | undefined {
  const { selection } = state;
  const { $from, $to } = selection;

  if (
    selection.empty ||
    !$from.sameParent($to) ||
    !$from.parent.isTextblock ||
    $from.parent.type.name === "codeBlock"
  ) {
    return undefined;
  }

  const content = $from.parent.content.cut($from.parentOffset, $to.parentOffset);

  return content.size > 0 ? content : undefined;
}

function selectedInlineText(state: EditorState): string | undefined {
  const { from, to, empty } = state.selection;

  if (empty) {
    return undefined;
  }

  const text = state.doc.textBetween(from, to, "\n");

  return text.trim() ? text : undefined;
}

function dispatchReplacement(
  state: EditorState,
  dispatch: Dispatch | undefined,
  node: ProseMirrorNode,
): boolean {
  dispatch?.(state.tr.replaceSelectionWith(node, false).scrollIntoView());
  return true;
}

export function replaceSelectedInlineRangeWithCallout(
  state: EditorState,
  dispatch: Dispatch | undefined,
  kind: CalloutKind,
): boolean {
  const calloutType = state.schema.nodes[calloutNodeNameByKind[kind]];
  const paragraphType = state.schema.nodes.paragraph;
  const blockContent = selectedBlockContent(state);

  if (!calloutType || !paragraphType) {
    return false;
  }

  if (blockContent) {
    return dispatchReplacement(state, dispatch, calloutType.create(null, blockContent));
  }

  const inlineContent = selectedInlineContent(state);

  if (!inlineContent) {
    return false;
  }

  return dispatchReplacement(
    state,
    dispatch,
    calloutType.create(null, paragraphType.create(null, inlineContent)),
  );
}

export function replaceSelectedInlineRangeWithCodeBlock(
  state: EditorState,
  dispatch: Dispatch | undefined,
  language: string,
  highlightLines = "",
  filename = "",
): boolean {
  const codeBlockType = state.schema.nodes.codeBlock;
  const text = selectedInlineText(state);

  if (!codeBlockType || !text) {
    return false;
  }

  return dispatchReplacement(
    state,
    dispatch,
    codeBlockType.create({ language, highlightLines, filename }, state.schema.text(text)),
  );
}

export function replaceSelectedInlineRangeWithLinkBox(
  state: EditorState,
  dispatch: Dispatch | undefined,
  href: string,
): boolean {
  const linkBoxType = state.schema.nodes.linkBox;
  const paragraphType = state.schema.nodes.paragraph;
  const blockContent = selectedBlockContent(state);

  if (!linkBoxType || !paragraphType || !href) {
    return false;
  }

  if (blockContent) {
    return dispatchReplacement(state, dispatch, linkBoxType.create({ href }, blockContent));
  }

  const inlineContent = selectedInlineContent(state);

  if (!inlineContent) {
    return false;
  }

  return dispatchReplacement(
    state,
    dispatch,
    linkBoxType.create({ href }, paragraphType.create(null, inlineContent)),
  );
}

export function replaceSelectedInlineRangeWithSectionHeading(
  state: EditorState,
  dispatch: Dispatch | undefined,
): boolean {
  const sectionHeadingType = state.schema.nodes.sectionHeading;
  const inlineContent = selectedInlineContent(state);

  if (!sectionHeadingType || !inlineContent) {
    return false;
  }

  return dispatchReplacement(state, dispatch, sectionHeadingType.create(null, inlineContent));
}

export function replaceSelectedInlineRangeWithCtaButton(
  state: EditorState,
  dispatch: Dispatch | undefined,
  href: string,
  fallbackLabel = "바로가기",
): boolean {
  const ctaButtonType = state.schema.nodes.ctaButton;

  if (!ctaButtonType || !href) {
    return false;
  }

  const inlineContent = selectedInlineContent(state);

  if (!inlineContent) {
    return false;
  }

  return dispatchReplacement(
    state,
    dispatch,
    ctaButtonType.create({ href }, inlineContent || state.schema.text(fallbackLabel)),
  );
}

export function selectedInlineRangeToCalloutCommand(kind: CalloutKind): Command {
  return ({ state, dispatch }) => replaceSelectedInlineRangeWithCallout(state, dispatch, kind);
}

export function selectedInlineRangeToCodeBlockCommand(
  language: string,
  highlightLines = "",
  filename = "",
): Command {
  return ({ state, dispatch }) =>
    replaceSelectedInlineRangeWithCodeBlock(state, dispatch, language, highlightLines, filename);
}

export function selectedInlineRangeToLinkBoxCommand(href: string): Command {
  return ({ state, dispatch }) => replaceSelectedInlineRangeWithLinkBox(state, dispatch, href);
}

export function selectedInlineRangeToSectionHeadingCommand(): Command {
  return ({ state, dispatch }) => replaceSelectedInlineRangeWithSectionHeading(state, dispatch);
}

export function selectedInlineRangeToCtaButtonCommand(
  href: string,
  fallbackLabel?: string,
): Command {
  return ({ state, dispatch }) =>
    replaceSelectedInlineRangeWithCtaButton(state, dispatch, href, fallbackLabel);
}
