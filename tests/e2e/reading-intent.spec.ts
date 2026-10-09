import { expect, test } from "@playwright/test";

for (const mobile of [false, true]) {
  test(`marks a selected sentence without changing text and restores its intention on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }, testInfo) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("./");
    const editor = page.locator(".article-editor");
    await expect(editor).toContainText("DC-CODE-PASTE");
    await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
    await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
    await page
      .getByLabel("Markdown 원문")
      .fill(
        "# 읽는 순서\n\n**[기억할 핵심 문장](https://example.com/source)**\n\n내용을 설명하는 문장",
      );
    await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
    const original = await editor.textContent();
    const sentence = editor.locator("p").first();
    await sentence.click();
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");
    const toolbar = page.getByRole("toolbar", { name: "선택한 글자 도구", exact: true });
    await expect(toolbar).toBeVisible();
    expect(
      await toolbar.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return (
          bounds.left >= 0 &&
          bounds.right <= innerWidth &&
          bounds.top >= 0 &&
          bounds.bottom <= innerHeight
        );
      }),
    ).toBe(true);
    await toolbar.getByRole("button", { name: "읽는 의도 선택", exact: true }).click();
    await toolbar.getByRole("button", { name: "읽는 의도: 먼저 읽기", exact: true }).click();
    await expect(sentence.locator('[data-reading-intent="focus"]')).toHaveText("기억할 핵심 문장");
    await expect(sentence.locator("a")).toHaveAttribute("href", "https://example.com/source");
    await expect(sentence.locator("strong")).toHaveText("기억할 핵심 문장");
    await expect(toolbar).toHaveCount(0);
    expect(await editor.textContent()).toBe(original);
    await page.screenshot({ path: testInfo.outputPath("reading-intent.png") });
    await editor.press("Control+z");
    await expect(sentence.locator("[data-reading-intent]")).toHaveCount(0);
    await expect(toolbar).toBeVisible();
    await editor.press("Control+y");
    await expect(sentence.locator('[data-reading-intent="focus"]')).toHaveCount(1);
    await toolbar.getByRole("button", { name: "읽는 의도 선택", exact: true }).click();
    await toolbar
      .getByRole("button", { name: "읽는 의도: 아직 답하지 못한 질문", exact: true })
      .click();
    await expect(sentence.locator('[data-reading-intent="question"]')).toHaveCount(1);
    await expect(page.locator(".topbar-status")).toContainText("저장됨");
    await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
    await page.getByRole("menuitem", { name: "HTML 원문 보기", exact: true }).click();
    const html = page.getByLabel("복사용 HTML 원문", { exact: true });
    await expect(html).toHaveValue(/data-reading-intent="question"/);
    await expect(html).toHaveValue(/href="https:\/\/example.com\/source"/);
    await page.reload();
    await expect(sentence.locator('[data-reading-intent="question"]')).toHaveText(
      "기억할 핵심 문장",
    );
    await expect(page.getByRole("group", { name: "글쓰기 편집기", exact: true })).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await sentence.click();
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");
    await toolbar.getByRole("button", { name: "읽는 의도 선택", exact: true }).click();
    await toolbar.getByRole("button", { name: "읽는 의도 해제", exact: true }).click();
    await expect(sentence.locator("[data-reading-intent]")).toHaveCount(0);
    expect(await editor.textContent()).toBe(original);
    await expect(sentence.locator("strong")).toHaveText("기억할 핵심 문장");
    await expect(sentence.locator("a")).toHaveAttribute("href", "https://example.com/source");
  });
}

test("keeps code formatting and disables reading intentions for a code-only selection", async ({
  page,
}) => {
  await page.goto("./");
  const editor = page.locator(".article-editor");
  await expect(editor).toContainText("DC-CODE-PASTE");
  const code = editor.locator("pre").first();
  const original = await code.innerText();
  await code.click();
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+End");
  await expect(page.getByRole("toolbar", { name: "선택한 글자 도구", exact: true })).toHaveCount(0);
  const controls = page.getByRole("group", { name: "읽는 의도", exact: true });
  for (const button of await controls.getByRole("button").all())
    await expect(button).toBeDisabled();
  expect(await code.innerText()).toBe(original);
});
