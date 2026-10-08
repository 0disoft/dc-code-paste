import { expect, test } from "@playwright/test";

for (const mobile of [false, true]) {
  test(`undoes and redoes a document replacement with its preferences on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("./");
    const editor = page.locator(".article-editor");
    await expect(editor).toContainText("DC-CODE-PASTE");
    if (mobile) await page.getByRole("button", { name: "블록 설정 패널", exact: true }).click();
    await page.getByRole("tab", { name: "전체 글", exact: true }).click();
    await page.getByLabel("본문 글꼴", { exact: true }).selectOption("Georgia");
    await page.getByLabel("복사될 글 배경", { exact: true }).selectOption("darkEditorial");
    if (mobile) await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
    await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
    await page.getByLabel("Markdown 원문").fill("# 이전 글\n\n되돌릴 본문");
    await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
    await expect(editor).toContainText("되돌릴 본문");
    if (mobile) await page.getByRole("button", { name: "블록 삽입 패널", exact: true }).click();
    await page.getByRole("tab", { name: "템플릿", exact: true }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "뉴스 정리 템플릿", exact: true }).click();
    await expect(editor).toContainText("뉴스 제목을 입력하세요");
    await expect(page.locator(".editor-surface")).toHaveClass(/editor-surface-clean/);
    await page.getByRole("button", { name: "실행 취소", exact: true }).click();
    await expect(editor).toContainText("되돌릴 본문");
    await expect(editor).toHaveCSS("font-family", /Georgia/);
    await expect(page.locator(".editor-surface")).toHaveClass(/editor-surface-dark/);
    await page.getByRole("button", { name: "다시 실행", exact: true }).click();
    await expect(editor).toContainText("뉴스 제목을 입력하세요");
    await expect(editor).not.toHaveCSS("font-family", /Georgia/);
    await expect(page.locator(".editor-surface")).toHaveClass(/editor-surface-clean/);
    await editor.press("Control+z");
    await expect(editor).toContainText("되돌릴 본문");
    await page.keyboard.insertText("새로 입력");
    await expect(editor).toContainText("새로 입력");
    await editor.press("Control+z");
    await expect(editor).not.toContainText("새로 입력");
    await expect(editor).toContainText("되돌릴 본문");
    await expect(editor).toHaveCSS("font-family", /Georgia/);
  });
}

test("restores preferences when the replacement has identical content", async ({ page }) => {
  await page.goto("./");
  const editor = page.locator(".article-editor");
  await expect(editor).toContainText("DC-CODE-PASTE");
  await page.getByRole("tab", { name: "템플릿", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "뉴스 정리 템플릿", exact: true }).click();
  await expect(editor).toContainText("뉴스 제목을 입력하세요");
  await page.getByRole("tab", { name: "전체 글", exact: true }).click();
  await page.getByLabel("본문 글꼴", { exact: true }).selectOption("Georgia");
  await page.getByLabel("복사될 글 배경", { exact: true }).selectOption("darkEditorial");
  await page.getByRole("tab", { name: "템플릿", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "뉴스 정리 템플릿", exact: true }).click();
  await expect(page.locator(".editor-surface")).toHaveClass(/editor-surface-clean/);
  await editor.press("Control+z");
  await expect(editor).toContainText("뉴스 제목을 입력하세요");
  await expect(editor).toHaveCSS("font-family", /Georgia/);
  await expect(page.locator(".editor-surface")).toHaveClass(/editor-surface-dark/);
  await expect(page.getByRole("button", { name: "다시 실행", exact: true })).toBeEnabled();
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("dc-code-paste:draft:v1") ?? "null")?.preferences,
      ),
    )
    .toMatchObject({
      bodyFontFamily: expect.stringContaining("Georgia"),
      documentTheme: "darkEditorial",
    });
  await editor.press("Control+y");
  await expect(page.locator(".editor-surface")).toHaveClass(/editor-surface-clean/);
});
