import { afterEach, describe, expect, it, vi } from "vitest";
import { copyDcHtml, copyPlainText, createDcClipboardPayload } from "../../src/lib/dc/clipboard";

class CapturingClipboardItem {
  readonly payload: Record<string, Blob>;

  constructor(payload: Record<string, Blob>) {
    this.payload = payload;
  }
}

describe("createDcClipboardPayload", () => {
  it("creates HTML and plain text clipboard blobs", async () => {
    const payload = createDcClipboardPayload("<p>강의</p>", "강의");

    expect(Object.keys(payload).sort()).toEqual(["text/html", "text/plain"]);
    expect(payload["text/html"].type).toBe("text/html");
    expect(payload["text/plain"].type).toBe("text/plain");
    await expect(payload["text/html"].text()).resolves.toBe("<p>강의</p>");
    await expect(payload["text/plain"].text()).resolves.toBe("강의");
  });
});

describe("copyDcHtml", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("writes one ClipboardItem containing DC-ready HTML and plain text", async () => {
    const writes: CapturingClipboardItem[][] = [];
    const write = vi.fn<(items: CapturingClipboardItem[]) => Promise<void>>(async (items) => {
      writes.push(items);
    });

    vi.stubGlobal("ClipboardItem", CapturingClipboardItem);
    vi.stubGlobal("navigator", {
      clipboard: { write },
    });

    await copyDcHtml('<div style="color:oklch(70% 0.2 150)">팁</div>', "팁");

    expect(write).toHaveBeenCalledOnce();
    expect(writes).toHaveLength(1);
    expect(writes[0]).toHaveLength(1);

    const item = writes[0][0];
    expect(item.payload["text/html"].type).toBe("text/html");
    expect(item.payload["text/plain"].type).toBe("text/plain");
    await expect(item.payload["text/html"].text()).resolves.toBe(
      '<div style="color:oklch(70% 0.2 150)">팁</div>',
    );
    await expect(item.payload["text/plain"].text()).resolves.toBe("팁");
  });

  it("rejects outside a browser-capable clipboard environment", async () => {
    await expect(copyDcHtml("<p>복사</p>", "복사")).rejects.toThrow(
      "Clipboard is available only in the browser.",
    );
  });
});

describe("copyPlainText", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("writes raw HTML source as plain text", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(async () => {});

    vi.stubGlobal("navigator", {
      clipboard: { writeText },
    });

    await copyPlainText('<p style="color:oklch(70% 0.2 150)">팁</p>');

    expect(writeText).toHaveBeenCalledWith('<p style="color:oklch(70% 0.2 150)">팁</p>');
  });

  it("rejects plain text copy outside a browser-capable clipboard environment", async () => {
    await expect(copyPlainText("<p>복사</p>")).rejects.toThrow(
      "Clipboard is available only in the browser.",
    );
  });

  it("clears fallback plain text selection even when copy is rejected", async () => {
    const target = {
      value: "",
      setAttribute: vi.fn<(qualifiedName: string, value: string) => void>(),
      style: {},
      select: vi.fn<() => void>(),
      blur: vi.fn<() => void>(),
      remove: vi.fn<() => void>(),
    };
    const removeAllRanges = vi.fn<() => void>();

    vi.stubGlobal("navigator", {});
    vi.stubGlobal("window", {
      getSelection: () => ({ removeAllRanges }),
    });
    vi.stubGlobal("document", {
      createElement: vi.fn<(tagName: string) => typeof target>(() => target),
      body: { append: vi.fn<(node: unknown) => void>() },
      execCommand: vi.fn<(commandId: string) => boolean>(() => false),
    });

    await expect(copyPlainText("복사")).rejects.toThrow("Copy command was rejected.");

    expect(target.select).toHaveBeenCalledOnce();
    expect(target.blur).toHaveBeenCalledOnce();
    expect(removeAllRanges).toHaveBeenCalledOnce();
    expect(target.remove).toHaveBeenCalledOnce();
  });
});
