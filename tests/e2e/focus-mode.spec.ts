import { expect, test, type Page } from "@playwright/test";

async function tool(page: Page, name: string) {
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}

async function focusMode(page: Page, active: boolean) {
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page
    .getByRole("menuitemcheckbox", {
      name: active ? "집중해서 쓰기" : "집중 모드 끝내기",
      exact: true,
    })
    .click();
  if (active) await expect(page.locator(".app-shell")).toHaveClass(/is-focused/);
  else await expect(page.locator(".app-shell")).not.toHaveClass(/is-focused/);
}

for (const mobile of [false, true]) {
  test(`preserves selection, reading position and output while using focus drawers on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 });
    await page.addInitScript(() => {
      (window as typeof window & { copiedHtml: string }).copiedHtml = "";
      Object.defineProperty(navigator, "clipboard", {
        value: {
          write: async (items: ClipboardItem[]) => {
            (window as typeof window & { copiedHtml: string }).copiedHtml = await (
              await items[0].getType("text/html")
            ).text();
          },
        },
      });
    });
    await page.goto("./");
    const editor = page.locator(".article-editor");
    await expect(editor).toContainText("DC-CODE-PASTE");
    await tool(page, "Markdown");
    await page
      .getByLabel("Markdown 원문")
      .fill(
        `# 글에 집중\n\n${Array.from({ length: 40 }, (_, index) => `문단 ${index + 1}. ${"읽던 문장과 편집 위치를 그대로 이어갑니다. ".repeat(4)}`).join("\n\n")}`,
      );
    await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
    await page.reload();
    await expect(page.getByRole("group", { name: "글쓰기 편집기", exact: true })).toHaveAttribute(
      "aria-busy",
      "false",
    );
    const original = await editor.textContent();
    await editor.locator(":scope > p").nth(28).click();
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");
    const selection = await page.evaluate(() => window.getSelection()?.toString());
    expect(selection?.length).toBeGreaterThan(0);
    const top = await page.evaluate(
      () => window.getSelection()!.getRangeAt(0).getBoundingClientRect().top,
    );
    await page.locator('[data-copy-trigger="preview"]').click();
    await expect
      .poll(() =>
        page.evaluate(() => (window as typeof window & { copiedHtml: string }).copiedHtml),
      )
      .not.toBe("");
    const html = await page.evaluate(
      () => (window as typeof window & { copiedHtml: string }).copiedHtml,
    );
    await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
    await page.getByRole("menuitem", { name: "저장함", exact: true }).focus();
    await page.keyboard.press("ArrowDown");
    const toggle = page.getByRole("menuitemcheckbox", { name: "집중해서 쓰기", exact: true });
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await page.keyboard.press("Enter");
    await expect(page.locator(".app-shell")).toHaveClass(/is-focused/);
    await expect(page.getByRole("complementary", { name: "블록 삽입", exact: true })).toBeHidden();
    await expect(page.getByRole("complementary", { name: "블록 설정", exact: true })).toBeHidden();
    await expect(editor).toBeFocused();
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(selection);
    await expect
      .poll(() =>
        page.evaluate(
          (originalTop) =>
            Math.abs(
              window.getSelection()!.getRangeAt(0).getBoundingClientRect().top - originalTop,
            ),
          top,
        ),
      )
      .toBeLessThan(4);
    expect(await editor.textContent()).toBe(original);
    await expect(page.getByRole("button", { name: "실행 취소", exact: true })).toBeDisabled();
    expect(
      await page
        .locator(".editor-surface")
        .evaluate((element) => element.getBoundingClientRect().width),
    ).toBeLessThanOrEqual(900);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: testInfo.outputPath(`focus-mode-${mobile ? "mobile" : "desktop"}.png`),
    });
    await page.locator('[data-copy-trigger="preview"]').click();
    await expect
      .poll(() =>
        page.evaluate(() => (window as typeof window & { copiedHtml: string }).copiedHtml),
      )
      .toBe(html);
    const settingsToggle = page.getByRole("button", { name: "블록 설정 패널", exact: true });
    await settingsToggle.click();
    const settings = page.getByRole("complementary", { name: "블록 설정", exact: true });
    await expect(settings).toBeVisible();
    await expect(page.getByRole("tab", { name: "선택한 블록", exact: true })).toBeFocused();
    await expect(page.getByLabel("출처를 연결할 문장", { exact: true })).toContainText(
      selection!.slice(0, 100),
    );
    await page.keyboard.press("Shift+Tab");
    expect(await settings.evaluate((element) => element.contains(document.activeElement))).toBe(
      true,
    );
    await page.keyboard.press("Tab");
    await expect(page.getByRole("tab", { name: "선택한 블록", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(settingsToggle).toBeFocused();
    await expect(settings).toBeHidden();
    await settingsToggle.click();
    await page
      .getByRole("button", { name: "패널 닫기", exact: true })
      .click({ position: { x: 4, y: 40 } });
    await expect(settingsToggle).toBeFocused();
    await expect(settings).toBeHidden();
    await page.getByRole("button", { name: "블록 삽입 패널", exact: true }).click();
    await page.getByRole("button", { name: "제목 삽입", exact: true }).click();
    await expect(editor).toBeFocused();
    await expect(editor.locator(":scope > p")).toHaveCount(39);
    await expect(editor.locator(":scope > h1")).toHaveCount(2);
    await expect(page.getByRole("complementary", { name: "블록 삽입", exact: true })).toBeHidden();
    await page.getByRole("button", { name: "실행 취소", exact: true }).click();
    expect(await editor.textContent()).toBe(original);
    await focusMode(page, false);
    if (!mobile) {
      await expect(settings).toBeVisible();
      await expect(
        page.getByRole("complementary", { name: "블록 삽입", exact: true }),
      ).toBeVisible();
    }
  });
}

test("keeps unfinished Markdown and AI input when switching to focus mode", async ({ page }) => {
  await page.route("https://openrouter.ai/**", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: [] }) }),
  );
  await page.goto("./");
  await expect(page.locator(".article-editor")).toContainText("DC-CODE-PASTE");
  const original = await page.locator(".article-editor").textContent();
  await tool(page, "Markdown");
  const pending = "# 적용하지 않은 원고\n\n작성 중인 내용";
  await page.getByLabel("Markdown 원문").fill(pending);
  await focusMode(page, true);
  await expect(page.getByLabel("Markdown 원문")).toHaveCount(0);
  await tool(page, "Markdown");
  await expect(page.getByLabel("Markdown 원문")).toHaveValue(pending);
  await focusMode(page, false);
  await tool(page, "AI 작성");
  await page.getByLabel("요청", { exact: true }).fill("아직 전송하지 않은 글 작성 요청");
  await focusMode(page, true);
  await expect(page.getByLabel("요청", { exact: true })).toHaveCount(0);
  await tool(page, "AI 작성");
  await expect(page.getByLabel("요청", { exact: true })).toHaveValue(
    "아직 전송하지 않은 글 작성 요청",
  );
  expect(await page.locator(".article-editor").textContent()).toBe(original);
});

test("keeps focus mode and moves focus out of hidden drawers across viewport changes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("./");
  await expect(page.locator(".article-editor")).toContainText("DC-CODE-PASTE");
  await focusMode(page, true);
  await page.getByRole("button", { name: "블록 삽입 패널", exact: true }).click();
  await expect(page.getByRole("tab", { name: "블록", exact: true })).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("complementary", { name: "블록 삽입", exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "블록 삽입 패널", exact: true })).toBeFocused();
  await expect(page.locator(".app-shell")).toHaveClass(/is-focused/);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByRole("complementary", { name: "블록 삽입", exact: true })).toBeHidden();
  await expect(page.locator(".canvas")).not.toHaveAttribute("inert");
  await focusMode(page, false);
  await expect(page.getByRole("complementary", { name: "블록 삽입", exact: true })).toBeVisible();
});

test("preserves a preview reading position when entering and leaving focus mode", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("./");
  await expect(page.locator(".article-editor")).toContainText("DC-CODE-PASTE");
  await tool(page, "Markdown");
  await page
    .getByLabel("Markdown 원문")
    .fill(
      `# 미리보기 읽기\n\n${Array.from({ length: 45 }, (_, index) => `문단 ${index + 1}. ${"읽던 구간을 유지합니다. ".repeat(5)}`).join("\n\n")}`,
    );
  await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
  await page.getByRole("button", { name: "미리보기", exact: true }).click();
  const passage = page
    .locator(".preview-surface td")
    .filter({ hasText: /^문단 26\./ })
    .last();
  await passage.scrollIntoViewIfNeeded();
  await passage.evaluate((element) => {
    const scroller = element.closest(".canvas-scroll")!;
    scroller.scrollTop +=
      element.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 8;
  });
  const readingOffset = () =>
    passage.evaluate(
      (element) =>
        element.getBoundingClientRect().top -
        element.closest(".canvas-scroll")!.getBoundingClientRect().top,
    );
  const top = await readingOffset();
  await focusMode(page, true);
  await expect(page.getByRole("button", { name: "글쓰기", exact: true })).toBeVisible();
  await expect.poll(readingOffset).toBeCloseTo(top, 0);
  await focusMode(page, false);
  await expect.poll(readingOffset).toBeCloseTo(top, 0);
});
