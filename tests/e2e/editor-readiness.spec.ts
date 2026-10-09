import { expect, test } from "@playwright/test";

for (const mobile of [false, true]) {
  test(`blocks editing until delayed initialization finishes on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    // Simulate a busy event loop without replacing the editor or its commands.
    await page.addInitScript(() => {
      const schedule = window.setTimeout.bind(window);
      window.setTimeout = ((callback: TimerHandler, delay?: number, ...args: unknown[]) =>
        schedule(callback, (delay ?? 0) < 100 ? 500 : delay, ...args)) as typeof window.setTimeout;
    });
    await page.goto("./");
    const editor = page.locator(".article-editor");
    const surface = page.getByRole("group", {
      name: "글쓰기 편집기",
      exact: true,
      includeHidden: true,
    });
    // The constructor has rendered content, but create has not run yet.
    await expect(editor).toContainText("DC-CODE-PASTE");
    await expect(surface).toHaveAttribute("aria-busy", "true");
    await expect(surface).toHaveAttribute("inert", "");
    await expect(page.getByRole("button", { name: "디씨 복사", exact: true })).toBeDisabled();
    await expect(surface).toHaveAttribute("aria-busy", "false");
    await expect(surface).not.toHaveAttribute("inert");
    await editor.click();
    await editor.press("Control+End");
    await page.keyboard.insertText("초기화 후 바로 입력");
    await expect(editor).toContainText("초기화 후 바로 입력");
    await expect(page.locator(".topbar-status")).toContainText("저장됨");
    await page.reload();
    await expect(editor).toContainText("초기화 후 바로 입력");
    await expect(surface).toHaveAttribute("aria-busy", "false");
    await editor.press("Control+End");
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");
    await expect(
      page.getByRole("toolbar", { name: "선택한 글자 도구", exact: true }),
    ).toBeVisible();
  });
}
