import { describe, expect, it } from "vitest";
import { llmAuthoringPrompt } from "../../src/lib/editor/llm-authoring-prompt";

describe("llmAuthoringPrompt", () => {
  it("documents the current authoring rules without encouraging every block at once", () => {
    for (const tag of [
      "hero",
      "summary",
      "tip",
      "warning",
      "reference",
      "tutorial",
      "comparison",
      "references",
      "cta",
    ]) {
      expect(llmAuthoringPrompt).toContain(`:::${tag}`);
    }

    expect(llmAuthoringPrompt).toContain(
      "tip, warning, reference, emphasis, success, failure, experiment, conclusion, rebuttal",
    );
    expect(llmAuthoringPrompt).toContain('```go {5-6} add=7 delete=8 title="goroutine_basic.go"');
    expect(llmAuthoringPrompt).not.toContain("{2,4-6} add=8 delete=3");
    expect(llmAuthoringPrompt).not.toContain('```cpp {2,5} add=3 delete=4 title="main.cpp"');
    expect(llmAuthoringPrompt).toContain("HTML 변환 후 65,535자를 넘으면 실패할 수 있다");
    expect(llmAuthoringPrompt).toContain("전체 Markdown은 가능하면 4,500자 이하");
    expect(llmAuthoringPrompt).toContain("콜아웃은 2~4개 이하");
    expect(llmAuthoringPrompt).toContain("코드블록은 3~4개 이하");
    expect(llmAuthoringPrompt).toContain("references는 3~4개 이하");
    expect(llmAuthoringPrompt).toContain("CTA 버튼은 1~3개 이하");
    expect(llmAuthoringPrompt).toContain("아래 Go 예시는 문법 예시일 뿐");
    expect(llmAuthoringPrompt).toContain("label: 동시성 핵심");
    expect(llmAuthoringPrompt).toContain("color: #16a34a");
    expect(llmAuthoringPrompt).toContain("label이 있는 모든 블록은 예시 문구를 그대로 쓰지 말고");
    expect(llmAuthoringPrompt).toContain("hero label, summary label, callout label 모두");
    expect(llmAuthoringPrompt).toContain("기본 라벨만 반복하지 마라");
    expect(llmAuthoringPrompt).toContain("label: 스택 감각");
    expect(llmAuthoringPrompt).toContain("label: 데드락 체크");
    expect(llmAuthoringPrompt).toContain("label: 읽을거리");
    expect(llmAuthoringPrompt).toContain("- 04 취소 경로 연결");
    expect(llmAuthoringPrompt).toContain("hero 안에는 대표 제목과 짧은 설명만 넣어라");
    expect(llmAuthoringPrompt).toContain(":::cta vertical");
    expect(llmAuthoringPrompt).toContain("references는 더 읽을 문서");
    expect(llmAuthoringPrompt).toContain("CTA는 사용자가 실제로 누를 행동 버튼");
    expect(llmAuthoringPrompt).toContain("CTA와 같은 URL을 중복해서 넣지 마라");
    expect(llmAuthoringPrompt).toContain("없는 줄 번호를 {강조줄}, add=, delete=에 쓰지 마라");
    expect(llmAuthoringPrompt).toContain("Markdown 창에 그대로 붙여넣을 수 있어야 한다");
  });
});
