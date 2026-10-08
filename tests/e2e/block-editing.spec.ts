import { expect, test } from "@playwright/test";

test("keeps the duplicated summary editable after moving it", async ({ page }) => {
  await page.goto("./");
  const editor = page.locator(".article-editor");
  await expect(editor).toContainText("DC-CODE-PASTE");
  const summaries = editor.locator(".dc-summary-box");
  const originalLabel = await summaries.first().getAttribute("data-label");
  const originalText = await summaries.first().locator(".dc-summary-item").first().innerText();
  const count = await summaries.count();
  await summaries.first().locator(".dc-summary-item").first().click();
  await page.getByRole("button", { name: "블록 복제", exact: true }).click();
  await expect(summaries).toHaveCount(count + 1);
  const title = page.getByLabel("요약 블록 제목", { exact: true });
  await expect(title).toHaveValue(originalLabel!);
  await title.fill("복제본 제목");
  await title.press("Enter");
  await expect(editor.locator(".dc-selected-block")).toHaveAttribute("data-label", "복제본 제목");
  await page.getByRole("button", { name: "위로 이동", exact: true }).click();
  await expect(title).toHaveValue("복제본 제목");
  await expect(editor).toBeFocused();
  await page.keyboard.insertText("덧붙인 내용 ");
  await expect(summaries).toHaveCount(count + 1);
  await expect(editor.locator(".dc-selected-block")).toContainText("덧붙인 내용");
  await expect(editor.locator(".dc-selected-block")).toContainText(originalText);
  await expect(summaries.filter({ hasNotText: "덧붙인 내용" }).first()).toHaveAttribute(
    "data-label",
    originalLabel!,
  );
});

test("returns to the edited block after a mobile inspector action", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  const editor = page.locator(".article-editor");
  await expect(editor).toContainText("DC-CODE-PASTE");
  const summaries = editor.locator(".dc-summary-box");
  const count = await summaries.count();
  await summaries.first().locator(".dc-summary-item").first().click();
  const toggle = page.getByRole("button", { name: "블록 설정 패널", exact: true });
  await toggle.click();
  await page.getByRole("button", { name: "블록 복제", exact: true }).click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(editor).toBeFocused();
  await page.keyboard.insertText("모바일에서 추가 ");
  await expect(summaries).toHaveCount(count + 1);
  await expect(editor.locator(".dc-selected-block")).toContainText("모바일에서 추가");
});
