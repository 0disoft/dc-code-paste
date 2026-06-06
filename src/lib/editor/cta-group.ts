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
  { label: "GitHub", href: "https://github.com/" },
  { label: "원문", href: "https://example.com/source" },
  { label: "다운로드", href: "https://example.com/download" },
  { label: "실행하기", href: "https://example.com/run" },
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
