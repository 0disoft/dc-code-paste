import { expect, test, type Page } from "@playwright/test";

async function waitForEditor(page: Page) {
  await page.goto("./");
  await expect(page.locator(".article-editor")).toContainText("DC-CODE-PASTE");
}

async function openTool(page: Page, name: string) {
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}

for (const mobile of [false, true]) {
  test(`keeps editing tools reachable while scrolling on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 });
    await waitForEditor(page);
    await page
      .locator(".canvas-scroll")
      .first()
      .evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
    await expect(page.getByRole("button", { name: "디씨 복사", exact: true })).toBeInViewport();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    if (mobile) {
      await expect(page.getByRole("button", { name: "실행 취소", exact: true })).toBeVisible();
      await expect(page.locator(".mobile-editing-bar")).toContainText("이 브라우저에 저장됨");
      await page.getByRole("button", { name: "블록 설정 패널", exact: true }).click();
    }
    await page.getByRole("tab", { name: "전체 글", exact: true }).click();
    await expect(page.getByLabel("본문 글자 크기", { exact: true })).toBeVisible();
    await expect(page.getByLabel("선택 글자 크기", { exact: true })).not.toBeVisible();
    await page.getByRole("tab", { name: "선택한 블록", exact: true }).click();
    await expect(page.getByLabel("선택 글자 크기", { exact: true })).toBeVisible();
  });
}

test("shows the block desk and keeps copy and import reachable", async ({ page }) => {
  await waitForEditor(page);
  await expect(page.getByRole("complementary", { name: "블록 삽입", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "요약 삽입", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "디씨 복사", exact: true })).toBeEnabled();
  await openTool(page, "Markdown");
  await page.getByLabel("Markdown 원문").fill("# 새 글\n\n일반 글도 꾸밀 수 있습니다.");
  await page.getByRole("button", { name: "Markdown 적용하기" }).click();
  await expect(page.locator(".article-editor")).toContainText("일반 글도 꾸밀 수 있습니다.");
  await expect(page.locator(".topbar-title-text")).toHaveText("새 글");
});

test("changes summary appearance, exports it and restores it after reload", async ({ page }) => {
  await waitForEditor(page);
  const summary = page.locator(".article-editor .dc-summary-box").first();
  await summary.locator(".dc-summary-item").first().click();
  await page.getByRole("button", { name: "초록 테마", exact: true }).click();
  await page.getByRole("button", { name: "가운데 정렬", exact: true }).click();
  await page
    .getByRole("group", { name: "요약 내부 여백" })
    .getByRole("button", { name: "크게" })
    .click();
  await page.getByLabel("요약 블록 제목").fill("핵심 요약");
  await page.getByLabel("요약 블록 제목").press("Enter");
  await expect(summary).toHaveAttribute("data-tone", "green");
  await expect(summary).toHaveAttribute("data-alignment", "center");
  await expect(summary).toHaveAttribute("data-spacing", "spacious");
  await expect(summary).toHaveAttribute("data-label", "핵심 요약");
  await expect(summary).toHaveCSS("background-color", "rgb(236, 253, 245)");
  await openTool(page, "HTML 원문 보기");
  const html = page.getByLabel("복사용 HTML 원문", { exact: true });
  await expect(html).toHaveValue(/bgcolor="#ecfdf5"/);
  await expect(html).toHaveValue(/padding:8px 24px 20px;text-align:center/);
  await expect(page.locator(".topbar-status")).toContainText("저장됨");
  await page.reload();
  await expect(summary).toHaveAttribute("data-tone", "green");
  await expect(summary).toHaveAttribute("data-spacing", "spacious");
  await expect(summary).toHaveAttribute("data-label", "핵심 요약");
});

test("applies code and edits its filename through the contextual inspector", async ({ page }) => {
  await waitForEditor(page);
  const editor = page.locator(".article-editor");
  const initialCount = await editor.locator("pre").count();
  await editor.locator(":scope > p").first().click();
  await page.getByRole("button", { name: "코드 삽입", exact: true }).click();
  await expect(editor.locator("pre")).toHaveCount(initialCount + 1);
  await page.getByLabel("코드 파일명", { exact: true }).fill("article-example.py");
  await page.getByLabel("코드 파일명", { exact: true }).press("Enter");
  await expect(editor.locator('pre[data-filename="article-example.py"]')).toHaveCount(1);
  await page.getByRole("tab", { name: "전체 글", exact: true }).click();
  await editor
    .locator('pre[data-filename="article-example.py"]')
    .dblclick({ position: { x: 40, y: 12 } });
  await expect(page.getByLabel("코드 파일명", { exact: true })).toBeFocused();
  await page.locator("details > summary").filter({ hasText: "글자 서식" }).click();
  await page.getByRole("button", { name: "코드블록 해제", exact: true }).click();
  await expect(editor.locator("pre")).toHaveCount(initialCount);
});

test("inserts a summary by dragging from the palette", async ({ page }) => {
  await waitForEditor(page);
  const editor = page.locator(".article-editor");
  const before = await editor.locator(".dc-summary-box").count();
  await page
    .getByRole("button", { name: "요약 삽입", exact: true })
    .dragTo(editor.locator(":scope > p").first());
  await expect(editor.locator(".dc-summary-box")).toHaveCount(before + 1);
});

for (const mobile of [false, true]) {
  test(`adds a link to summary text on ${mobile ? "mobile" : "desktop"}`, async ({ page }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await waitForEditor(page);
    const item = page.locator(".article-editor .dc-summary-item").first();
    await item.click();
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");
    if (mobile) await page.getByRole("button", { name: "블록 삽입 패널", exact: true }).click();
    await page.getByRole("button", { name: "링크 삽입", exact: true }).click();
    const input = page.getByLabel("링크 주소", { exact: true });
    await expect(input).toBeFocused();
    await input.fill("https://example.com");
    await input.press("Enter");
    await expect(item.locator("a")).toHaveAttribute("href", "https://example.com/");
  });
}

test("opens and closes mobile drawers without hiding copy or overflowing", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await waitForEditor(page);
  const paletteToggle = page.getByRole("button", { name: "블록 삽입 패널", exact: true });
  const inspectorToggle = page.getByRole("button", { name: "블록 설정 패널", exact: true });
  await expect(page.getByRole("button", { name: "디씨 복사", exact: true })).toBeInViewport();
  await paletteToggle.click();
  await expect(paletteToggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "요약 삽입", exact: true })).toBeInViewport();
  await page.keyboard.press("Escape");
  await expect(paletteToggle).toHaveAttribute("aria-pressed", "false");
  await inspectorToggle.click();
  await expect(inspectorToggle).toHaveAttribute("aria-pressed", "true");
  const firstTab = page.getByRole("tab", { name: "선택한 블록", exact: true });
  await firstTab.press("Shift+Tab");
  await expect(page.locator("#inspector-rail summary").last()).toBeFocused();
  await page.locator("#inspector-rail summary").last().press("Tab");
  await expect(firstTab).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(inspectorToggle).toHaveAttribute("aria-pressed", "false");
  await expect(inspectorToggle).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
