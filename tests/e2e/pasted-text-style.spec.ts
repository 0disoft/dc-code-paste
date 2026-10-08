import { expect, test } from "@playwright/test";

for (const mobile of [false, true]) {
  test(`preserves pasted RGB color, font and links through export and reload on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("./");
    const editor = page.locator(".article-editor");
    await expect(editor).toContainText("DC-CODE-PASTE");
    await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
    await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
    await page.getByLabel("Markdown 원문").fill("붙여넣을 곳");
    await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
    await expect(editor).toBeFocused();
    await page.keyboard.press("Control+a");
    await editor.evaluate((element) => {
      const data = new DataTransfer();
      data.setData(
        "text/html",
        '<p><strong><span style="color:rgb(37,99,235);font-family:Georgia;font-size:22px">가져온 글</span></strong> <a href="https://example.com/source">출처</a></p>',
      );
      data.setData("text/plain", "가져온 글 출처");
      element.dispatchEvent(
        new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data }),
      );
    });
    const span = editor.locator("span").filter({ hasText: "가져온 글" });
    await expect(span).toHaveCSS("color", "rgb(37, 99, 235)");
    await expect(span).toHaveCSS("font-family", "Georgia");
    await expect(span).toHaveCSS("font-size", "22px");
    await expect(editor.locator("a")).toHaveAttribute("href", "https://example.com/source");
    await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
    await page.getByRole("menuitem", { name: "HTML 원문 보기", exact: true }).click();
    const source = page.getByLabel("복사용 HTML 원문", { exact: true });
    await expect(source).toHaveValue(/color:#2563eb/);
    await expect(source).toHaveValue(/font-size:22px/);
    await expect(source).toHaveValue(/font-family:Georgia,Batang,serif/);
    await expect(page.locator(".topbar-status")).toContainText("저장됨");
    await page.reload();
    await expect(span).toHaveCSS("color", "rgb(37, 99, 235)");
    await expect(editor.locator("strong")).toHaveText("가져온 글");
  });
}
