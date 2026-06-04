import CodeBlock from "@tiptap/extension-code-block";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Link from "@tiptap/extension-link";
import { FontSize, TextStyle } from "@tiptap/extension-text-style";
import StarterKit from "@tiptap/starter-kit";
import { defaultLanguage } from "$lib/highlighter/catalog";
import { calloutExtensions } from "./callout-extension";
import { LinkBox } from "./link-box-extension";

export function createEditorExtensions() {
  return [
    StarterKit.configure({
      codeBlock: false,
    }),
    CodeBlock.configure({
      defaultLanguage,
      enableTabIndentation: true,
      tabSize: 4,
      HTMLAttributes: {
        class: "dc-editor-code",
      },
    }),
    ...calloutExtensions,
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
