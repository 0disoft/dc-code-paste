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
  "ctaButton",
  "ctaGroup",
  "referenceList",
  "referenceItem",
  "codeBlock",
  "comparisonBlock",
  "tutorialBlock",
  "tutorialStep",
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

function collectNodesByType(
  node: JSONContent,
  type: string,
  found: JSONContent[] = [],
): JSONContent[] {
  if (node.type === type) {
    found.push(node);
  }

  for (const child of node.content ?? []) {
    collectNodesByType(child, type, found);
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

  it("uses the dc-code-paste intro template instead of the older Go examples", () => {
    const text = collectText(sampleDocument);

    expect(text).toContain("디씨 글쓰기에 코드블록과 서식을 붙여넣는 도구");
    expect(text).toContain("Markdown처럼 글을 작성하고");
    expect(text).toContain("LLM 가이드");
    expect(text).toContain("적용하기를 눌러야 한다");
    expect(text).not.toContain("Go 반복문 정복: for 하나로 모든 루프를 제어한다");
    expect(text).not.toContain("Go에는 for 키워드 하나만 존재하며");
    expect(text).not.toContain(
      "for range로 슬라이스를 순회할 때 반환되는 value는 요소의 복사본이다.",
    );
  });

  it("highlights the embedded example.md block as Markdown", () => {
    const codeBlocks = collectNodesByType(sampleDocument, "codeBlock");
    const exampleBlock = codeBlocks.find((node) => node.attrs?.filename === "example.md");

    expect(exampleBlock?.attrs?.language).toBe("markdown");
  });
});
