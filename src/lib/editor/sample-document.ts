import type { JSONContent } from "@tiptap/core";
import { createDefaultComparisonBlock } from "$lib/editor/comparison-block";
import { createDefaultCtaGroup } from "$lib/editor/cta-group";
import { createDefaultHeroBlock } from "$lib/editor/hero-block";
import { createDefaultReferenceList } from "$lib/editor/reference-list";
import { createDefaultSummaryBox } from "$lib/editor/summary-box";
import { createDefaultTutorialBlock } from "$lib/editor/tutorial-block";

export const sampleDocument: JSONContent = {
  type: "doc",
  content: [
    createDefaultHeroBlock(),
    createDefaultSummaryBox(),
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Go는 메모리 공유 대신 " },
        { type: "text", text: "통신을 통한 메모리 공유", marks: [{ type: "bold" }] },
        {
          type: "text",
          text: "를 지향한다. 고루틴과 채널을 같이 보면 동시성 코드의 흐름이 훨씬 또렷해진다.",
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
              text: "Do not communicate by sharing memory; instead, share memory by communicating.",
            },
          ],
        },
      ],
    },
    {
      type: "sectionHeading",
      content: [{ type: "text", text: "고루틴" }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "함수 호출 앞에 " },
        { type: "text", text: "go", marks: [{ type: "code" }] },
        {
          type: "text",
          text: "를 붙이면 새 고루틴이 생성된다. 고루틴은 OS 스레드보다 훨씬 가볍고, Go 런타임이 이를 효율적으로 스케줄링한다.",
        },
      ],
    },
    {
      type: "codeBlock",
      attrs: {
        language: "go",
        filename: "goroutine_basic.go",
        highlightLines: "5-6",
      },
      content: [
        {
          type: "text",
          text: 'package main\n\nimport "fmt"\n\nfunc main() {\n    go fmt.Println("비동기 실행")\n    fmt.Println("메인 함수 실행")\n    // 고루틴 완료를 보장하지 않으면 메인이 먼저 종료될 수 있다\n}',
        },
      ],
    },
    {
      type: "tipBox",
      attrs: { label: "스택 감각", toneColor: "#16a34a" },
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "고루틴 하나의 초기 스택은 작게 시작하고 필요할 때 늘어난다. 수천 개의 작업을 만들 수 있지만, 종료 경로는 반드시 설계해야 한다.",
            },
          ],
        },
      ],
    },
    {
      type: "sectionHeading",
      content: [{ type: "text", text: "채널 방향" }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "채널은 " },
        { type: "text", text: "make(chan T)", marks: [{ type: "code" }] },
        { type: "text", text: "로 만들고 " },
        { type: "text", text: "<-", marks: [{ type: "code" }] },
        {
          type: "text",
          text: " 연산자로 값을 주고받는다. 함수 시그니처에 방향을 적으면 실수를 컴파일 단계에서 줄일 수 있다.",
        },
      ],
    },
    {
      type: "codeBlock",
      attrs: {
        language: "go",
        filename: "directional_channel.go",
        highlightLines: "1-2",
        additionLines: "5",
        deletionLines: "7",
      },
      content: [
        {
          type: "text",
          text: "func sendOnly(ch chan<- int) {\n    ch <- 42\n}\n\nfunc recvOnly(ch <-chan int) {\n    val := <-ch\n    fmt.Println(val)\n}",
        },
      ],
    },
    {
      type: "warningBox",
      attrs: { label: "데드락 체크", toneColor: "#d97706" },
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "버퍼 없는 채널에서 송신자와 수신자가 동시에 준비되지 않으면 고루틴은 멈춘다. 작은 예제에서도 누가 보내고 누가 받는지 먼저 그려야 한다.",
            },
          ],
        },
      ],
    },
    createDefaultComparisonBlock(),
    {
      type: "horizontalRule",
    },
    {
      type: "sectionHeading",
      content: [{ type: "text", text: "실전 패턴" }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "여러 워커가 작업을 나눠 처리하고 결과를 모으는 Fan-Out / Fan-In 흐름은 채널의 쓰임을 가장 빨리 체감할 수 있는 패턴이다.",
        },
      ],
    },
    createDefaultTutorialBlock(),
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "작업 큐는 버퍼 채널로 단순하게 시작한다." }],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "종료 신호는 close와 context 중 어느 쪽이 책임지는지 정한다.",
                },
              ],
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
              content: [{ type: "text", text: "작은 입력으로 고루틴 종료를 먼저 확인한다." }],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "부하를 늘리기 전에 취소 경로와 타임아웃을 연결한다." },
              ],
            },
          ],
        },
      ],
    },
    {
      type: "referenceBox",
      attrs: { label: "읽을거리", toneColor: "#2563eb" },
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "공식 문서의 " },
            {
              type: "text",
              text: "A Tour of Go 동시성 장",
              marks: [
                {
                  type: "link",
                  attrs: {
                    href: "https://go.dev/tour/concurrency/1",
                    target: "_blank",
                    rel: "noopener noreferrer",
                  },
                },
              ],
            },
            { type: "text", text: "을 같이 열어두면 예제를 바로 실행해 보기 좋다." },
          ],
        },
      ],
    },
    createDefaultReferenceList(),
    {
      type: "ctaButton",
      attrs: { href: "https://go.dev/play/" },
      content: [{ type: "text", text: "Go Playground 열기" }],
    },
    createDefaultCtaGroup("vertical"),
    {
      type: "linkBox",
      attrs: { href: "https://go.dev/doc/effective_go#concurrency" },
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Effective Go의 동시성 문단은 링크박스로 따로 빼두면 다시 찾아보기 쉽다.",
            },
          ],
        },
      ],
    },
  ],
};
