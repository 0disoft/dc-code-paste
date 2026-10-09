import type { DcThemeId } from "#lib/highlighter/catalog.ts";
import type { ReadingLayout } from "#lib/editor/reading-layout.ts";

export type DcExportStructure = "dcTable";
export type DcDocumentTheme = "lightLecture" | "darkEditorial" | "cleanEditorial";

export type DcExportOptions = {
  theme: DcThemeId;
  bodyFontFamily: string;
  bodyFontSize: string;
  codeFontSize: string;
  showLineNumbers: boolean;
  documentTheme?: DcDocumentTheme;
  readingLayout?: ReadingLayout;
  structure?: DcExportStructure;
  includeAttribution?: boolean;
};
