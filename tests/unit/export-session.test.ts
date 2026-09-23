import { describe, expect, it, vi } from "vitest";
import type { JSONContent } from "@tiptap/core";
import { createDcExportSession, type DcExportOptions } from "$lib/dc/export-document";
import { createBlockRenderCache } from "$lib/dc/export/block-cache";

const options: DcExportOptions = {
  theme: "github-dark",
  bodyFontFamily: "Pretendard",
  bodyFontSize: "17px",
  codeFontSize: "15px",
  showLineNumbers: false,
};

function document(first: string, second: string): JSONContent {
  return {
    type: "doc",
    content: [first, second].map((value) => ({
      type: "paragraph",
      content: [{ type: "text", text: value }],
    })),
  };
}

describe("workspace export session", () => {
  it("reflects changed content and styles while sharing a bounded cache", async () => {
    const session = createDcExportSession();
    const first = await session.exportDocument(document("old", "same"), options);
    expect(first).toContain("old");
    expect(first).toContain("same");

    const latest = await session.exportDocument(document("new", "same"), options);
    expect(latest).toContain("new");
    expect(latest).not.toContain("old");

    const themed = await session.exportDocument(document("new", "same"), {
      ...options,
      documentTheme: "darkEditorial",
    });
    expect(themed).not.toBe(latest);
    session.dispose();
    await expect(session.exportDocument(document("new", "same"), options)).rejects.toThrow(
      "Export session was disposed.",
    );
  });

  it("reuses successful blocks, retries failures, and bounds retained bytes", async () => {
    const cache = createBlockRenderCache();
    const produce = vi.fn<() => Promise<string>>().mockResolvedValue("<p>one</p>");
    expect(await cache.render("one", produce)).toBe("<p>one</p>");
    expect(await cache.render("one", produce)).toBe("<p>one</p>");
    expect(produce).toHaveBeenCalledOnce();

    const retry = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("render failed"))
      .mockResolvedValueOnce("<p>recovered</p>");
    await expect(cache.render("retry", retry)).rejects.toThrow("render failed");
    expect(await cache.render("retry", retry)).toBe("<p>recovered</p>");
    expect(retry).toHaveBeenCalledTimes(2);

    for (let index = 0; index < 120; index += 1) {
      await cache.render(`block-${index}`, async () => "x".repeat(40_000));
    }
    expect(cache.usage.bytes).toBeLessThanOrEqual(cache.usage.maxBytes);
    expect(cache.usage.entries).toBeLessThanOrEqual(100);
    cache.dispose();
    expect(cache.usage.bytes).toBe(0);
  });
});
