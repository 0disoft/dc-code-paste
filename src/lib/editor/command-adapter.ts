import type { Editor } from "@tiptap/core";
import {
  selectedInlineRangeToCodeBlockCommand,
  selectedInlineRangeToCtaButtonCommand,
  selectedInlineRangeToLinkBoxCommand,
  selectedInlineRangeToSectionHeadingCommand,
} from "$lib/editor/selection-commands";
import type { DcLanguageId } from "$lib/highlighter/catalog";

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

  return { run, selectedText, applyCodeBlock, applyLinkBox, applySectionHeading, applyCtaButton };
}
