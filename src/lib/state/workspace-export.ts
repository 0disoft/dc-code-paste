import type { JSONContent } from "@tiptap/core";

import { copyDcHtml, copyPlainText } from "$lib/dc/clipboard";
import { exportDocumentToDcHtml, type DcExportOptions } from "$lib/dc/export-document";

export type WorkspaceCopyState = "idle" | "copied" | "error";

type PreviewRendererOptions = {
  debounceMs: number;
  setHtml: (html: string) => void;
  setIsRendering: (isRendering: boolean) => void;
};

type CopyStateOptions = {
  setState: (state: WorkspaceCopyState) => void;
  resetDelayMs?: number;
};

type CopyDcPreviewOptions = CopyStateOptions & {
  document: JSONContent;
  exportOptions: DcExportOptions;
  plainText: string;
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
}: CopyStateOptions) {
  setTimeout(() => {
    setState("idle");
  }, resetDelayMs);
}

export function createWorkspacePreviewRenderer({
  debounceMs,
  setHtml,
  setIsRendering,
}: PreviewRendererOptions) {
  let renderTurn = 0;
  let previewRenderTimer: ReturnType<typeof setTimeout> | undefined;

  function clearScheduledPreviewRender() {
    if (previewRenderTimer) {
      clearTimeout(previewRenderTimer);
      previewRenderTimer = undefined;
    }
  }

  async function renderPreview(document: JSONContent, options: DcExportOptions) {
    const turn = ++renderTurn;
    setIsRendering(true);

    try {
      const nextHtml = await exportDocumentToDcHtml(document, options);

      if (turn === renderTurn) {
        setHtml(nextHtml);
      }
    } finally {
      if (turn === renderTurn) {
        setIsRendering(false);
      }
    }
  }

  function schedulePreviewRender(document: JSONContent, options: DcExportOptions) {
    clearScheduledPreviewRender();
    previewRenderTimer = setTimeout(() => {
      previewRenderTimer = undefined;
      void renderPreview(document, options);
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
  plainText,
  setState,
  resetDelayMs,
}: CopyDcPreviewOptions) {
  setState("idle");

  try {
    const copyHtml = await exportDocumentToDcHtml(document, {
      ...exportOptions,
      includeAttribution: true,
    });

    await copyDcHtml(copyHtml, plainText);
    setState("copied");
    scheduleCopiedStateReset({ setState, resetDelayMs });
  } catch {
    setState("error");
  }
}

export async function copySourceHtml({ html, setState, resetDelayMs }: CopySourceHtmlOptions) {
  setState("idle");

  try {
    await copyPlainText(html);
    setState("copied");
    scheduleCopiedStateReset({ setState, resetDelayMs });
  } catch {
    setState("error");
  }
}

export async function copyPlainTextWithState({
  text,
  setState,
  resetDelayMs,
}: CopyPlainTextOptions) {
  setState("idle");

  try {
    await copyPlainText(text);
    setState("copied");
    scheduleCopiedStateReset({ setState, resetDelayMs });
  } catch {
    setState("error");
  }
}
