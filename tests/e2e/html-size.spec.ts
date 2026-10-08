import { expect, test } from "@playwright/test";

type CopyWindow = typeof window & { copiedSource?: string };

test("shows the UTF-8 size of the exported HTML for ASCII and long Korean text with emoji", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text: string) => {
          (window as CopyWindow).copiedSource = text;
        },
      },
    });
  });
  await page.goto("./");
  await expect(page.locator(".article-editor")).toContainText("DC-CODE-PASTE");
  for (const text of ["ASCII text ".repeat(300), "가🙂 ".repeat(5000)]) {
    await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
    await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
    await page.getByLabel("Markdown 원문").fill(text);
    await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
    await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
    await page.getByRole("menuitem", { name: "HTML 원문 보기", exact: true }).click();
    const source = page.getByLabel("복사용 HTML 원문", { exact: true });
    await expect(source).toBeEnabled();
    await expect(source).toHaveValue(text.includes("🙂") ? /가🙂/ : /ASCII text/);
    const html = await source.inputValue();
    const bytes = Buffer.byteLength(html, "utf8");
    if (text.includes("🙂")) {
      expect(bytes).toBeGreaterThan(30_000);
      expect(Math.ceil(bytes / 1024)).toBeGreaterThan(Math.ceil(html.length / 1024));
    }
    const size = page.locator(".preview-size");
    await expect(size).toHaveText(`HTML ${Math.ceil(bytes / 1024)}KB`);
    await page
      .locator(".preview-tools")
      .getByRole("button", { name: /원문 복사|복사됨/ })
      .click();
    await expect.poll(() => page.evaluate(() => (window as CopyWindow).copiedSource)).toBe(html);
  }
  await expect(page.locator(".preview-size")).toHaveAttribute(
    "title",
    "HTML 원문의 UTF-8 기준 용량",
  );
});
