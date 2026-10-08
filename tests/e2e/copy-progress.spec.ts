import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

type CopyTestWindow = typeof window & { copyTest: { calls: number; finish: () => void } };

async function delayClipboard(page: Page) {
  await page.addInitScript(() => {
    const fixture = { calls: 0, finish: () => {} };
    (window as CopyTestWindow).copyTest = fixture;
    async function pendingWrite() {
      fixture.calls++;
      await new Promise<void>((resolve) => {
        fixture.finish = resolve;
      });
    }
    Object.defineProperty(navigator, "clipboard", {
      value: { write: pendingWrite, writeText: pendingWrite },
    });
  });
}

for (const mobile of [false, true]) {
  test(`shows copy progress and prevents overlapping writes on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1487, height: 900 });
    await delayClipboard(page);
    await page.goto("./");
    await expect(page.locator(".article-editor")).toContainText("DC-CODE-PASTE");
    await page.getByRole("button", { name: "디씨 복사", exact: true }).click();
    const busy = page.getByRole("button", { name: "복사 중", exact: true });
    await expect(busy).toBeDisabled();
    await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
    await expect(
      page.getByRole("menuitem", { name: "LLM 가이드 복사", exact: true }),
    ).toBeDisabled();
    const htmlMenu = page.getByRole("menuitem", { name: "HTML 원문 보기", exact: true });
    await htmlMenu.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: "예시 템플릿", exact: true })).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(htmlMenu).toBeFocused();
    await htmlMenu.click();
    const source = page.getByRole("button", { name: "원문 복사", exact: true });
    await expect(page.getByLabel("복사용 HTML 원문", { exact: true })).not.toHaveValue("");
    await expect(source).toBeDisabled();
    expect(await page.evaluate(() => (window as CopyTestWindow).copyTest.calls)).toBe(1);
    if (process.env.DC_PASTE_CAPTURE_DIR) {
      await mkdir(process.env.DC_PASTE_CAPTURE_DIR, { recursive: true });
      await page.screenshot({
        path: join(
          process.env.DC_PASTE_CAPTURE_DIR,
          `copy-progress-${mobile ? "mobile" : "desktop"}.png`,
        ),
      });
    }
    await page.evaluate(() => (window as CopyTestWindow).copyTest.finish());
    await expect(page.getByRole("button", { name: "복사됨", exact: true })).toBeEnabled();
    await expect(source).toBeEnabled();
    await source.click();
    await expect(page.getByRole("button", { name: "복사 중", exact: true })).toBeDisabled();
    expect(await page.evaluate(() => (window as CopyTestWindow).copyTest.calls)).toBe(2);
    await page.evaluate(() => (window as CopyTestWindow).copyTest.finish());
    await expect(
      page.locator(".preview-tools").getByRole("button", { name: "복사됨", exact: true }),
    ).toBeEnabled();
  });
}
