import { beforeEach, describe, expect, it, vi } from "vitest";

const { createHighlighterCoreMock } = vi.hoisted(() => ({
  createHighlighterCoreMock: vi.fn<() => Promise<unknown>>(),
}));

vi.mock("shiki/core", () => ({ createHighlighterCore: createHighlighterCoreMock }));

const options = {
  language: "javascript" as const,
  theme: "github-dark" as const,
  showBackground: true,
  showLineNumbers: false,
};

function fakeHighlighter() {
  return {
    getLoadedLanguages: vi.fn<() => string[]>(() => []),
    getLoadedThemes: vi.fn<() => string[]>(() => []),
    loadLanguage: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    loadTheme: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    codeToTokens: vi.fn<() => unknown>(() => ({
      tokens: [[{ content: "code", color: "#ffffff" }]],
      bg: "#000000",
      fg: "#ffffff",
    })),
  };
}

describe("Shiki initialization recovery", () => {
  beforeEach(() => {
    vi.resetModules();
    createHighlighterCoreMock.mockReset();
  });

  it("retries core initialization after a shared failed attempt", async () => {
    const highlighter = fakeHighlighter();
    createHighlighterCoreMock
      .mockRejectedValueOnce(new Error("engine load failed"))
      .mockResolvedValueOnce(highlighter);
    const { highlightForDcHtml } = await import("$lib/highlighter/shiki-client");

    const first = highlightForDcHtml("code", options);
    const concurrent = highlightForDcHtml("code", options);
    await expect(first).rejects.toThrow("engine load failed");
    await expect(concurrent).rejects.toThrow("engine load failed");
    expect(createHighlighterCoreMock).toHaveBeenCalledOnce();

    await expect(highlightForDcHtml("code", options)).resolves.toContain("code");
    expect(createHighlighterCoreMock).toHaveBeenCalledTimes(2);
  });

  it("retries a language chunk after its first load fails", async () => {
    const highlighter = fakeHighlighter();
    highlighter.loadLanguage.mockRejectedValueOnce(new Error("language chunk failed"));
    createHighlighterCoreMock.mockResolvedValue(highlighter);
    const { highlightForDcHtml } = await import("$lib/highlighter/shiki-client");

    await expect(highlightForDcHtml("code", options)).rejects.toThrow("language chunk failed");
    await expect(highlightForDcHtml("code", options)).resolves.toContain("code");
    expect(highlighter.loadLanguage).toHaveBeenCalledTimes(2);
  });

  it("retries a theme chunk after its first load fails", async () => {
    const highlighter = fakeHighlighter();
    highlighter.loadTheme.mockRejectedValueOnce(new Error("theme chunk failed"));
    createHighlighterCoreMock.mockResolvedValue(highlighter);
    const { highlightForDcHtml } = await import("$lib/highlighter/shiki-client");

    await expect(highlightForDcHtml("code", options)).rejects.toThrow("theme chunk failed");
    await expect(highlightForDcHtml("code", options)).resolves.toContain("code");
    expect(highlighter.loadTheme).toHaveBeenCalledTimes(2);
  });
});
