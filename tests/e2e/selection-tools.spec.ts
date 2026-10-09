import { expect, test } from "@playwright/test";

for (const mobile of [false, true]) {
  test(`formats selected prose nearby without losing links or undo boundaries on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(mobile ? { width: 320, height: 844 } : { width: 1280, height: 900 });
    await page.goto("./");
    const editor = page.locator(".article-editor");
    await expect(editor).toContainText("DC-CODE-PASTE");
    await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
    await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
    await page
      .getByLabel("Markdown 원문")
      .fill(
        "# 선택한 문장\n\n[기억할](https://example.com/source) 문장\n\n다른 문단\n\n```js\nconst code = 1;\n```",
      );
    await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
    await expect(page.locator(".topbar-status")).toContainText("저장됨");
    await page.reload();
    await expect(page.getByRole("group", { name: "글쓰기 편집기", exact: true })).toHaveAttribute(
      "aria-busy",
      "false",
    );
    const original = await editor.textContent();
    const sentence = editor.locator("p").first();
    async function expectMarkedSentence(mark: "strong" | "em" | '[data-reading-intent="focus"]') {
      await expect
        .poll(async () => (await sentence.locator(mark).allTextContents()).join(""))
        .toBe("기억할 문장");
    }
    const toolbar = page.getByRole("toolbar", { name: "선택한 글자 도구", exact: true });
    await sentence.click({ clickCount: 3 });
    await expect
      .poll(() => page.evaluate(() => window.getSelection()?.toString()))
      .toBe("기억할 문장");
    await expect(toolbar).toBeVisible();
    const readingToggle = toolbar.getByRole("button", { name: "읽는 의도 선택", exact: true });
    await expect(readingToggle).toHaveAttribute("aria-expanded", "false");
    await expect(
      toolbar.getByRole("button", { name: "읽는 의도: 먼저 읽기", exact: true }),
    ).toHaveCount(0);
    await toolbar.getByRole("button", { name: "굵게", exact: true }).click();
    await expectMarkedSentence("strong");
    await expect(toolbar.getByRole("button", { name: "굵게", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe("기억할 문장");
    const italic = toolbar.getByRole("button", { name: "기울임", exact: true });
    await italic.focus();
    await page.keyboard.press("Enter");
    await expectMarkedSentence("em");
    await expect(editor).toBeFocused();
    await editor.press("Control+z");
    await expect(sentence.locator("em")).toHaveCount(0);
    await expectMarkedSentence("strong");
    await editor.press("Control+z");
    await expect(sentence.locator("strong")).toHaveCount(0);
    expect(await editor.textContent()).toBe(original);
    await editor.press("Control+y");
    await editor.press("Control+y");
    await readingToggle.click();
    await expect(readingToggle).toHaveAttribute("aria-expanded", "true");
    await expect(
      toolbar.getByRole("group", { name: "읽는 의도", exact: true }).getByRole("button"),
    ).toHaveCount(6);
    await expect
      .poll(() =>
        toolbar.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return (
            rect.left >= 0 &&
            rect.right <= innerWidth &&
            rect.top >= 0 &&
            rect.bottom <= innerHeight
          );
        }),
      )
      .toBe(true);
    expect(
      await page.locator('[data-copy-trigger="preview"]').evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= innerWidth;
      }),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`selection-tools-${mobile ? "mobile" : "desktop"}.png`),
    });
    await toolbar.getByRole("button", { name: "읽는 의도: 먼저 읽기", exact: true }).click();
    await expectMarkedSentence('[data-reading-intent="focus"]');
    await expect(toolbar).toHaveCount(0);
    await page.keyboard.insertText("바꾼 문장");
    await expect(sentence).toHaveText("바꾼 문장");
    await editor.press("Control+z");
    await expect(sentence).toHaveText("기억할 문장");
    await expectMarkedSentence('[data-reading-intent="focus"]');
    await expectMarkedSentence("strong");
    await expectMarkedSentence("em");
    await expect(sentence.locator("a")).toHaveAttribute("href", "https://example.com/source");
    await editor.press("Escape");
    await expect(toolbar).toHaveCount(0);
    await editor.locator("pre").click();
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");
    await expect(toolbar).toHaveCount(0);
    await expect(editor.locator("pre")).toHaveText("const code = 1;");
    await expect(page.locator(".topbar-status")).toContainText("저장됨");
    await page.reload();
    await expectMarkedSentence('[data-reading-intent="focus"]');
    await expectMarkedSentence("strong");
    await expectMarkedSentence("em");
    expect(await editor.textContent()).toBe(original);
  });
}
