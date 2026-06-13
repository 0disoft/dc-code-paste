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
  "conclusionBox",
  "ctaButton",
  "ctaGroup",
  "referenceList",
  "referenceItem",
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

  it("uses the current Go for-loop sample instead of the older examples", () => {
    const text = collectText(sampleDocument);

    expect(text).toContain("Go 반복문 정복: for 하나로 모든 루프를 제어한다");
    expect(text).toContain("Go에는 for 키워드 하나만 존재하며");
    expect(text).toContain("for range로 슬라이스를 순회할 때 반환되는 value는 요소의 복사본이다.");
    expect(text).not.toContain("Go 동시성 마스터하기: 고루틴과 채널");
    expect(text).not.toContain("goroutine은 go 키워드로 실행되는 가벼운 작업 단위다.");
    expect(text).not.toContain("C++로 보는 입력 최적화");
    expect(text).not.toContain("sync_with_stdio");
  });
});
