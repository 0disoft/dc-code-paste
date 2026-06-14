import { describe, expect, it } from "vitest";
import {
  codeLineDecorations,
  highlightCodeTokens,
} from "../../src/lib/editor/code-block-highlight";

function tokenTexts(code: string, kind: string, language: unknown = "go"): string[] {
  return highlightCodeTokens(code, language)
    .filter((token) => token.kind === kind)
    .map((token) => code.slice(token.from, token.to));
}

describe("editor code block highlighting", () => {
  it("highlights common Go tokens without touching comment contents", () => {
    const code = [
      "package main",
      "",
      'import "fmt"',
      "",
      "func main() {",
      '    go fmt.Println("비동기 실행")',
      "    // go keyword inside comment",
      "}",
    ].join("\n");

    const tokens = highlightCodeTokens(code, "go");

    expect(tokenTexts(code, "keyword")).toEqual(["package", "import", "func", "go"]);
    expect(tokenTexts(code, "string")).toEqual(['"fmt"', '"비동기 실행"']);
    expect(tokenTexts(code, "function")).toEqual(["main", "Println"]);
    expect(tokenTexts(code, "comment")).toEqual(["// go keyword inside comment"]);
    expect(tokens.every((token) => token.to > token.from)).toBe(true);
  });

  it("falls back to C++ token rules for unknown code block languages", () => {
    const code = "int main() { return 0; }";

    expect(tokenTexts(code, "keyword", "unknown")).toEqual(["int", "return"]);
    expect(tokenTexts(code, "function", "unknown")).toEqual(["main"]);
    expect(tokenTexts(code, "number", "unknown")).toEqual(["0"]);
  });

  it("highlights common assembly tokens and semicolon comments", () => {
    const code = ["section .text", "global _start", "_start:", "    mov eax, 1 ; exit"].join("\n");

    expect(tokenTexts(code, "keyword", "asm")).toEqual(["section", "text", "global", "mov"]);
    expect(tokenTexts(code, "number", "asm")).toEqual(["1"]);
    expect(tokenTexts(code, "comment", "asm")).toEqual(["; exit"]);
  });

  it("highlights data and query code block tokens", () => {
    expect(tokenTexts("enabled: true # comment", "keyword", "yaml")).toEqual(["true"]);
    expect(tokenTexts("enabled: true # comment", "comment", "yaml")).toEqual(["# comment"]);
    expect(tokenTexts('name = "dc"\nenabled = false', "keyword", "toml")).toEqual(["false"]);
    expect(tokenTexts("SELECT title FROM posts WHERE id = 1;", "keyword", "sql")).toEqual([
      "SELECT",
      "FROM",
      "WHERE",
    ]);
    expect(tokenTexts("select * from posts -- latest", "comment", "sql")).toEqual(["-- latest"]);
  });

  it("highlights common markdown and mermaid tokens", () => {
    const markdown = ["# 제목", "- 항목", "[문서](https://example.com)"].join("\n");
    const mermaid = ["graph TD", "  A --> B", "%% comment"].join("\n");

    expect(tokenTexts(markdown, "keyword", "markdown")).toEqual(["#", "- "]);
    expect(tokenTexts(markdown, "string", "markdown")).toEqual(["[문서](https://example.com)"]);
    expect(tokenTexts(mermaid, "keyword", "mermaid")).toEqual(["graph"]);
    expect(tokenTexts(mermaid, "comment", "mermaid")).toEqual(["%% comment"]);
  });

  it("uses CSS block comments without treating double slashes as comments", () => {
    const code = [
      "/* color token should stay protected */",
      ".card { color: //not-comment; }",
    ].join("\n");

    expect(tokenTexts(code, "comment", "css")).toEqual(["/* color token should stay protected */"]);
  });

  it("protects single-line C-family block comments", () => {
    const code = "/* int keyword inside comment */ int value = 1;";

    expect(tokenTexts(code, "comment", "cpp")).toEqual(["/* int keyword inside comment */"]);
    expect(tokenTexts(code, "keyword", "cpp")).toEqual(["int"]);
  });

  it("creates editor line decorations for highlight, addition, and deletion lines", () => {
    const code = ["const a = 1;", "const b = 2;", "const c = 3;"].join("\n");

    expect(
      codeLineDecorations(code, {
        highlightLines: "1-3",
        additionLines: "2",
        deletionLines: "3",
      }),
    ).toEqual([
      { from: 0, to: 12, kind: "highlight" },
      { from: 13, to: 25, kind: "addition" },
      { from: 26, to: 38, kind: "deletion" },
    ]);
  });

  it("keeps line decorations for empty code lines", () => {
    const code = ["const a = 1;", "", "const c = 3;"].join("\n");
    const emptyLineOffset = code.indexOf("\n") + 1;

    expect(
      codeLineDecorations(code, {
        additionLines: "2",
      }),
    ).toEqual([{ from: emptyLineOffset, to: emptyLineOffset, kind: "addition", empty: true }]);
  });

  it("lets deletion and addition line decorations override plain highlights", () => {
    const code = ["keep", "add", "delete"].join("\n");

    expect(
      codeLineDecorations(code, {
        highlightLines: "1-3",
        additionLines: "2-3",
        deletionLines: "3",
      }).map((line) => line.kind),
    ).toEqual(["highlight", "addition", "deletion"]);
  });
});
