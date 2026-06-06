import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { sampleDocument } from "../../src/lib/editor/sample-document";

const requiredManualCheckNodes = [
  "heading",
  "paragraph",
  "heroBlock",
  "summaryBox",
  "summaryItem",
  "tipBox",
  "warningBox",
  "referenceBox",
  "emphasisBox",
  "successBox",
  "failureBox",
  "experimentBox",
  "conclusionBox",
  "rebuttalBox",
  "linkBox",
  "blockquote",
  "sectionHeading",
  "tutorialBlock",
  "tutorialStep",
  "comparisonBlock",
  "comparisonColumn",
  "ctaButton",
  "ctaGroup",
  "referenceList",
  "referenceItem",
  "bulletList",
  "orderedList",
  "horizontalRule",
  "codeBlock",
] as const;

function collectNodeTypes(node: JSONContent, found = new Set<string>()): Set<string> {
  if (node.type) {
    found.add(node.type);
  }

  for (const child of node.content ?? []) {
    collectNodeTypes(child, found);
  }

  return found;
}

describe("sampleDocument", () => {
  it("covers every block needed for manual DC paste verification", () => {
    const nodeTypes = collectNodeTypes(sampleDocument);

    for (const nodeType of requiredManualCheckNodes) {
      expect([...nodeTypes]).toContain(nodeType);
    }
  });
});
