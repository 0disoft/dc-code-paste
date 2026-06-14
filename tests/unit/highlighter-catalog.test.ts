import { describe, expect, it } from "vitest";
import {
  isSupportedLanguage,
  supportedLanguageGroups,
  supportedLanguages,
} from "../../src/lib/highlighter/catalog";

describe("highlighter catalog", () => {
  it("groups data and query languages together", () => {
    const dataGroup = supportedLanguageGroups.find((group) => group.id === "data");

    expect(dataGroup?.label).toBe("데이터/설정");
    expect(dataGroup?.languages.map((language) => language.id)).toEqual([
      "json",
      "yaml",
      "toml",
      "sql",
    ]);
  });

  it("groups documentation and diagram languages together", () => {
    const docsGroup = supportedLanguageGroups.find((group) => group.id === "docs");

    expect(docsGroup?.label).toBe("문서/다이어그램");
    expect(docsGroup?.languages.map((language) => language.id)).toEqual([
      "markdown",
      "mermaid",
    ]);
  });

  it("keeps every listed language selectable and grouped", () => {
    const groupedLanguageIds = new Set(
      supportedLanguageGroups.flatMap((group) => group.languages.map((language) => language.id)),
    );

    for (const language of supportedLanguages) {
      expect(isSupportedLanguage(language.id)).toBe(true);
      expect(groupedLanguageIds.has(language.id)).toBe(true);
    }
  });
});
