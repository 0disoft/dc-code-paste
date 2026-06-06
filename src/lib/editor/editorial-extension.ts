import { mergeAttributes, Node } from "@tiptap/core";
import { normalizeCtaGroupLayout } from "./cta-group";

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

export const CtaGroup = Node.create({
  name: "ctaGroup",
  group: "block",
  content: "ctaButton+",
  defining: true,

  addAttributes() {
    return {
      layout: {
        default: "horizontal",
        parseHTML: (element) => normalizeCtaGroupLayout(element.getAttribute("data-layout")),
        renderHTML: (attributes) => {
          const layout = normalizeCtaGroupLayout(attributes.layout);
          return layout === "vertical" ? { "data-layout": "vertical" } : {};
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-dc-cta-group]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-dc-cta-group": "",
        class: "dc-cta-group",
      }),
      0,
    ];
  },
});

export const ReferenceItem = Node.create({
  name: "referenceItem",
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
    };
  },

  parseHTML() {
    return [{ tag: "li[data-dc-reference-item]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "li",
      mergeAttributes(HTMLAttributes, {
        "data-dc-reference-item": "",
        class: "dc-reference-item",
      }),
      0,
    ];
  },
});

export const ReferenceList = Node.create({
  name: "referenceList",
  group: "block",
  content: "referenceItem+",
  defining: true,

  parseHTML() {
    return [{ tag: "ol[data-dc-reference-list]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "ol",
      mergeAttributes(HTMLAttributes, {
        "data-dc-reference-list": "",
        class: "dc-reference-list",
      }),
      0,
    ];
  },
});

export const SummaryItem = Node.create({
  name: "summaryItem",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [{ tag: "li[data-dc-summary-item]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "li",
      mergeAttributes(HTMLAttributes, {
        "data-dc-summary-item": "",
        class: "dc-summary-item",
      }),
      0,
    ];
  },
});

export const SummaryBox = Node.create({
  name: "summaryBox",
  group: "block",
  content: "summaryItem+",
  defining: true,

  parseHTML() {
    return [{ tag: "section[data-dc-summary-box]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "section",
      mergeAttributes(HTMLAttributes, {
        "data-dc-summary-box": "",
        class: "dc-summary-box",
      }),
      ["ul", { class: "dc-summary-list" }, 0],
    ];
  },
});

export const editorialExtensions = [
  SectionHeading,
  CtaButton,
  CtaGroup,
  ReferenceItem,
  ReferenceList,
  SummaryItem,
  SummaryBox,
];
