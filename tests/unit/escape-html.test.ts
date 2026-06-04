import { describe, expect, it } from "vitest";
import { escapeHtml } from "../../src/lib/dc/escape-html";

describe("escapeHtml", () => {
  it("escapes text before it becomes pasteable HTML", () => {
    expect(escapeHtml(`<span title="x&y">'code'</span>`)).toBe(
      "&lt;span title=&quot;x&amp;y&quot;&gt;&#39;code&#39;&lt;/span&gt;",
    );
  });
});
