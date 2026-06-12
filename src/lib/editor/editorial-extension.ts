import { mergeAttributes, Node } from "@tiptap/core";
import { normalizeCtaGroupLayout } from "./cta-group";
import { defaultSummaryBoxLabel } from "./summary-box";

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

  addAttributes() {
    return {
      label: {
        default: defaultSummaryBoxLabel,
        parseHTML: (element) => element.getAttribute("data-label") ?? defaultSummaryBoxLabel,
        renderHTML: (attributes) => {
          const label = typeof attributes.label === "string" ? attributes.label.trim() : "";
          return label ? { "data-label": label } : {};
        },
      },
    };
  },

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

export const HeroBlock = Node.create({
  name: "heroBlock",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      label: {
        default: "CODING GUIDE",
        parseHTML: (element) => element.getAttribute("data-label") ?? "CODING GUIDE",
        renderHTML: (attributes) => {
          const label = typeof attributes.label === "string" ? attributes.label.trim() : "";
          return label ? { "data-label": label } : {};
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "section[data-dc-hero-block]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const label =
      typeof HTMLAttributes["data-label"] === "string"
        ? HTMLAttributes["data-label"]
        : "CODING GUIDE";

    return [
      "section",
      mergeAttributes(HTMLAttributes, {
        "data-dc-hero-block": "",
        class: "dc-hero-block",
      }),
      ["span", { class: "dc-hero-rule" }],
      ["strong", { class: "dc-hero-label" }, label],
      ["div", { class: "dc-hero-body" }, 0],
    ];
  },
});

export const TutorialStep = Node.create({
  name: "tutorialStep",
  content: "block*",
  defining: true,

  addAttributes() {
    return {
      title: {
        default: "단계",
        parseHTML: (element) => element.getAttribute("data-title") ?? "단계",
        renderHTML: (attributes) => {
          const title = typeof attributes.title === "string" ? attributes.title.trim() : "";
          return title ? { "data-title": title } : {};
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "section[data-dc-tutorial-step]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const title =
      typeof HTMLAttributes["data-title"] === "string" ? HTMLAttributes["data-title"] : "단계";

    return [
      "section",
      mergeAttributes(HTMLAttributes, {
        "data-dc-tutorial-step": "",
        class: "dc-tutorial-step",
      }),
      [
        "div",
        { class: "dc-tutorial-head" },
        ["span", { class: "dc-tutorial-number" }],
        ["strong", { class: "dc-tutorial-title" }, title],
      ],
      ["div", { class: "dc-tutorial-body" }, 0],
    ];
  },
});

export const TutorialBlock = Node.create({
  name: "tutorialBlock",
  group: "block",
  content: "tutorialStep+",
  defining: true,

  parseHTML() {
    return [{ tag: "div[data-dc-tutorial-block]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-dc-tutorial-block": "",
        class: "dc-tutorial-block",
      }),
      0,
    ];
  },
});

export const ComparisonColumn = Node.create({
  name: "comparisonColumn",
  content: "block*",
  defining: true,

  addAttributes() {
    return {
      side: {
        default: "left",
        parseHTML: (element) => (element.getAttribute("data-side") === "right" ? "right" : "left"),
        renderHTML: (attributes) => {
          const side = attributes.side === "right" ? "right" : "left";
          return { "data-side": side };
        },
      },
      title: {
        default: "Before",
        parseHTML: (element) => element.getAttribute("data-title") ?? "Before",
        renderHTML: (attributes) => {
          const title = typeof attributes.title === "string" ? attributes.title.trim() : "";
          return title ? { "data-title": title } : {};
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "section[data-dc-comparison-column]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const title =
      typeof HTMLAttributes["data-title"] === "string" ? HTMLAttributes["data-title"] : "Before";
    const side = HTMLAttributes["data-side"] === "right" ? "right" : "left";

    return [
      "section",
      mergeAttributes(HTMLAttributes, {
        "data-dc-comparison-column": "",
        "data-side": side,
        class: `dc-comparison-column dc-comparison-${side}`,
      }),
      ["strong", { class: "dc-comparison-title" }, title],
      ["div", { class: "dc-comparison-body" }, 0],
    ];
  },
});

export const ComparisonBlock = Node.create({
  name: "comparisonBlock",
  group: "block",
  content: "comparisonColumn comparisonColumn",
  defining: true,

  parseHTML() {
    return [{ tag: "div[data-dc-comparison-block]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-dc-comparison-block": "",
        class: "dc-comparison-block",
      }),
      0,
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
  HeroBlock,
  TutorialStep,
  TutorialBlock,
  ComparisonColumn,
  ComparisonBlock,
];
