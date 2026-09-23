import { afterEach, describe, expect, it, vi } from "vitest";
import { copyDcHtml, copyPlainText } from "../../src/lib/dc/clipboard";

class MockClipboardItem {}

function mockBrowser(copied = true) {
  const originalRange = { cloneRange: vi.fn<() => unknown>(() => originalRange) };
  const selection = {
    rangeCount: 1,
    getRangeAt: vi.fn<(index: number) => unknown>(() => originalRange),
    removeAllRanges: vi.fn<() => void>(),
    addRange: vi.fn<(range: unknown) => void>(),
  };
  const activeElement = {
    isConnected: true,
    selectionStart: 2,
    selectionEnd: 4,
    selectionDirection: "backward",
    setSelectionRange: vi.fn<(start: number, end: number, direction: string) => void>(),
    focus: vi.fn<() => void>(),
  };
  const target = {
    value: "",
    innerHTML: "",
    style: {},
    setAttribute: vi.fn<(name: string, value: string) => void>(),
    select: vi.fn<() => void>(),
    blur: vi.fn<() => void>(),
    remove: vi.fn<() => void>(),
  };
  const write = vi.fn<() => Promise<void>>().mockRejectedValue(new Error("async rejected"));
  const writeText = vi.fn<() => Promise<void>>().mockRejectedValue(new Error("async rejected"));
  const copyData = { setData: vi.fn<(type: string, value: string) => void>() };
  const preventDefault = vi.fn<() => void>();
  const listeners = new Set<(event: ClipboardEvent) => void>();
  const execCommand = vi.fn<(command: string) => boolean>(() => {
    for (const listener of listeners) {
      listener({ clipboardData: copyData, preventDefault } as unknown as ClipboardEvent);
    }
    return copied;
  });
  vi.stubGlobal("ClipboardItem", MockClipboardItem);
  vi.stubGlobal("navigator", { clipboard: { write, writeText } });
  vi.stubGlobal("window", {
    getSelection: () => selection,
    scrollX: 10,
    scrollY: 20,
    scrollTo: vi.fn<(x: number, y: number) => void>(),
  });
  vi.stubGlobal("document", {
    activeElement,
    createElement: vi.fn<(tagName: string) => typeof target>(() => target),
    createRange: vi.fn<() => { selectNodeContents: (node: unknown) => void }>(() => ({
      selectNodeContents: vi.fn<(node: unknown) => void>(),
    })),
    body: { append: vi.fn<(node: unknown) => void>() },
    addEventListener: vi.fn<(type: string, listener: (event: ClipboardEvent) => void) => void>(
      (_, listener) => {
        listeners.add(listener);
      },
    ),
    removeEventListener: vi.fn<(type: string, listener: (event: ClipboardEvent) => void) => void>(
      (_, listener) => {
        listeners.delete(listener);
      },
    ),
    execCommand,
  });
  return {
    target,
    write,
    writeText,
    execCommand,
    copyData,
    preventDefault,
    selection,
    originalRange,
    activeElement,
    listeners,
  };
}

describe("clipboard fallback after async API failure", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("tries the browser fallback for rejected HTML writes", async () => {
    const {
      target,
      execCommand,
      copyData,
      preventDefault,
      selection,
      originalRange,
      activeElement,
    } = mockBrowser();

    await copyDcHtml("<p>복사</p>", "정확한 일반 텍스트");

    expect(target.innerHTML).toBe("<p>복사</p>");
    expect(execCommand).toHaveBeenCalledExactlyOnceWith("copy");
    expect(target.remove).toHaveBeenCalledOnce();
    expect(copyData.setData).toHaveBeenCalledWith("text/html", "<p>복사</p>");
    expect(copyData.setData).toHaveBeenCalledWith("text/plain", "정확한 일반 텍스트");
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(selection.addRange).toHaveBeenLastCalledWith(originalRange);
    expect(activeElement.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(activeElement.setSelectionRange).toHaveBeenCalledWith(2, 4, "backward");
  });

  it("tries the browser fallback for rejected plain text writes", async () => {
    const { target, execCommand, selection, originalRange, activeElement } = mockBrowser();

    await copyPlainText("복사");

    expect(target.value).toBe("복사");
    expect(execCommand).toHaveBeenCalledExactlyOnceWith("copy");
    expect(target.remove).toHaveBeenCalledOnce();
    expect(selection.addRange).toHaveBeenLastCalledWith(originalRange);
    expect(activeElement.focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("falls back when ClipboardItem construction rejects the payload", async () => {
    const { write, execCommand } = mockBrowser();
    vi.stubGlobal(
      "ClipboardItem",
      class {
        constructor() {
          throw new Error("unsupported item");
        }
      },
    );

    await copyDcHtml("<p>복사</p>", "복사");

    expect(write).not.toHaveBeenCalled();
    expect(execCommand).toHaveBeenCalledExactlyOnceWith("copy");
  });

  it("does not duplicate successful async copies", async () => {
    const { write, writeText, execCommand } = mockBrowser();
    write.mockResolvedValue(undefined);
    writeText.mockResolvedValue(undefined);

    await copyDcHtml("<p>복사</p>", "복사");
    await copyPlainText("복사");

    expect(write).toHaveBeenCalledOnce();
    expect(writeText).toHaveBeenCalledOnce();
    expect(execCommand).not.toHaveBeenCalled();
  });

  it("still reports failure and cleans up when the fallback is also rejected", async () => {
    const { target, execCommand, selection, originalRange, listeners } = mockBrowser(false);

    await expect(copyDcHtml("<p>복사</p>", "복사")).rejects.toThrow("Copy command was rejected.");

    expect(execCommand).toHaveBeenCalledExactlyOnceWith("copy");
    expect(target.remove).toHaveBeenCalledOnce();
    expect(selection.addRange).toHaveBeenLastCalledWith(originalRange);
    expect(listeners.size).toBe(0);
  });

  it("removes temporary DOM and restores selection if selection setup fails", async () => {
    const { target, selection, originalRange } = mockBrowser();
    vi.mocked(document.createRange).mockImplementation(() => {
      throw new Error("range denied");
    });

    await expect(copyDcHtml("<p>복사</p>", "복사")).rejects.toThrow("range denied");
    expect(target.remove).toHaveBeenCalledOnce();
    expect(selection.addRange).toHaveBeenLastCalledWith(originalRange);
  });

  it("restores focus and selection when execCommand throws", async () => {
    const { target, execCommand, activeElement, selection, originalRange } = mockBrowser();
    execCommand.mockImplementation(() => {
      throw new Error("copy denied");
    });

    await expect(copyPlainText("복사")).rejects.toThrow("copy denied");
    expect(target.remove).toHaveBeenCalledOnce();
    expect(activeElement.focus).toHaveBeenCalledOnce();
    expect(selection.addRange).toHaveBeenLastCalledWith(originalRange);
  });
});
