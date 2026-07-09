import { describe, expect, it, vi } from "vitest";
import {
  autocompleteLlmModelOptions,
  buildLlmAuthoringMessages,
  llmProviders,
  normalizeGeneratedMarkdown,
  openCodeGoModelIds,
  openRouterTopWeeklyModelLimit,
  requestLlmMarkdown,
  requestOpenRouterModels,
  umansModelIds,
} from "../../src/lib/editor/llm-generation";

type MockFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("llm-generation", () => {
  it("builds a direct authoring prompt", () => {
    const messages = buildLlmAuthoringMessages("LLM guide body", "Go 반복문 글 써줘");

    expect(messages.system).toContain("LLM guide body");
    expect(messages.system).toContain("dc-code-paste Markdown 본문만");
    expect(messages.user).toBe("Go 반복문 글 써줘");
  });

  it("strips a surrounding markdown fence from model output", () => {
    expect(normalizeGeneratedMarkdown("```markdown\n# 제목\n본문\n```")).toBe("# 제목\n본문");
  });

  it("keeps built-in provider model suggestions current", () => {
    expect(openCodeGoModelIds).toEqual([
      "glm-5.2",
      "glm-5.1",
      "kimi-k2.7-code",
      "kimi-k2.6",
      "deepseek-v4-pro",
      "deepseek-v4-flash",
      "mimo-v2.5",
      "mimo-v2.5-pro",
      "minimax-m3",
      "minimax-m2.7",
      "minimax-m2.5",
      "qwen3.7-max",
      "qwen3.7-plus",
      "qwen3.6-plus",
    ]);
    expect(llmProviders.find((provider) => provider.id === "opencode-go")?.models).toEqual(
      openCodeGoModelIds,
    );
    expect(llmProviders.find((provider) => provider.id === "opencode-go")).toMatchObject({
      supportsBrowserGeneration: false,
      browserGenerationBlockedReason: "서버 프록시 필요",
    });
    expect(umansModelIds).toEqual([
      "umans/umans-coder",
      "umans/umans-kimi-k2.7",
      "umans/umans-glm-5.2",
      "umans/umans-flash",
      "umans/umans-qwen3.6-35b-a3b",
      "umans/umans-glm-5.1",
    ]);
    expect(llmProviders.find((provider) => provider.id === "umans")?.models).toEqual(umansModelIds);
    expect(llmProviders.find((provider) => provider.id === "umans")).toMatchObject({
      requiresApiKey: false,
      supportsBrowserGeneration: false,
      browserGenerationBlockedReason: "서버 프록시 필요",
    });
    expect(llmProviders.find((provider) => provider.id === "openai")?.models).toEqual([
      "gpt-5.5",
      "gpt-5.5-pro",
      "gpt-5.4",
      "gpt-5.4-pro",
      "gpt-5.4-mini",
      "gpt-5.4-nano",
    ]);
    expect(llmProviders.find((provider) => provider.id === "anthropic")?.models).toEqual([
      "claude-fable-5",
      "claude-opus-4-8",
      "claude-sonnet-4-6",
      "claude-haiku-4-5",
    ]);
    expect(llmProviders.find((provider) => provider.id === "gemini")?.models).toEqual([
      "gemini-3.5-flash",
      "gemini-3.1-pro-preview",
      "gemini-3.1-flash-lite",
      "gemini-3-flash-preview",
      "gemini-flash-latest",
    ]);
    expect(llmProviders.find((provider) => provider.id === "deepseek")?.models).toEqual([
      "deepseek-v4-pro",
      "deepseek-v4-flash",
      "deepseek-chat",
      "deepseek-reasoner",
    ]);
    expect(llmProviders.find((provider) => provider.id === "mistral")?.models).toEqual([
      "mistral-medium-latest",
      "mistral-large-latest",
      "mistral-small-latest",
      "devstral-latest",
      "devstral-small-latest",
      "magistral-medium-latest",
      "magistral-small-latest",
      "codestral-latest",
    ]);
    expect(llmProviders.find((provider) => provider.id === "groq")?.models).toEqual([
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "qwen/qwen3-32b",
      "meta-llama/llama-4-scout-17b-16e-instruct",
    ]);
    expect(llmProviders.find((provider) => provider.id === "cerebras")?.models).toEqual([
      "gpt-oss-120b",
      "zai-glm-4.7",
    ]);
    expect(llmProviders.find((provider) => provider.id === "xai")?.models).toEqual([
      "grok-4.5",
      "grok-4.5-latest",
    ]);
    expect(llmProviders.find((provider) => provider.id === "perplexity")?.models).toEqual([
      "sonar-pro",
      "sonar",
      "sonar-reasoning-pro",
      "sonar-deep-research",
    ]);
    expect(
      llmProviders
        .filter((provider) =>
          [
            "opencode-go",
            "umans",
            "openai",
            "anthropic",
            "gemini",
            "deepseek",
            "mistral",
            "groq",
            "cerebras",
            "xai",
            "perplexity",
          ].includes(provider.id),
        )
        .every((provider) => provider.supportsBrowserGeneration === false),
    ).toBe(true);
  });

  it("autocompletes model IDs and names after a short query", () => {
    const models = [
      { id: "openai/gpt-4.1-mini", name: "GPT-4.1 Mini" },
      { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5" },
      { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    ];

    expect(autocompleteLlmModelOptions(models, "gpt mini")).toEqual([
      { id: "openai/gpt-4.1-mini", name: "GPT-4.1 Mini" },
    ]);
    expect(autocompleteLlmModelOptions(models, "claude")).toEqual([
      { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5" },
    ]);
    expect(autocompleteLlmModelOptions(models, "g")).toEqual([]);
  });

  it("limits model autocomplete results while preserving ranked order", () => {
    const models = [
      { id: "provider/alpha-1", name: "Alpha 1" },
      { id: "provider/alpha-2", name: "Alpha 2" },
      { id: "provider/alpha-3", name: "Alpha 3" },
    ];

    expect(autocompleteLlmModelOptions(models, "alpha", { limit: 2 })).toEqual([
      { id: "provider/alpha-1", name: "Alpha 1" },
      { id: "provider/alpha-2", name: "Alpha 2" },
    ]);
  });

  it("can show initial ranked model options before the user types", () => {
    const models = [
      { id: "provider/rank-1", name: "Rank 1" },
      { id: "provider/rank-2", name: "Rank 2" },
      { id: "provider/rank-3", name: "Rank 3" },
    ];

    expect(autocompleteLlmModelOptions(models, "")).toEqual([]);
    expect(
      autocompleteLlmModelOptions(models, "", {
        limit: 2,
        showInitialOptions: true,
      }),
    ).toEqual([
      { id: "provider/rank-1", name: "Rank 1" },
      { id: "provider/rank-2", name: "Rank 2" },
    ]);
  });

  it("requests OpenRouter through the OpenAI-compatible endpoint", async () => {
    const fetcher = vi.fn<MockFetch>(async () =>
      jsonResponse({
        choices: [{ message: { content: ":::hero\n제목\n:::" } }],
      }),
    );

    const markdown = await requestLlmMarkdown(
      {
        provider: "openrouter",
        apiKey: "sk-or-v1-test",
        model: "openai/gpt-4.1-mini",
        userPrompt: "테스트 글",
        authoringPrompt: "가이드",
        siteUrl: "https://0disoft.github.io/dc-code-paste/",
        appTitle: "dc-code-paste",
      },
      fetcher,
    );

    expect(markdown).toBe(":::hero\n제목\n:::");
    expect(fetcher).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-or-v1-test",
          "HTTP-Referer": "https://0disoft.github.io/dc-code-paste/",
          "X-Title": "dc-code-paste",
        }),
      }),
    );
  });

  it("blocks provider-native remote calls that require OpenRouter or a proxy", async () => {
    const fetcher = vi.fn<MockFetch>(async () =>
      jsonResponse({
        choices: [{ message: { content: "# 직접 호출 글" } }],
      }),
    );

    await expect(
      requestLlmMarkdown(
        {
          provider: "openai",
          apiKey: "sk-test",
          model: "gpt-5.5",
          userPrompt: "테스트 글",
          authoringPrompt: "가이드",
        },
        fetcher,
      ),
    ).rejects.toThrow("OpenAI 직접 호출은 이 정적 페이지에서 지원하지 않습니다.");

    await expect(
      requestLlmMarkdown(
        {
          provider: "opencode-go",
          apiKey: "opencode_go-test",
          model: "kimi-k2.6",
          userPrompt: "테스트 글",
          authoringPrompt: "가이드",
        },
        fetcher,
      ),
    ).rejects.toThrow("OpenCode Go 직접 호출은 이 정적 페이지에서 지원하지 않습니다.");

    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    "umans",
    "anthropic",
    "gemini",
    "deepseek",
    "mistral",
    "groq",
    "cerebras",
    "xai",
    "perplexity",
  ] as const)("does not fetch for %s native calls from the static app", async (provider) => {
    const fetcher = vi.fn<MockFetch>(async () =>
      jsonResponse({
        choices: [{ message: { content: "# 직접 호출 글" } }],
      }),
    );

    await expect(
      requestLlmMarkdown(
        {
          provider,
          apiKey: "provider-test-key",
          model: "provider-model",
          userPrompt: "테스트 글",
          authoringPrompt: "가이드",
        },
        fetcher,
      ),
    ).rejects.toThrow("직접 호출은 이 정적 페이지에서 지원하지 않습니다.");

    expect(fetcher).not.toHaveBeenCalled();
  });

  it("loads OpenRouter models with the user key when provided", async () => {
    const fetcher = vi.fn<MockFetch>(async () =>
      jsonResponse({
        data: [
          {
            id: "openai/gpt-4.1-mini",
            name: "GPT-4.1 Mini",
            context_length: 1047576,
            architecture: {
              input_modalities: ["text"],
              output_modalities: ["text"],
            },
          },
          {
            id: "google/imagen",
            name: "Imagen",
            architecture: {
              input_modalities: ["text"],
              output_modalities: ["image"],
            },
          },
        ],
      }),
    );

    await expect(requestOpenRouterModels("sk-or-v1-test", {}, fetcher)).resolves.toEqual([
      {
        id: "openai/gpt-4.1-mini",
        name: "GPT-4.1 Mini",
        contextLength: 1047576,
      },
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("https://openrouter.ai/api/v1/models/user?"),
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer sk-or-v1-test" },
      }),
    );
  });

  it("loads public OpenRouter models without a key", async () => {
    const fetcher = vi.fn<MockFetch>(async () =>
      jsonResponse({
        data: [{ id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet" }],
      }),
    );

    await expect(requestOpenRouterModels("", {}, fetcher)).resolves.toEqual([
      {
        id: "anthropic/claude-sonnet-4.5",
        name: "Claude Sonnet",
        contextLength: undefined,
      },
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("https://openrouter.ai/api/v1/models?"),
      {
        method: "GET",
        headers: undefined,
      },
    );
  });

  it("asks OpenRouter for top-weekly ordering", async () => {
    const fetcher = vi.fn<MockFetch>(async () =>
      jsonResponse({
        data: [{ id: "openai/gpt-4.1", name: "GPT-4.1" }],
      }),
    );

    await requestOpenRouterModels("", {}, fetcher);

    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    expect(url.searchParams.get("sort")).toBe("top-weekly");
    expect(url.searchParams.get("output_modalities")).toBe("text");
  });

  it("limits OpenRouter top-weekly models after text filtering while preserving server order", async () => {
    const textModels = Array.from({ length: openRouterTopWeeklyModelLimit + 2 }, (_, index) => ({
      id: `provider/model-${index + 1}`,
      name: `Model ${index + 1}`,
      architecture: {
        input_modalities: ["text"],
        output_modalities: ["text"],
      },
    }));
    const fetcher = vi.fn<MockFetch>(async () =>
      jsonResponse({
        data: [
          {
            id: "image/provider-model",
            name: "Image Model",
            architecture: {
              input_modalities: ["text"],
              output_modalities: ["image"],
            },
          },
          ...textModels,
        ],
      }),
    );

    const models = await requestOpenRouterModels(
      "",
      {
        limit: openRouterTopWeeklyModelLimit,
      },
      fetcher,
    );

    expect(models).toHaveLength(openRouterTopWeeklyModelLimit);
    expect(models.slice(0, 3)).toEqual([
      {
        id: "provider/model-1",
        name: "Model 1",
        contextLength: undefined,
      },
      {
        id: "provider/model-2",
        name: "Model 2",
        contextLength: undefined,
      },
      {
        id: "provider/model-3",
        name: "Model 3",
        contextLength: undefined,
      },
    ]);
    expect(models.at(-1)?.id).toBe(`provider/model-${openRouterTopWeeklyModelLimit}`);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
