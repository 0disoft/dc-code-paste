import type { JSONContent } from "@tiptap/core";
import { createTutorialStep } from "./tutorial-block";

export const writingTemplates = [
  { id: "news", label: "뉴스 정리", description: "핵심 요약 · 내용 · 의미 · 출처" },
  { id: "column", label: "칼럼", description: "주장 · 근거 · 다른 관점 · 맺음말" },
  { id: "howto", label: "사용법", description: "준비물 · 단계별 안내 · 확인 사항" },
] as const;
export type WritingTemplateId = (typeof writingTemplates)[number]["id"];

const text = (value: string): JSONContent => ({ type: "text", text: value });
const paragraph = (value: string): JSONContent => ({ type: "paragraph", content: [text(value)] });
const section = (value: string): JSONContent => ({
  type: "sectionHeading",
  content: [text(value)],
});
const hero = (label: string, title: string): JSONContent => ({
  type: "heroBlock",
  attrs: { label },
  content: [
    { type: "heading", attrs: { level: 1 }, content: [text(title)] },
    paragraph("글을 소개하는 한 문장을 입력하세요."),
  ],
});
const summary = (items: string[]): JSONContent => ({
  type: "summaryBox",
  attrs: { label: "핵심 요약" },
  content: items.map((value) => ({ type: "summaryItem", content: [text(value)] })),
});

export function createWritingTemplate(id: WritingTemplateId): JSONContent {
  let content: JSONContent[];
  if (id === "news") {
    content = [
      hero("뉴스 정리", "뉴스 제목을 입력하세요"),
      summary([
        "무슨 일이 있었는지 한 문장으로 정리하세요.",
        "독자가 알아야 할 변화와 영향을 적으세요.",
      ]),
      section("어떤 일이 있었나"),
      paragraph("확인한 사실과 발표 내용을 적으세요. 날짜와 수치를 함께 기록하면 좋습니다."),
      section("어떤 의미가 있나"),
      paragraph("이 소식의 의미를 설명하세요. 확인된 사실과 자신의 해석을 구분해 적으세요."),
      section("출처"),
      paragraph("원문 제목, 작성자, 발표일과 링크를 적으세요."),
    ];
  } else if (id === "column") {
    content = [
      hero("생각을 정리하는 글", "칼럼 제목을 입력하세요"),
      paragraph("이 글을 쓰게 된 질문이나 경험으로 이야기를 시작하세요."),
      section("내가 하고 싶은 이야기"),
      paragraph("핵심 주장을 적고, 그렇게 생각하는 이유를 설명하세요."),
      section("근거와 사례"),
      paragraph("주장을 뒷받침하는 자료나 경험을 적으세요."),
      section("다른 관점에서 보면"),
      paragraph("다른 해석이나 반론을 소개하고 자신의 생각을 덧붙이세요."),
      summary(["독자에게 남기고 싶은 생각을 한 문장으로 정리하세요."]),
      section("맺음말"),
      paragraph("글을 마무리하며 독자에게 던지고 싶은 질문을 적으세요."),
    ];
  } else {
    content = [
      hero("사용법 안내", "사용법 제목을 입력하세요"),
      paragraph("무엇을 할 수 있는지, 누구를 위한 안내인지 소개하세요."),
      summary(["준비물과 필요한 조건을 적으세요.", "완료까지 걸리는 시간이나 비용을 적으세요."]),
      section("순서대로 따라 하기"),
      {
        type: "tutorialBlock",
        content: [
          createTutorialStep("준비하기", "시작 전에 확인할 사항을 적으세요.", 1),
          createTutorialStep("진행하기", "따라 할 작업을 순서대로 설명하세요.", 2),
          createTutorialStep("결과 확인하기", "완료된 결과를 확인하는 방법을 적으세요.", 3),
        ],
      },
      section("문제가 생겼을 때"),
      paragraph("자주 생기는 문제와 해결 방법을 적으세요."),
    ];
  }
  return { type: "doc", content };
}
