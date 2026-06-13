import type { JSONContent } from "@tiptap/core";

export const ctaGroupLayoutOptions = [
  { label: "가로", value: "horizontal" },
  { label: "세로", value: "vertical" },
] as const;

export type CtaGroupLayout = (typeof ctaGroupLayoutOptions)[number]["value"];

export function normalizeCtaGroupLayout(value: unknown): CtaGroupLayout {
  return ctaGroupLayoutOptions.some((option) => option.value === value)
    ? (value as CtaGroupLayout)
    : "horizontal";
}

const defaultCtaButtons = [
  { label: "Go Playground", href: "https://go.dev/play/" },
  { label: "공식 문서", href: "https://go.dev/doc/" },
  { label: "GitHub", href: "https://github.com/golang/go" },
] as const;

export function createDefaultCtaGroup(layout: CtaGroupLayout): JSONContent {
  return {
    type: "ctaGroup",
    attrs: { layout: normalizeCtaGroupLayout(layout) },
    content: defaultCtaButtons.map((button) => ({
      type: "ctaButton",
      attrs: { href: button.href },
      content: [{ type: "text", text: button.label }],
    })),
  };
}
