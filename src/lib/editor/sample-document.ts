import type { JSONContent } from "@tiptap/core";

function text(value: string, marks?: JSONContent["marks"]): JSONContent {
  return marks ? { type: "text", text: value, marks } : { type: "text", text: value };
}

function codeText(value: string): JSONContent {
  return text(value, [{ type: "code" }]);
}

function paragraph(content: JSONContent[]): JSONContent {
  return { type: "paragraph", content };
}

function summaryItem(content: JSONContent[]): JSONContent {
  return { type: "summaryItem", content };
}

function codeBlock(filename: string, highlightLines: string, source: string): JSONContent {
  return {
    type: "codeBlock",
    attrs: { language: "go", filename, highlightLines },
    content: [{ type: "text", text: source }],
  };
}

function callout(
  type: "tipBox" | "warningBox" | "conclusionBox",
  label: string,
  toneColor: string,
  content: JSONContent[],
): JSONContent {
  return {
    type,
    attrs: { label, toneColor },
    content: [paragraph(content)],
  };
}

function referenceItem(label: string, href: string): JSONContent {
  return {
    type: "referenceItem",
    attrs: { href },
    content: [text(label)],
  };
}

function ctaButton(label: string, href: string): JSONContent {
  return {
    type: "ctaButton",
    attrs: { href },
    content: [text(label)],
  };
}

export const sampleDocument: JSONContent = {
  type: "doc",
  content: [
    {
      type: "heroBlock",
      attrs: { label: "GO의 유일한 반복자" },
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [text("Go 반복문 정복: for 하나로 모든 루프를 제어한다")],
        },
        paragraph([
          text(
            "C 언어 계열의 while, do-while 없이 오직 for만으로 모든 반복 패턴을 구현하는 Go의 간결한 설계를 실전 예제로 익힌다.",
          ),
        ]),
      ],
    },
    {
      type: "summaryBox",
      attrs: { label: "for문 기본기" },
      content: [
        summaryItem([
          text("Go에는 "),
          codeText("for"),
          text(" 키워드 하나만 존재하며, 초기문·조건문·증감문을 모두 생략할 수 있다."),
        ]),
        summaryItem([
          text("조건문만 남기면 "),
          codeText("while"),
          text("처럼, 아무것도 쓰지 않으면 무한 루프로 동작한다."),
        ]),
        summaryItem([
          codeText("range"),
          text("를 통해 배열·슬라이스·맵·채널을 인덱스와 값으로 안전하게 순회한다."),
        ]),
        summaryItem([
          text("사용하지 않는 변수는 "),
          codeText("_"),
          text("로 명시적으로 버려야 컴파일 오류를 피할 수 있다."),
        ]),
      ],
    },
    codeBlock(
      "basic_for.go",
      "6",
      'package main\n\nimport "fmt"\n\nfunc main() {\n    for i := 0; i < 5; i++ {\n        fmt.Println(i)\n    }\n}',
    ),
    codeBlock(
      "while_style.go",
      "7",
      'package main\n\nimport "fmt"\n\nfunc main() {\n    sum := 1\n    for sum < 1000 {\n        sum += sum\n    }\n    fmt.Println(sum)\n}',
    ),
    codeBlock(
      "infinite_loop.go",
      "4",
      "package main\n\nfunc main() {\n    for {\n        // 무한 반복이 필요할 때\n    }\n}",
    ),
    codeBlock(
      "range_with_index.go",
      "6",
      'package main\n\nimport "fmt"\n\nfunc main() {\n    fruits := []string{"사과", "바나나", "체리"}\n    for idx, name := range fruits {\n        fmt.Printf("%d: %s\\n", idx, name)\n    }\n}',
    ),
    callout("tipBox", "조건문으로 변신한 for", "#16a34a", [
      text("초기문과 증감문을 생략하면 일반적인 "),
      codeText("while"),
      text(
        " 루프와 동일한 형태가 된다. 조건이 거짓이 될 때까지 블록을 반복 실행하므로, 종료 조건을 명확히 설정해야 무한 루프를 방지할 수 있다.",
      ),
    ]),
    callout("warningBox", "range는 값 복사에 주의", "#d97706", [
      codeText("for range"),
      text("로 슬라이스를 순회할 때 반환되는 "),
      codeText("value"),
      text(
        "는 요소의 복사본이다. 원본 요소를 직접 수정하려면 인덱스를 사용하거나 포인터 슬라이스를 순회해야 한다.",
      ),
    ]),
    callout("conclusionBox", "for 하나로 충분한 이유", "#a16207", [
      text("Go는 "),
      codeText("for"),
      text("의 생략 가능한 구성 요소와 "),
      codeText("range"),
      text(
        " 키워드만으로 반복 구조를 직교성 있게 표현한다. 문법이 적을수록 코드 리뷰는 빨라지고, 관용구를 익히는 데 걸리는 시간도 짧아진다.",
      ),
    ]),
    {
      type: "referenceList",
      content: [
        referenceItem("A Tour of Go - For", "https://go.dev/tour/flowcontrol/1"),
        referenceItem("Effective Go - For", "https://go.dev/doc/effective_go#for"),
        referenceItem("Go by Example: For", "https://gobyexample.com/for"),
      ],
    },
    {
      type: "ctaGroup",
      attrs: { layout: "vertical" },
      content: [
        ctaButton("Go Playground", "https://go.dev/play/"),
        ctaButton("Tour of Go", "https://go.dev/tour/"),
        ctaButton("언어 명세 (For문)", "https://go.dev/ref/spec#For_statements"),
      ],
    },
  ],
};
