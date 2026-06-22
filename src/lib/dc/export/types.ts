import type { DcThemeId } from "$lib/highlighter/catalog";

export type DcExportStructure = "dcTable";
export type DcDocumentTheme = "lightLecture" | "darkEditorial";

export type DcExportOptions = {
  theme: DcThemeId;
  bodyFontFamily: string;
  bodyFontSize: string;
  codeFontSize: string;
  showLineNumbers: boolean;
  documentTheme?: DcDocumentTheme;
  structure?: DcExportStructure;
  includeAttribution?: boolean;
};
