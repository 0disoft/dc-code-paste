import { expect, it } from "vitest";
import { createReadableHtmlFile } from "../../src/lib/dc/html-file";

it("wraps the original export in a portable UTF-8 document", () => {
  const html = '<table style="color:#263f9a"><tr><td>한글 글 &amp; 서식</td></tr></table>';
  const file = createReadableHtmlFile(html);
  expect(file.filename).toMatch(/^dc-code-paste-.*\.html$/);
  expect(file.filename).not.toContain(":");
  expect(file.content).toContain('<meta charset="utf-8">');
  expect(file.content).toContain('name="viewport"');
  expect(file.content).toContain(html);
  expect(file.content).toMatch(/^<!doctype html>/);
});
