import { mergeAttributes, Node } from "@tiptap/core";

export const LinkBox = Node.create({
  name: "linkBox",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      href: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-href") ?? "",
        renderHTML: (attributes) => {
          const href = typeof attributes.href === "string" ? attributes.href : "";
          return href ? { "data-href": href } : {};
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "aside[data-dc-link-box]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "aside",
      mergeAttributes(HTMLAttributes, {
        "data-dc-link-box": "",
        class: "dc-link-box",
      }),
      0,
    ];
  },
});
