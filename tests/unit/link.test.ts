import { describe, expect, it } from "vitest";
import { normalizeEditableLinkHref } from "../../src/lib/editor/link";

describe("normalizeEditableLinkHref", () => {
  it("keeps safe absolute links", () => {
    expect(normalizeEditableLinkHref("https://example.com/docs?x=1#top")).toBe(
      "https://example.com/docs?x=1#top",
    );
    expect(normalizeEditableLinkHref("mailto:hello@example.com")).toBe("mailto:hello@example.com");
  });

  it("normalizes common pasted domains", () => {
    expect(normalizeEditableLinkHref("example.com")).toBe("https://example.com/");
    expect(normalizeEditableLinkHref("//example.com/path")).toBe("https://example.com/path");
  });

  it("rejects unsupported schemes and whitespace-bearing input", () => {
    expect(normalizeEditableLinkHref("javascript:alert(1)")).toBeUndefined();
    expect(normalizeEditableLinkHref("data:text/html,<script>alert(1)</script>")).toBeUndefined();
    expect(normalizeEditableLinkHref("https://example.com/a b")).toBeUndefined();
    expect(normalizeEditableLinkHref("")).toBeUndefined();
  });
});
