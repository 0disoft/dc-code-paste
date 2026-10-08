import { expect, test } from "@playwright/test";

for (const mobile of [false, true]) {
  test(`offers only fresh HTML for manual copy after an asynchronous update on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.clock.install();
    await page.goto("./");
    await expect(page.locator(".article-editor")).toContainText("DC-CODE-PASTE");
    await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
    await page.getByRole("menuitem", { name: "HTML 원문 보기", exact: true }).click();
    await expect(page.getByLabel("복사용 HTML 원문", { exact: true })).toHaveValue(/DC-CODE-PASTE/);

    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    try {
      await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
      await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
      await page
        .getByLabel("Markdown 원문")
        .fill('새 글 내용\n\n```rust\nfn main() { println!("FRESH_EXPORT"); }\n```');
      await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
      await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
      await page.getByRole("menuitem", { name: "HTML 원문 보기", exact: true }).click();
      const source = page.locator(".canvas-view .html-source");
      await expect(source).toBeDisabled();
      await expect(source).toHaveValue("");
      await expect(source).toHaveAttribute("aria-label", "HTML 원문 생성 중");
      await expect(page.locator(".preview-size")).toHaveText("HTML 생성 중");
      await expect(page.getByRole("button", { name: "원문 복사", exact: true })).toBeDisabled();
      await page.clock.runFor(1000);
      await expect(source).toBeEnabled();
      await expect(source).toHaveValue(/FRESH_EXPORT/);
      await expect(source).not.toHaveValue(/DC-CODE-PASTE/);
      await expect(source).toHaveAttribute("aria-label", "복사용 HTML 원문");
      await expect(page.locator(".preview-size")).toHaveText(/^HTML \d+KB$/);
      await expect(page.getByRole("button", { name: "원문 복사", exact: true })).toBeEnabled();
    } finally {
      await page.clock.resume();
    }
  });
}
