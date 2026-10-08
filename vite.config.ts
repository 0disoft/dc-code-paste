import { sveltekit } from "@sveltejs/kit/vite";
import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

function shikiGrammarChunk(id: string): string | undefined {
  const normalizedId = id.replaceAll("\\", "/");

  if (normalizedId.includes("/node_modules/@shikijs/langs/dist/cpp-macro.mjs")) {
    return "shiki-lang-cpp-macro";
  }

  if (normalizedId.includes("/node_modules/@shikijs/langs/dist/regexp.mjs")) {
    return "shiki-lang-regexp";
  }

  if (normalizedId.includes("/node_modules/@shikijs/langs/dist/glsl.mjs")) {
    return "shiki-lang-glsl";
  }

  return undefined;
}

export default defineConfig(({ command, isPreview }) => ({
  plugins: [
    sveltekit({
      preprocess: vitePreprocess(),
      adapter: adapter({ fallback: "404.html" }),
      paths: {
        base: (command === "serve" && !isPreview ? "" : process.env.BASE_PATH || "") as
          | ""
          | `/${string}`,
      },
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              debugName: "shiki-grammars",
              name: shikiGrammarChunk,
              test: (id) => shikiGrammarChunk(id) !== undefined,
            },
          ],
        },
      },
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
}));
