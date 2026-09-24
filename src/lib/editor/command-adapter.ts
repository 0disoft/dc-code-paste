import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode, ResolvedPos } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";
import {
  selectedInlineRangeToCalloutCommand,
  selectedInlineRangeToCodeBlockCommand,
  selectedInlineRangeToCtaButtonCommand,
  selectedInlineRangeToLinkBoxCommand,
  selectedInlineRangeToSectionHeadingCommand,
} from "$lib/editor/selection-commands";
import type { DcLanguageId } from "$lib/highlighter/catalog";
import { createDefaultCtaGroup, type CtaGroupLayout } from "$lib/editor/cta-group";
import {
  createDefaultReferenceList,
  createReferenceListFromText,
} from "$lib/editor/reference-list";
import { createDefaultSummaryBox, createSummaryBoxFromText } from "$lib/editor/summary-box";
import { createDefaultHeroBlock, createHeroBlockFromText } from "$lib/editor/hero-block";
import {
  createComparisonBlockFromText,
  createDefaultComparisonBlock,
} from "$lib/editor/comparison-block";
import type { QuoteStyle } from "$lib/editor/quote-style";
import {
  calloutKindFromNodeName,
  calloutNodeNameByKind,
  defaultCalloutLabel,
  isCalloutNodeName,
  type CalloutKind,
} from "$lib/editor/callout";
import { normalizeCalloutToneColor } from "$lib/editor/callout-palette";
import { normalizeEditableLinkHref } from "$lib/editor/link";
import {
  createDefaultTutorialBlock,
  createTutorialBlockFromText,
  createTutorialStep,
  normalizeTutorialStepNumber,
} from "$lib/editor/tutorial-block";

type CodeBlockOptions = {
  language: DcLanguageId;
  highlightLines: string;
  filename: string;
  additionLines: string;
  deletionLines: string;
};

export function findTutorialBlockTargetFromResolvedPos(resolvedPos: ResolvedPos) {
  for (let depth = resolvedPos.depth; depth > 0; depth -= 1) {
    if (resolvedPos.node(depth).type.name === "tutorialBlock") {
      return { pos: resolvedPos.before(depth) };
    }
  }
  return null;
}

export function isEditableHrefNodeName(nodeName: string) {
  return nodeName === "linkBox" || nodeName === "ctaButton" || nodeName === "referenceItem";
}

export function hrefFromAttributes(attrs: Record<string, unknown>) {
  return typeof attrs.href === "string" ? normalizeEditableLinkHref(attrs.href) : undefined;
}

export function editableHrefNodeTargetFromResolvedPos(resolvedPos: ResolvedPos) {
  for (let depth = resolvedPos.depth; depth > 0; depth -= 1) {
    const node = resolvedPos.node(depth);
    if (!isEditableHrefNodeName(node.type.name)) continue;
    return {
      pos: resolvedPos.before(depth),
      href: hrefFromAttributes(node.attrs) ?? "",
    };
  }
  return undefined;
}

function nextTutorialStepNumber(node: ProseMirrorNode) {
  let maxNumber = 0;
  let stepCount = 0;
  node.forEach((child) => {
    if (child.type.name !== "tutorialStep") return;
    stepCount += 1;
    const numeric = Number.parseInt(normalizeTutorialStepNumber(child.attrs.number), 10);
    if (Number.isFinite(numeric)) maxNumber = Math.max(maxNumber, numeric);
  });
  return normalizeTutorialStepNumber(maxNumber > 0 ? maxNumber + 1 : stepCount + 1);
}

function retargetActiveBlockHref(current: Editor, nodeName: "linkBox" | "ctaButton", href: string) {
  if (!current.schema.nodes[nodeName]) return false;
  const selectionFrom = current.state.selection.$from;
  for (let depth = selectionFrom.depth; depth > 0; depth -= 1) {
    const node = selectionFrom.node(depth);
    if (node.type.name !== nodeName) continue;
    current.commands.focus();
    current.view.dispatch(
      current.state.tr
        .setNodeMarkup(selectionFrom.before(depth), node.type, { ...node.attrs, href })
        .scrollIntoView(),
    );
    return true;
  }
  return false;
}

export function createEditorCommandAdapter(options: {
  getEditor: () => Editor | undefined;
  onCommand: (editor: Editor) => void;
  onCalloutRetarget: (kind: CalloutKind, pos: number, label: string) => void;
}) {
  function run(command: (current: Editor) => boolean) {
    const editor = options.getEditor();
    if (!editor) return;
    command(editor);
    options.onCommand(editor);
  }

  function selectedText() {
    const editor = options.getEditor();
    if (!editor || editor.state.selection.empty) return "";
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, "\n").trim();
  }

  function applyCodeBlock({
    language,
    highlightLines,
    filename,
    additionLines,
    deletionLines,
  }: CodeBlockOptions) {
    run((current) => {
      if (current.isActive("codeBlock")) {
        return current.chain().focus().toggleCodeBlock({ language }).run();
      }
      if (
        current
          .chain()
          .focus()
          .command(
            selectedInlineRangeToCodeBlockCommand(
              language,
              highlightLines,
              filename,
              additionLines,
              deletionLines,
            ),
          )
          .run()
      ) {
        return true;
      }
      return current
        .chain()
        .focus()
        .setCodeBlock({ language })
        .updateAttributes("codeBlock", {
          highlightLines,
          filename,
          additionLines,
          deletionLines,
        })
        .run();
    });
  }

  function applyLinkBox(href: string) {
    run((current) => {
      if (retargetActiveBlockHref(current, "linkBox", href)) return true;
      if (current.chain().focus().command(selectedInlineRangeToLinkBoxCommand(href)).run()) {
        return true;
      }
      return current
        .chain()
        .focus()
        .insertContent({
          type: "linkBox",
          attrs: { href },
          content: [{ type: "paragraph", content: [{ type: "text", text: href }] }],
        })
        .run();
    });
  }

  function applySectionHeading() {
    run((current) => {
      if (current.chain().focus().command(selectedInlineRangeToSectionHeadingCommand()).run()) {
        return true;
      }
      return current
        .chain()
        .focus()
        .insertContent({ type: "sectionHeading", content: [{ type: "text", text: "새 섹션" }] })
        .run();
    });
  }

  function applyCtaButton(href: string, fallbackLabel: string) {
    run((current) => {
      if (retargetActiveBlockHref(current, "ctaButton", href)) return true;
      if (current.chain().focus().command(selectedInlineRangeToCtaButtonCommand(href)).run()) {
        return true;
      }
      return current
        .chain()
        .focus()
        .insertContent({
          type: "ctaButton",
          attrs: { href },
          content: [{ type: "text", text: fallbackLabel }],
        })
        .run();
    });
  }

  function applyQuote(style: QuoteStyle) {
    run((current) => {
      if (current.isActive("blockquote")) {
        return current.chain().focus().updateAttributes("blockquote", { quoteStyle: style }).run();
      }
      return current
        .chain()
        .focus()
        .toggleBlockquote()
        .updateAttributes("blockquote", { quoteStyle: style })
        .run();
    });
  }

  function updateActiveQuoteStyle(style: QuoteStyle) {
    run((current) =>
      current.isActive("blockquote")
        ? current.chain().focus().updateAttributes("blockquote", { quoteStyle: style }).run()
        : true,
    );
  }

  function applyCtaGroup(layout: CtaGroupLayout) {
    run((current) =>
      current.isActive("ctaGroup")
        ? current.chain().focus().updateAttributes("ctaGroup", { layout }).run()
        : current.chain().focus().insertContent(createDefaultCtaGroup(layout)).run(),
    );
  }

  function updateActiveCtaGroupLayout(layout: CtaGroupLayout) {
    run((current) =>
      current.isActive("ctaGroup")
        ? current.chain().focus().updateAttributes("ctaGroup", { layout }).run()
        : true,
    );
  }

  function applyReferenceList() {
    const content = createReferenceListFromText(selectedText()) ?? createDefaultReferenceList();
    run((current) => current.chain().focus().insertContent(content).run());
  }

  function applySummaryBox() {
    const content = createSummaryBoxFromText(selectedText()) ?? createDefaultSummaryBox();
    run((current) => current.chain().focus().insertContent(content).run());
  }

  function applyHeroBlock() {
    const content = createHeroBlockFromText(selectedText()) ?? createDefaultHeroBlock();
    run((current) => current.chain().focus().insertContent(content).run());
  }

  function applyComparisonBlock() {
    const content = createComparisonBlockFromText(selectedText()) ?? createDefaultComparisonBlock();
    run((current) => current.chain().focus().insertContent(content).run());
  }

  function applyTutorialBlock(trackedPos?: number) {
    const text = selectedText();
    if (text.trim()) {
      const content = createTutorialBlockFromText(text);
      run((current) => {
        if (!content) return false;
        return current.chain().focus().insertContent(content).run();
      });
      return;
    }

    run((current) => {
      const selection = current.state.selection.$from;
      const selectedPos = findTutorialBlockTargetFromResolvedPos(selection)?.pos;
      const target = [selectedPos, trackedPos]
        .filter((pos): pos is number => pos !== undefined)
        .map((pos) => ({ pos, node: current.state.doc.nodeAt(pos) }))
        .find(({ node }) => node?.type.name === "tutorialBlock");
      if (!target?.node) {
        return current.chain().focus().insertContent(createDefaultTutorialBlock()).run();
      }
      return current
        .chain()
        .focus()
        .insertContentAt(
          target.pos + target.node.nodeSize - 1,
          createTutorialStep("새 단계", "", nextTutorialStepNumber(target.node)),
        )
        .run();
    });
  }

  function retargetCalloutAtPosition(
    current: Editor,
    pos: number,
    kind: CalloutKind,
    toneColor: string,
  ) {
    const targetType = current.schema.nodes[calloutNodeNameByKind[kind]];
    const node = current.state.doc.nodeAt(pos);
    if (!targetType || !node || !isCalloutNodeName(node.type.name)) return false;

    const previousKind = calloutKindFromNodeName(node.type.name);
    const previousDefault = previousKind ? defaultCalloutLabel(previousKind) : "";
    const previousLabel =
      typeof node.attrs.label === "string"
        ? node.attrs.label.trim().replace(/\s+/g, " ").slice(0, 40)
        : "";
    const label =
      previousLabel && previousLabel !== previousDefault
        ? previousLabel
        : defaultCalloutLabel(kind);
    current.commands.focus();
    current.view.dispatch(
      current.state.tr
        .setNodeMarkup(pos, targetType, {
          ...node.attrs,
          label,
          toneColor: normalizeCalloutToneColor(toneColor, kind),
        })
        .scrollIntoView(),
    );
    options.onCalloutRetarget(kind, pos, label);
    return true;
  }

  function retargetActiveCallout(current: Editor, kind: CalloutKind, toneColor: string) {
    const selectionFrom = current.state.selection.$from;
    for (let depth = selectionFrom.depth; depth > 0; depth -= 1) {
      if (isCalloutNodeName(selectionFrom.node(depth).type.name)) {
        const pos = selectionFrom.before(depth);
        return retargetCalloutAtPosition(current, pos, kind, toneColor);
      }
    }
    return false;
  }

  function retargetActiveHrefNode(current: Editor, href: string) {
    let target: { pos: number; href: string } | undefined;
    if (current.state.selection instanceof NodeSelection) {
      const selectedNode = current.state.selection.node;
      if (isEditableHrefNodeName(selectedNode.type.name)) {
        target = {
          pos: current.state.selection.from,
          href: hrefFromAttributes(selectedNode.attrs) ?? "",
        };
      }
    }
    target ??= editableHrefNodeTargetFromResolvedPos(current.state.selection.$from);
    if (!target) return false;
    const node = current.state.doc.nodeAt(target.pos);
    if (!node || !isEditableHrefNodeName(node.type.name)) return false;
    current.commands.focus();
    current.view.dispatch(
      current.state.tr
        .setNodeMarkup(target.pos, node.type, { ...node.attrs, href })
        .scrollIntoView(),
    );
    return true;
  }

  function setLink(href: string) {
    run(
      (current) =>
        retargetActiveHrefNode(current, href) ||
        current.chain().focus().extendMarkRange("link").setLink({ href }).run(),
    );
  }

  function unsetLink() {
    run(
      (current) =>
        retargetActiveHrefNode(current, "") ||
        current.chain().focus().extendMarkRange("link").unsetLink().run(),
    );
  }

  function setTextColor(color: string) {
    run((current) => current.chain().focus().setColor(color).run());
  }

  function setFontSize(value: string) {
    run((current) => current.chain().focus().setFontSize(value).run());
  }

  function applyCallout(kind: CalloutKind, toneColor: string) {
    run((current) => {
      if (retargetActiveCallout(current, kind, toneColor)) return true;
      if (
        current.chain().focus().command(selectedInlineRangeToCalloutCommand(kind, toneColor)).run()
      ) {
        return true;
      }
      return current
        .chain()
        .focus()
        .wrapIn(calloutNodeNameByKind[kind], {
          label: defaultCalloutLabel(kind),
          toneColor: normalizeCalloutToneColor(toneColor, kind),
        })
        .run();
    });
  }

  return {
    run,
    selectedText,
    applyCodeBlock,
    applyLinkBox,
    applySectionHeading,
    applyCtaButton,
    applyQuote,
    updateActiveQuoteStyle,
    applyCtaGroup,
    updateActiveCtaGroupLayout,
    applyReferenceList,
    applySummaryBox,
    applyHeroBlock,
    applyComparisonBlock,
    applyTutorialBlock,
    applyCallout,
    retargetCalloutAtPosition,
    retargetActiveCallout,
    setLink,
    unsetLink,
    setTextColor,
    setFontSize,
  };
}
