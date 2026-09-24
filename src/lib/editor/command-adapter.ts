import type { Editor } from "@tiptap/core";
import {
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

type CodeBlockOptions = {
  language: DcLanguageId;
  highlightLines: string;
  filename: string;
  additionLines: string;
  deletionLines: string;
};

function retargetActiveHrefNode(current: Editor, nodeName: "linkBox" | "ctaButton", href: string) {
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
      if (retargetActiveHrefNode(current, "linkBox", href)) return true;
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
      if (retargetActiveHrefNode(current, "ctaButton", href)) return true;
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
  };
}
