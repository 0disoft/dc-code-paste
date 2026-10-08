import { expect, test } from "@playwright/test";

for (const mobile of [false, true]) {
  test(`keeps prose and explicit Markdown breaks through export and reload on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("./");
    const editor = page.locator(".article-editor");
    await expect(editor).toContainText("DC-CODE-PASTE");
    await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
    await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
    await page
      .getByLabel("Markdown 원문")
      .fill(
        "안녕하세요\n\nREADME.md\n\n**첫째  \n둘째**\n\n- 셋째\\\n  넷째\n\n> 다섯째  \n> 여섯째",
      );
    await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
    await expect(editor.locator("p").first()).toHaveText("안녕하세요");
    await expect(editor.locator("p").nth(1)).toHaveText("README.md");
    await expect(editor.locator("br:not(.ProseMirror-trailingBreak)")).toHaveCount(3);
    await expect(editor.locator("strong").filter({ hasText: "첫째" })).toBeVisible();
    await expect(editor.locator("strong").filter({ hasText: "둘째" })).toBeVisible();
    await expect(editor.locator("li")).toHaveText("셋째넷째");
    await expect(editor.locator("blockquote")).toHaveText("다섯째여섯째");
    await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
    await page.getByRole("menuitem", { name: "HTML 원문 보기", exact: true }).click();
    const source = page.getByLabel("복사용 HTML 원문", { exact: true });
    await expect(source).toHaveValue(/안녕하세요/);
    await expect(source).toHaveValue(/README\.md/);
    await expect(source).not.toHaveValue(/xn--|https:\/\/readme\.md/);
    for (const [before, after] of [
      ["첫째", "둘째"],
      ["셋째", "넷째"],
      ["다섯째", "여섯째"],
    ]) {
      await expect(source).toHaveValue(new RegExp(`${before}[\\s\\S]*?<br>[\\s\\S]*?${after}`));
    }
    await expect(page.locator(".topbar-status")).toContainText("저장됨");
    await page.reload();
    await expect(editor.locator("p").first()).toHaveText("안녕하세요");
    await expect(editor.locator("br:not(.ProseMirror-trailingBreak)")).toHaveCount(3);
    await expect(editor.locator("strong").filter({ hasText: "둘째" })).toBeVisible();
  });
}
