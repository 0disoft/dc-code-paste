import {
  autocompleteLlmModelOptions,
  llmModelAutocompleteLimit,
  openRouterTopWeeklyModelLimit,
  requestOpenRouterModels,
  type LlmProviderId,
  type OpenRouterModelOption,
  type OpenRouterModelRequestOptions,
} from "$lib/editor/llm-generation";

export type OpenRouterModelState = "idle" | "loading" | "loaded" | "fallback" | "error";

type RequestModels = (
  apiKey: string,
  options: OpenRouterModelRequestOptions,
) => Promise<OpenRouterModelOption[]>;

type LlmModelOptions = {
  getProvider: () => LlmProviderId;
  getApiKey: () => string;
  getTopWeeklyOnly: () => boolean;
  setModels: (models: OpenRouterModelOption[]) => void;
  setState: (state: OpenRouterModelState) => void;
  setError: (error: string) => void;
  setAutocompleteOpen: (open: boolean) => void;
  request?: RequestModels;
};

export function createLlmModelController({
  getProvider,
  getApiKey,
  getTopWeeklyOnly,
  setModels,
  setState,
  setError,
  setAutocompleteOpen,
  request = requestOpenRouterModels,
}: LlmModelOptions) {
  let turn = 0;
  let disposed = false;
  let active: AbortController | undefined;
  let blurTimer: ReturnType<typeof setTimeout> | undefined;

  function isCurrent(currentTurn: number, controller: AbortController) {
    return !disposed && currentTurn === turn && active === controller && !controller.signal.aborted;
  }

  function clearBlurTimer() {
    if (blurTimer !== undefined) clearTimeout(blurTimer);
    blurTimer = undefined;
  }

  function openAutocomplete() {
    if (disposed) return;
    clearBlurTimer();
    setAutocompleteOpen(true);
  }

  function closeAutocomplete() {
    clearBlurTimer();
    if (!disposed) setAutocompleteOpen(false);
  }

  function closeAutocompleteSoon() {
    if (disposed) return;
    clearBlurTimer();
    blurTimer = setTimeout(() => {
      blurTimer = undefined;
      closeAutocomplete();
    }, 120);
  }

  function cancel() {
    turn += 1;
    active?.abort();
    active = undefined;
  }

  function clearError() {
    if (!disposed) setError("");
  }

  async function refresh() {
    cancel();
    if (disposed || getProvider() !== "openrouter") return;

    const currentTurn = turn;
    const controller = new AbortController();
    active = controller;
    const apiKey = getApiKey();
    const limit = getTopWeeklyOnly() ? openRouterTopWeeklyModelLimit : undefined;
    setState("loading");
    setError("");

    try {
      let models: OpenRouterModelOption[];
      let state: "loaded" | "fallback" = "loaded";
      try {
        models = await request(apiKey, { limit, signal: controller.signal });
      } catch (error) {
        if (!apiKey.trim() || !isCurrent(currentTurn, controller)) throw error;
        models = await request("", { limit, signal: controller.signal });
        state = "fallback";
      }
      if (!isCurrent(currentTurn, controller)) return;
      setModels(models);
      setState(models.length > 0 ? state : "error");
      setError(models.length > 0 ? "" : "사용 가능한 모델 없음");
      openAutocomplete();
    } catch (error) {
      if (!isCurrent(currentTurn, controller)) return;
      setState("error");
      setError(
        error instanceof Error ? error.message : "OpenRouter 모델 목록을 불러오지 못했습니다.",
      );
    } finally {
      if (active === controller) active = undefined;
    }
  }

  function autocompleteOptions(
    provider: LlmProviderId,
    providerModels: string[],
    remoteModels: OpenRouterModelOption[],
    query: string,
    topWeeklyOnly: boolean,
  ) {
    const models =
      provider === "openrouter" && remoteModels.length > 0
        ? remoteModels
        : providerModels.map((id) => ({ id, name: id }));
    const showInitialOptions =
      query.trim().length === 0 &&
      models.length > 0 &&
      (provider !== "openrouter" || (topWeeklyOnly && remoteModels.length > 0));
    return autocompleteLlmModelOptions(models, query, {
      limit:
        provider === "openrouter" && showInitialOptions
          ? openRouterTopWeeklyModelLimit
          : llmModelAutocompleteLimit,
      showInitialOptions,
    });
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancel();
    clearBlurTimer();
  }

  return {
    refresh,
    cancel,
    clearError,
    openAutocomplete,
    closeAutocomplete,
    closeAutocompleteSoon,
    autocompleteOptions,
    dispose,
  };
}
