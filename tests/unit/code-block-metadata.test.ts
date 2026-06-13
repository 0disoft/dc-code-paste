import { describe, expect, it } from "vitest";
import { normalizeCodeFilename } from "../../src/lib/highlighter/code-block-metadata";

describe("code block metadata", () => {
  it("normalizes code filenames without allowing HTML-like brackets", () => {
    expect(normalizeCodeFilename("  src/main.cpp  ")).toBe("src/main.cpp");
    expect(normalizeCodeFilename("bad<script>.ts")).toBe("badscript.ts");
    expect(normalizeCodeFilename("app   config.ts")).toBe("app config.ts");
  });

  it("preserves full unicode code points while filtering control characters", () => {
    expect(normalizeCodeFilename("go-🚀\u0000-main.go")).toBe("go-🚀-main.go");
  });
});
