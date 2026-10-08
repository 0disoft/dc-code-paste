import { expect, test } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";

for (const mobile of [false, true]) {
  test(`recovers a blocked formatted copy on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1487, height: 900 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          write: async () => {
            throw new Error("Clipboard blocked");
          },
          writeText: async () => {
            throw new Error("Clipboard blocked");
          },
        },
      });
      document.execCommand = () => false;
    });
    await page.goto("./");
    const editor = page.locator(".article-editor");
    await expect(editor).toContainText("DC-CODE-PASTE");
    const editorHeight = await editor
      .locator("..")
      .evaluate((element) => element.getBoundingClientRect().height);
    await page.getByRole("button", { name: "디씨 복사", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "자동 복사가 막혔습니다", exact: true });
    await expect(dialog).toBeVisible();
    if (process.env.DC_PASTE_CAPTURE_DIR) {
      await mkdir(process.env.DC_PASTE_CAPTURE_DIR, { recursive: true });
      await page.screenshot({
        path: join(
          process.env.DC_PASTE_CAPTURE_DIR,
          `copy-recovery-${mobile ? "mobile" : "desktop"}.png`,
        ),
      });
    }
    const source = dialog.getByRole("textbox", { name: "수동 복사용 HTML 원문" });
    await expect(source).toHaveValue(/<table/);
    const html = await source.inputValue();
    await dialog.getByRole("button", { name: "원문 전체 선택", exact: true }).click();
    await expect(source).toBeFocused();
    expect(
      await source.evaluate(
        (element: HTMLTextAreaElement) => element.selectionEnd - element.selectionStart,
      ),
    ).toBe(html.length);
    const downloading = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "HTML 파일 저장", exact: true }).click();
    const download = await downloading;
    const exported = await readFile((await download.path())!, "utf8");
    expect(exported).toContain(html);
    expect(exported).toContain('<meta charset="utf-8">');
    await dialog.getByRole("button", { name: "다시 복사", exact: true }).click();
    await expect(dialog).toBeVisible();
    await source.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("button", { name: "디씨 복사", exact: true })).toBeFocused();
    expect(
      await editor.locator("..").evaluate((element) => element.getBoundingClientRect().height),
    ).toBe(editorHeight);
    await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
    await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
    await page.getByLabel("Markdown 원문").fill("# 새 글\n\n새 내용");
    await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
    await page.getByRole("button", { name: "디씨 복사", exact: true }).click();
    await expect(source).toHaveValue(/새 내용/);
    await expect(source).not.toHaveValue(/DC-CODE-PASTE/);
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { write: async () => {}, writeText: async () => {} },
      });
    });
    await dialog.getByRole("button", { name: "다시 복사", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("button", { name: "복사됨", exact: true })).toBeVisible();
  });
}

test("offers the same manual recovery when source copy fails", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw new Error("Denied");
        },
      },
    });
    document.execCommand = () => false;
  });
  await page.goto("./");
  await expect(page.locator(".article-editor")).toContainText("DC-CODE-PASTE");
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "HTML 원문 보기", exact: true }).click();
  const original = page.getByLabel("복사용 HTML 원문", { exact: true });
  await expect(original).not.toHaveValue("");
  const html = await original.inputValue();
  await page.getByRole("button", { name: "원문 복사", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "자동 복사가 막혔습니다", exact: true });
  await expect(dialog.getByLabel("수동 복사용 HTML 원문")).toHaveValue(html);
  await dialog.getByRole("button", { name: "복사 도움 닫기" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(original).toBeVisible();
});
