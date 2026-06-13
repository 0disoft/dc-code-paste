import { describe, expect, it } from "vitest";
import { highlightCodeTokens } from "../../src/lib/editor/code-block-highlight";

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
});
