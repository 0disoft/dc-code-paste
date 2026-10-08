import { expect, test } from "@playwright/test";

for (const mobile of [false, true]) {
  test(`finds blocks and navigates from preview on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1487, height: 900 });
    await page.goto("./");
    const editor = page.locator(".article-editor");
    await expect(editor).toContainText("DC-CODE-PASTE");
    const before = (await editor.innerText()).trim();
    if (mobile) await page.getByRole("button", { name: "블록 삽입 패널", exact: true }).click();
    const search = page.getByRole("searchbox", { name: "삽입 블록 검색" });
    await search.fill("강조");
    await expect(page.getByRole("button", { name: "강조 상자 삽입", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "코드 삽입", exact: true })).not.toBeVisible();
    await search.fill("없는 블록 이름");
    await expect(
      page.getByRole("status").filter({ hasText: "일치하는 블록이 없습니다" }),
    ).toBeVisible();
    await search.fill("");
    if (mobile) await search.press("Escape");
    await page.getByRole("button", { name: "미리보기", exact: true }).click();
    if (mobile) await page.getByRole("button", { name: "블록 삽입 패널", exact: true }).click();
    await page.getByRole("tab", { name: "글 구성", exact: true }).click();
    const outlineSearch = page.getByRole("searchbox", { name: "글 구성 검색" });
    await outlineSearch.fill("요약");
    const item = page
      .getByRole("navigation", { name: "글 구성", exact: true })
      .getByRole("button")
      .first();
    await expect(item).toContainText("요약 블록");
    await item.click();
    await expect(editor).toBeVisible();
    await expect(editor.locator(".dc-selected-block")).toHaveClass(/dc-summary-box/);
    await expect(editor).toBeFocused();
    expect((await editor.innerText()).trim()).toBe(before);
    if (mobile) {
      await expect(
        page.getByRole("button", { name: "블록 삽입 패널", exact: true }),
      ).toHaveAttribute("aria-pressed", "false");
      await page.getByRole("button", { name: "블록 삽입 패널", exact: true }).click();
    }
    await outlineSearch.fill("");
    const last = page
      .getByRole("navigation", { name: "글 구성", exact: true })
      .getByRole("button")
      .filter({ hasText: "코드블록" })
      .last();
    const text = await last.locator(".outline-text").innerText();
    await last.click();
    await expect(editor.locator(".dc-selected-block")).toContainText(text.replace(/…$/, ""));
    await expect(editor.locator(".dc-selected-block")).toBeInViewport();
    await expect(page.getByRole("button", { name: "실행 취소", exact: true })).toBeDisabled();
  });
}
