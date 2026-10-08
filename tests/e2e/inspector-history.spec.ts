import { expect, test } from "@playwright/test";

const changes = [
  { label: "코드 언어", value: "python", attribute: "class", select: true },
  { label: "코드 파일명", value: "history.py", attribute: "data-filename", select: false },
  { label: "코드 강조 줄", value: "2", attribute: "data-highlight-lines", select: false },
] as const;

for (const change of changes) {
  test(`syncs ${change.label} after undo and redo while the cursor stays in the same block`, async ({
    page,
  }) => {
    await page.goto("./");
    const editor = page.locator(".article-editor");
    await expect(editor).toContainText("DC-CODE-PASTE");
    const pre = editor.locator("pre").first();
    await pre.click();
    if (change.label === "코드 강조 줄") await page.getByText("세부 설정", { exact: true }).click();
    const input = page.getByLabel(change.label, { exact: true });
    const original = await input.inputValue();
    const node = change.select ? pre.locator("code") : pre;
    const originalAttribute = await node.getAttribute(change.attribute);
    if (change.select) await input.selectOption(change.value);
    else {
      await input.fill(change.value);
      await input.press("Enter");
    }
    await expect(node).toHaveAttribute(
      change.attribute,
      change.select ? "language-python" : change.value,
    );
    await editor.press("Control+z");
    await expect(node).toHaveAttribute(change.attribute, originalAttribute!);
    await expect(input).toHaveValue(original);
    await editor.press("Control+y");
    await expect(node).toHaveAttribute(
      change.attribute,
      change.select ? "language-python" : change.value,
    );
    await expect(input).toHaveValue(change.value);
  });
}

test("keeps unfinished invalid marker input when only the global code theme changes", async ({
  page,
}) => {
  await page.goto("./");
  const editor = page.locator(".article-editor");
  await expect(editor).toContainText("DC-CODE-PASTE");
  await editor.locator("pre").first().click();
  await page.getByText("세부 설정", { exact: true }).click();
  const input = page.getByLabel("코드 강조 줄", { exact: true });
  await input.fill("999999");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("코드 테마", { exact: true }).selectOption("catppuccin-mocha");
  await expect(input).toHaveValue("999999");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(editor.locator("pre").first()).toHaveAttribute("data-highlight-lines", "3");
});

test("syncs the quote style after undo without moving to another block", async ({ page }) => {
  await page.goto("./");
  const editor = page.locator(".article-editor");
  await expect(editor).toContainText("DC-CODE-PASTE");
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
  await page.getByLabel("Markdown 원문").fill("> 인용 본문");
  await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
  const quote = editor.locator("blockquote");
  await quote.locator("p").click();
  await page.locator("details > summary").filter({ hasText: "글자 서식" }).click();
  const input = page.getByLabel("인용 스타일", { exact: true });
  await input.selectOption("academic");
  await expect(quote).toHaveAttribute("data-quote-style", "academic");
  await editor.press("Control+z");
  await expect(quote).not.toHaveAttribute("data-quote-style");
  await expect(input).toHaveValue("literary");
  await editor.press("Control+y");
  await expect(quote).toHaveAttribute("data-quote-style", "academic");
  await expect(input).toHaveValue("academic");
});

test("syncs the button group layout after undo and redo", async ({ page }) => {
  await page.goto("./");
  const editor = page.locator(".article-editor");
  await expect(editor).toContainText("DC-CODE-PASTE");
  const group = editor.locator(".dc-cta-group");
  await group.click({ position: { x: 2, y: 2 } });
  const input = page.getByLabel("버튼묶음 정렬", { exact: true });
  await expect(input).toHaveValue("vertical");
  await input.selectOption("horizontal");
  await expect(group).not.toHaveAttribute("data-layout");
  await editor.press("Control+z");
  await expect(group).toHaveAttribute("data-layout", "vertical");
  await expect(input).toHaveValue("vertical");
  await editor.press("Control+y");
  await expect(group).not.toHaveAttribute("data-layout");
  await expect(input).toHaveValue("horizontal");
});
