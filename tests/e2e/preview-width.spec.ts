import { expect, test } from "@playwright/test";

for (const mobile of [false, true]) {
  test(`checks article widths without changing export on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1487, height: 900 });
    await page.goto("./");
    await expect(page.locator(".article-editor")).toContainText("DC-CODE-PASTE");
    await page.getByRole("button", { name: "미리보기", exact: true }).click();
    const tools = page.getByRole("group", { name: "미리보기 폭", exact: true });
    await tools.getByRole("button", { name: "모바일", exact: true }).click();
    await expect(page.locator(".preview-surface")).toHaveCSS("width", "390px");
    await expect(tools.getByRole("button", { name: "모바일", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByRole("button", { name: "HTML", exact: true }).click();
    const source = page.getByRole("textbox", { name: "복사용 HTML 원문", exact: true });
    await expect(source).not.toHaveValue("");
    const original = await source.inputValue();
    await expect(tools).not.toBeVisible();
    await expect(page.getByRole("button", { name: "원문 복사", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "미리보기", exact: true }).click();
    await tools.getByRole("button", { name: "PC", exact: true }).click();
    await expect(page.locator(".preview-surface")).toHaveCSS("width", "960px");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await tools.getByRole("button", { name: "맞춤", exact: true }).click();
    const stage = page.locator(".preview-stage");
    const canvas = stage.locator("..");
    expect(await canvas.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    await page.getByRole("button", { name: "HTML", exact: true }).click();
    await expect(source).toHaveValue(original);
    await expect(page.getByRole("button", { name: "실행 취소", exact: true })).toBeDisabled();
  });
}
