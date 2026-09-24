import {
  requestLlmMarkdown,
  type LlmMarkdownResult,
  type LlmRequestInput,
} from "$lib/editor/llm-generation";

export type LlmGenerationState = "idle" | "loading" | "stale" | "ready" | "incomplete" | "error";

type RequestLlm = (input: LlmRequestInput) => Promise<LlmMarkdownResult>;

type LlmRequestControllerOptions = {
  getDraft: () => string;
  applyResult: (result: LlmMarkdownResult) => void;
  setState: (state: LlmGenerationState) => void;
  setError: (error: string) => void;
  setInFlight: (inFlight: boolean) => void;
  request?: RequestLlm;
  timeoutMs?: number;
};

export function createLlmRequestController({
  getDraft,
  applyResult,
  setState,
  setError,
  setInFlight,
  request = requestLlmMarkdown,
  timeoutMs = 90_000,
}: LlmRequestControllerOptions) {
  let turn = 0;
  let state: LlmGenerationState = "idle";
  let inFlight = false;
  let disposed = false;
  let active: { controller: AbortController; timeoutId: ReturnType<typeof setTimeout> } | undefined;

  function publishState(nextState: LlmGenerationState) {
    state = nextState;
    if (!disposed) setState(nextState);
  }

  function publishError(error: string) {
    if (!disposed) setError(error);
  }

  function finishCurrent(entry: NonNullable<typeof active>) {
    if (active !== entry) return;
    active = undefined;
    inFlight = false;
    if (!disposed) setInFlight(false);
    if (state === "stale") publishState("idle");
  }

  function cancel() {
    turn += 1;
    if (active) {
      clearTimeout(active.timeoutId);
      active.controller.abort();
      active = undefined;
    }
    inFlight = false;
    if (!disposed) {
      setInFlight(false);
      publishState("idle");
      publishError("");
    }
  }

  function markInputChanged() {
    if (disposed) return;
    turn += 1;
    publishError("");
    publishState(inFlight ? "stale" : "idle");
  }

  async function generate(input: Omit<LlmRequestInput, "signal">) {
    if (disposed || inFlight) return;
    const currentTurn = ++turn;
    const draftAtStart = getDraft();
    const controller = new AbortController();
    const entry = {
      controller,
      timeoutId: setTimeout(
        () => controller.abort(new DOMException("LLM request timed out", "TimeoutError")),
        timeoutMs,
      ),
    };
    active = entry;
    inFlight = true;
    setInFlight(true);
    publishState("loading");
    publishError("");

    try {
      const result = await request({ ...input, signal: controller.signal });
      if (
        disposed ||
        currentTurn !== turn ||
        controller.signal.aborted ||
        getDraft() !== draftAtStart
      ) {
        if (currentTurn === turn) publishState("idle");
        return;
      }

      applyResult(result);
      if (result.completionState === "complete") {
        publishState("ready");
      } else {
        publishError(
          result.completionState === "blocked"
            ? `응답이 ${result.finishReason} 사유로 중단됐습니다. 생성된 글을 확인해 주세요.`
            : `응답이 ${result.finishReason} 사유로 끝나 글이 미완성일 수 있습니다. 생성된 글을 확인해 주세요.`,
        );
        publishState("incomplete");
      }
    } catch (error) {
      if (disposed || currentTurn !== turn) return;
      if (
        controller.signal.aborted &&
        controller.signal.reason instanceof Error &&
        controller.signal.reason.name === "TimeoutError"
      ) {
        publishError("요청 시간이 초과됐습니다. 다시 시도해 주세요.");
        publishState("error");
      } else if (
        controller.signal.aborted ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        publishState("idle");
      } else {
        publishError(
          error instanceof TypeError
            ? "네트워크 연결이나 브라우저 요청을 확인해 주세요."
            : error instanceof Error
              ? error.message
              : "응답을 읽지 못했습니다. 다시 시도해 주세요.",
        );
        publishState("error");
      }
    } finally {
      clearTimeout(entry.timeoutId);
      finishCurrent(entry);
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancel();
  }

  return { cancel, markInputChanged, generate, dispose, clearError: () => publishError("") };
}
