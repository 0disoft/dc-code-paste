import { mergeAttributes, Node } from "@tiptap/core";

export const SectionHeading = Node.create({
  name: "sectionHeading",
  group: "block",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [{ tag: "section[data-dc-section-heading]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "section",
      mergeAttributes(HTMLAttributes, {
        "data-dc-section-heading": "",
        class: "dc-section-heading",
      }),
      0,
    ];
  },
});

export const CtaButton = Node.create({
  name: "ctaButton",
  group: "block",
  content: "inline*",
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
      variant: {
        default: "primary",
        parseHTML: (element) => element.getAttribute("data-variant") ?? "primary",
        renderHTML: (attributes) => {
          const variant = typeof attributes.variant === "string" ? attributes.variant : "primary";
          return variant === "secondary" ? { "data-variant": "secondary" } : {};
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "a[data-dc-cta-button]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        "data-dc-cta-button": "",
        class: "dc-cta-button",
      }),
      0,
    ];
  },
});

export const editorialExtensions = [SectionHeading, CtaButton];
