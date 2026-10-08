import type { DcDocumentTheme } from "./export/types";

const light = { background: "#ffffff", fallback: "oklch(23.39% 0.012 255.51)" };

export const documentTextColors: Record<DcDocumentTheme, { background: string; fallback: string }> =
  {
    cleanEditorial: light,
    lightLecture: light,
    darkEditorial: { background: "#151515", fallback: "#e8e8e8" },
  };
