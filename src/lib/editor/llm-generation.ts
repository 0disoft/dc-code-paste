export type LlmProviderId =
  | "openai"
  | "anthropic"
  | "gemini"
  | "openrouter"
  | "opencode-go"
  | "umans"
  | "deepseek"
  | "mistral"
  | "groq"
  | "cerebras"
  | "xai"
  | "perplexity";

export type LlmProviderDefinition = {
  id: LlmProviderId;
  label: string;
  models: string[];
  apiKeyPlaceholder: string;
  requiresApiKey?: boolean;
  supportsBrowserGeneration?: boolean;
  browserGenerationBlockedReason?: string;
};

export type LlmRequestInput = {
  provider: LlmProviderId;
  apiKey: string;
  model: string;
  userPrompt: string;
  authoringPrompt: string;
  siteUrl?: string;
  appTitle?: string;
};

export type OpenRouterModelOption = {
  id: string;
  name: string;
  contextLength?: number;
};

export type OpenRouterModelRequestOptions = {
  limit?: number;
};

export type LlmModelAutocompleteOption = {
  id: string;
  name?: string;
};

type LlmFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type OpenAiCompatibleChatOptions = {
  endpoint: string;
  maxTokenField?: "max_tokens" | "max_completion_tokens";
  extraHeaders?: Record<string, string>;
  extraBody?: Record<string, unknown>;
};

export const openCodeGoModelIds = [
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
];

const openCodeGoMessagesModelIds = new Set([
  "minimax-m3",
  "minimax-m2.7",
  "minimax-m2.5",
  "qwen3.7-max",
  "qwen3.7-plus",
  "qwen3.6-plus",
]);

export const umansModelIds = [
  "umans/umans-coder",
  "umans/umans-kimi-k2.7",
  "umans/umans-glm-5.2",
  "umans/umans-flash",
  "umans/umans-qwen3.6-35b-a3b",
  "umans/umans-glm-5.1",
];

export const llmProviders: LlmProviderDefinition[] = [
  {
    id: "openrouter",
    label: "OpenRouter",
    models: [
      "openai/gpt-5.5",
      "anthropic/claude-fable-5",
      "google/gemini-3.5-flash",
      "deepseek/deepseek-chat",
    ],
    apiKeyPlaceholder: "sk-or-v1-...",
  },
  {
    id: "opencode-go",
    label: "OpenCode Go",
    models: openCodeGoModelIds,
    apiKeyPlaceholder: "opencode_go...",
    supportsBrowserGeneration: false,
    browserGenerationBlockedReason: "서버 프록시 필요",
  },
  {
    id: "umans",
    label: "Umans",
    models: umansModelIds,
    apiKeyPlaceholder: "선택 사항",
    requiresApiKey: false,
    supportsBrowserGeneration: false,
    browserGenerationBlockedReason: "서버 프록시 필요",
  },
  {
    id: "openai",
    label: "OpenAI",
    models: ["gpt-5.5", "gpt-5.5-pro", "gpt-5.4", "gpt-5.4-pro", "gpt-5.4-mini", "gpt-5.4-nano"],
    apiKeyPlaceholder: "sk-...",
    supportsBrowserGeneration: false,
    browserGenerationBlockedReason: "OpenRouter 또는 프록시 필요",
  },
  {
    id: "anthropic",
    label: "Claude",
    models: ["claude-fable-5", "claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5"],
    apiKeyPlaceholder: "sk-ant-...",
    supportsBrowserGeneration: false,
    browserGenerationBlockedReason: "OpenRouter 또는 프록시 필요",
  },
  {
    id: "gemini",
    label: "Gemini",
    models: [
      "gemini-3.5-flash",
      "gemini-3.1-pro-preview",
      "gemini-3.1-flash-lite",
      "gemini-3-flash-preview",
      "gemini-flash-latest",
    ],
    apiKeyPlaceholder: "AIza...",
    supportsBrowserGeneration: false,
    browserGenerationBlockedReason: "OpenRouter 또는 프록시 필요",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    models: ["deepseek-v4-pro", "deepseek-v4-flash", "deepseek-chat", "deepseek-reasoner"],
    apiKeyPlaceholder: "sk-...",
    supportsBrowserGeneration: false,
    browserGenerationBlockedReason: "OpenRouter 또는 프록시 필요",
  },
  {
    id: "mistral",
    label: "Mistral",
    models: [
      "mistral-medium-latest",
      "mistral-large-latest",
      "mistral-small-latest",
      "devstral-latest",
      "devstral-small-latest",
      "magistral-medium-latest",
      "magistral-small-latest",
      "codestral-latest",
    ],
    apiKeyPlaceholder: "...",
    supportsBrowserGeneration: false,
    browserGenerationBlockedReason: "OpenRouter 또는 프록시 필요",
  },
  {
    id: "groq",
    label: "Groq",
    models: [
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "qwen/qwen3-32b",
      "meta-llama/llama-4-scout-17b-16e-instruct",
    ],
    apiKeyPlaceholder: "gsk_...",
    supportsBrowserGeneration: false,
    browserGenerationBlockedReason: "OpenRouter 또는 프록시 필요",
  },
  {
    id: "cerebras",
    label: "Cerebras",
    models: ["gpt-oss-120b", "zai-glm-4.7"],
    apiKeyPlaceholder: "csk-...",
    supportsBrowserGeneration: false,
    browserGenerationBlockedReason: "OpenRouter 또는 프록시 필요",
  },
  {
    id: "xai",
    label: "xAI",
    models: ["grok-4.5", "grok-4.5-latest"],
    apiKeyPlaceholder: "xai-...",
    supportsBrowserGeneration: false,
    browserGenerationBlockedReason: "OpenRouter 또는 프록시 필요",
  },
  {
    id: "perplexity",
    label: "Perplexity",
    models: ["sonar-pro", "sonar", "sonar-reasoning-pro", "sonar-deep-research"],
    apiKeyPlaceholder: "pplx-...",
    supportsBrowserGeneration: false,
    browserGenerationBlockedReason: "OpenRouter 또는 프록시 필요",
  },
];

export const defaultLlmProviderId: LlmProviderId = "openrouter";

export function defaultModelForProvider(providerId: LlmProviderId) {
  return (
    llmProviders.find((provider) => provider.id === providerId)?.models[0] ??
    llmProviders[0].models[0]
  );
}

export function providerDefinition(providerId: LlmProviderId) {
  return llmProviders.find((provider) => provider.id === providerId) ?? llmProviders[0];
}

export function normalizeGeneratedMarkdown(value: string) {
  const trimmed = value.trim();
  const fenced = /^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i.exec(trimmed);

  return fenced?.[1]?.trim() ?? trimmed;
}

export function buildLlmAuthoringMessages(authoringPrompt: string, userPrompt: string) {
  return {
    system: [
      authoringPrompt.trim(),
      "",
      "위 규칙을 우선 적용해서 dc-code-paste Markdown 본문만 작성해라.",
      "인사말, 확인 질문, 코드펜스 바깥 설명, 사족은 출력하지 마라.",
      "응답 전체가 Markdown 입력창에 바로 들어갈 수 있어야 한다.",
    ].join("\n"),
    user: userPrompt.trim(),
  };
}

export const openRouterTopWeeklyModelLimit = 80;
export const llmModelAutocompleteMinQueryLength = 2;
export const llmModelAutocompleteLimit = 8;

export async function requestLlmMarkdown(
  input: LlmRequestInput,
  fetcher: LlmFetch = globalThis.fetch.bind(globalThis),
) {
  const apiKey = input.apiKey.trim();
  const model = input.model.trim();
  const userPrompt = input.userPrompt.trim();
  const provider = providerDefinition(input.provider);
  const requiresApiKey = provider.requiresApiKey !== false;

  if (provider.supportsBrowserGeneration === false) {
    throw new Error(
      `${provider.label} 직접 호출은 이 정적 페이지에서 지원하지 않습니다. ${
        provider.browserGenerationBlockedReason ?? "서버 프록시가 필요합니다."
      }`,
    );
  }

  if ((requiresApiKey && !apiKey) || !model || !userPrompt) {
    throw new Error(
      requiresApiKey
        ? "API 키, 모델, 요청을 모두 입력해야 합니다."
        : "모델과 요청을 모두 입력해야 합니다.",
    );
  }

  const messages = buildLlmAuthoringMessages(input.authoringPrompt, userPrompt);

  const raw =
    input.provider === "anthropic"
      ? await requestAnthropic(input, messages, fetcher)
      : input.provider === "gemini"
        ? await requestGemini(input, messages, fetcher)
        : input.provider === "openai"
          ? await requestOpenAi(input, messages, fetcher)
          : input.provider === "opencode-go"
            ? await requestOpenCodeGo(input, messages, fetcher)
            : input.provider === "umans"
              ? await requestUmans(input, messages, fetcher)
              : input.provider === "openrouter"
                ? await requestOpenRouter(input, messages, fetcher)
                : await requestOpenAiCompatibleChat(input, messages, fetcher);

  const markdown = normalizeGeneratedMarkdown(raw);

  if (!markdown) {
    throw new Error("LLM 응답이 비어 있습니다.");
  }

  return markdown;
}

export async function requestOpenRouterModels(
  apiKey = "",
  options: OpenRouterModelRequestOptions = {},
  fetcher: LlmFetch = globalThis.fetch.bind(globalThis),
) {
  const trimmedKey = apiKey.trim();
  const url = new URL(
    trimmedKey ? "https://openrouter.ai/api/v1/models/user" : "https://openrouter.ai/api/v1/models",
  );
  url.searchParams.set("output_modalities", "text");
  url.searchParams.set("sort", "top-weekly");

  const response = await fetcher(url.toString(), {
    method: "GET",
    headers: trimmedKey ? { Authorization: `Bearer ${trimmedKey}` } : undefined,
  });

  const payload = await readJsonResponse(response);
  return extractOpenRouterModels(payload, options);
}

export function autocompleteLlmModelOptions(
  models: LlmModelAutocompleteOption[],
  query: string,
  options: {
    limit?: number;
    minQueryLength?: number;
    showInitialOptions?: boolean;
  } = {},
) {
  const minQueryLength = options.minQueryLength ?? llmModelAutocompleteMinQueryLength;
  const limit = options.limit ?? llmModelAutocompleteLimit;
  const normalizedQuery = normalizeAutocompleteText(query);

  if (limit <= 0) {
    return [];
  }

  if (normalizedQuery.length === 0) {
    return options.showInitialOptions
      ? models
          .map((model) => {
            const id = model.id.trim();
            const name = model.name?.trim() || id;

            return id ? { id, name } : null;
          })
          .filter((model): model is { id: string; name: string } => model !== null)
          .slice(0, limit)
      : [];
  }

  if (normalizedQuery.length < minQueryLength) {
    return [];
  }

  const queryParts = normalizedQuery.split(" ").filter(Boolean);

  return models
    .map((model, index) => {
      const id = model.id.trim();
      const name = model.name?.trim() || id;
      const haystack = normalizeAutocompleteText(`${id} ${name}`);

      if (queryParts.some((part) => !haystack.includes(part))) {
        return null;
      }

      const normalizedId = normalizeAutocompleteText(id);
      const normalizedName = normalizeAutocompleteText(name);
      const startsWithQuery =
        normalizedId.startsWith(normalizedQuery) || normalizedName.startsWith(normalizedQuery);
      const wordStartsWithQuery = haystack
        .split(" ")
        .some((word) => word.startsWith(normalizedQuery));

      return {
        id,
        name,
        index,
        score: startsWithQuery ? 0 : wordStartsWithQuery ? 1 : 2,
      };
    })
    .filter(
      (model): model is { id: string; name: string; index: number; score: number } =>
        model !== null,
    )
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .slice(0, limit)
    .map(({ id, name }) => ({ id, name }));
}

async function requestOpenRouter(
  input: LlmRequestInput,
  messages: ReturnType<typeof buildLlmAuthoringMessages>,
  fetcher: LlmFetch,
) {
  const response = await fetcher("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey.trim()}`,
      "HTTP-Referer": input.siteUrl ?? "https://0disoft.github.io/dc-code-paste/",
      "X-Title": input.appTitle ?? "dc-code-paste",
    },
    body: JSON.stringify({
      model: input.model.trim(),
      temperature: 0.7,
      messages: [
        { role: "system", content: messages.system },
        { role: "user", content: messages.user },
      ],
    }),
  });

  const payload = await readJsonResponse(response);
  return extractOpenAiCompatibleText(payload);
}

async function requestOpenCodeGo(
  input: LlmRequestInput,
  messages: ReturnType<typeof buildLlmAuthoringMessages>,
  fetcher: LlmFetch,
) {
  if (openCodeGoMessagesModelIds.has(input.model.trim())) {
    return requestOpenCodeGoMessages(input, messages, fetcher);
  }

  const response = await fetcher("https://opencode.ai/zen/go/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: input.model.trim(),
      messages: [
        { role: "system", content: messages.system },
        { role: "user", content: messages.user },
      ],
      thinking: { type: "disabled" },
      max_tokens: 4500,
      stream: false,
    }),
  });

  const payload = await readJsonResponse(response);
  return extractOpenAiCompatibleText(payload);
}

async function requestOpenCodeGoMessages(
  input: LlmRequestInput,
  messages: ReturnType<typeof buildLlmAuthoringMessages>,
  fetcher: LlmFetch,
) {
  const response = await fetcher("https://opencode.ai/zen/go/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: input.model.trim(),
      max_tokens: 4500,
      system: messages.system,
      messages: [{ role: "user", content: messages.user }],
    }),
  });

  const payload = await readJsonResponse(response);
  return extractAnthropicText(payload);
}

async function requestOpenAi(
  input: LlmRequestInput,
  messages: ReturnType<typeof buildLlmAuthoringMessages>,
  fetcher: LlmFetch,
) {
  return requestOpenAiCompatibleResponses(
    input,
    messages,
    fetcher,
    "https://api.openai.com/v1/responses",
  );
}

async function requestUmans(
  input: LlmRequestInput,
  messages: ReturnType<typeof buildLlmAuthoringMessages>,
  fetcher: LlmFetch,
) {
  return requestOpenAiCompatibleResponses(
    input,
    messages,
    fetcher,
    "http://127.0.0.1:8789/v1/responses",
  );
}

async function requestOpenAiCompatibleResponses(
  input: LlmRequestInput,
  messages: ReturnType<typeof buildLlmAuthoringMessages>,
  fetcher: LlmFetch,
  endpoint: string,
) {
  const response = await fetcher(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authorizationHeader(input.apiKey),
    },
    body: JSON.stringify({
      model: input.model.trim(),
      instructions: messages.system,
      input: messages.user,
    }),
  });

  const payload = await readJsonResponse(response);
  return extractOpenAiResponseText(payload);
}

function authorizationHeader(apiKey: string): Record<string, string> {
  const trimmedKey = apiKey.trim();

  return trimmedKey ? { Authorization: `Bearer ${trimmedKey}` } : {};
}

function openAiCompatibleChatOptions(provider: LlmProviderId): OpenAiCompatibleChatOptions {
  switch (provider) {
    case "deepseek":
      return {
        endpoint: "https://api.deepseek.com/chat/completions",
        maxTokenField: "max_tokens",
      };
    case "mistral":
      return {
        endpoint: "https://api.mistral.ai/v1/chat/completions",
        maxTokenField: "max_tokens",
      };
    case "groq":
      return {
        endpoint: "https://api.groq.com/openai/v1/chat/completions",
        maxTokenField: "max_tokens",
      };
    case "cerebras":
      return {
        endpoint: "https://api.cerebras.ai/v1/chat/completions",
        maxTokenField: "max_completion_tokens",
      };
    case "xai":
      return {
        endpoint: "https://api.x.ai/v1/chat/completions",
        maxTokenField: "max_tokens",
      };
    case "perplexity":
      return {
        endpoint: "https://api.perplexity.ai/chat/completions",
        maxTokenField: "max_tokens",
      };
    default:
      throw new Error("지원하지 않는 LLM 제공자입니다.");
  }
}

async function requestOpenAiCompatibleChat(
  input: LlmRequestInput,
  messages: ReturnType<typeof buildLlmAuthoringMessages>,
  fetcher: LlmFetch,
) {
  const options = openAiCompatibleChatOptions(input.provider);
  const body: Record<string, unknown> = {
    model: input.model.trim(),
    temperature: 0.7,
    stream: false,
    messages: [
      { role: "system", content: messages.system },
      { role: "user", content: messages.user },
    ],
    ...options.extraBody,
  };

  if (options.maxTokenField) {
    body[options.maxTokenField] = 4500;
  }

  const response = await fetcher(options.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey.trim()}`,
      ...options.extraHeaders,
    },
    body: JSON.stringify(body),
  });

  const payload = await readJsonResponse(response);
  return extractOpenAiCompatibleText(payload);
}

async function requestAnthropic(
  input: LlmRequestInput,
  messages: ReturnType<typeof buildLlmAuthoringMessages>,
  fetcher: LlmFetch,
) {
  const response = await fetcher("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": input.apiKey.trim(),
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: input.model.trim(),
      max_tokens: 4500,
      temperature: 0.7,
      system: messages.system,
      messages: [{ role: "user", content: messages.user }],
    }),
  });

  const payload = await readJsonResponse(response);
  return extractAnthropicText(payload);
}

async function requestGemini(
  input: LlmRequestInput,
  messages: ReturnType<typeof buildLlmAuthoringMessages>,
  fetcher: LlmFetch,
) {
  const model = input.model.trim().replace(/^models\//, "");
  const response = await fetcher(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model,
    )}:generateContent?key=${encodeURIComponent(input.apiKey.trim())}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: messages.system }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: messages.user }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
        },
      }),
    },
  );

  const payload = await readJsonResponse(response);
  return extractGeminiText(payload);
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(`LLM 요청 실패 (${response.status}): ${summarizeErrorPayload(payload)}`);
  }

  return payload;
}

function summarizeErrorPayload(payload: unknown) {
  if (!isRecord(payload)) {
    return "응답을 확인할 수 없습니다.";
  }

  const error = payload.error;

  if (typeof error === "string") {
    return error;
  }

  if (isRecord(error)) {
    if (typeof error.message === "string") {
      return error.message;
    }

    if (typeof error.type === "string") {
      return error.type;
    }
  }

  if (typeof payload.message === "string") {
    return payload.message;
  }

  return "키, 모델명, 제공자 설정을 확인해 주세요.";
}

function extractOpenAiCompatibleText(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) {
    throw new Error("LLM 응답 형식을 읽을 수 없습니다.");
  }

  const firstChoice = payload.choices[0];
  const message = isRecord(firstChoice) ? firstChoice.message : undefined;
  const content = isRecord(message) ? message.content : undefined;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : ""))
      .join("");
  }

  throw new Error("LLM 응답 본문이 비어 있습니다.");
}

function extractOpenAiResponseText(payload: unknown) {
  if (!isRecord(payload)) {
    throw new Error("OpenAI 응답 형식을 읽을 수 없습니다.");
  }

  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }

  if (!Array.isArray(payload.output)) {
    throw new Error("OpenAI 응답 본문이 비어 있습니다.");
  }

  const text = payload.output
    .flatMap((item) => (isRecord(item) && Array.isArray(item.content) ? item.content : []))
    .map((part) => {
      if (!isRecord(part)) {
        return "";
      }

      if (typeof part.text === "string") {
        return part.text;
      }

      if (typeof part.output_text === "string") {
        return part.output_text;
      }

      return "";
    })
    .join("");

  if (!text) {
    throw new Error("OpenAI 응답 본문이 비어 있습니다.");
  }

  return text;
}

function extractAnthropicText(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.content)) {
    throw new Error("Claude 응답 형식을 읽을 수 없습니다.");
  }

  const text = payload.content
    .map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : ""))
    .join("");

  if (!text) {
    throw new Error("Claude 응답 본문이 비어 있습니다.");
  }

  return text;
}

function extractGeminiText(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.candidates)) {
    throw new Error("Gemini 응답 형식을 읽을 수 없습니다.");
  }

  const firstCandidate = payload.candidates[0];
  const content = isRecord(firstCandidate) ? firstCandidate.content : undefined;
  const parts = isRecord(content) ? content.parts : undefined;

  if (!Array.isArray(parts)) {
    throw new Error("Gemini 응답 본문이 비어 있습니다.");
  }

  const text = parts
    .map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : ""))
    .join("");

  if (!text) {
    throw new Error("Gemini 응답 본문이 비어 있습니다.");
  }

  return text;
}

function extractOpenRouterModels(
  payload: unknown,
  options: OpenRouterModelRequestOptions = {},
): OpenRouterModelOption[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new Error("OpenRouter 모델 목록 형식을 읽을 수 없습니다.");
  }

  const models = payload.data
    .map((item): OpenRouterModelOption | null => {
      if (!isRecord(item) || typeof item.id !== "string") {
        return null;
      }

      const architecture = isRecord(item.architecture) ? item.architecture : {};
      const inputModalities = Array.isArray(architecture.input_modalities)
        ? architecture.input_modalities
        : [];
      const outputModalities = Array.isArray(architecture.output_modalities)
        ? architecture.output_modalities
        : [];

      if (inputModalities.length > 0 && !inputModalities.includes("text")) {
        return null;
      }

      if (outputModalities.length > 0 && !outputModalities.includes("text")) {
        return null;
      }

      return {
        id: item.id,
        name: typeof item.name === "string" ? item.name : item.id,
        contextLength: typeof item.context_length === "number" ? item.context_length : undefined,
      };
    })
    .filter((model): model is OpenRouterModelOption => model !== null);

  return typeof options.limit === "number" ? models.slice(0, Math.max(0, options.limit)) : models;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeAutocompleteText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[/:._-]+/g, " ")
    .replace(/\s+/g, " ");
}
