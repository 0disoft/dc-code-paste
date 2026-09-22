import { afterEach, describe, expect, it, vi } from "vitest";
import { copyDcHtml, copyPlainText } from "../../src/lib/dc/clipboard";

class MockClipboardItem {}

function mockBrowser(copied = true) {
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
  const execCommand = vi.fn<(command: string) => boolean>(() => copied);
  vi.stubGlobal("ClipboardItem", MockClipboardItem);
  vi.stubGlobal("navigator", { clipboard: { write, writeText } });
  vi.stubGlobal("window", {
    getSelection: () => ({
      removeAllRanges: vi.fn<() => void>(),
      addRange: vi.fn<(range: unknown) => void>(),
    }),
  });
  vi.stubGlobal("document", {
    createElement: vi.fn<(tagName: string) => typeof target>(() => target),
    createRange: () => ({ selectNodeContents: vi.fn<(node: unknown) => void>() }),
    body: { append: vi.fn<(node: unknown) => void>() },
    execCommand,
  });
  return { target, write, writeText, execCommand };
}

describe("clipboard fallback after async API failure", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("tries the browser fallback for rejected HTML writes", async () => {
    const { target, execCommand } = mockBrowser();

    await copyDcHtml("<p>복사</p>", "복사");

    expect(target.innerHTML).toBe("<p>복사</p>");
    expect(execCommand).toHaveBeenCalledExactlyOnceWith("copy");
    expect(target.remove).toHaveBeenCalledOnce();
  });

  it("tries the browser fallback for rejected plain text writes", async () => {
    const { target, execCommand } = mockBrowser();

    await copyPlainText("복사");

    expect(target.value).toBe("복사");
    expect(execCommand).toHaveBeenCalledExactlyOnceWith("copy");
    expect(target.remove).toHaveBeenCalledOnce();
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
    const { target, execCommand } = mockBrowser(false);

    await expect(copyDcHtml("<p>복사</p>", "복사")).rejects.toThrow("Copy command was rejected.");

    expect(execCommand).toHaveBeenCalledExactlyOnceWith("copy");
    expect(target.remove).toHaveBeenCalledOnce();
  });
});
