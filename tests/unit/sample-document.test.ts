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

function collectText(node: JSONContent): string {
  const ownText = typeof node.text === "string" ? node.text : "";
  const childText = (node.content ?? []).map(collectText).join("");

  return `${ownText}${childText}`;
}

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
  it("covers the bundled sample article blocks used for manual DC paste verification", () => {
    const nodeTypes = collectNodeTypes(sampleDocument);

    for (const nodeType of requiredManualCheckNodes) {
      expect([...nodeTypes]).toContain(nodeType);
    }
  });

  it("uses the current Go concurrency sample instead of the old C++ fast I/O sample", () => {
    const text = collectText(sampleDocument);

    expect(text).toContain("Go 동시성 마스터하기: 고루틴과 채널");
    expect(text).toContain("goroutine은 go 키워드로 실행되는 가벼운 작업 단위다.");
    expect(text).not.toContain("C++로 보는 입력 최적화");
    expect(text).not.toContain("sync_with_stdio");
  });
});
