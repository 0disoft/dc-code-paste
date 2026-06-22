import type { DcExportStructure } from "./types";

export const defaultDcExportStructure: DcExportStructure = "dcTable";

export function normalizeDcExportStructure(value: unknown): DcExportStructure | undefined {
  if (value === defaultDcExportStructure || value === "modern") {
    return defaultDcExportStructure;
  }

  return undefined;
}
