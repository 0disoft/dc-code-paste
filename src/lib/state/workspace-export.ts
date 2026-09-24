import type { JSONContent } from "@tiptap/core";

import { copyDcHtmlWhenReady, copyPlainText } from "$lib/dc/clipboard";
import { exportDocumentToDcHtml, type DcExportOptions } from "$lib/dc/export-document";

type RenderDocument = (document: JSONContent, options: DcExportOptions) => Promise<string>;

export type WorkspaceCopyState = "idle" | "copied" | "error";

type PreviewRendererOptions = {
  debounceMs: number;
  renderDocument?: RenderDocument;
  setHtml: (html: string) => void;
  setIsRendering: (isRendering: boolean) => void;
  setError: (error: string) => void;
};

type CopyStateOptions = {
  setState: (state: WorkspaceCopyState) => void;
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

type CopyChannel = "preview" | "source" | "guide";

export function createCopyFeedbackController() {
  const turns: Record<CopyChannel, number> = { preview: 0, source: 0, guide: 0 };
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
    for (const channel of ["preview", "source", "guide"] as const) {
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
    if (isCurrent()) {
      setState("copied");
      scheduleCopiedStateReset({ setState, resetDelayMs, scheduleReset });
    }
  } catch {
    if (isCurrent()) {
      setManualHtml(completedHtml);
      setState("error");
    }
  }
}

export async function copySourceHtml({
  html,
  setState,
  resetDelayMs,
  scheduleReset,
}: CopySourceHtmlOptions) {
  setState("idle");

  try {
    await copyPlainText(html);
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
