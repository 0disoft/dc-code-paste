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
  return { type: "summaryItem", content }
}

function codeBlock(
  language: string,
  filename: string,
  highlightLines: string,
  additionLines: string,
  deletionLines: string,
  source: string,
): JSONContent {
  return {
    type: "codeBlock",
    attrs: { language, filename, highlightLines, additionLines, deletionLines },
    content: [{ type: "text", text: source }],
  };
}

function callout(
  type: "tipBox" | "warningBox" | "emphasisBox",
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

function comparisonColumn(title: string, content: JSONContent[]): JSONContent {
  return {
    type: "comparisonColumn",
    attrs: { title },
    content,
  };
}

function tutorialStep(number: string, title: string, content: JSONContent[]): JSONContent {
  return {
    type: "tutorialStep",
    attrs: { number },
    content: [
      { type: "heading", attrs: { level: 1 }, content: [text(title)] },
      ...content,
    ],
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
      attrs: { label: "DC-CODE-PASTE" },
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [text("디씨 글쓰기에 코드블록과 서식을 붙여넣는 도구")],
        },
        paragraph([
          text(
            "Markdown처럼 글을 작성하고, 버튼 한 번으로 DCInside에 붙여넣을 수 있는 HTML을 만든다.",
          ),
        ]),
      ],
    },
    {
      type: "summaryBox",
      attrs: { label: "이 도구로 할 수 있는 것" },
      content: [
        summaryItem([
          text("Markdown으로 글을 작성하고 에디터에 바로 적용할 수 있다."),
        ]),
        summaryItem([
          text("코드블록에 파일명, 언어, 강조줄, 추가줄, 삭제줄 표시를 넣을 수 있다."),
        ]),
        summaryItem([
          text("콜아웃, 비교, 튜토리얼, 링크박스, CTA 버튼 같은 서식 블록을 쓸 수 있다."),
        ]),
        summaryItem([
          codeText("디씨 복사"),
          text(" 버튼으로 DCInside에 그대로 붙여넣을 수 있는 HTML을 만든다."),
        ]),
      ],
    },
    paragraph([
      text(
        "LLM을 써서 글을 빠르게 초안으로 만들 수도 있다. 상단 툴바의 ",
      ),
      codeText("LLM 가이드"),
      text(
        " 버튼을 누르면 이 도구의 Markdown 문법 설명이 클립보드에 복사된다. 이걸 ChatGPT·Claude·DeepSeek 같은 LLM에 붙여넣고 글 작성을 요청하면 된다.",
      ),
    ]),
    callout("tipBox", "Markdown 붙여넣기 방법", "#16a34a", [
      text("LLM 결과를 왼쪽 편집기에 직접 붙여넣으면 서식이 깨진다. "),
      codeText("Markdown"),
      text(
        " 버튼으로 입력창을 열고, 거기에 붙여넣은 뒤 ",
      ),
      codeText("적용하기"),
      text("를 눌러야 한다."),
    ]),
    {
      type: "comparisonBlock",
      content: [
        comparisonColumn("기존 방식", [
          paragraph([
            text("DCInside 에디터에서 색상·폰트·표를 손으로 하나씩 맞춤. 코드는 고정폭 서식으로만 표현 가능."),
          ]),
        ]),
        comparisonColumn("dc-code-paste 사용", [
          paragraph([
            text("Markdown 또는 버튼으로 블록 작성 → 미리보기 확인 → 디씨 복사로 바로 붙여넣기."),
          ]),
        ]),
      ],
    },
    {
      type: "tutorialBlock",
      content: [
        tutorialStep("01", "LLM 가이드 복사", [
          paragraph([
            text("상단 툴바 "),
            codeText("LLM 가이드"),
            text(" 버튼을 클릭한다."),
          ]),
        ]),
        tutorialStep("02", "LLM에게 글 요청", [
          paragraph([
            text("복사한 가이드를 LLM 채팅창에 붙여넣고, 원하는 글 주제와 함께 작성을 요청한다."),
          ]),
        ]),
        tutorialStep("03", "Markdown 패널에 붙여넣기", [
          paragraph([
            text("LLM 결과를 복사한 뒤, "),
            codeText("Markdown"),
            text(" 버튼으로 입력창을 열고 붙여넣는다."),
          ]),
        ]),
        tutorialStep("04", "적용 및 미리보기 확인", [
          paragraph([
            codeText("적용하기"),
            text(" 버튼을 누르면 에디터에 내용이 반영되고, 오른쪽 미리보기에서 결과를 확인할 수 있다."),
          ]),
        ]),
        tutorialStep("05", "디씨 복사", [
          paragraph([
            text("미리보기가 만족스러우면 "),
            codeText("디씨 복사"),
            text(" 버튼을 누르고, DCInside 글쓰기 화면에 붙여넣는다."),
          ]),
        ]),
      ],
    },
    codeBlock(
      "markdown",
      "example.md",
      "3",
      "6",
      "",
      `# 제목

이 줄은 강조 표시된 줄이다.

본문 텍스트 예시.

이 줄은 추가된 줄 표시다.

:::tip 팁 블록
팁 내용을 여기에 작성한다.
:::

:::comparison
=== Before
기존 방식 설명
=== After
개선된 방식 설명
:::

:::cta vertical
[데모 사이트](https://0disoft.github.io/dc-code-paste/)
[GitHub 저장소](https://github.com/0disoft/dc-code-paste)
:::`,
    ),
    callout("warningBox", "줄 번호 범위 주의", "#d97706", [
      text("강조줄·추가줄·삭제줄 번호는 코드블록 실제 줄 수 안에서 지정해야 한다. 범위를 벗어나면 조용히 무시된다."),
    ]),
    {
      type: "referenceList",
      content: [
        referenceItem("dc-code-paste README", "https://github.com/0disoft/dc-code-paste#readme"),
        referenceItem("오픈소스 GitHub 저장소", "https://github.com/0disoft/dc-code-paste"),
      ],
    },
    {
      type: "ctaGroup",
      attrs: { layout: "vertical" },
      content: [
        ctaButton("데모 사이트 열기", "https://0disoft.github.io/dc-code-paste/"),
        ctaButton("GitHub 저장소", "https://github.com/0disoft/dc-code-paste"),
      ],
    },
  ],
};
