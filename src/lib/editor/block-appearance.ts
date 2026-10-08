export const blockTones = ["blue", "green", "amber", "rose", "violet"] as const;
export const blockAlignments = ["left", "center", "right"] as const;
export const blockSpacings = ["compact", "normal", "spacious"] as const;

export type BlockAppearance = {
  tone: (typeof blockTones)[number];
  alignment: (typeof blockAlignments)[number];
  spacing: (typeof blockSpacings)[number];
};

export function normalizeBlockAppearance(attrs: Record<string, unknown> = {}): BlockAppearance {
  return {
    tone: blockTones.find((value) => value === attrs.tone) ?? "blue",
    alignment: blockAlignments.find((value) => value === attrs.alignment) ?? "left",
    spacing: blockSpacings.find((value) => value === attrs.spacing) ?? "normal",
  };
}

export const summaryToneColors = {
  blue: { background: "#eef2ff", accent: "#315dfb", border: "#c7d2fe", label: "#263f9a" },
  green: { background: "#ecfdf5", accent: "#059669", border: "#a7f3d0", label: "#065f46" },
  amber: { background: "#fffbeb", accent: "#d97706", border: "#fde68a", label: "#92400e" },
  rose: { background: "#fff1f2", accent: "#e11d48", border: "#fecdd3", label: "#9f1239" },
  violet: { background: "#f5f3ff", accent: "#7c3aed", border: "#ddd6fe", label: "#5b21b6" },
} as const;

export const summarySpacing = {
  compact: { horizontal: 12, top: 8, row: 3, bottom: 9 },
  normal: { horizontal: 16, top: 12, row: 5, bottom: 13 },
  spacious: { horizontal: 24, top: 20, row: 8, bottom: 20 },
} as const;
