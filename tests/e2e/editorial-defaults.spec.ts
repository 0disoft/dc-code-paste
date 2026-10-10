import { expect, test, type Page } from "@playwright/test";

type CopyWindow = typeof window & { editorialCopy?: Record<string, string> };
async function openTool(page: Page, name: string) {
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}

for (const mobile of [false, true]) {
  test(`does not add sample copy to travel prose on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1400, height: 900 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: {
          write: async (items: ClipboardItem[]) => {
            (window as CopyWindow).editorialCopy = {
              "text/html": await (await items[0].getType("text/html")).text(),
              "text/plain": await (await items[0].getType("text/plain")).text(),
            };
          },
        },
      });
    });
    await page.goto("./");
    const editor = page.locator(".article-editor");
    await expect(editor).toBeVisible();
    await openTool(page, "Markdown");
    await page
      .getByLabel("Markdown 원문")
      .fill(":::hero\n봄 여행 준비\n:::\n\n:::summary\n여권 챙기기\n:::");
    await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
    await expect(editor.locator(".dc-hero-block h1")).toHaveText("봄 여행 준비");
    await expect(editor.locator(".dc-hero-label")).toHaveCount(0);
    await expect(editor.locator(".dc-summary-box")).toHaveAttribute("data-label", "요약");
    await expect(editor).not.toContainText(/GO CONCURRENCY|Go 동시성|동시성 핵심|CODING GUIDE/);
    await page.locator('[data-copy-trigger="preview"]').click();
    await expect.poll(() => page.evaluate(() => (window as CopyWindow).editorialCopy)).toBeTruthy();
    const payload = await page.evaluate(() => (window as CopyWindow).editorialCopy!);
    for (const output of [payload["text/html"], payload["text/plain"]]) {
      expect(output).toContain("봄 여행 준비");
      expect(output).toContain("여권 챙기기");
      expect(output).not.toMatch(/GO CONCURRENCY|Go 동시성|동시성 핵심|CODING GUIDE|강의 노트/);
    }
    await expect(page.locator(".topbar-status")).toContainText("저장됨");
    await page.reload();
    await expect(editor.locator(".dc-hero-block h1")).toHaveText("봄 여행 준비");
    await expect(editor.locator(".dc-hero-label")).toHaveCount(0);
    await expect(editor.locator(".dc-summary-box")).toHaveAttribute("data-label", "요약");
  });
}

test("formats a selected title without sample content or a fabricated inspector label", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.locator(".article-editor")).toBeVisible();
  await openTool(page, "Markdown");
  await page.getByLabel("Markdown 원문").fill("봄 여행 준비");
  await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
  const editor = page.locator(".article-editor");
  await editor.click();
  await editor.press("Control+a");
  await page.getByRole("button", { name: "더 많은 블록", exact: true }).click();
  await page.getByRole("button", { name: "글 머리 삽입", exact: true }).click();
  await expect(editor.locator(".dc-hero-block h1")).toHaveText("봄 여행 준비");
  await expect(editor.locator(".dc-hero-label")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "블록 라벨", exact: true })).toHaveValue("");
  await page.getByRole("textbox", { name: "블록 라벨", exact: true }).fill("여행 기록");
  await page.getByRole("button", { name: "라벨 적용", exact: true }).click();
  await expect(editor.locator(".dc-hero-label")).toHaveText("여행 기록");
});
