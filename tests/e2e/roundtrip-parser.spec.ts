import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import type {} from "../fixtures/roundtrip-browser.ts";

test("extracts inert clipboard HTML, preserves code, compares equivalent lists and recovers a saved passage", async ({
  page,
}) => {
  const folder = await mkdtemp(join(tmpdir(), "dc-roundtrip-parser-"));
  try {
    const bundle = join(folder, "fixture.js");
    execFileSync(
      "bun",
      [
        "build",
        "tests/fixtures/roundtrip-browser.ts",
        "--target=browser",
        "--format=iife",
        "--outfile",
        bundle,
      ],
      { cwd: process.cwd(), stdio: "pipe" },
    );
    await page.goto("about:blank");
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.addScriptTag({ path: bundle });
    const result = await page.evaluate(() => {
      const api = window.roundtripTest;
      const original =
        '<table style="color:rgb(30,30,30);font-size:18px"><tbody><tr><td><h2>제목</h2><p>앞 <strong>굵은</strong> <a href="https://example.com/old">자료</a></p><table role="none"><tbody><tr><td>1.</td><td><p>첫 항목</p></td></tr><tr><td>2.</td><td><p>둘째 항목</p></td></tr></tbody></table><pre><code>  return value;\n    다음 줄\n</code></pre><p>끝</p></td></tr></tbody></table>';
      const returned =
        '<div><h2>제목</h2><p>앞 <b>굵은</b> <a href="https://example.com/old">자료</a></p><ol><li>첫 항목</li><li>둘째 항목</li></ol><pre>  return value;\n    다음 줄\n</pre><p>끝</p></div>';
      const before = api.snapshot(original);
      const after = api.snapshot(returned);
      const comparison = api.compare(before, after);
      const codeChanged = api.compare(before, api.snapshot(returned.replace("  return", "return")));
      const repaired = api.fragment(original, before.blocks[1]);
      const mixed = api.snapshot("맨 앞<span> 이어짐</span><div>밖 <p>안</p> 뒤</div>맨 뒤");
      const inert = api.snapshot(
        '<p>남긴 문장<img src="https://example.test/pixel" onerror="window.injected=1"></p><script>window.injected=2</script><iframe src="https://example.test/frame"></iframe><p hidden>숨긴 문장</p><p style="display:none">숨김</p>',
      );
      const unsafe =
        '<p onclick="alert(1)" style="color:red;background-image:url(https://example.test/pixel)">원문<a href="javascript:alert(1)">주소</a><img src="https://example.test/image"></p>';
      const safeRecovery = api.fragment(unsafe, api.snapshot(unsafe).blocks[0]);
      let stale = "";
      try {
        api.fragment(original.replace("굵은", "다른"), before.blocks[1]);
      } catch (error) {
        stale = (error as Error).message;
      }
      let deep = "";
      try {
        api.snapshot(`${"<div>".repeat(90)}깊음${"</div>".repeat(90)}`);
      } catch (error) {
        deep = (error as Error).message;
      }
      return {
        before,
        after,
        comparison,
        codeChanged,
        repaired,
        mixed,
        inert,
        safeRecovery,
        stale,
        deep,
        executed: "injected" in window,
      };
    });
    expect(result.before.blocks.map((block) => block.text)).toEqual([
      "제목",
      "앞 굵은 자료",
      "첫 항목",
      "둘째 항목",
      "  return value;\n    다음 줄\n",
      "끝",
    ]);
    expect(result.after.blocks.map((block) => block.text)).toEqual(
      result.before.blocks.map((block) => block.text),
    );
    expect(result.comparison).toMatchObject({
      changes: [],
      linksChanged: false,
      listsChanged: false,
      stylesChanged: true,
    });
    expect(result.codeChanged.changes).toHaveLength(1);
    expect(result.codeChanged.changes[0].kind).toBe("changed");
    expect(result.repaired.html).toContain("<strong>굵은</strong>");
    expect(result.repaired.html).toContain('href="https://example.com/old"');
    expect(result.repaired.html).toMatch(/font-size:\s*18px/);
    expect(result.repaired.html).not.toContain("첫 항목");
    expect(result.repaired.html).not.toContain("제목");
    expect(result.repaired.plainText).toBe("앞 굵은 자료");
    expect(result.mixed.blocks.map((block) => block.text)).toEqual([
      "맨 앞 이어짐",
      "밖",
      "안",
      "뒤",
      "맨 뒤",
    ]);
    expect(result.inert.blocks.map((block) => block.text)).toEqual(["남긴 문장"]);
    expect(result.executed).toBe(false);
    expect(requests).toEqual([]);
    expect(result.safeRecovery.html).not.toMatch(/onclick|javascript:|background-image|<img/);
    expect(result.safeRecovery.html).toMatch(/color:\s*red/);
    expect(result.stale).toContain("구간이 바뀌었습니다");
    expect(result.deep).toContain("구조가 너무 깊습니다");
  } finally {
    const target = resolve(folder);
    if (
      !target.startsWith(`${resolve(tmpdir())}${sep}`) ||
      !basename(target).startsWith("dc-roundtrip-parser-")
    )
      throw new Error("Unexpected temporary fixture path");
    await rm(target, { recursive: true, force: true });
  }
});
