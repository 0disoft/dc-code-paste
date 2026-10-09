import { expect, test, type Page } from "@playwright/test";

const defaultsKey = "dc-code-paste:writing-defaults:v1";
const draftKey = "dc-code-paste:draft:v1";

async function openSettings(page: Page) {
  const tab = page.getByRole("tab", { name: "전체 글", exact: true });
  if (!(await tab.isVisible()))
    await page.getByRole("button", { name: "블록 설정 패널", exact: true }).click();
  await tab.click();
}

async function openTemplates(page: Page) {
  const tab = page.getByRole("tab", { name: "템플릿", exact: true });
  if (!(await tab.isVisible()))
    await page.getByRole("button", { name: "블록 삽입 패널", exact: true }).click();
  await tab.click();
}

for (const mobile of [false, true]) {
  test(`remembers new writing appearance while preserving imported files on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1487, height: 900 });
    await page.goto("./");
    const editor = page.locator(".article-editor");
    await expect(editor).toContainText("DC-CODE-PASTE");
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), draftKey))
      .not.toBeNull();
    const original = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), draftKey);

    await openSettings(page);
    await page.getByLabel("읽기 배치", { exact: true }).selectOption("airy");
    await page.getByLabel("복사될 글 배경", { exact: true }).selectOption("darkEditorial");
    await page.getByLabel("본문 글꼴", { exact: true }).selectOption({ label: "Georgia" });
    await page.getByLabel("본문 글자 크기", { exact: true }).selectOption("20px");
    const remember = page.getByRole("button", {
      name: "현재 설정을 새 글 기본값으로 기억",
      exact: true,
    });
    await remember.click();
    await expect(remember).toBeDisabled();
    await expect(page.getByLabel("기억한 글 설정")).toContainText("20px");
    const remembered = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      defaultsKey,
    );
    expect(Object.keys(remembered.appearance).sort()).toEqual([
      "bodyFontFamily",
      "bodyFontSize",
      "documentTheme",
      "readingLayout",
    ]);

    await openTemplates(page);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "새 글 시작", exact: true }).click();
    await expect(editor).toHaveCSS("font-size", "20px");
    await expect(editor).toHaveCSS("font-family", /Georgia/);
    await expect(page.locator(".editor-surface")).toHaveClass(/editor-surface-dark/);
    await openTemplates(page);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "뉴스 정리 템플릿", exact: true }).click();
    await expect(editor).toContainText("뉴스 제목을 입력하세요");
    await expect(editor).toHaveCSS("font-size", "20px");
    await openSettings(page);
    await expect(page.getByLabel("읽기 배치", { exact: true })).toHaveValue("airy");
    await page.reload();
    await expect(editor).toHaveCSS("font-size", "20px");
    await openSettings(page);
    await expect(page.getByLabel("기억한 글 설정")).toContainText("20px");

    original.document = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "파일 설정 유지" }] }],
    };
    original.preferences.bodyFontSize = "15px";
    original.preferences.bodyFontFamily = "Custom Font,serif";
    original.preferences.documentTheme = "cleanEditorial";
    original.preferences.readingLayout = "balanced";
    await openTemplates(page);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByLabel("초안 JSON 파일", { exact: true }).setInputFiles({
      name: "original.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(original)),
    });
    await expect(editor).toHaveText("파일 설정 유지");
    await expect(editor).toHaveCSS("font-size", "15px");
    await openSettings(page);
    await expect(page.getByLabel("본문 글꼴", { exact: true })).toHaveValue("Custom Font,serif");
    await expect(page.getByLabel("읽기 배치", { exact: true })).toHaveValue("balanced");
    await expect(remember).toBeEnabled();
    await page.getByRole("button", { name: "기억한 기본값 지우기", exact: true }).click();
    expect(await page.evaluate((key) => localStorage.getItem(key), defaultsKey)).toBeNull();
    await expect(editor).toHaveCSS("font-size", "15px");
    await openTemplates(page);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "새 글 시작", exact: true }).click();
    await expect(editor).toHaveCSS("font-size", original.preferences.selectionFontSize);
    await openSettings(page);
    await expect(page.getByLabel("읽기 배치", { exact: true })).toHaveValue("balanced");
    await expect(page.getByLabel("복사될 글 배경", { exact: true })).toHaveValue("cleanEditorial");
    await expect(page.getByLabel("기억한 글 설정")).toHaveText("기억한 설정 없음");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test("updates defaults across tabs without changing either active document", async ({
  page,
  context,
}) => {
  await page.goto("./");
  await expect(page.locator(".article-editor")).toContainText("DC-CODE-PASTE");
  const other = await context.newPage();
  await other.goto("./");
  await expect(other.locator(".article-editor")).toContainText("DC-CODE-PASTE");
  await openSettings(page);
  await openSettings(other);
  await page.getByLabel("본문 글자 크기", { exact: true }).selectOption("20px");
  await page
    .getByRole("button", { name: "현재 설정을 새 글 기본값으로 기억", exact: true })
    .click();
  await expect(other.getByLabel("기억한 글 설정")).toContainText("20px");
  await expect(other.locator(".article-editor")).not.toHaveCSS("font-size", "20px");
  await other.getByRole("button", { name: "기억한 기본값 지우기", exact: true }).click();
  await expect(page.getByLabel("기억한 글 설정")).toHaveText("기억한 설정 없음");
  await expect(page.locator(".article-editor")).toHaveCSS("font-size", "20px");
});
