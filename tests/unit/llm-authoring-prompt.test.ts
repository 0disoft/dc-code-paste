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
    expect(llmAuthoringPrompt).toContain('```go {6} add=8 delete=9 title="basic_for.go"');
    expect(llmAuthoringPrompt).not.toContain("{2,4-6} add=8 delete=3");
    expect(llmAuthoringPrompt).not.toContain('```cpp {2,5} add=3 delete=4 title="main.cpp"');
    expect(llmAuthoringPrompt).not.toContain("goroutine_basic.go");
    expect(llmAuthoringPrompt).not.toContain("Go 동시성 마스터하기");
    expect(llmAuthoringPrompt).toContain("HTML 변환 후 65,535자를 넘으면 실패할 수 있다");
    expect(llmAuthoringPrompt).toContain("전체 Markdown은 가능하면 4,500자 이하");
    expect(llmAuthoringPrompt).toContain("콜아웃은 2~4개 이하");
    expect(llmAuthoringPrompt).toContain("코드블록은 3~4개 이하");
    expect(llmAuthoringPrompt).toContain("references는 3~4개 이하");
    expect(llmAuthoringPrompt).toContain("CTA 버튼은 1~3개 이하");
    expect(llmAuthoringPrompt).toContain("아래 Go 예시는 문법 예시일 뿐");
    expect(llmAuthoringPrompt).toContain("긴 코드 줄은 dc-code-paste가 가로 스크롤로 처리한다");
    expect(llmAuthoringPrompt).toContain("코드 한 줄을 임의로 나누지 마라");
    expect(llmAuthoringPrompt).toContain("label: GO의 유일한 반복자");
    expect(llmAuthoringPrompt).toContain("Go 반복문 정복: for 하나로 모든 루프를 제어한다");
    expect(llmAuthoringPrompt).toContain("label: for문 기본기");
    expect(llmAuthoringPrompt).toContain("color: #16a34a");
    expect(llmAuthoringPrompt).toContain("label이 있는 모든 블록은 예시 문구를 그대로 쓰지 말고");
    expect(llmAuthoringPrompt).toContain("hero label, summary label, callout label 모두");
    expect(llmAuthoringPrompt).toContain("기본 라벨만 반복하지 마라");
    expect(llmAuthoringPrompt).toContain("어떤 관점으로 읽어야 하는가");
    expect(llmAuthoringPrompt).toContain("label: 조건문으로 변신한 for");
    expect(llmAuthoringPrompt).toContain("label: range는 값 복사에 주의");
    expect(llmAuthoringPrompt).toContain("label: 원문 확인");
    expect(llmAuthoringPrompt).toContain("- 04 버릴 값은 _로 표시하기");
    expect(llmAuthoringPrompt).toContain("hero 안에는 대표 제목과 짧은 설명만 넣어라");
    expect(llmAuthoringPrompt).toContain(":::cta vertical");
    expect(llmAuthoringPrompt).toContain("references는 더 읽을 문서");
    expect(llmAuthoringPrompt).toContain("CTA는 사용자가 실제로 누를 행동 버튼");
    expect(llmAuthoringPrompt).toContain("CTA와 같은 URL을 중복해서 넣지 마라");
    expect(llmAuthoringPrompt).toContain("없는 줄 번호를 {강조줄}, add=, delete=에 쓰지 마라");
    expect(llmAuthoringPrompt).toContain("Markdown 창에 그대로 붙여넣을 수 있어야 한다");
  });
});
