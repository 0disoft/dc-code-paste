import CodeBlock from "@tiptap/extension-code-block";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Link from "@tiptap/extension-link";
import { FontSize, TextStyle } from "@tiptap/extension-text-style";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { defaultLanguage } from "$lib/highlighter/catalog";
import { normalizeQuoteStyle } from "$lib/editor/quote-style";
import { calloutExtensions } from "./callout-extension";
import { editorialExtensions } from "./editorial-extension";
import { LinkBox } from "./link-box-extension";
import { normalizeCodeFilename } from "$lib/highlighter/code-block-metadata";
import { normalizeHighlightLines } from "$lib/highlighter/highlight-lines";

const DcCodeBlock = CodeBlock.extend({
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
    StarterKit.configure({
      codeBlock: false,
    }),
    QuoteStyleAttributes,
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
