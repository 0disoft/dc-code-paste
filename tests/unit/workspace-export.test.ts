import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JSONContent } from "@tiptap/core";
import { exportDocumentToDcHtml, type DcExportOptions } from "$lib/dc/export-document";
import { createWorkspacePreviewRenderer } from "$lib/state/workspace-export";

vi.mock("$lib/dc/export-document", () => ({
  exportDocumentToDcHtml: vi.fn<typeof exportDocumentToDcHtml>(),
}));
vi.mock("$lib/dc/clipboard", () => ({
  copyDcHtml: vi.fn<(html: string, plainText: string) => Promise<void>>(),
  copyPlainText: vi.fn<(text: string) => Promise<void>>(),
}));

const options: DcExportOptions = {
  theme: "github-dark",
  bodyFontFamily: "Pretendard",
  bodyFontSize: "17px",
  codeFontSize: "15px",
  showLineNumbers: false,
};

function document(text: string): JSONContent {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

function deferred() {
  let resolve!: (value: string) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<string>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createRenderer() {
  const setHtml = vi.fn<(html: string) => void>();
  const setIsRendering = vi.fn<(isRendering: boolean) => void>();
  const setError = vi.fn<(error: string) => void>();
  const renderer = createWorkspacePreviewRenderer({
    debounceMs: 90,
    setHtml,
    setIsRendering,
    setError,
  });
  return { renderer, setHtml, setIsRendering, setError };
}

describe("workspace preview render lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(exportDocumentToDcHtml).mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("invalidates old results while a newer document is still debouncing", async () => {
    const old = deferred();
    vi.mocked(exportDocumentToDcHtml)
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce("new-html");
    const { renderer, setHtml, setIsRendering } = createRenderer();
    const oldRender = renderer.renderPreview(document("old"), options);

    renderer.schedulePreviewRender(document("new"), options);
    old.resolve("old-html");
    await oldRender;

    expect(setHtml).not.toHaveBeenCalled();
    expect(setIsRendering).toHaveBeenLastCalledWith(true);
    await vi.advanceTimersByTimeAsync(90);
    expect(setHtml).toHaveBeenCalledExactlyOnceWith("new-html");
    expect(setIsRendering).toHaveBeenLastCalledWith(false);
  });

  it("prevents a running export from publishing after cleanup", async () => {
    const old = deferred();
    vi.mocked(exportDocumentToDcHtml).mockReturnValueOnce(old.promise);
    const { renderer, setHtml, setIsRendering } = createRenderer();
    const oldRender = renderer.renderPreview(document("old"), options);

    renderer.clearScheduledPreviewRender();
    old.resolve("old-html");
    await oldRender;

    expect(setHtml).not.toHaveBeenCalled();
    expect(setIsRendering).toHaveBeenLastCalledWith(false);
    expect(renderer.previewRenderTimer).toBeUndefined();
  });

  it("cancels delayed work when an immediate render starts", async () => {
    vi.mocked(exportDocumentToDcHtml).mockResolvedValue("now-html");
    const { renderer, setHtml } = createRenderer();
    const immediateDocument = document("now");

    renderer.schedulePreviewRender(document("scheduled"), options);
    await renderer.renderPreview(immediateDocument, options);
    await vi.advanceTimersByTimeAsync(90);

    expect(exportDocumentToDcHtml).toHaveBeenCalledExactlyOnceWith(immediateDocument, options);
    expect(setHtml).toHaveBeenCalledExactlyOnceWith("now-html");
  });

  it("reports queued work as busy and coalesces rapid edits", async () => {
    vi.mocked(exportDocumentToDcHtml).mockResolvedValue("b-html");
    const { renderer, setHtml, setIsRendering } = createRenderer();
    const latestDocument = document("b");

    renderer.schedulePreviewRender(document("a"), options);
    expect(setIsRendering).toHaveBeenLastCalledWith(true);
    renderer.schedulePreviewRender(latestDocument, options);
    await vi.advanceTimersByTimeAsync(90);

    expect(exportDocumentToDcHtml).toHaveBeenCalledExactlyOnceWith(latestDocument, options);
    expect(setHtml).toHaveBeenCalledExactlyOnceWith("b-html");
  });

  it("keeps the latest result when the older export finishes last", async () => {
    const old = deferred();
    const next = deferred();
    vi.mocked(exportDocumentToDcHtml)
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(next.promise);
    const { renderer, setHtml } = createRenderer();

    const oldRender = renderer.renderPreview(document("old"), options);
    const nextRender = renderer.renderPreview(document("new"), options);
    next.resolve("new-html");
    await nextRender;
    old.resolve("old-html");
    await oldRender;

    expect(setHtml).toHaveBeenCalledExactlyOnceWith("new-html");
  });

  it("does not let an old rejection reset a newer queued busy state", async () => {
    const old = deferred();
    vi.mocked(exportDocumentToDcHtml)
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce("new-html");
    const { renderer, setHtml, setIsRendering } = createRenderer();
    const oldRender = renderer.renderPreview(document("old"), options);

    renderer.schedulePreviewRender(document("new"), options);
    old.reject(new Error("old failure"));
    await oldRender;

    expect(setHtml).not.toHaveBeenCalled();
    expect(setIsRendering).toHaveBeenLastCalledWith(true);
    await vi.advanceTimersByTimeAsync(90);
    expect(setHtml).toHaveBeenCalledExactlyOnceWith("new-html");
  });

  it("marks the latest failed render stale and recovers on retry", async () => {
    vi.mocked(exportDocumentToDcHtml)
      .mockRejectedValueOnce(new Error("grammar chunk failed"))
      .mockResolvedValueOnce("recovered-html");
    const { renderer, setHtml, setIsRendering, setError } = createRenderer();

    renderer.schedulePreviewRender(document("first"), options);
    await vi.advanceTimersByTimeAsync(90);
    expect(setHtml).not.toHaveBeenCalled();
    expect(setError).toHaveBeenLastCalledWith(
      "미리보기 생성에 실패했습니다. 이전 결과가 표시될 수 있습니다.",
    );
    expect(setIsRendering).toHaveBeenLastCalledWith(false);

    await renderer.renderPreview(document("retry"), options);
    expect(setHtml).toHaveBeenCalledExactlyOnceWith("recovered-html");
    expect(setError).toHaveBeenLastCalledWith("");
  });
});
