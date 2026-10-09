import type { JSONContent } from "@tiptap/core";

import { copyDcHtmlWhenReady, copyPlainText } from "#lib/dc/clipboard.ts";
import { exportDocumentToDcHtml, type DcExportOptions } from "#lib/dc/export-document.ts";

type RenderDocument = (document: JSONContent, options: DcExportOptions) => Promise<string>;

export type WorkspaceCopyState = "idle" | "copied" | "error" | "render-error";

type PreviewRendererOptions = {
  debounceMs: number;
  renderDocument?: RenderDocument;
  setHtml: (html: string) => void;
  setIsRendering: (isRendering: boolean) => void;
  setError: (error: string) => void;
};

type CopyStateOptions = {
  setState: (state: WorkspaceCopyState) => void;
  onCopied?: (html: string) => void;
  resetDelayMs?: number;
  scheduleReset?: (setState: (state: WorkspaceCopyState) => void, delayMs: number) => void;
};

type CopyDcPreviewOptions = CopyStateOptions & {
  document: JSONContent;
  exportOptions: DcExportOptions;
  renderDocument?: RenderDocument;
  plainText: string;
  isCurrent: () => boolean;
  setManualHtml: (html: string) => void;
};

type CopySourceHtmlOptions = CopyStateOptions & {
  html: string;
};

type CopyPlainTextOptions = CopyStateOptions & {
  text: string;
};

const defaultCopyResetDelayMs = 1300;

function scheduleCopiedStateReset({
  setState,
  resetDelayMs = defaultCopyResetDelayMs,
  scheduleReset,
}: CopyStateOptions) {
  if (scheduleReset) {
    scheduleReset(setState, resetDelayMs);
    return;
  }
  setTimeout(() => {
    setState("idle");
  }, resetDelayMs);
}

export type CopyChannel = "preview" | "source" | "guide" | "saved";

/** Clipboard writes from all entry points share one in-flight task. */
export function createCopyTaskController(publish: (channel: CopyChannel | null) => void) {
  let active = false;
  let disposed = false;
  return {
    async run(channel: CopyChannel, task: () => Promise<void>) {
      if (active || disposed) return false;
      active = true;
      publish(channel);
      try {
        await task();
        return true;
      } finally {
        active = false;
        if (!disposed) publish(null);
      }
    },
    dispose() {
      disposed = true;
    },
  };
}

export function createCopyFeedbackController() {
  const turns: Record<CopyChannel, number> = { preview: 0, source: 0, guide: 0, saved: 0 };
  const resetTimers = new Map<CopyChannel, ReturnType<typeof setTimeout>>();
  let disposed = false;

  function clearReset(channel: CopyChannel) {
    const timer = resetTimers.get(channel);
    if (timer !== undefined) clearTimeout(timer);
    resetTimers.delete(channel);
  }

  function begin(channel: CopyChannel, publish: (state: WorkspaceCopyState) => void) {
    if (disposed) return undefined;
    const turn = ++turns[channel];
    clearReset(channel);
    const isCurrent = () => !disposed && turns[channel] === turn;
    return {
      isCurrent,
      setState(state: WorkspaceCopyState) {
        if (isCurrent()) publish(state);
      },
      scheduleReset(setState: (state: WorkspaceCopyState) => void, delayMs: number) {
        if (!isCurrent()) return;
        clearReset(channel);
        resetTimers.set(
          channel,
          setTimeout(() => {
            resetTimers.delete(channel);
            if (isCurrent()) setState("idle");
          }, delayMs),
        );
      },
    };
  }

  function dispose() {
    disposed = true;
    for (const channel of ["preview", "source", "guide", "saved"] as const) {
      turns[channel] += 1;
      clearReset(channel);
    }
  }

  return { begin, dispose };
}

export function createWorkspacePreviewRenderer({
  debounceMs,
  renderDocument = exportDocumentToDcHtml,
  setHtml,
  setIsRendering,
  setError,
}: PreviewRendererOptions) {
  let renderTurn = 0;
  let previewRenderTimer: ReturnType<typeof setTimeout> | undefined;

  function clearScheduledPreviewRender() {
    // Invalidate running exports as soon as the document changes or cleanup runs.
    renderTurn += 1;
    if (previewRenderTimer !== undefined) {
      clearTimeout(previewRenderTimer);
      previewRenderTimer = undefined;
    }
    setIsRendering(false);
  }

  async function renderForTurn(document: JSONContent, options: DcExportOptions, turn: number) {
    if (turn !== renderTurn) return;
    setError("");
    setIsRendering(true);

    try {
      const nextHtml = await renderDocument(document, options);

      if (turn === renderTurn) {
        setHtml(nextHtml);
      }
    } catch {
      if (turn === renderTurn) {
        setError("미리보기 생성에 실패했습니다. 이전 결과가 표시될 수 있습니다.");
      }
    } finally {
      if (turn === renderTurn) {
        setIsRendering(false);
      }
    }
  }

  async function renderPreview(document: JSONContent, options: DcExportOptions) {
    clearScheduledPreviewRender();
    await renderForTurn(document, options, renderTurn);
  }

  function schedulePreviewRender(document: JSONContent, options: DcExportOptions) {
    clearScheduledPreviewRender();
    const turn = renderTurn;
    setError("");
    setIsRendering(true);
    previewRenderTimer = setTimeout(() => {
      previewRenderTimer = undefined;
      void renderForTurn(document, options, turn);
    }, debounceMs);
  }

  return {
    clearScheduledPreviewRender,
    renderPreview,
    schedulePreviewRender,
    get previewRenderTimer() {
      return previewRenderTimer;
    },
    get renderTurn() {
      return renderTurn;
    },
  };
}

export async function copyDcPreview({
  document,
  exportOptions,
  renderDocument = exportDocumentToDcHtml,
  plainText,
  isCurrent,
  setManualHtml,
  setState,
  resetDelayMs,
  scheduleReset,
  onCopied,
}: CopyDcPreviewOptions) {
  setState("idle");
  setManualHtml("");
  let completedHtml = "";
  const copyHtmlPromise = Promise.resolve().then(async () => {
    const html = await renderDocument(document, {
      ...exportOptions,
      includeAttribution: true,
    });
    if (!isCurrent()) throw new Error("Copy source changed during export.");
    completedHtml = html;
    return html;
  });

  try {
    await copyDcHtmlWhenReady(copyHtmlPromise, plainText);
    onCopied?.(completedHtml);
    if (isCurrent()) {
      setState("copied");
      scheduleCopiedStateReset({ setState, resetDelayMs, scheduleReset });
    }
  } catch {
    try {
      await copyHtmlPromise;
    } catch {
      if (isCurrent()) setState("render-error");
      return;
    }
    if (!isCurrent()) return;
    setManualHtml(completedHtml);
    setState("error");
  }
}

export async function copySourceHtml({
  html,
  setState,
  resetDelayMs,
  scheduleReset,
  onCopied,
}: CopySourceHtmlOptions) {
  setState("idle");

  try {
    await copyPlainText(html);
    onCopied?.(html);
    setState("copied");
    scheduleCopiedStateReset({ setState, resetDelayMs, scheduleReset });
  } catch {
    setState("error");
  }
}

export async function copyPlainTextWithState({
  text,
  setState,
  resetDelayMs,
  scheduleReset,
}: CopyPlainTextOptions) {
  setState("idle");

  try {
    await copyPlainText(text);
    setState("copied");
    scheduleCopiedStateReset({ setState, resetDelayMs, scheduleReset });
  } catch {
    setState("error");
  }
}
