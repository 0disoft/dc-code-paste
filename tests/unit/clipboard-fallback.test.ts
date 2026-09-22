import { afterEach, describe, expect, it, vi } from "vitest";
import { copyDcHtml, copyPlainText } from "../../src/lib/dc/clipboard";

class MockClipboardItem {}

function mockBrowser(copied = true) {
  const target = {
    value: "",
    innerHTML: "",
    style: {},
    setAttribute: vi.fn(),
    select: vi.fn(),
    blur: vi.fn(),
    remove: vi.fn(),
  };
  const write = vi.fn<() => Promise<void>>().mockRejectedValue(new Error("async rejected"));
  const writeText = vi.fn<() => Promise<void>>().mockRejectedValue(new Error("async rejected"));
  const execCommand = vi.fn(() => copied);
  vi.stubGlobal("ClipboardItem", MockClipboardItem);
  vi.stubGlobal("navigator", { clipboard: { write, writeText } });
  vi.stubGlobal("window", {
    getSelection: () => ({ removeAllRanges: vi.fn(), addRange: vi.fn() }),
  });
  vi.stubGlobal("document", {
    createElement: vi.fn(() => target),
    createRange: () => ({ selectNodeContents: vi.fn() }),
    body: { append: vi.fn() },
    execCommand,
  });
  return { target, write, writeText, execCommand };
}

describe("clipboard fallback after async API failure", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(["html", "text"])("tries the browser fallback for rejected %s writes", async (kind) => {
    const { target, execCommand } = mockBrowser();

    if (kind === "html") {
      await copyDcHtml("<p>복사</p>", "복사");
      expect(target.innerHTML).toBe("<p>복사</p>");
    } else {
      await copyPlainText("복사");
      expect(target.value).toBe("복사");
    }

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
