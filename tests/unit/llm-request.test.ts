import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LlmMarkdownResult, LlmRequestInput } from "$lib/editor/llm-generation";
import { createLlmRequestController, type LlmGenerationState } from "$lib/state/llm-request";

const input = {
  provider: "openrouter",
  apiKey: "test-key",
  model: "test-model",
  userPrompt: "test prompt",
  authoringPrompt: "test guide",
} as const;

function deferred() {
  let resolve!: (result: LlmMarkdownResult) => void;
  const promise = new Promise<LlmMarkdownResult>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function createHarness(request: (input: LlmRequestInput) => Promise<LlmMarkdownResult>) {
  let draft = "original";
  const applyResult = vi.fn<(result: LlmMarkdownResult) => void>((result) => {
    draft = result.markdown;
  });
  const setState = vi.fn<(state: LlmGenerationState) => void>();
  const setError = vi.fn<(error: string) => void>();
  const setInFlight = vi.fn<(inFlight: boolean) => void>();
  const controller = createLlmRequestController({
    getDraft: () => draft,
    applyResult,
    setState,
    setError,
    setInFlight,
    request,
    timeoutMs: 100,
  });
  return { controller, applyResult, setState, setError, setInFlight };
}

describe("LLM request lifecycle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("ignores a cancelled response after a newer request starts", async () => {
    const first = deferred();
    const second = deferred();
    const request = vi
      .fn<(input: LlmRequestInput) => Promise<LlmMarkdownResult>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { controller, applyResult, setState } = createHarness(request);
    const oldRun = controller.generate(input);
    const oldSignal = request.mock.calls[0][0].signal;
    controller.cancel();
    expect(oldSignal?.aborted).toBe(true);

    const newRun = controller.generate(input);
    first.resolve({ markdown: "obsolete", completionState: "complete", finishReason: "stop" });
    await oldRun;
    expect(applyResult).not.toHaveBeenCalled();
    second.resolve({ markdown: "current", completionState: "complete", finishReason: "stop" });
    await newRun;
    expect(applyResult).toHaveBeenCalledOnce();
    expect(applyResult.mock.calls[0][0].markdown).toBe("current");
    expect(setState).toHaveBeenLastCalledWith("ready");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("discards a response when input changes while it is running", async () => {
    const pending = deferred();
    const { controller, applyResult, setState } = createHarness(() => pending.promise);
    const run = controller.generate(input);
    controller.markInputChanged();
    expect(setState).toHaveBeenLastCalledWith("stale");
    pending.resolve({ markdown: "late", completionState: "complete", finishReason: "stop" });
    await run;
    expect(applyResult).not.toHaveBeenCalled();
    expect(setState).toHaveBeenLastCalledWith("idle");
  });

  it("reports timeout and releases the request timer", async () => {
    const { controller, setState, setError } = createHarness(
      ({ signal }) =>
        new Promise((_, reject) => {
          signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
        }),
    );
    const run = controller.generate(input);
    await vi.advanceTimersByTimeAsync(100);
    await run;
    expect(setError).toHaveBeenLastCalledWith("요청 시간이 초과됐습니다. 다시 시도해 주세요.");
    expect(setState).toHaveBeenLastCalledWith("error");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("suppresses callbacks after disposal", async () => {
    const pending = deferred();
    const { controller, applyResult, setState, setInFlight } = createHarness(() => pending.promise);
    const run = controller.generate(input);
    controller.dispose();
    expect(vi.getTimerCount()).toBe(0);
    pending.resolve({ markdown: "late", completionState: "complete", finishReason: "stop" });
    await run;
    expect(applyResult).not.toHaveBeenCalled();
    expect(setState).toHaveBeenCalledExactlyOnceWith("loading");
    expect(setInFlight).toHaveBeenCalledExactlyOnceWith(true);
  });
});
