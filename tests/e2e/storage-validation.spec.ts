import { expect, test } from "@playwright/test";

test("reports unreadable draft saves and keeps the previous saved document", async ({ page }) => {
  await page.goto("./");
  const editor = page.locator(".article-editor");
  await expect(editor).toContainText("DC-CODE-PASTE");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("dc-code-paste:draft:v1")))
    .not.toBeNull();
  const previous = await page.evaluate(() => localStorage.getItem("dc-code-paste:draft:v1"));
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
  const input = page.getByLabel("Markdown 원문");
  await expect(input).toBeVisible();
  await expect(input).toBeEditable();
  // Set up the large fixture without measuring the browser's native text insertion latency.
  await input.evaluate((element) => {
    (element as HTMLTextAreaElement).value = Array.from(
      { length: 10_000 },
      (_, index) => `문단 ${index}`,
    ).join("\n\n");
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
  await expect(editor).toContainText("문단 9999");
  await expect(
    page.getByRole("alert").getByText("저장 실패 · 이 탭의 내용을 복사해 보관하세요"),
  ).toBeVisible({ timeout: 15_000 });
  expect(await page.evaluate(() => localStorage.getItem("dc-code-paste:draft:v1"))).toBe(previous);
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "저장함", exact: true }).click();
  await page.getByLabel("프리셋 이름", { exact: true }).fill("제한 초과 글");
  await page.getByRole("button", { name: "프리셋 저장", exact: true }).click();
  await expect(page.locator(".preset-count")).toHaveText("저장 실패");
  await page.getByRole("button", { name: "초안 스냅샷 저장", exact: true }).click();
  await expect(page.locator(".draft-history-count")).toHaveText("저장 실패");
  expect(await page.evaluate(() => localStorage.getItem("dc-code-paste:presets:v1"))).toBeNull();
  expect(
    await page.evaluate(() => localStorage.getItem("dc-code-paste:draft-history:v1")),
  ).not.toContain("문단 9999");
  await page.reload();
  await expect(editor).toContainText("DC-CODE-PASTE");
  await expect(page.getByRole("alert")).not.toBeVisible();
});
