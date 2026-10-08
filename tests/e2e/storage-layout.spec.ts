import { expect, test } from "@playwright/test";

for (const width of [390, 1280]) {
  test(`keeps populated storage inside the workspace at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("./");
    await expect(page.locator(".article-editor")).toContainText("DC-CODE-PASTE");
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("dc-code-paste:draft:v1")))
      .not.toBeNull();
    await page.evaluate(() => {
      const draft = JSON.parse(localStorage.getItem("dc-code-paste:draft:v1")!);
      const entries = Array.from({ length: 10 }, (_, index) => ({
        ...draft,
        id: `storage-${index}`,
        name: `${index} ${"긴 제목의 초안과 프리셋 ".repeat(4)}`,
        createdAt: draft.updatedAt,
      }));
      localStorage.setItem("dc-code-paste:draft-history:v1", JSON.stringify(entries));
      localStorage.setItem(
        "dc-code-paste:presets:v1",
        JSON.stringify({
          version: 1,
          presets: entries.map((entry) => ({ ...entry, version: 1 })),
        }),
      );
    });
    await page.reload();
    await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
    await page.getByRole("menuitem", { name: "저장함", exact: true }).click();

    await expect(page.locator(".preset-item")).toHaveCount(10);
    await expect(page.locator(".draft-history-item")).toHaveCount(10);
    for (const selector of [".panel-dock", "#storage-panel"]) {
      expect(
        await page
          .locator(selector)
          .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
      ).toBe(true);
    }
    await expect(page.getByLabel("프리셋 이름", { exact: true })).toBeInViewport();
    await expect(
      page.getByRole("button", { name: "초안 파일 불러오기", exact: true }),
    ).toBeInViewport();
    const preset = page.locator(".preset-item").first();
    expect(
      await preset.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return Array.from(element.querySelectorAll("button")).every((button) => {
          const rect = button.getBoundingClientRect();
          return rect.left >= bounds.left && rect.right <= bounds.right && rect.width >= 30;
        });
      }),
    ).toBe(true);
    await page
      .locator(".preset-item")
      .last()
      .getByRole("button", { name: /이름 변경$/ })
      .click();
    await expect(page.getByLabel("프리셋 제목 변경", { exact: true })).toBeFocused();
    await page.getByLabel("프리셋 제목 변경", { exact: true }).fill("바꾼 이름");
    await page.getByLabel("프리셋 제목 변경", { exact: true }).press("Enter");
    await expect(
      page.getByRole("button", { name: "바꾼 이름 삭제", exact: true }),
    ).toBeInViewport();
    expect(await page.locator(".panel-dock").evaluate((element) => element.scrollLeft)).toBe(0);
  });
}

test("opens the hidden draft input through the visible import button", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator(".article-editor")).toContainText("DC-CODE-PASTE");
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "저장함", exact: true }).click();
  await expect(page.getByLabel("초안 JSON 파일", { exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "초안 JSON 파일", exact: true })).toHaveCount(0);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "초안 파일 불러오기", exact: true }).click();
  await (
    await chooser
  ).setFiles({ name: "broken.json", mimeType: "application/json", buffer: Buffer.from("{broken") });
  await expect(page.getByRole("alert")).toContainText("올바른 초안 JSON");
});
