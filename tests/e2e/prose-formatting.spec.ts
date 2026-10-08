import { expect, test, type Page } from "@playwright/test";

async function loadMarkdown(page: Page, markdown: string) {
  await page.goto("./");
  await expect(page.locator(".article-editor")).toContainText("DC-CODE-PASTE");
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
  await page.getByLabel("Markdown 원문").fill(markdown);
  await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
  await expect(page.locator(".article-editor")).toBeFocused();
}

for (const mobile of [false, true]) {
  test(`changes heading levels and returns to prose on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await loadMarkdown(page, "### **소제목**\n\n본문");
    const editor = page.locator(".article-editor");
    await editor.locator("h3").click();
    if (mobile) await page.getByRole("button", { name: "블록 설정 패널", exact: true }).click();
    const heading = page.getByRole("button", { name: "제목", exact: true });
    await expect(heading).toHaveAttribute("aria-pressed", "true");
    const level = page.getByLabel("제목 단계", { exact: true });
    await expect(level).toHaveValue("3");
    await level.selectOption("4");
    await expect(editor.locator("h4 strong")).toHaveText("소제목");
    await level.selectOption("4");
    await expect(editor.locator("h4")).toHaveText("소제목");
    await expect(page.locator(".topbar-status")).toContainText("저장됨");
    await page.reload();
    await expect(editor.locator("h4")).toHaveText("소제목");
    await editor.locator("h4").click();
    if (mobile) await page.getByRole("button", { name: "블록 설정 패널", exact: true }).click();
    await expect(level).toHaveValue("4");
    await heading.click();
    await expect(editor.locator(":scope > p strong")).toHaveText("소제목");
    await expect(level).not.toBeVisible();
    await expect(page.getByRole("button", { name: "코드블록 적용", exact: true })).toHaveCount(1);
    await page.getByRole("button", { name: "실행 취소", exact: true }).click();
    await expect(editor.locator("h4 strong")).toHaveText("소제목");
  });

  test(`creates, exports and restores a numbered list on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await loadMarkdown(page, "첫 항목\n\n두 번째 항목");
    const editor = page.locator(".article-editor");
    await editor.locator(":scope > p").first().click();
    await page.keyboard.press("Control+a");
    if (mobile) await page.getByRole("button", { name: "블록 설정 패널", exact: true }).click();
    await expect(page.getByRole("region", { name: "선택 영역", exact: true })).toContainText(
      "선택한 글자에 적용됩니다.",
    );
    const numbered = page.getByRole("button", { name: "번호 목록", exact: true });
    await numbered.click();
    await expect(editor.locator("ol > li")).toHaveCount(2);
    if (mobile) await page.getByRole("button", { name: "블록 설정 패널", exact: true }).click();
    await editor.locator("ol > li").first().click();
    if (mobile) await page.getByRole("button", { name: "블록 설정 패널", exact: true }).click();
    await expect(numbered).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".topbar-status")).toContainText("저장됨");
    await page.reload();
    await expect(editor.locator("ol > li")).toHaveCount(2);
    await page.getByRole("button", { name: "미리보기", exact: true }).click();
    await expect(page.locator(".preview-surface").getByText("1.", { exact: true })).toBeVisible();
    await expect(page.locator(".preview-surface").getByText("2.", { exact: true })).toBeVisible();
    await page.getByRole("banner").getByRole("button", { name: "글쓰기", exact: true }).click();
    await editor.locator("ol > li").first().click();
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+ArrowDown");
    await page.keyboard.press("Shift+End");
    await expect
      .poll(() => page.evaluate(() => window.getSelection()?.toString()))
      .toContain("두 번째 항목");
    if (mobile) await page.getByRole("button", { name: "블록 설정 패널", exact: true }).click();
    await expect(page.getByRole("region", { name: "선택 영역", exact: true })).toContainText(
      "선택한 글자에 적용됩니다.",
    );
    await numbered.click();
    await expect(editor.locator("ol")).toHaveCount(0);
    await expect(editor.locator(":scope > p").filter({ hasText: "첫 항목" })).toHaveCount(1);
    await expect(editor.locator(":scope > p").filter({ hasText: "두 번째 항목" })).toHaveCount(1);
  });
}
