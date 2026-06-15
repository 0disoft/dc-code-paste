import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { exportDocumentToDcHtml } from "../../src/lib/dc/export-document";
import {
  defaultProseFontFamily,
  safeDcCodeFontFamily,
  safeDcInlineCodeFontFamily,
  safeDcProseFontFamily,
} from "../../src/lib/dc/font-stacks";
import { parseMarkdownToDocument } from "../../src/lib/editor/markdown-import";

const expectedDefaultDcProseFontFamily = safeDcProseFontFamily(defaultProseFontFamily);

const exportOptions = {
  theme: "github-dark",
  bodyFontFamily: defaultProseFontFamily,
  bodyFontSize: "17px",
  codeFontSize: "15px",
  showLineNumbers: false,
} as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function textOfTestDocument(node: JSONContent): string {
  return `${node.text ?? ""}${(node.content ?? []).map(textOfTestDocument).join("")}`;
}

describe("exportDocumentToDcHtml", () => {
  it("returns empty HTML for an empty editor document", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [{ type: "paragraph" }],
    };

    await expect(exportDocumentToDcHtml(document, exportOptions)).resolves.toBe("");
    await expect(
      exportDocumentToDcHtml(document, {
        ...exportOptions,
        includeAttribution: true,
      }),
    ).resolves.toBe("");
  });

  it("omits the attribution footer by default for preview HTML", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "본문 내용" }],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, exportOptions);

    expect(html).toContain("본문 내용");
    expect(html).not.toContain("Created with dc-code-paste");
    expect(html).not.toContain('href="https://0disoft.github.io/dc-code-paste/"');
  });

  it("exports markdown-authored data tables as paste-safe tables", async () => {
    const document = parseMarkdownToDocument(
      [
        "| 설정 항목 | 추천값 | 효과 |",
        "| --- | --- | --- |",
        "| 화면 밝기 | 자동 밝기 또는 40% 이하 | 최대 20% 절약 |",
        "| 배터리 절약 모드 | 항상 켜기 | 백그라운드 소모 감소 |",
      ].join("\n"),
    );

    const html = await exportDocumentToDcHtml(document, exportOptions);

    expect(html).toContain('<table width="100%"');
    expect(html).toContain("<th ");
    expect(html).toContain("<td ");
    expect(html).toContain("설정 항목");
    expect(html).toContain("자동 밝기 또는 40% 이하");
    expect(html).toContain("백그라운드 소모 감소");
    expect(html).toMatch(
      new RegExp(
        `<th style="padding:8px 10px;border:1px solid #[0-9a-f]{6};background-color:#[0-9a-f]{6};color:#[0-9a-f]{6};font-family:${escapeRegExp(
          expectedDefaultDcProseFontFamily,
        )};font-size:17px;font-weight:700;line-height:1\\.62;text-align:left;vertical-align:top;word-break:keep-all;overflow-wrap:break-word">설정 항목</th>`,
      ),
    );
    expect(html).toMatch(
      new RegExp(
        `<td style="padding:9px 10px;border:1px solid #[0-9a-f]{6};background-color:#[0-9a-f]{6};font-family:${escapeRegExp(
          expectedDefaultDcProseFontFamily,
        )};font-size:17px;line-height:1\\.62;text-align:left;vertical-align:top;word-break:keep-all;overflow-wrap:break-word">자동 밝기 또는 40% 이하</td>`,
      ),
    );
  });

  it("keeps prose font styles after markdown-authored data tables", async () => {
    const document = parseMarkdownToDocument(
      [
        "| 함수 | 예시 | 결과 |",
        "| --- | --- | --- |",
        "| gcd | `gcd(24, 60)` | 12 |",
        "| lcm | `lcm(8, 10)` | 40 |",
        "",
        "`map` 노드 조작도 이제 재할당 없이 가능하다.",
      ].join("\n"),
    );

    const html = await exportDocumentToDcHtml(document, exportOptions);
    const afterTableHtml = html.slice(Math.max(0, html.indexOf("map") - 300));

    expect(afterTableHtml).toContain(
      `font-family:${expectedDefaultDcProseFontFamily};font-size:17px`,
    );
    expect(afterTableHtml).toMatch(
      /<td style="padding:0;color:#[0-9a-f]{6};font-family:[^"]+;font-size:17px;line-height:1\.72">/,
    );
  });

  it("appends a subtle linked attribution footer to copied DC HTML", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "본문 내용" }],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      includeAttribution: true,
    });
    const footerStart = html.indexOf("Created with dc-code-paste");

    expect(footerStart).toBeGreaterThan(html.indexOf("본문 내용"));
    expect(html).toContain('href="https://0disoft.github.io/dc-code-paste/"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('align="right"');
    expect(html).toContain("text-align:right");
    expect(html).toContain("color:#c9c1b5");
    expect(html).toContain("opacity:0.18");
    expect(html.slice(footerStart - 200, footerStart + 120)).not.toContain("font-family:");
  });

  it("keeps the attribution footer quieter on dark documents", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "다크 문서" }],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      documentTheme: "darkEditorial",
      includeAttribution: true,
    });

    expect(html).toContain("Created with dc-code-paste");
    expect(html).toContain("color:#787878");
    expect(html).toContain("opacity:0.34");
  });

  it("renders prose, links, callouts, and code blocks as inline-style DC HTML", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "강의 노트" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "중요한 문장", marks: [{ type: "bold" }] },
            { type: "text", text: "과 " },
            {
              type: "text",
              text: "링크",
              marks: [{ type: "link", attrs: { href: "https://example.com" } }],
            },
            { type: "text", text: "와 " },
            { type: "text", text: "LLM 가이드", marks: [{ type: "code" }] },
          ],
        },
        {
          type: "tipBox",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "여긴 팁이야." }],
            },
          ],
        },
        {
          type: "warningBox",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "입력값 범위를 먼저 봐." }],
            },
          ],
        },
        {
          type: "referenceBox",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "레퍼런스는 여기." }],
            },
          ],
        },
        {
          type: "emphasisBox",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "핵심만 따로 눌러준다." }],
            },
          ],
        },
        {
          type: "linkBox",
          attrs: { href: "https://example.com/reference" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "외부 레퍼런스" }],
            },
          ],
        },
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "인용문도 글 흐름 안에서 살아야 한다." }],
            },
          ],
        },
        {
          type: "sectionHeading",
          content: [{ type: "text", text: "사용 방법 및 예시" }],
        },
        {
          type: "ctaButton",
          attrs: { href: "https://example.com/start" },
          content: [{ type: "text", text: "바로가기" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "첫 번째 체크" }],
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
                  content: [{ type: "text", text: "순서 있는 체크" }],
                },
              ],
            },
          ],
        },
        {
          type: "horizontalRule",
        },
        {
          type: "codeBlock",
          attrs: { language: "javascript" },
          content: [{ type: "text", text: "const value = 1;" }],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, exportOptions);

    expect(html).toContain("강의 노트");
    expect(html).toContain("font-weight:700");
    expect(html).not.toMatch(/font-weight:(?:800|850|900)/);
    expect(html).toContain('href="https://example.com"');
    expect(html).toMatch(
      new RegExp(
        `<code style="background-color:#[0-9a-f]{6};color:#[0-9a-f]{6};font-family:${escapeRegExp(
          safeDcInlineCodeFontFamily(),
        )};font-size:\\.92em;font-weight:700;padding:1px 4px;border-radius:4px">LLM 가이드</code>`,
      ),
    );
    expect(html).toContain("TIP");
    expect(html).toContain("주의");
    expect(html).toContain("REF");
    expect(html).toContain("POINT");
    expect(html).toContain("LINK");
    expect(html).toContain('href="https://example.com/reference"');
    expect(html).toContain("인용문도 글 흐름 안에서 살아야 한다.");
    expect(html).toContain("&ldquo;");
    expect(html).toContain("font-style:italic");
    expect(html).toContain("background-color:#fbfaf2");
    expect(html).toContain("사용 방법 및 예시");
    expect(html).toContain('href="https://example.com/start"');
    expect(html).toContain("바로가기");
    expect(html).not.toContain("<ul");
    expect(html).not.toContain("<ol");
    expect(html).not.toContain("<li");
    expect(html).toContain("&bull;</span></td><td");
    expect(html).toContain(">1.</span></td><td");
    expect(html).toMatch(
      /<td style="padding:0 0 7px;color:#[0-9a-f]{6};font-family:[^"]+;font-size:17px;line-height:1\.7;vertical-align:top"><span style="color:#[0-9a-f]{6};line-height:1\.7">첫 번째 체크<\/span><\/td>/,
    );
    expect(html).toMatch(
      /<td style="padding:0 0 7px;color:#[0-9a-f]{6};font-family:[^"]+;font-size:17px;line-height:1\.7;vertical-align:top"><span style="color:#[0-9a-f]{6};line-height:1\.7">순서 있는 체크<\/span><\/td>/,
    );
    expect(html).toContain("<hr");
    expect(html).toContain("const");
    expect(html).toMatch(/color:#[0-9a-f]{6}/);
    expect(html).not.toContain("oklch(");
  }, 15_000);

  it("keeps legacy calloutBox documents exportable", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "calloutBox",
          attrs: { kind: "reference" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "이전 문서도 버리지 않는다." }],
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, exportOptions);

    expect(html).toContain("REF");
    expect(html).toContain("이전 문서도 버리지 않는다.");
  });

  it("exports extended callout variants with distinct labels and table fallbacks", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "successBox",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "성공 케이스" }],
            },
          ],
        },
        {
          type: "failureBox",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "실패 케이스" }],
            },
          ],
        },
        {
          type: "experimentBox",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "실험 값은 " },
                { type: "text", text: "n=1000", marks: [{ type: "code" }] },
                { type: "text", text: "부터 본다." },
              ],
            },
          ],
        },
        {
          type: "conclusionBox",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "결론 문장" }],
            },
          ],
        },
        {
          type: "rebuttalBox",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "반박 문장" }],
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      structure: "dcTable",
    });

    expect(html).toContain("성공");
    expect(html).toContain("실패");
    expect(html).toContain("실험");
    expect(html).toContain("결론");
    expect(html).toContain("반박");
    expect(html).toContain("성공 케이스");
    expect(html).toContain("실패 케이스");
    expect(html).toContain("결론 문장");
    expect(html).toContain("반박 문장");
    expect(html).toContain('bgcolor="#e7faee"');
    expect(html).toContain('bgcolor="#ffe8e5"');
    expect(html).toContain('bgcolor="#eaf1ff"');
    expect(html).toContain('bgcolor="#fff7d9"');
    expect(html).toContain('bgcolor="#ffe9f5"');
    expect(html).toMatch(/background-color:#[0-9a-f]{6}/);
    expect(html).toMatch(/color:#[0-9a-f]{6}/);
    expect(html).not.toContain("oklch(");
    expect(html).not.toContain("<aside");
    expect(html).not.toMatch(/\sclass=/);
    expect(html).not.toMatch(/\sdata-[\w-]+=/);
  });

  it("keeps selected font family and size scoped to textStyle spans", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "기본 " },
            {
              type: "text",
              text: "선택 스타일",
              marks: [
                {
                  type: "textStyle",
                  attrs: {
                    fontFamily: "Georgia, Times New Roman, serif",
                    fontSize: "18px",
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, exportOptions);

    expect(html).toContain(
      `<span style="font-family:${safeDcProseFontFamily("Georgia, Times New Roman, serif")};font-size:18px">선택 스타일</span>`,
    );
    expect(html).toContain(`font-family:${expectedDefaultDcProseFontFamily}`);
    expect(html).toContain("font-size:17px");
    expect(html).toContain(`<td style="padding:18px;background-color:`);
    expect(html).toContain(`font-family:${expectedDefaultDcProseFontFamily};font-size:17px`);
    expect(html).toMatch(
      new RegExp(
        `<table width="100%"[^>]*style="width:100%;margin:0 0 14px;border-collapse:collapse"><tbody><tr><td style="padding:0;color:#[0-9a-f]{6};font-family:${escapeRegExp(expectedDefaultDcProseFontFamily)};font-size:17px;line-height:1\\.72">`,
      ),
    );
  });

  it("keeps markdown-authored long DC table exports below the DC upload limit", async () => {
    const markdown = [
      ":::hero",
      "label: GO CONCURRENCY",
      "Go 동시성 마스터하기: 고루틴과 채널",
      "병렬 처리를 우아하게 구현하는 Go의 동시성 모델을 배우고 실무에 적용하는 가이드",
      ":::",
      "",
      ":::summary",
      "label: 핵심 요약",
      "- `goroutine`은 경량 스레드로 `go` 키워드만으로 실행된다.",
      "- `channel`은 고루틴 간 안전한 데이터 교환을 위한 유일한 통로다.",
      "- 버퍼가 없는 채널은 동기화 도구로, 버퍼가 있는 채널은 비동기 큐로 활용된다.",
      ":::",
      "",
      "## 동시성의 기본 철학",
      "",
      "> Do not communicate by sharing memory; instead, share memory by communicating.",
      "> — Effective Go",
      "",
      "Go는 메모리 공유 대신 **통신을 통한 메모리 공유**를 지향한다.",
      "",
      "---",
      "",
      "## 고루틴",
      "",
      "함수 호출 앞에 `go`를 붙이면 새로운 고루틴이 생성된다.",
      "",
      '```go title="goroutine_basic.go" {4,6}',
      "package main",
      "",
      'import "fmt"',
      "",
      "func main() {",
      '    go fmt.Println("비동기 실행")',
      '    fmt.Println("메인 함수 실행")',
      "    // 고루틴 완료를 보장하지 않으면 메인이 먼저 종료될 수 있다",
      "}",
      "```",
      "",
      ":::tip",
      "label: 고루틴과 OS 스레드",
      "color: #16a34a",
      "고루틴 하나의 초기 스택 크기는 몇 KB에 불과하며, 필요에 따라 동적으로 증가한다.",
      ":::",
      "",
      "---",
      "",
      "## 채널",
      "",
      "채널은 `make(chan T)`로 생성한다. 송수신 연산자인 `<-`를 통해 데이터를 주고받는다.",
      "",
      '```go title="unbuffered_channel.go" {3,7,9}',
      "package main",
      "",
      'import "fmt"',
      "",
      "func main() {",
      "    ch := make(chan string)",
      "",
      "    go func() {",
      '        ch <- "안녕하세요"',
      "    }()",
      "",
      "    msg := <-ch",
      "    fmt.Println(msg)",
      "}",
      "```",
      "",
      ":::warning",
      "label: 주의",
      "color: #d97706",
      "버퍼 없는 채널에서 수신자가 준비되지 않으면 송신자는 블록된다.",
      ":::",
      "",
      "---",
      "",
      "## 버퍼 채널로 생산자-소비자 구현",
      "",
      '```go title="buffered_channel.go" {3,7} add=12 delete=4',
      "package main",
      "",
      'import "fmt"',
      "",
      "func main() {",
      "    jobs := make(chan int, 5)",
      "    done := make(chan bool)",
      "",
      "    go func() {",
      "        for j := range jobs {",
      '            fmt.Println("처리 중:", j)',
      "        }",
      "        done <- true",
      "    }()",
      "",
      "    for i := 1; i <= 3; i++ {",
      "        jobs <- i",
      "    }",
      "    close(jobs)",
      "    <-done",
      "}",
      "```",
      "",
      ":::comparison",
      "Before: 공유 슬라이스에 `sync.Mutex`로 락을 걸고 작업 큐를 구현하던 방식은 락 누락과 성능 저하 위험이 컸다.",
      "After: 버퍼 채널로 큐를 대체하자 코드가 절반으로 줄었고, 경쟁 상태 걱정 없이 안전하게 동작했다.",
      ":::",
      "",
      "---",
      "",
      "## 채널 방향",
      "",
      '```go title="directional_channel.go" {1-2,5}',
      "func sendOnly(ch chan<- int) {",
      "    ch <- 42",
      "}",
      "",
      "func recvOnly(ch <-chan int) {",
      "    val := <-ch",
      "    fmt.Println(val)",
      "}",
      "```",
      "",
      ":::emphasis",
      "label: POINT",
      "color: #9333ea",
      "채널 방향을 함수 시그니처에 명시하면 컴파일 타임에 실수를 잡을 수 있다.",
      ":::",
      "",
      "---",
      "",
      "## select 문",
      "",
      '```go title="select.go" {4,7-10}',
      "select {",
      "case msg1 := <-ch1:",
      '    fmt.Println("ch1:", msg1)',
      "case msg2 := <-ch2:",
      '    fmt.Println("ch2:", msg2)',
      "case <-time.After(1 * time.Second):",
      '    fmt.Println("타임아웃")',
      "default:",
      '    fmt.Println("즉시 실행")',
      "}",
      "```",
      "",
      ":::experiment",
      "label: 실험",
      "color: #4f46e5",
      "5개의 채널을 동시에 기다리는 코드를 `select`와 개별 `if-else`로 비교했다.",
      ":::",
      "",
      "---",
      "",
      "## 실전 패턴: Fan-Out / Fan-In",
      "",
      "여러 워커가 작업을 분산 처리하고 결과를 하나로 모으는 패턴이다.",
      "",
      '```go title="fanout_fanin.go" {6-10,18-22}',
      "func worker(id int, jobs <-chan int, results chan<- int) {",
      "    for j := range jobs {",
      "        results <- j * 2",
      "    }",
      "}",
      "",
      "func main() {",
      "    const numWorkers = 3",
      "    jobs := make(chan int, 10)",
      "    results := make(chan int, 10)",
      "",
      "    for w := 1; w <= numWorkers; w++ {",
      "        go worker(w, jobs, results)",
      "    }",
      "",
      "    for j := 1; j <= 5; j++ {",
      "        jobs <- j",
      "    }",
      "    close(jobs)",
      "",
      "    for r := 1; r <= 5; r++ {",
      "        <-results",
      "    }",
      "}",
      "```",
      "",
      ":::tutorial",
      "- 01 워커 정의: 입력 채널(`<-chan`)과 출력 채널(`chan<-`)을 받는 `worker` 함수를 작성한다.",
      "- 02 워커 풀 생성: `for` 루프로 원하는 수만큼 `go worker(...)`를 실행한다.",
      "- 03 작업 전송: `jobs` 채널에 작업을 보내고 완료되면 `close(jobs)`로 워커에게 종료 신호를 준다.",
      "- 04 결과 수집: `results` 채널에서 기대하는 개수만큼 읽어 들인다.",
      ":::",
      "",
      "---",
      "",
      "## Context로 취소 전파",
      "",
      '```go title="context_cancel.go" {5,9-10}',
      "func doWork(ctx context.Context) {",
      "    for {",
      "        select {",
      "        case <-ctx.Done():",
      "            return",
      "        default:",
      "            // 작업 수행",
      "        }",
      "    }",
      "}",
      "```",
      "",
      ":::success",
      "label: 성공",
      "color: #15803d",
      "context를 사용하면 고루틴이 몇 개든 상관없이 깔끔하게 전파 종료가 가능하다.",
      ":::",
      "",
      ":::failure",
      "label: 실패",
      "color: #dc2626",
      "`done` 채널을 직접 만들어 취소 신호를 전달하다 보면 추적이 불가능해진다.",
      ":::",
      "",
      ":::conclusion",
      "label: 결론",
      "color: #a16207",
      "고루틴과 채널은 Go 동시성의 핵심이다. 버퍼 없는 채널로 동기화하고, 버퍼 채널로 큐를 만들며, select로 다중 채널을 감시하고, context로 생명주기를 관리하라.",
      ":::",
      "",
      ":::rebuttal",
      "label: 반박",
      "color: #db2777",
      '"채널이 만능이다"라는 생각은 위험하다. 단순한 카운터나 캐시 같은 공유 상태는 `sync.Mutex`나 `sync.RWMutex`가 더 낫다.',
      ":::",
      "",
      ":::references",
      "- [A Tour of Go - Concurrency](https://go.dev/tour/concurrency/1)",
      "- [Go by Example: Channels](https://gobyexample.com/channels)",
      "- [Effective Go - Concurrency](https://go.dev/doc/effective_go#concurrency)",
      "- [Go Concurrency Patterns (Pipelines)](https://go.dev/blog/pipelines)",
      ":::",
      "",
      ":::cta",
      "- GitHub: https://github.com/golang/go",
      "- Go Playground: https://go.dev/play/",
      "- 원문: https://go.dev/doc/",
      ":::",
    ].join("\n");
    const document = parseMarkdownToDocument(markdown, { defaultLanguage: "go" });
    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      bodyFontSize: "17px",
      codeFontSize: "15px",
      theme: "catppuccin-mocha",
      includeAttribution: true,
    });

    expect(markdown.length).toBeGreaterThan(3_000);
    expect(markdown.length).toBeLessThan(6_000);
    expect(textOfTestDocument(document).length).toBeGreaterThan(2_500);
    expect(html.length).toBeLessThan(65_535);
    expect(html).toContain("Go 동시성 마스터하기");
    expect(
      html.match(new RegExp(`font-family:${escapeRegExp(expectedDefaultDcProseFontFamily)}`, "g"))
        ?.length ?? 0,
    ).toBeLessThan(50);
    expect(html).toMatch(
      /<strong style="color:#[0-9a-f]{6};font-size:20px;font-weight:700;line-height:1\.35">동시성의 기본 철학<\/strong>/,
    );
    expect(html).toMatch(/<td style="[^"]*"><span style="[^"]*">&bull;<\/span>&nbsp;&nbsp;/);
  }, 20_000);

  it("auto-adjusts selected text colors that would disappear in dark document mode", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "다크모드 안전색",
              marks: [
                {
                  type: "textStyle",
                  attrs: {
                    color: "oklch(10% 0.02 255)",
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      documentTheme: "darkEditorial",
    });
    expect(html).toContain("다크모드 안전색");
    expect(html).not.toContain("color:oklch(10% 0.02 255)");
    expect(html).toMatch(/<span style="color:#[0-9a-f]{6}">다크모드 안전색<\/span>/);
    expect(html).not.toContain("oklch(");
  });

  it("exports CTA button groups with horizontal and vertical table layouts", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "ctaGroup",
          attrs: { layout: "horizontal" },
          content: [
            {
              type: "ctaButton",
              attrs: { href: "https://github.com/0disoft/dc-code-paste" },
              content: [{ type: "text", text: "GitHub" }],
            },
            {
              type: "ctaButton",
              attrs: { href: "https://example.com/source" },
              content: [{ type: "text", text: "원문" }],
            },
          ],
        },
        {
          type: "ctaGroup",
          attrs: { layout: "vertical" },
          content: [
            {
              type: "ctaButton",
              attrs: { href: "https://example.com/download" },
              content: [{ type: "text", text: "다운로드" }],
            },
            {
              type: "ctaButton",
              attrs: { href: "https://example.com/run" },
              content: [{ type: "text", text: "실행하기" }],
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      structure: "dcTable",
    });

    expect(html).toContain("GitHub");
    expect(html).toContain("원문");
    expect(html).toContain("다운로드");
    expect(html).toContain("실행하기");
    expect(html).toContain('href="https://github.com/0disoft/dc-code-paste"');
    expect(html).toContain('href="https://example.com/download"');
    expect(html).toContain("<tr><td");
    expect(html).toContain("border-spacing:0 8px");
    expect(html).toContain("padding:0 8px 8px 0");
    expect(html).not.toMatch(/\sclass=/);
    expect(html).not.toMatch(/\sdata-[\w-]+=/);
    expect(html).not.toMatch(/\son[a-z]+=/i);
  });

  it("exports reference lists as numbered paste-safe link tables", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "referenceList",
          content: [
            {
              type: "referenceItem",
              attrs: { href: "https://example.com/guide" },
              content: [{ type: "text", text: "가이드 원문" }],
            },
            {
              type: "referenceItem",
              attrs: { href: "https://github.com/0disoft/dc-code-paste" },
              content: [{ type: "text", text: "구현 저장소" }],
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      structure: "dcTable",
    });

    expect(html).toContain('bgcolor="#e5f6ff"');
    expect(html).toContain(
      'width="7" height="18" bgcolor="#2478ce" style="width:7px;height:18px;padding:0;background-color:#2478ce;font-size:0;line-height:0"',
    );
    expect(html).toContain('>01</span></td><td width="7" height="18"');
    expect(html).toContain('>02</span></td><td width="7" height="18"');
    expect(html).toContain("가이드 원문");
    expect(html).toContain("구현 저장소");
    expect(html).toContain('href="https://example.com/guide"');
    expect(html).toContain('href="https://github.com/0disoft/dc-code-paste"');
    expect(html).toContain("display:inline-block;margin:0");
    expect(html).toContain("display:inline-table;border-collapse:collapse;vertical-align:middle");
    expect(html).toContain("padding:0;background-color:#2478ce");
    expect(html).toContain("line-height:18px;vertical-align:middle");
    expect(html).toContain('<span style="display:inline-block;height:18px');
    expect(html).toContain("line-height:1.18");
    expect(html).toContain(`font-family:${expectedDefaultDcProseFontFamily};font-size:17px`);
    expect(html).toContain("vertical-align:middle");
    expect(html).toContain("border-left:4px solid");
    expect(html).not.toMatch(/\sclass=/);
    expect(html).not.toMatch(/\sdata-[\w-]+=/);
    expect(html).not.toMatch(/\son[a-z]+=/i);
  });

  it("exports summary boxes as compact bullet blocks", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "summaryBox",
          content: [
            {
              type: "summaryItem",
              content: [{ type: "text", text: "핵심만 먼저 보여준다." }],
            },
            {
              type: "summaryItem",
              content: [{ type: "text", text: "본문은 아래에서 천천히 풀어낸다." }],
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      structure: "dcTable",
    });

    expect(html).toContain('bgcolor="#fbf6e6"');
    expect(html).toContain("핵심 요약");
    expect(html).toContain("핵심만 먼저 보여준다.");
    expect(html).toContain("본문은 아래에서 천천히 풀어낸다.");
    expect(html).toContain("border-top:4px solid");
    expect(html).not.toContain("border-radius:999px");
    expect(html).toContain('<td style="padding:5px 16px');
    expect(html).toContain("&bull;</span>&nbsp;&nbsp;핵심만 먼저 보여준다.");
    expect(html).not.toContain('width="28"');
    expect(html).not.toContain('colspan="2"');
    expect(html).not.toContain("display:block;width:8px;height:8px");
    expect(html).not.toMatch(/\sclass=/);
    expect(html).not.toMatch(/\sdata-[\w-]+=/);
    expect(html).not.toMatch(/\son[a-z]+=/i);
  });

  it("exports custom summary and callout labels", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "summaryBox",
          attrs: { label: "빠른 체크" },
          content: [
            {
              type: "summaryItem",
              content: [{ type: "text", text: "문제 크기를 먼저 본다." }],
            },
          ],
        },
        {
          type: "tipBox",
          attrs: { label: "메모 <중요>" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "cin/cout 설정을 앞에 둔다." }],
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      structure: "dcTable",
    });

    expect(html).toContain("빠른 체크");
    expect(html).toContain("문제 크기를 먼저 본다.");
    expect(html).toContain("메모 &lt;중요&gt;");
    expect(html).toContain("cin/cout 설정을 앞에 둔다.");
    expect(html).toMatch(
      /<span style="display:block;margin:0 0 6px;color:#[0-9a-f]{6};font-size:12px;font-weight:700;letter-spacing:0">메모 &lt;중요&gt;<\/span>/,
    );
    expect(html).not.toContain(">TIP</span>");
    expect(html).not.toContain(">핵심 요약</td>");
  });

  it("exports custom callout colors as DC-safe hex styles", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "tipBox",
          attrs: { label: "메모", toneColor: "#0ea5e9" },
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "색상 피커로 고른 " },
                { type: "text", text: "tone", marks: [{ type: "code" }] },
                { type: "text", text: "을 유지한다." },
              ],
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      structure: "dcTable",
    });

    expect(html).toContain("메모");
    expect(html).toContain('bgcolor="#ddf2fc"');
    expect(html).toContain("border-left:4px solid #0ea5e9");
    expect(html).toContain("background-color:#ddf2fc");
    expect(html).toContain("tone");
    expect(html).not.toContain("oklch(");
    expect(html).not.toMatch(/\sdata-[\w-]+=/);
  });

  it("exports hero blocks as paste-safe title panels", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "heroBlock",
          attrs: { label: "CODEX GUIDE" },
          content: [
            {
              type: "heading",
              attrs: { level: 1 },
              content: [{ type: "text", text: "Codex의 /goal 지시어는 어떻게 쓰는가?" }],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "/goal은 작업을 검증 가능한 완료 계약으로 바꾼다." }],
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      structure: "dcTable",
    });

    expect(html).toContain('bgcolor="#fbf6e6"');
    expect(html).toContain("CODEX GUIDE");
    expect(html).toContain("Codex의 /goal 지시어는 어떻게 쓰는가?");
    expect(html).toContain("/goal은 작업을 검증 가능한 완료 계약으로 바꾼다.");
    expect(html).toMatch(
      /<span style="color:#[0-9a-f]{6};font-size:12px;font-weight:700;line-height:1\.2">CODEX GUIDE<\/span>/,
    );
    expect(html).toContain("border-top:4px solid");
    expect(html).toContain("font-size:28px");
    expect(html).toMatch(
      /CODEX GUIDE[\s\S]*<\/tr><tr>[\s\S]*Codex의 \/goal 지시어는 어떻게 쓰는가\?[\s\S]*<\/tr><tr>[\s\S]*\/goal은 작업을 검증 가능한 완료 계약으로 바꾼다\./,
    );
    expect(html).not.toMatch(/\sclass=/);
    expect(html).not.toMatch(/\sdata-[\w-]+=/);
    expect(html).not.toMatch(/\son[a-z]+=/i);
  });

  it("exports paragraph-first hero blocks without forcing a title style", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "heroBlock",
          attrs: { label: "CODEX GUIDE" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Codex의 /goal 지시어는 어떻게 쓰는가?" }],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "/goal은 작업을 검증 가능한 완료 계약으로 바꾼다." }],
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      structure: "dcTable",
    });

    expect(html).toContain("CODEX GUIDE");
    expect(html).toContain("Codex의 /goal 지시어는 어떻게 쓰는가?");
    expect(html).toContain("/goal은 작업을 검증 가능한 완료 계약으로 바꾼다.");
    expect(html).not.toContain("font-size:30px");
    expect(html).not.toMatch(/<strong[^>]*>Codex의 \/goal 지시어는 어떻게 쓰는가\?<\/strong>/);
    expect(html).toMatch(
      /CODEX GUIDE[\s\S]*<\/tr><tr>[\s\S]*Codex의 \/goal 지시어는 어떻게 쓰는가\?<br>\/goal은 작업을 검증 가능한 완료 계약으로 바꾼다\./,
    );
  });

  it("exports nested hero layout blocks without flattening them into subtitle text", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "heroBlock",
          attrs: { label: "CODING GUIDE" },
          content: [
            {
              type: "comparisonBlock",
              content: [
                {
                  type: "comparisonColumn",
                  attrs: { side: "left", title: "Before" },
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "endl을 반복문 안에서 쓴다." }],
                    },
                  ],
                },
                {
                  type: "comparisonColumn",
                  attrs: { side: "right", title: "After" },
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "\\n으로 출력한다." }],
                    },
                  ],
                },
              ],
            },
            {
              type: "heading",
              attrs: { level: 1 },
              content: [{ type: "text", text: "C++ 입력 최적화" }],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "입출력 병목을 빠르게 찾는다." }],
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      structure: "dcTable",
    });

    expect(html).toContain("C++ 입력 최적화");
    expect(html).toContain("입출력 병목을 빠르게 찾는다.");
    expect(html).toContain("Before");
    expect(html).toContain("After");
    expect(html).toContain("border-collapse:collapse");
    expect(html).not.toContain("강의 노트");
    expect(html).toMatch(/C\+\+ 입력 최적화[\s\S]*입출력 병목을 빠르게 찾는다\.[\s\S]*Before/);
    expect(html).not.toMatch(/입출력 병목을 빠르게 찾는다\.<br>Before/);
    expect(html).not.toMatch(/\sclass=/);
    expect(html).not.toMatch(/\sdata-[\w-]+=/);
  });

  it("exports tutorial blocks as numbered section cards", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "tutorialBlock",
          content: [
            {
              type: "tutorialStep",
              attrs: { title: "문제 파악", number: "04" },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "입력 크기와 반복 횟수를 먼저 본다." }],
                },
              ],
            },
            {
              type: "tutorialStep",
              attrs: { title: "병목 좁히기", number: "05" },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "시간이 튀는 지점만 따로 재본다." }],
                },
              ],
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      structure: "dcTable",
    });

    expect(html).toContain('bgcolor="#ffffff"');
    expect(html).toContain(
      'width="7" height="22" bgcolor="#948163" style="width:7px;height:22px;padding:0;background-color:#948163;font-size:0;line-height:0"',
    );
    expect(html).toContain('>04</span></td><td width="7" height="22"');
    expect(html).toContain('>05</span></td><td width="7" height="22"');
    expect(html).toContain("문제 파악");
    expect(html).toContain("병목 좁히기");
    expect(html).toContain("padding:14px 0 8px 28px");
    expect(html).toContain("padding:14px 16px 8px 0");
    expect(html).toContain("padding:0 16px 14px 0");
    expect(html).toContain("padding:0;background-color:#948163");
    expect(html).toContain("line-height:22px;vertical-align:middle");
    expect(html).toContain('<span style="display:inline-block;height:22px');
    expect(html).toContain("</table></td><td");
    expect(html).not.toContain('colspan="2"');
    expect(html).toContain("입력 크기와 반복 횟수를 먼저 본다.");
    expect(html).toContain("시간이 튀는 지점만 따로 재본다.");
    expect(html).toContain("border-left:4px solid");
    expect(html).not.toMatch(/\sclass=/);
    expect(html).not.toMatch(/\sdata-[\w-]+=/);
    expect(html).not.toMatch(/\son[a-z]+=/i);
  });

  it("exports comparison blocks as two-column paste-safe tables", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "comparisonBlock",
          content: [
            {
              type: "comparisonColumn",
              attrs: { side: "left", title: "잘못된 코드" },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "endl을 반복문 안에서 계속 쓴다." }],
                },
              ],
            },
            {
              type: "comparisonColumn",
              attrs: { side: "right", title: "수정 코드" },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "\\n 출력으로 바꾼다." }],
                },
              ],
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      structure: "dcTable",
    });

    expect(html).toContain('<td width="49%" bgcolor="#fff0ee"');
    expect(html).toContain('<td width="2%" bgcolor="#ffffff"');
    expect(html).toContain('<td width="49%" bgcolor="#e9f9ef"');
    expect(html).toContain('bgcolor="#fff0ee"');
    expect(html).toContain('bgcolor="#e9f9ef"');
    expect(html).toContain("잘못된 코드");
    expect(html).toContain("수정 코드");
    expect(html).toContain("endl을 반복문 안에서 계속 쓴다.");
    expect(html).toContain("\\n 출력으로 바꾼다.");
    expect(html).toContain('<td width="4" bgcolor="#ef4444"');
    expect(html).toContain('<td width="4" bgcolor="#22c55e"');
    expect(html).toContain("table-layout:fixed");
    expect(html).toContain("font-size:0;line-height:0");
    expect(html).not.toMatch(/\sclass=/);
    expect(html).not.toMatch(/\sdata-[\w-]+=/);
    expect(html).not.toMatch(/\son[a-z]+=/i);
  });

  it("adds compact DC-safe fallback stacks to prose and code font declarations", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "폰트 없는 사람도 읽힌다.",
              marks: [
                {
                  type: "textStyle",
                  attrs: {
                    fontFamily: "Pretendard",
                  },
                },
              ],
            },
          ],
        },
        {
          type: "codeBlock",
          attrs: { language: "cpp" },
          content: [{ type: "text", text: "int main() { return 0; }" }],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      bodyFontFamily: "Inter",
    });

    expect(html).toContain(`font-family:${safeDcProseFontFamily("Inter")}`);
    expect(html).toContain(`font-family:${safeDcProseFontFamily("Pretendard")}`);
    expect(html).toContain(`font-family:${safeDcCodeFontFamily()}`);
    expect(html).not.toContain("NanumSquare Neo");
    expect(html).not.toContain("Helvetica Neue");
  }, 15_000);

  it("exports an article canvas so dark DC editor backgrounds do not swallow prose", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "다크모드에서도 보이는 제목" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "본문도 같은 캔버스 위에 있어야 한다." }],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, exportOptions);

    expect(html).toMatch(/^<table width="100%"/);
    expect(html).not.toContain("oklch(");
    expect(html).toContain("padding:18px");
    expect(html).toContain("box-sizing:border-box");
    expect(html).toContain("다크모드에서도 보이는 제목");
  });

  it("can export DC table-compatible structure for stricter paste surfaces", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "테이블 복붙" }],
        },
        {
          type: "tipBox",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "DC가 table 기반 HTML을 더 끈질기게 살린다." }],
            },
          ],
        },
        {
          type: "linkBox",
          attrs: { href: "https://example.com/reference" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "참고 링크" }],
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      structure: "dcTable",
    });

    expect(html).toMatch(
      /^<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff"/,
    );
    expect(html).toContain("<tbody><tr><td");
    expect(html).toContain('bgcolor="#e6fbe4"');
    expect(html).toContain('bgcolor="#e5f6ff"');
    expect(html).toContain("border-collapse:collapse");
    expect(html).toContain("border-left:4px solid");
    expect(html).toContain("테이블 복붙");
    expect(html).toContain("참고 링크");
    expect(html).toContain('href="https://example.com/reference"');
    expect(html).not.toContain("<aside");
    expect(html).not.toMatch(/\sclass=/);
    expect(html).not.toMatch(/\son[a-z]+=/i);
  });

  it("can export a dark editorial document theme with table fallbacks", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "만물큐레이션" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "검은 캔버스에서 읽히는 본문" }],
        },
        {
          type: "sectionHeading",
          content: [{ type: "text", text: "사용 방법 및 예시" }],
        },
        {
          type: "referenceBox",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "인라인 " },
                { type: "text", text: "code", marks: [{ type: "code" }] },
                { type: "text", text: " 색상도 박스에 맞춘다." },
              ],
            },
          ],
        },
        {
          type: "ctaButton",
          attrs: { href: "https://example.com/archive" },
          content: [{ type: "text", text: "아카이브 보기" }],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      documentTheme: "darkEditorial",
      structure: "dcTable",
    });

    expect(html).toMatch(
      /^<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#151515"/,
    );
    expect(html).toMatch(/background-color:#[0-9a-f]{6}/);
    expect(html).toMatch(/color:#[0-9a-f]{6}/);
    expect(html).toContain("만물큐레이션");
    expect(html).toContain("사용 방법 및 예시");
    expect(html).toContain("아카이브 보기");
    expect(html).toContain('href="https://example.com/archive"');
    expect(html).toContain('bgcolor="#1b1b1b"');
    expect(html).toMatch(/background-color:#[0-9a-f]{6}/);
    expect(html).toMatch(/color:#[0-9a-f]{6}/);
    expect(html).not.toContain("oklch(");
    expect(html).not.toMatch(/\sclass=/);
    expect(html).not.toMatch(/\sdata-[\w-]+=/);
    expect(html).not.toMatch(/\son[a-z]+=/i);
  });

  it("keeps blockquotes visually distinct from callout boxes in DC table mode", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "느린 코드는 자료 흐름에서 먼저 걸린다." }],
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      structure: "dcTable",
    });

    expect(html).toContain('bgcolor="#ffffff"');
    expect(html).toContain("&ldquo;");
    expect(html).toContain("font-style:italic");
    expect(html).toMatch(/border:1px solid #[0-9a-f]{6}/);
    expect(html).toContain("느린 코드는 자료 흐름에서 먼저 걸린다.");
    expect(html).not.toContain("TIP");
    expect(html).not.toContain("주의");
    expect(html).not.toContain("REF");
    expect(html).not.toContain("POINT");
    expect(html).not.toContain('bgcolor="#e5f6ff"');
  });

  it("exports quote style variants as distinct paste-safe blocks", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          attrs: { quoteStyle: "literary" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "문학적 인용" }],
            },
          ],
        },
        {
          type: "blockquote",
          attrs: { quoteStyle: "academic" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "논문식 인용" }],
            },
          ],
        },
        {
          type: "blockquote",
          attrs: { quoteStyle: "pull" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "한 줄 강조 인용" }],
            },
          ],
        },
        {
          type: "blockquote",
          attrs: { quoteStyle: "bigQuote" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "큰따옴표 인용" }],
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      structure: "dcTable",
    });

    expect(html).toContain("문학적 인용");
    expect(html).toContain("논문식 인용");
    expect(html).toContain("한 줄 강조 인용");
    expect(html).toContain("큰따옴표 인용");
    expect(html).toContain("&ldquo;");
    expect(html).toContain(">QUOTE</span>");
    expect(html).toContain("font-size:21px");
    expect(html).toContain("text-align:center");
    expect(html).toContain("font-size:56px");
    expect(html).toContain("background-color:transparent");
    expect(html).not.toMatch(/\sdata-[\w-]+=/);
    expect(html).not.toMatch(/\sclass=/);
  });

  it("keeps pull quote tables free of left and right borders", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
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
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      structure: "dcTable",
    });

    expect(html).toContain(
      "느린 코드는 대부분 한 줄짜리 비법보다 입출력 횟수와 자료 흐름에서 먼저 걸린다.",
    );
    expect(html).toContain("border-top:1px solid");
    expect(html).toContain("border-bottom:1px solid");
    expect(html).not.toContain("border-left");
    expect(html).not.toContain("border-right");
    expect(html).not.toContain("border:1px solid");
  });

  it("exports DC paste HTML without app-owned attributes or unsafe links", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 99 },
          content: [{ type: "text", text: "깨지면 안 되는 제목" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "위험한 링크",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
        {
          type: "referenceBox",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "앱 class 없이 inline style만 남긴다." }],
            },
          ],
        },
        {
          type: "linkBox",
          attrs: { href: "javascript:alert(1)" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "위험한 링크 박스" }],
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, exportOptions);

    expect(html).toContain("위험한 링크");
    expect(html).not.toContain("<h99");
    expect(html).toContain("위험한 링크");
    expect(html).toContain("위험한 링크 박스");
    expect(html).not.toContain("javascript:");
    expect(html).not.toMatch(/\sclass=/);
    expect(html).not.toMatch(/\sdata-[\w-]+=/);
    expect(html).not.toMatch(/\son[a-z]+=/i);
    expect(html).not.toMatch(/<script\b/i);
    expect(html).toMatch(/^<table width="100%"/);
  });

  it("does not export URL-only or empty link boxes as duplicated blank paste artifacts", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "linkBox",
          attrs: { href: "https://example.com/reference" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "https://example.com/reference" }],
            },
          ],
        },
        {
          type: "linkBox",
          attrs: { href: "" },
          content: [
            {
              type: "paragraph",
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, exportOptions);

    expect(html).toContain("LINK");
    expect(html).toContain('href="https://example.com/reference"');
    expect(html).toContain(">example.com/reference</a>");
    expect(html).not.toContain(">https://example.com/reference</");
    expect(html.match(/LINK/g)).toHaveLength(1);
  });

  it("exports code block line highlights from code block attrs", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: { language: "javascript", highlightLines: "2,4-5" },
          content: [
            {
              type: "text",
              text: "const a = 1;\nconst b = 2;\nconst c = 3;\nconst d = 4;\nconst e = 5;",
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      showLineNumbers: true,
    });

    expect(html).toContain(">2</span>");
    expect(html).toContain(">5</span>");
    expect(html).toContain(">b</span>");
    expect(html).toContain(">d</span>");
    expect(html).toContain(">e</span>");
    expect(html).toMatch(/background-color:#[0-9a-f]{6}/);
    expect(html).toMatch(/border-left:4px solid #[0-9a-f]{6}/);
    expect(html).not.toContain("oklch(");
  }, 15_000);

  it("exports code block addition and deletion markers from code block attrs", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: { language: "cpp", additionLines: "2", deletionLines: "1" },
          content: [
            {
              type: "text",
              text: "int oldValue = 1;\nint newValue = 2;\nreturn newValue;",
            },
          ],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      showLineNumbers: true,
    });

    expect(html).toContain(">1</span>");
    expect(html).toContain(">2</span>");
    expect(html).toContain("oldValue");
    expect(html).toContain("newValue");
    expect(html.match(/border-left:4px solid #[0-9a-f]{6}/g)).toHaveLength(2);
    expect(html).toMatch(/background-color:#[0-9a-f]{6}/);
    expect(html).not.toContain("oklch(");
  }, 15_000);

  it("exports code block filenames from code block attrs", async () => {
    const document: JSONContent = {
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: { language: "typescript", filename: "vite.config.ts" },
          content: [{ type: "text", text: "export default {};" }],
        },
      ],
    };

    const html = await exportDocumentToDcHtml(document, exportOptions);

    expect(html).toContain("vite.config.ts");
    expect(html).toMatch(/border-bottom:1px solid #[0-9a-f]{6}/);
    expect(html).not.toContain("oklch(");
    expect(html).toContain("export");
  }, 15_000);
});
