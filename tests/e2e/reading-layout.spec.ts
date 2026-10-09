import { expect, test } from "@playwright/test";

type CapturedClipboard = typeof window & { copiedHtml: string };

for (const mobile of [false, true]) {
  test(`compares and applies layouts through undo, clipboard and reload on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1487, height: 900 });
    await page.addInitScript(() => {
      (window as CapturedClipboard).copiedHtml = "";
      Object.defineProperty(navigator, "clipboard", {
        value: {
          write: async (items: ClipboardItem[]) => {
            (window as CapturedClipboard).copiedHtml = await (
              await items[0].getType("text/html")
            ).text();
          },
        },
      });
    });
    await page.goto("./");
    const editor = page.locator(".article-editor");
    await expect(editor).toContainText("DC-CODE-PASTE");
    await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
    await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
    await page
      .getByLabel("Markdown 원문")
      .fill(
        "# 생각을 건네는 순서\n\n**[기억할 핵심 문장](https://example.com/source)**\n\n내용을 설명하는 문장\n\n- 첫 번째 근거\n- 두 번째 근거",
      );
    await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
    const original = await editor.textContent();
    await page.getByRole("button", { name: "미리보기", exact: true }).click();
    await page.getByRole("button", { name: "배치 비교", exact: true }).click();
    const comparison = page.getByRole("region", { name: "읽기 배치 비교", exact: true });
    const balanced = comparison.getByRole("region", { name: "기본 간격 글 미리보기", exact: true });
    const airy = comparison.getByRole("region", {
      name: "여유 있는 간격 글 미리보기",
      exact: true,
    });
    await expect(balanced).toContainText("기억할 핵심 문장");
    await expect(airy).toContainText("기억할 핵심 문장");
    expect(await airy.innerText()).toBe(await balanced.innerText());
    const prose = (area: typeof airy) =>
      area.locator(".candidate-document > table > tbody > tr > td > table").nth(1);
    await expect(prose(balanced)).toHaveCSS("margin-bottom", "14px");
    await expect(prose(airy)).toHaveCSS("margin-bottom", "24px");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: testInfo.outputPath(`reading-layout-${mobile ? "mobile" : "desktop"}.png`),
    });
    await comparison.getByRole("button", { name: "여유 있는 간격 적용", exact: true }).click();
    await expect(comparison).toHaveCount(0);
    await expect(page.getByRole("button", { name: "배치 비교", exact: true })).toBeFocused();
    await expect(page.getByLabel("현재 읽기 배치", { exact: true })).toHaveText("여유 있는 간격");
    await page.getByRole("button", { name: "실행 취소", exact: true }).click();
    await expect(page.getByLabel("현재 읽기 배치", { exact: true })).toHaveText("기본 간격");
    await page.getByRole("button", { name: "다시 실행", exact: true }).click();
    await expect(page.getByLabel("현재 읽기 배치", { exact: true })).toHaveText("여유 있는 간격");
    await page.getByRole("button", { name: "글쓰기", exact: true }).click();
    await expect(editor.locator("p").first()).toHaveCSS("margin-bottom", "24px");
    await expect(editor.locator("li p").first()).toHaveCSS("margin-bottom", "0px");
    await expect(editor.locator("li").first()).toHaveCSS("margin-bottom", "12px");
    expect(await editor.textContent()).toBe(original);
    await expect(editor.locator("p").first().locator("strong a, a strong")).toHaveText(
      "기억할 핵심 문장",
    );
    await page.getByRole("button", { name: "디씨 복사", exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => (window as CapturedClipboard).copiedHtml))
      .toContain("line-height:1.95");
    const copied = await page.evaluate(() => (window as CapturedClipboard).copiedHtml);
    expect(copied).toContain('href="https://example.com/source"');
    expect(copied).toContain("margin:0 0 24px");
    await expect(page.locator(".topbar-status")).toContainText("저장됨");
    await page.reload();
    await expect(editor.locator("p").first()).toHaveCSS("margin-bottom", "24px");
    expect(await editor.textContent()).toBe(original);
    await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
    await page.getByRole("menuitem", { name: "HTML 원문 보기", exact: true }).click();
    await expect(page.getByLabel("복사용 HTML 원문", { exact: true })).toHaveValue(
      /line-height:1\.95/,
    );
  });
}
