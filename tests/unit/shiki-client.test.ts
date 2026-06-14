import { describe, expect, it } from "vitest";
import type { DcLanguageId, DcThemeId } from "../../src/lib/highlighter/catalog";
import { highlightForDcHtml } from "../../src/lib/highlighter/shiki-client";

const requestedLanguageSamples = [
  { language: "c", code: "#include <stdio.h>\nint main(void) { return 0; }", token: "stdio" },
  {
    language: "jsx",
    code: 'export function App() { return <main className="p-4">DC</main>; }',
    token: "className",
  },
  {
    language: "tsx",
    code: "type Props = { title: string };\nexport function App(props: Props) { return <h1>{props.title}</h1>; }",
    token: "Props",
  },
  { language: "astro", code: "---\nconst title = 'DC';\n---\n<h1>{title}</h1>", token: "title" },
  {
    language: "tailwind",
    code: '<article class="mx-auto grid max-w-2xl gap-4 text-slate-100">DC</article>',
    token: "max-w-2xl",
  },
  {
    language: "unocss",
    code: '<button class="i-carbon-send rounded-lg px-3 py-2 text-blue-5">DC</button>',
    token: "i-carbon-send",
  },
  { language: "php", code: "<?php echo strlen('dc');", token: "strlen" },
  {
    language: "diff",
    code: "-const oldValue = 1;\n+const newValue = 2;",
    token: "newValue",
  },
  {
    language: "patch",
    code: "@@ -1 +1 @@\n-old\n+new",
    token: "new",
  },
  { language: "csharp", code: "public class App { static void Main() {} }", token: "class" },
  { language: "asm", code: "section .text\nglobal _start\n_start:\n    mov eax, 1", token: "mov" },
  { language: "haskell", code: 'main = putStrLn "dc"', token: "putStrLn" },
  { language: "scala", code: 'object Main extends App { println("dc") }', token: "object" },
  { language: "zig", code: "pub fn main() void {}", token: "main" },
  { language: "julia", code: 'function main()\n    println("dc")\nend', token: "function" },
  { language: "mojo", code: 'fn main():\n    print("dc")', token: "main" },
] as const satisfies readonly { language: DcLanguageId; code: string; token: string }[];

const requestedThemeSamples = [
  "catppuccin-mocha",
  "catppuccin-latte",
  "tokyo-night",
  "kanagawa-wave",
  "rose-pine",
  "github-dark-high-contrast",
] as const satisfies readonly DcThemeId[];

describe("highlightForDcHtml", () => {
  it("loads the selected Shiki language and theme on demand", async () => {
    const html = await highlightForDcHtml("#include <iostream>\nint main() { return 0; }", {
      language: "cpp",
      theme: "github-dark",
      showBackground: true,
      showLineNumbers: true,
    });

    expect(html).not.toContain("<pre");
    expect(html).toContain("#include");
    expect(html).toContain("return");
    expect(html).toContain("</div><div style=");
    expect(html).toContain(">2</span>");
    expect(html).toMatch(/color:#[0-9a-f]{6}/);
    expect(html).not.toContain("oklch(");
  }, 15_000);

  it("loads every explicitly requested extra language", async () => {
    for (const sample of requestedLanguageSamples) {
      const html = await highlightForDcHtml(sample.code, {
        language: sample.language,
        theme: "github-dark",
        showBackground: true,
        showLineNumbers: false,
      });

      expect(html).not.toContain("<pre");
      expect(html).toContain(sample.token);
      expect(html).toMatch(/color:#[0-9a-f]{6}/);
      expect(html).not.toContain("oklch(");
    }
  }, 60_000);

  it("loads added theme choices on demand", async () => {
    for (const selectedTheme of requestedThemeSamples) {
      const html = await highlightForDcHtml("const theme = 'dc';", {
        language: "typescript",
        theme: selectedTheme,
        showBackground: true,
        showLineNumbers: false,
      });

      expect(html).not.toContain("<pre");
      expect(html).toContain("theme");
      expect(html).toMatch(/color:#[0-9a-f]{6}/);
      expect(html).not.toContain("oklch(");
    }
  }, 60_000);

  it("adds diff line colors for patch-style blocks", async () => {
    const html = await highlightForDcHtml("@@ -1 +1 @@\n-old value\n+new value", {
      language: "diff",
      theme: "github-dark",
      showBackground: true,
      showLineNumbers: false,
    });

    expect(html).toContain("old&nbsp;value");
    expect(html).toContain("new&nbsp;value");
    expect(html).toContain("border-left:4px solid");
    expect(html).toMatch(/background-color:#[0-9a-f]{6}/);
    expect(html).not.toContain("oklch(");
  }, 15_000);

  it("adds manual line highlight colors to selected code lines", async () => {
    const html = await highlightForDcHtml("const a = 1;\nconst b = 2;\nconst c = 3;", {
      language: "typescript",
      theme: "github-dark",
      showBackground: true,
      showLineNumbers: true,
      highlightLines: "2",
    });

    expect(html).toContain(">2</span>");
    expect(html).toContain(">b</span>");
    expect(html).toMatch(/background-color:#[0-9a-f]{6}/);
    expect(html).toMatch(/border-left:4px solid #[0-9a-f]{6}/);
    expect(html).not.toContain("oklch(");
  }, 15_000);

  it("adds manual addition and deletion colors to selected code lines", async () => {
    const html = await highlightForDcHtml(
      "int oldValue = 1;\nint newValue = 2;\nreturn newValue;",
      {
        language: "cpp",
        theme: "github-dark",
        showBackground: true,
        showLineNumbers: true,
        additionLines: "2",
        deletionLines: "1",
      },
    );

    expect(html).toContain(">1</span>");
    expect(html).toContain(">2</span>");
    expect(html).toContain("oldValue");
    expect(html).toContain("newValue");
    expect(html.match(/border-left:4px solid #[0-9a-f]{6}/g)).toHaveLength(2);
    expect(html).toMatch(/background-color:#[0-9a-f]{6}/);
    expect(html).not.toContain("oklch(");
  }, 15_000);

  it("renders a filename header for code blocks", async () => {
    const html = await highlightForDcHtml("export const value = 1;", {
      language: "typescript",
      theme: "github-dark",
      showBackground: true,
      showLineNumbers: false,
      filename: "app.ts",
    });

    expect(html).toContain("app.ts");
    expect(html).toMatch(/border-bottom:1px solid #[0-9a-f]{6}/);
    expect(html).not.toContain("<pre");
    expect(html).toContain("export");
    expect(html).not.toContain("oklch(");
  }, 15_000);
});
