import { sveltekit } from "@sveltejs/kit/vite";
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

export default defineConfig({
  plugins: [sveltekit()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: shikiGrammarChunk,
      },
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
});
