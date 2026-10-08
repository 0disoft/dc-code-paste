import { expect, test } from "@playwright/test";

for (const theme of ["cleanEditorial", "lightLecture", "darkEditorial"]) {
  test(`uses the exported body colors in the editor for ${theme}`, async ({ page }) => {
    await page.goto("./");
    await expect(page.locator(".article-editor")).toContainText("DC-CODE-PASTE");
    await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
    await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
    await page.getByLabel("Markdown 원문").fill("기본 문단");
    await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
    await page.getByRole("tab", { name: "전체 글", exact: true }).click();
    await page.getByLabel("복사될 글 배경").selectOption(theme);
    const surface = page.locator(".editor-surface");
    const paragraph = page.locator(".article-editor > p");
    const editorBackground = await surface.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    const editorColor = await paragraph.evaluate((element) => getComputedStyle(element).color);
    await page.getByRole("button", { name: "미리보기", exact: true }).click();
    const table = page.locator(".preview-surface > table");
    await expect(table).toBeVisible();
    await expect(table).toHaveCSS("background-color", editorBackground);
    await expect(
      page.locator(".preview-surface").getByText("기본 문단", { exact: true }),
    ).toHaveCSS("color", editorColor);
  });
}
