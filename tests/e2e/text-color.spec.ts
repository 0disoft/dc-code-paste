import { expect, test } from "@playwright/test";

for (const theme of ["cleanEditorial", "darkEditorial"]) {
  test(`shows the applied text color and resets color independently in ${theme}`, async ({
    page,
  }) => {
    await page.goto("./");
    await expect(page.locator(".article-editor")).toContainText("DC-CODE-PASTE");
    await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
    await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
    await page.getByLabel("Markdown 원문").fill("**꾸밀 문단**\n\n일반 문단");
    await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
    await page.getByRole("tab", { name: "전체 글", exact: true }).click();
    await page.getByLabel("복사될 글 배경").selectOption(theme);
    await page.getByRole("tab", { name: "선택한 블록", exact: true }).click();
    const paragraph = page.locator(".article-editor > p").first();
    await paragraph.click();
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");
    await expect(page.getByRole("region", { name: "선택 영역", exact: true })).toContainText(
      "선택한 글자에 적용됩니다.",
    );
    await page.getByLabel("선택 글꼴", { exact: true }).selectOption({ label: "Georgia" });
    await expect(page.locator(".article-editor")).toBeFocused();
    await page.getByLabel("선택 글자 크기", { exact: true }).selectOption("20px");
    await expect(page.locator(".article-editor")).toBeFocused();
    await expect(paragraph.locator("span")).toHaveCSS("font-family", /Georgia/);
    await expect(paragraph.locator("span")).toHaveCSS("font-size", "20px");
    const swatch = page.getByRole("button", { name: "짙은 회색 글자색", exact: true });
    await swatch.click();
    await expect(swatch).toHaveAttribute("aria-pressed", "true");
    await expect(swatch).toHaveClass(/is-active/);
    const shownColor = await swatch.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    await expect(paragraph.locator("span")).toHaveCSS("color", shownColor);
    await page.getByRole("button", { name: "본문 글자색", exact: true }).click();
    await expect(paragraph.locator("span")).not.toHaveAttribute("style", /(?:^|;)\s*color:/);
    await expect(paragraph.locator("span")).toHaveCSS("font-family", /Georgia/);
    await expect(paragraph.locator("span")).toHaveCSS("font-size", "20px");
    await expect(paragraph.locator("strong")).toHaveText("꾸밀 문단");
    await expect(swatch).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("button", { name: "본문 글자색", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
}
