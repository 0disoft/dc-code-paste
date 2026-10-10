import { expect, test } from "@playwright/test";

test("keeps all presets when full and allows a new save only after explicit deletion", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.locator(".article-editor")).toBeVisible();
  await expect(page.locator(".topbar-status")).toContainText("저장됨");
  await page.evaluate(() => {
    const snapshot = JSON.parse(localStorage.getItem("dc-code-paste:draft:v1")!);
    localStorage.setItem(
      "dc-code-paste:presets:v1",
      JSON.stringify({
        version: 1,
        presets: Array.from({ length: 30 }, (_, index) => ({
          version: 1,
          id: `preset-${index}`,
          name: `보관 프리셋 ${index}`,
          createdAt: snapshot.updatedAt,
          updatedAt: snapshot.updatedAt,
          document: snapshot.document,
          preferences: snapshot.preferences,
        })),
      }),
    );
  });
  await page.reload();
  await expect(page.locator(".article-editor")).toBeVisible();
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "저장함", exact: true }).click();
  const raw = await page.evaluate(() => localStorage.getItem("dc-code-paste:presets:v1"));
  await page.getByLabel("프리셋 이름", { exact: true }).fill("새로 보관할 글");
  await page.getByRole("button", { name: "프리셋 저장", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("기존 프리셋을 삭제한 뒤 저장해 주세요");
  await expect(page.getByLabel("프리셋 이름", { exact: true })).toHaveValue("새로 보관할 글");
  expect(await page.evaluate(() => localStorage.getItem("dc-code-paste:presets:v1"))).toBe(raw);
  await page.getByRole("button", { name: "보관 프리셋 29 삭제", exact: true }).click();
  await page.getByRole("button", { name: "프리셋 저장", exact: true }).click();
  await expect(page.locator(".preset-item")).toHaveCount(30);
  await expect(page.locator(".preset-apply").filter({ hasText: "보관 프리셋 0" })).toHaveCount(1);
  await expect(page.locator(".preset-apply").filter({ hasText: "새로 보관할 글" })).toHaveCount(1);
});
