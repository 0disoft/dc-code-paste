import { expect, test } from "@playwright/test";

test("keeps the saved document unchanged when adjusting settings before editing", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.locator(".article-editor")).toContainText("DC-CODE-PASTE");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("dc-code-paste:draft:v1")))
    .not.toBeNull();
  const original = await page.evaluate(
    () => JSON.parse(localStorage.getItem("dc-code-paste:draft:v1")!).document,
  );
  await page.getByRole("tab", { name: "전체 글", exact: true }).click();
  await page.getByLabel("본문 글꼴", { exact: true }).selectOption("Georgia");
  await page.getByLabel("본문 글자 크기", { exact: true }).selectOption("20px");
  await page.getByLabel("복사될 글 배경", { exact: true }).selectOption("darkEditorial");
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("dc-code-paste:draft:v1")!).preferences.documentTheme,
      ),
    )
    .toBe("darkEditorial");
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("dc-code-paste:draft:v1")!).document),
  ).toEqual(original);
  const editor = page.locator(".article-editor");
  await editor.press("Control+End");
  await expect(editor.locator(":scope > *")).toHaveCount(original.content.length + 1);
  const lastBlock = editor.locator(":scope > :last-child");
  await expect(lastBlock).toHaveJSProperty("nodeName", "P");
  await editor.press("Control+End");
  await expect(editor.locator(":scope > *")).toHaveCount(original.content.length + 1);
  await page.keyboard.insertText("마지막 블록 다음의 새 문단");
  await expect(lastBlock).toHaveText("마지막 블록 다음의 새 문단");
});

for (const mobile of [false, true]) {
  test(`undoes article settings separately without changing text on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("./");
    const editor = page.locator(".article-editor");
    await expect(editor).toContainText("DC-CODE-PASTE");
    const original = await editor.textContent();
    const undo = page.getByRole("button", { name: "실행 취소", exact: true });
    const redo = page.getByRole("button", { name: "다시 실행", exact: true });
    await expect(undo).toBeDisabled();
    if (mobile) await page.getByRole("button", { name: "블록 설정 패널", exact: true }).click();
    await page.getByRole("tab", { name: "전체 글", exact: true }).click();
    await page.getByLabel("본문 글꼴", { exact: true }).selectOption("Georgia");
    await page.getByLabel("본문 글자 크기", { exact: true }).selectOption("20px");
    await page.getByLabel("본문 글자 크기", { exact: true }).selectOption("20px");
    await page.getByLabel("복사될 글 배경", { exact: true }).selectOption("darkEditorial");
    if (mobile) await page.keyboard.press("Escape");
    await expect(undo).toBeEnabled();
    await undo.click();
    await expect(page.locator(".editor-surface")).toHaveClass(/editor-surface-clean/);
    await expect(editor).toHaveCSS("font-size", "20px");
    await expect(editor).toHaveCSS("font-family", /Georgia/);
    await undo.click();
    await expect(editor).toHaveCSS("font-size", "18px");
    await expect(editor).toHaveCSS("font-family", /Georgia/);
    await undo.click();
    await expect(editor).not.toHaveCSS("font-family", /Georgia/);
    await expect(undo).toBeDisabled();
    await redo.click();
    await redo.click();
    await redo.click();
    await expect(editor).toHaveCSS("font-family", /Georgia/);
    await expect(editor).toHaveCSS("font-size", "20px");
    await expect(page.locator(".editor-surface")).toHaveClass(/editor-surface-dark/);
    expect(await editor.textContent()).toBe(original);
    await expect
      .poll(() =>
        page.evaluate(
          () => JSON.parse(localStorage.getItem("dc-code-paste:draft:v1") ?? "null")?.preferences,
        ),
      )
      .toMatchObject({
        bodyFontFamily: expect.stringContaining("Georgia"),
        bodyFontSize: "20px",
        documentTheme: "darkEditorial",
      });
    await editor.press("Control+End");
    await page.keyboard.insertText("설정 뒤 입력");
    await editor.press("Control+z");
    await expect(editor).not.toContainText("설정 뒤 입력");
    await expect(editor).toHaveCSS("font-size", "20px");
    await expect(page.locator(".editor-surface")).toHaveClass(/editor-surface-dark/);
    await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
    await page.getByRole("menuitem", { name: "HTML 원문 보기", exact: true }).click();
    const html = page.getByLabel("복사용 HTML 원문", { exact: true });
    await expect(html).toHaveValue(/font-family:Georgia/);
    await expect(html).toHaveValue(/font-size:20px/);
  });
}

test("undoes global code display settings without changing the code", async ({ page }) => {
  await page.goto("./");
  const editor = page.locator(".article-editor");
  await expect(editor).toContainText("DC-CODE-PASTE");
  await editor.locator("pre").first().click();
  const code = await editor.locator("pre").first().innerText();
  await page.getByText("세부 설정", { exact: true }).click();
  await page.getByLabel("코드 테마", { exact: true }).selectOption("catppuccin-mocha");
  await page.getByLabel("코드 글자 크기", { exact: true }).selectOption("17px");
  await page.getByLabel("줄번호", { exact: true }).check();
  const undo = page.getByRole("button", { name: "실행 취소", exact: true });
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect(page.getByLabel("줄번호", { exact: true })).not.toBeChecked();
  await undo.click();
  await expect(page.getByLabel("코드 글자 크기", { exact: true })).toHaveValue("15px");
  await undo.click();
  await expect(page.getByLabel("코드 테마", { exact: true })).toHaveValue("github-light");
  expect(await editor.locator("pre").first().innerText()).toBe(code);
});
