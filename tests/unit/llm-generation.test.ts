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
    expect(llmProviders.find((provider) => provider.id === "opencode-go")?.models).toEqual(
      openCodeGoModelIds,
    );
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
      "grok-4.3",
      "grok-4.3-latest",
      "grok-build-0.1",
    ]);
    expect(llmProviders.find((provider) => provider.id === "perplexity")?.models).toEqual([
      "sonar-pro",
      "sonar",
      "sonar-reasoning-pro",
      "sonar-deep-research",
    ]);
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

  it("requests OpenCode Go through its OpenAI-compatible endpoint", async () => {
    const fetcher = vi.fn<MockFetch>(async () =>
      jsonResponse({
        choices: [{ message: { content: "# OpenCode Go 글" } }],
      }),
    );

    const markdown = await requestLlmMarkdown(
      {
        provider: "opencode-go",
        apiKey: "opencode_go-test",
        model: "kimi-k2.6",
        userPrompt: "테스트 글",
        authoringPrompt: "가이드",
      },
      fetcher,
    );

    expect(markdown).toBe("# OpenCode Go 글");
    expect(fetcher).toHaveBeenCalledWith(
      "https://opencode.ai/zen/go/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer opencode_go-test",
        }),
        body: JSON.stringify({
          model: "kimi-k2.6",
          messages: [
            {
              role: "system",
              content:
                "가이드\n\n위 규칙을 우선 적용해서 dc-code-paste Markdown 본문만 작성해라.\n인사말, 확인 질문, 코드펜스 바깥 설명, 사족은 출력하지 마라.\n응답 전체가 Markdown 입력창에 바로 들어갈 수 있어야 한다.",
            },
            { role: "user", content: "테스트 글" },
          ],
          thinking: { type: "disabled" },
          max_tokens: 4500,
          stream: false,
        }),
      }),
    );
  });

  it("requests OpenAI through the Responses API", async () => {
    const fetcher = vi.fn<MockFetch>(async () =>
      jsonResponse({
        output_text: "# OpenAI 글",
      }),
    );

    const markdown = await requestLlmMarkdown(
      {
        provider: "openai",
        apiKey: "sk-test",
        model: "gpt-5.5",
        userPrompt: "테스트 글",
        authoringPrompt: "가이드",
      },
      fetcher,
    );

    expect(markdown).toBe("# OpenAI 글");
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-test",
        }),
        body: JSON.stringify({
          model: "gpt-5.5",
          instructions:
            "가이드\n\n위 규칙을 우선 적용해서 dc-code-paste Markdown 본문만 작성해라.\n인사말, 확인 질문, 코드펜스 바깥 설명, 사족은 출력하지 마라.\n응답 전체가 Markdown 입력창에 바로 들어갈 수 있어야 한다.",
          input: "테스트 글",
        }),
      }),
    );
  });

  it.each([
    {
      provider: "deepseek" as const,
      apiKey: "sk-deepseek-test",
      model: "deepseek-v4-pro",
      endpoint: "https://api.deepseek.com/chat/completions",
      tokenField: "max_tokens",
    },
    {
      provider: "mistral" as const,
      apiKey: "mistral-test",
      model: "mistral-medium-latest",
      endpoint: "https://api.mistral.ai/v1/chat/completions",
      tokenField: "max_tokens",
    },
    {
      provider: "groq" as const,
      apiKey: "gsk_test",
      model: "openai/gpt-oss-120b",
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      tokenField: "max_tokens",
    },
    {
      provider: "cerebras" as const,
      apiKey: "csk-test",
      model: "gpt-oss-120b",
      endpoint: "https://api.cerebras.ai/v1/chat/completions",
      tokenField: "max_completion_tokens",
    },
    {
      provider: "xai" as const,
      apiKey: "xai-test",
      model: "grok-4.3",
      endpoint: "https://api.x.ai/v1/chat/completions",
      tokenField: "max_tokens",
    },
    {
      provider: "perplexity" as const,
      apiKey: "pplx-test",
      model: "sonar-pro",
      endpoint: "https://api.perplexity.ai/chat/completions",
      tokenField: "max_tokens",
    },
  ])("requests $provider through an OpenAI-compatible chat endpoint", async (caseItem) => {
    const fetcher = vi.fn<MockFetch>(async () =>
      jsonResponse({
        choices: [{ message: { content: `# ${caseItem.provider} 글` } }],
      }),
    );

    const markdown = await requestLlmMarkdown(
      {
        provider: caseItem.provider,
        apiKey: caseItem.apiKey,
        model: caseItem.model,
        userPrompt: "테스트 글",
        authoringPrompt: "가이드",
      },
      fetcher,
    );

    expect(markdown).toBe(`# ${caseItem.provider} 글`);
    expect(fetcher).toHaveBeenCalledWith(
      caseItem.endpoint,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: `Bearer ${caseItem.apiKey}`,
        }),
      }),
    );

    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      model: caseItem.model,
      temperature: 0.7,
      stream: false,
      messages: [
        {
          role: "system",
          content:
            "가이드\n\n위 규칙을 우선 적용해서 dc-code-paste Markdown 본문만 작성해라.\n인사말, 확인 질문, 코드펜스 바깥 설명, 사족은 출력하지 마라.\n응답 전체가 Markdown 입력창에 바로 들어갈 수 있어야 한다.",
        },
        { role: "user", content: "테스트 글" },
      ],
      [caseItem.tokenField]: 4500,
    });
  });

  it("extracts Claude text responses", async () => {
    const fetcher = vi.fn<MockFetch>(async () =>
      jsonResponse({
        content: [{ type: "text", text: "# Claude 글" }],
      }),
    );

    await expect(
      requestLlmMarkdown(
        {
          provider: "anthropic",
          apiKey: "sk-ant-test",
          model: "claude-fable-5",
          userPrompt: "테스트 글",
          authoringPrompt: "가이드",
        },
        fetcher,
      ),
    ).resolves.toBe("# Claude 글");
  });

  it("extracts Gemini candidate text responses", async () => {
    const fetcher = vi.fn<MockFetch>(async () =>
      jsonResponse({
        candidates: [{ content: { parts: [{ text: "# Gemini 글" }] } }],
      }),
    );

    await expect(
      requestLlmMarkdown(
        {
          provider: "gemini",
          apiKey: "AIza-test",
          model: "gemini-3.5-flash",
          userPrompt: "테스트 글",
          authoringPrompt: "가이드",
        },
        fetcher,
      ),
    ).resolves.toBe("# Gemini 글");
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
