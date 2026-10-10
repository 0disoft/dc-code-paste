import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const draftKey = "dc-code-paste:draft:v1";
async function openTool(page: Page, name: string) {
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}

for (const mobile of [false, true]) {
  test(`refuses unbackable Markdown while retaining the current document and source on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1400, height: 900 });
    await page.goto("./");
    const editor = page.locator(".article-editor");
    await expect(editor).toBeVisible();
    await expect(page.locator(".topbar-status")).toContainText("저장됨");
    const originalText = await editor.textContent();
    const original = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), draftKey);
    const markdown = Array.from({ length: 10_001 }, (_, index) => `문단 ${index}`).join("\n\n");
    await openTool(page, "Markdown");
    // Send this large fixture in one input event instead of native text insertion of 20,001 lines.
    await page.getByLabel("Markdown 원문").evaluate((element, value) => {
      (element as HTMLTextAreaElement).value = value;
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }, markdown);
    await expect
      .poll(() =>
        page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key) ?? "{}").markdownDraft,
          draftKey,
        ),
      )
      .toBe(markdown);
    const history = await page.evaluate(() =>
      localStorage.getItem("dc-code-paste:draft-history:v1"),
    );
    await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("문서 구조가 보관 한도를 넘었습니다");
    await expect(page.getByLabel("Markdown 원문")).toHaveValue(markdown);
    expect(await editor.textContent()).toBe(originalText);
    const current = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), draftKey);
    expect(current.document).toEqual(original.document);
    expect(current.preferences).toEqual(original.preferences);
    expect(await page.evaluate(() => localStorage.getItem("dc-code-paste:draft-history:v1"))).toBe(
      history,
    );

    await openTool(page, "저장함");
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "초안 파일 저장", exact: true }).click();
    const download = await downloaded;
    const backup = JSON.parse(await readFile((await download.path())!, "utf8"));
    expect(backup.document).toEqual(original.document);
    expect(backup.markdownDraft).toBe(markdown);
    await page.reload();
    await expect(editor).toBeVisible();
    expect(await editor.textContent()).toBe(originalText);
    await openTool(page, "Markdown");
    await expect(page.getByLabel("Markdown 원문")).toHaveValue(markdown);
    await page.getByLabel("Markdown 원문").fill("# 나눠서 적용한 글\n\n짧은 본문");
    await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
    await expect(editor).toContainText("나눠서 적용한 글");
    await expect(page.getByLabel("Markdown 원문")).toHaveCount(0);
    await expect(page.locator(".topbar-status")).toContainText("저장됨");
    await page.reload();
    await expect(editor).toContainText("나눠서 적용한 글");
  });
}
