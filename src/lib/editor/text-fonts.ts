import { defaultProseFontFamily, safeDcProseFontFamily } from "#lib/dc/font-stacks.ts";

export const proseFontOptions = [
  { label: "기본 고딕", value: defaultProseFontFamily },
  { label: "맑은 고딕", value: safeDcProseFontFamily("Malgun Gothic") },
  { label: "명조", value: safeDcProseFontFamily("Noto Serif KR") },
  { label: "Georgia", value: safeDcProseFontFamily("Georgia") },
] as const;
