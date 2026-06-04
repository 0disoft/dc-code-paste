import { describe, expect, it } from "vitest";
import type { DcLanguageId } from "../../src/lib/highlighter/catalog";
import { highlightForDcHtml } from "../../src/lib/highlighter/shiki-client";

const requestedLanguageSamples = [
  { language: "c", code: "#include <stdio.h>\nint main(void) { return 0; }", token: "stdio" },
  { language: "php", code: "<?php echo strlen('dc');", token: "strlen" },
  { language: "csharp", code: "public class App { static void Main() {} }", token: "class" },
  { language: "haskell", code: 'main = putStrLn "dc"', token: "putStrLn" },
  { language: "scala", code: 'object Main extends App { println("dc") }', token: "object" },
  { language: "zig", code: "pub fn main() void {}", token: "main" },
  { language: "julia", code: 'function main()\n    println("dc")\nend', token: "function" },
  { language: "mojo", code: 'fn main():\n    print("dc")', token: "main" },
] as const satisfies readonly { language: DcLanguageId; code: string; token: string }[];

describe("highlightForDcHtml", () => {
  it("loads the selected Shiki language and theme on demand", async () => {
    const html = await highlightForDcHtml("#include <iostream>\nint main() { return 0; }", {
      language: "cpp",
      theme: "github-dark",
      showBackground: true,
      showLineNumbers: true,
    });

    expect(html).toContain("<pre");
    expect(html).toContain("#include");
    expect(html).toContain("return");
    expect(html).toContain(">2</span>");
    expect(html).toContain("oklch(");
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  }, 15_000);

  it("loads every explicitly requested extra language", async () => {
    for (const sample of requestedLanguageSamples) {
      const html = await highlightForDcHtml(sample.code, {
        language: sample.language,
        theme: "github-dark",
        showBackground: true,
        showLineNumbers: false,
      });

      expect(html).toContain("<pre");
      expect(html).toContain(sample.token);
      expect(html).toContain("oklch(");
      expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  }, 60_000);
});
