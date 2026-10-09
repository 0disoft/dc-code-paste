import CodeBlock from "@tiptap/extension-code-block";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Link from "@tiptap/extension-link";
import { FontSize, TextStyle } from "@tiptap/extension-text-style";
import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import { defaultLanguage } from "#lib/highlighter/catalog.ts";
import { normalizeQuoteStyle } from "#lib/editor/quote-style.ts";
import { calloutExtensions } from "./callout-extension";
import { editorialExtensions } from "./editorial-extension";
import { LinkBox } from "./link-box-extension";
import { createCodeBlockHighlightPlugin } from "./code-block-highlight";
import { normalizeCodeFilename } from "#lib/highlighter/code-block-metadata.ts";
import { normalizeHighlightLines } from "#lib/highlighter/highlight-lines.ts";
import { SelectedBlockDecoration } from "./block-inspector";
import { ReadingIntentMark } from "./reading-intent";

const DcStarterKit = StarterKit.extend({
  addExtensions() {
    return (this.parent?.() ?? []).map((extension) => {
      if (extension.name !== "trailingNode") return extension;
      return extension.extend({
        addProseMirrorPlugins() {
          return (this.parent?.() ?? []).map(
            (plugin) =>
              new Plugin({
                ...plugin.spec,
                appendTransaction(transactions, oldState, state) {
                  // Preference history steps change settings without editing the document.
                  // Keep the insertion paragraph for content changes and intentional editor focus.
                  if (oldState.doc.eq(state.doc) && !transactions.some((tr) => tr.getMeta("focus")))
                    return null;
                  return (
                    plugin.spec.appendTransaction?.call(plugin, transactions, oldState, state) ??
                    null
                  );
                },
              }),
          );
        },
      });
    });
  },
});

const DcCodeBlock = CodeBlock.extend({
  addProseMirrorPlugins() {
    return [...(this.parent?.() ?? []), createCodeBlockHighlightPlugin()];
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      highlightLines: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-highlight-lines") ?? "",
        renderHTML: (attributes) => {
          const highlightLines = normalizeHighlightLines(attributes.highlightLines);

          return highlightLines ? { "data-highlight-lines": highlightLines } : {};
        },
      },
      additionLines: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-addition-lines") ?? "",
        renderHTML: (attributes) => {
          const additionLines = normalizeHighlightLines(attributes.additionLines);

          return additionLines ? { "data-addition-lines": additionLines } : {};
        },
      },
      deletionLines: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-deletion-lines") ?? "",
        renderHTML: (attributes) => {
          const deletionLines = normalizeHighlightLines(attributes.deletionLines);

          return deletionLines ? { "data-deletion-lines": deletionLines } : {};
        },
      },
      filename: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-filename") ?? "",
        renderHTML: (attributes) => {
          const filename = normalizeCodeFilename(attributes.filename);

          return filename ? { "data-filename": filename } : {};
        },
      },
    };
  },
});

const QuoteStyleAttributes = Extension.create({
  name: "quoteStyleAttributes",

  addGlobalAttributes() {
    return [
      {
        types: ["blockquote"],
        attributes: {
          quoteStyle: {
            default: "literary",
            parseHTML: (element) => normalizeQuoteStyle(element.getAttribute("data-quote-style")),
            renderHTML: (attributes) => {
              const quoteStyle = normalizeQuoteStyle(attributes.quoteStyle);

              return quoteStyle === "literary" ? {} : { "data-quote-style": quoteStyle };
            },
          },
        },
      },
    ];
  },
});

export function createEditorExtensions() {
  return [
    DcStarterKit.configure({
      codeBlock: false,
      link: false,
    }),
    QuoteStyleAttributes,
    SelectedBlockDecoration,
    DcCodeBlock.configure({
      defaultLanguage,
      enableTabIndentation: true,
      tabSize: 4,
      HTMLAttributes: {
        class: "dc-editor-code",
      },
    }),
    ...calloutExtensions,
    ...editorialExtensions,
    LinkBox,
    ReadingIntentMark,
    TextStyle,
    Color,
    FontFamily,
    FontSize,
    Link.configure({
      autolink: true,
      defaultProtocol: "https",
      enableClickSelection: true,
      linkOnPaste: true,
      openOnClick: false,
      protocols: ["http", "https", "mailto"],
      HTMLAttributes: {
        rel: "noopener noreferrer",
        target: "_blank",
      },
    }),
  ];
}
