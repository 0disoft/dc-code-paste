import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  OpenRouterModelOption,
  OpenRouterModelRequestOptions,
} from "$lib/editor/llm-generation";
import { createLlmModelController, type OpenRouterModelState } from "$lib/state/llm-models";

type RequestModels = (
  apiKey: string,
  options: OpenRouterModelRequestOptions,
) => Promise<OpenRouterModelOption[]>;

function deferred() {
  let resolve!: (value: OpenRouterModelOption[]) => void;
  const promise = new Promise<OpenRouterModelOption[]>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function harness(request: RequestModels) {
  const setModels = vi.fn<(models: OpenRouterModelOption[]) => void>();
  const setState = vi.fn<(state: OpenRouterModelState) => void>();
  const setError = vi.fn<(error: string) => void>();
  const setAutocompleteOpen = vi.fn<(open: boolean) => void>();
  let apiKey = "";
  const controller = createLlmModelController({
    getProvider: () => "openrouter",
    getApiKey: () => apiKey,
    getTopWeeklyOnly: () => true,
    setModels,
    setState,
    setError,
    setAutocompleteOpen,
    request,
  });
  return {
    controller,
    setModels,
    setState,
    setError,
    setAutocompleteOpen,
    setApiKey: (value: string) => {
      apiKey = value;
    },
  };
}

describe("LLM model lookup lifecycle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("aborts an older lookup and publishes only the latest result", async () => {
    const first = deferred();
    const second = deferred();
    const request = vi
      .fn<RequestModels>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { controller, setModels, setState } = harness(request);
    const oldRun = controller.refresh();
    const oldSignal = request.mock.calls[0][1].signal;
    const newRun = controller.refresh();
    expect(oldSignal?.aborted).toBe(true);
    first.resolve([{ id: "old", name: "old" }]);
    await oldRun;
    expect(setModels).not.toHaveBeenCalled();
    second.resolve([{ id: "new", name: "new" }]);
    await newRun;
    expect(setModels).toHaveBeenCalledExactlyOnceWith([{ id: "new", name: "new" }]);
    expect(setState).toHaveBeenLastCalledWith("loaded");
  });

  it("falls back to public models after an authenticated request fails", async () => {
    const request = vi
      .fn<RequestModels>()
      .mockRejectedValueOnce(new Error("unauthorized"))
      .mockResolvedValueOnce([{ id: "public", name: "public" }]);
    const { controller, setApiKey, setModels, setState } = harness(request);
    setApiKey("test-key");
    await controller.refresh();
    expect(request.mock.calls.map(([key]) => key)).toEqual(["test-key", ""]);
    expect(setModels).toHaveBeenCalledExactlyOnceWith([{ id: "public", name: "public" }]);
    expect(setState).toHaveBeenLastCalledWith("fallback");
  });

  it("clears the blur timer and suppresses a late response after disposal", async () => {
    const pending = deferred();
    const request = vi.fn<RequestModels>(() => pending.promise);
    const { controller, setModels, setState, setAutocompleteOpen } = harness(request);
    controller.openAutocomplete();
    controller.closeAutocompleteSoon();
    const run = controller.refresh();
    const signal = request.mock.calls[0][1].signal;
    controller.dispose();
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    pending.resolve([{ id: "late", name: "late" }]);
    await run;
    expect(setModels).not.toHaveBeenCalled();
    expect(setState).toHaveBeenCalledExactlyOnceWith("loading");
    expect(setAutocompleteOpen).toHaveBeenCalledExactlyOnceWith(true);
  });
});
