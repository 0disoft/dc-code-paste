import { describe, expect, it } from "vitest";
import { llmAuthoringPrompt } from "../../src/lib/editor/llm-authoring-prompt";

describe("llmAuthoringPrompt", () => {
  it("documents the importable authoring blocks", () => {
    for (const tag of [
      "hero",
      "summary",
      "tip",
      "warning",
      "reference",
      "emphasis",
      "success",
      "failure",
      "experiment",
      "conclusion",
      "rebuttal",
      "tutorial",
      "comparison",
      "references",
      "cta",
    ]) {
      expect(llmAuthoringPrompt).toContain(`:::${tag}`);
    }

    expect(llmAuthoringPrompt).toContain("Markdown 창에 그대로 붙여넣을 수 있어야 한다");
  });
});
