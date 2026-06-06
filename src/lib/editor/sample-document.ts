import type { JSONContent } from "@tiptap/core";
import { createDefaultCtaGroup } from "$lib/editor/cta-group";
import { createDefaultComparisonBlock } from "$lib/editor/comparison-block";
import { createDefaultHeroBlock } from "$lib/editor/hero-block";
import { createDefaultReferenceList } from "$lib/editor/reference-list";
import { createDefaultSummaryBox } from "$lib/editor/summary-box";
import { createDefaultTutorialBlock } from "$lib/editor/tutorial-block";
import { defaultLanguage } from "$lib/highlighter/catalog";

export const sampleDocument: JSONContent = {
  type: "doc",
  content: [
    createDefaultHeroBlock(),
    createDefaultSummaryBox(),
    {
      type: "paragraph",
      content: [
        { type: "text", text: "입출력이 많은 문제에서는 " },
        { type: "text", text: "동기화 해제", marks: [{ type: "bold" }] },
        { type: "text", text: "만 해도 체감 성능이 꽤 달라져." },
      ],
    },
    {
      type: "tipBox",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "cin/cout을 계속 쓸 거면 " },
            { type: "text", text: "ios::sync_with_stdio(false)", marks: [{ type: "code" }] },
            { type: "text", text: "는 거의 습관처럼 넣어도 좋아." },
          ],
        },
      ],
    },
    {
      type: "emphasisBox",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "여기서 중요한 건 빠른 입출력이 아니라 " },
            {
              type: "text",
              text: "언제 병목이 생기는지 먼저 보는 습관",
              marks: [{ type: "bold" }],
            },
            { type: "text", text: "이야." },
          ],
        },
      ],
    },
    {
      type: "warningBox",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "scanf/printf와 cin/cout을 섞어 쓰면 순서가 꼬일 수 있어. " },
            { type: "text", text: "한 글 안에서는 같은 입출력 계열로 밀고 가는 편이 안전해." },
          ],
        },
      ],
    },
    {
      type: "successBox",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "입출력 계열을 하나로 고정하면 디버깅 포인트가 확 줄어." },
          ],
        },
      ],
    },
    {
      type: "failureBox",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "endl을 반복문 안에서 계속 쓰면 flush 때문에 시간이 새기 쉽다." },
          ],
        },
      ],
    },
    {
      type: "experimentBox",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "정말 병목인지 모르겠으면 " },
            { type: "text", text: "입력만 읽는 버전", marks: [{ type: "code" }] },
            { type: "text", text: "으로 먼저 재보면 돼." },
          ],
        },
      ],
    },
    {
      type: "conclusionBox",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "빠른 입출력은 마법이 아니라 불필요한 기다림을 줄이는 기본 세팅이야.",
            },
          ],
        },
      ],
    },
    {
      type: "rebuttalBox",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "그래도 느리면 입출력보다 알고리즘이나 자료구조가 문제일 가능성이 더 커.",
            },
          ],
        },
      ],
    },
    {
      type: "blockquote",
      attrs: { quoteStyle: "pull" },
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "느린 코드는 대부분 한 줄짜리 비법보다 입출력 횟수와 자료 흐름에서 먼저 걸린다.",
            },
          ],
        },
      ],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "입력 크기와 반복 횟수를 먼저 본다." }],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "빠른 입출력 설정은 코드 맨 앞에서 끝낸다." }],
            },
          ],
        },
      ],
    },
    {
      type: "orderedList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "기본 코드로 먼저 맞춘다." }],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "시간이 튀면 입출력과 불필요한 flush를 본다." }],
            },
          ],
        },
      ],
    },
    {
      type: "horizontalRule",
    },
    {
      type: "sectionHeading",
      content: [{ type: "text", text: "사용 방법 및 예시" }],
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "아래 코드는 입력 설정을 한 번에 모아 둔 최소 예시야." }],
    },
    createDefaultTutorialBlock(),
    createDefaultComparisonBlock(),
    {
      type: "codeBlock",
      attrs: { language: defaultLanguage, highlightLines: "5-6", filename: "main.cpp" },
      content: [
        {
          type: "text",
          text: '#include <iostream>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n\n    int n;\n    cin >> n;\n    cout << n << "\\n";\n}',
        },
      ],
    },
    {
      type: "ctaButton",
      attrs: { href: "https://en.cppreference.com/w/cpp/io/ios_base/sync_with_stdio" },
      content: [{ type: "text", text: "cppreference 열기" }],
    },
    createDefaultCtaGroup("horizontal"),
    createDefaultReferenceList(),
    {
      type: "referenceBox",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "참고: " },
            {
              type: "text",
              text: "cppreference ios_base::sync_with_stdio",
              marks: [
                {
                  type: "link",
                  attrs: {
                    href: "https://en.cppreference.com/w/cpp/io/ios_base/sync_with_stdio",
                    target: "_blank",
                    rel: "noopener noreferrer",
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: "linkBox",
      attrs: { href: "https://en.cppreference.com/w/cpp/io/ios_base/sync_with_stdio" },
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "원문 레퍼런스는 링크박스로 따로 빼두면 글 흐름이 덜 끊겨." },
          ],
        },
      ],
    },
  ],
};
