import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const outputKey = "dc-code-paste:last-copied-output:v1";
type CapturedClipboard = typeof window & {
  copiedHtml: string;
  copiedText: string;
  denyCopy: boolean;
};

async function captureClipboard(page: Page) {
  await page.addInitScript(() => {
    const captured = window as CapturedClipboard;
    captured.copiedHtml = "";
    captured.copiedText = "";
    captured.denyCopy = false;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        write: async (items: ClipboardItem[]) => {
          if (captured.denyCopy) throw new Error("blocked");
          captured.copiedHtml = await (await items[0].getType("text/html")).text();
          captured.copiedText = await (await items[0].getType("text/plain")).text();
        },
        writeText: async (text: string) => {
          if (captured.denyCopy) throw new Error("blocked");
          captured.copiedText = text;
        },
      },
    });
    document.execCommand = () => false;
  });
}

async function applyMarkdown(page: Page, text: string) {
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
  await page.getByLabel("Markdown 원문").fill(text);
  await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
}

async function openOutput(page: Page) {
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "마지막 복사 결과", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "마지막 복사 결과", exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

for (const mobile of [false, true]) {
  test(`compares, replays and restores exact copied output on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1487, height: 900 });
    await captureClipboard(page);
    await page.goto("./");
    const editor = page.locator(".article-editor");
    await expect(editor).toContainText("DC-CODE-PASTE");
    await applyMarkdown(
      page,
      '# 복사 당시\n\n**기억할 문장** [자료](https://example.com/source)\n\n```js\nconsole.log("original");\n```',
    );
    await page.locator('[data-copy-trigger="preview"]').click();
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), outputKey))
      .not.toBeNull();
    const output = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), outputKey);
    expect(output.html).toBe(await page.evaluate(() => (window as CapturedClipboard).copiedHtml));
    const originalText = await editor.textContent();
    await applyMarkdown(page, "# 수정한 글\n\n새롭게 덧붙인 문장");
    let dialog = await openOutput(page);
    await expect(dialog).toContainText("내용이 바뀌었습니다.");
    await expect(
      page.frameLocator('iframe[title="복사 당시 글 미리보기"]').locator("body"),
    ).toContainText("기억할 문장");
    await expect(
      page.frameLocator('iframe[title="현재 글 미리보기"]').locator("body"),
    ).toContainText("새롭게 덧붙인 문장");
    await page.screenshot({
      path: testInfo.outputPath(`copied-output-${mobile ? "mobile" : "desktop"}.png`),
    });
    await dialog.getByRole("button", { name: "같은 결과 다시 복사", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "다시 복사됨", exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as CapturedClipboard).copiedHtml)).toBe(output.html);
    expect(await editor.textContent()).not.toBe(originalText);
    const downloading = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "HTML 파일 저장", exact: true }).click();
    const file = await downloading;
    expect(await readFile((await file.path())!, "utf8")).toContain(output.html);
    await dialog.getByRole("button", { name: "복사 결과 닫기", exact: true }).click();
    await expect(page.getByRole("button", { name: "더보기 메뉴", exact: true })).toBeFocused();
    await page.reload();
    await expect(editor).toContainText("새롭게 덧붙인 문장");
    dialog = await openOutput(page);
    await dialog.locator("summary").click();
    await expect(dialog.getByLabel("복사 당시 HTML 원문", { exact: true })).toHaveValue(
      output.html,
    );
    page.once("dialog", (confirmation) => confirmation.accept());
    await dialog.getByRole("button", { name: "복사 당시 글 복원", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(editor).toHaveText(originalText!);
    await expect(editor).toBeFocused();
    expect(
      await page.evaluate(() => localStorage.getItem("dc-code-paste:draft-history:v1")),
    ).toContain("새롭게 덧붙인 문장");
    dialog = await openOutput(page);
    await expect(dialog).toContainText("현재 글이 복사 당시와 같습니다.");
    await dialog.getByRole("button", { name: "복사 기록 지우기", exact: true }).click();
    expect(await page.evaluate((key) => localStorage.getItem(key), outputKey)).toBeNull();
    await expect(editor).toHaveText(originalText!);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test("preserves the last success after failure and offers exact recovery for a blocked replay", async ({
  page,
}) => {
  await captureClipboard(page);
  await page.goto("./");
  await expect(page.locator(".article-editor")).toContainText("DC-CODE-PASTE");
  await applyMarkdown(page, "# 成功したコピー\n\n保存する文章");
  await page.locator('[data-copy-trigger="preview"]').click();
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), outputKey))
    .not.toBeNull();
  const original = await page.evaluate((key) => localStorage.getItem(key), outputKey);
  await applyMarkdown(page, "# 後から編集\n\nコピーに失敗する文章");
  await page.evaluate(() => {
    (window as CapturedClipboard).denyCopy = true;
  });
  await page.locator('[data-copy-trigger="preview"]').click();
  const recovery = page.getByRole("dialog", { name: "자동 복사가 막혔습니다", exact: true });
  await expect(recovery).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), outputKey)).toBe(original);
  await recovery.getByRole("button", { name: "복사 도움 닫기", exact: true }).click();
  const dialog = await openOutput(page);
  await dialog.getByRole("button", { name: "같은 결과 다시 복사", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("자동 복사가 막혔습니다.");
  await expect(dialog.getByLabel("복사 당시 HTML 원문", { exact: true })).toHaveValue(
    JSON.parse(original!).html,
  );
  await expect(page.locator(".article-editor")).toContainText("後から編集");
});

test("keeps a successful copy usable when storage is full", async ({ page }) => {
  await captureClipboard(page);
  await page.addInitScript((key) => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException("full", "QuotaExceededError");
      return setItem.call(this, name, value);
    };
  }, outputKey);
  await page.goto("./");
  await expect(page.locator(".article-editor")).toContainText("DC-CODE-PASTE");
  await page.locator('[data-copy-trigger="preview"]').click();
  await expect(page.locator('[data-copy-trigger="preview"]')).toHaveText("복사됨");
  const copied = await page.evaluate(() => (window as CapturedClipboard).copiedHtml);
  const dialog = await openOutput(page);
  await expect(dialog).toContainText("이번 결과는 이 탭에서만 볼 수 있습니다.");
  await dialog.locator("summary").click();
  await expect(dialog.getByLabel("복사 당시 HTML 원문", { exact: true })).toHaveValue(copied);
  expect(await page.evaluate((key) => localStorage.getItem(key), outputKey)).toBeNull();
});

test("replays a source copy as the exact plain HTML instead of formatted content", async ({
  page,
}) => {
  await captureClipboard(page);
  await page.goto("./");
  await expect(page.locator(".article-editor")).toContainText("DC-CODE-PASTE");
  await applyMarkdown(page, "# HTML 복사\n\n원문으로 전달할 문장");
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "HTML 원문 보기", exact: true }).click();
  await expect(page.getByLabel("복사용 HTML 원문", { exact: true })).not.toHaveValue("");
  await page.getByRole("button", { name: "원문 복사", exact: true }).click();
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), outputKey))
    .not.toBeNull();
  const output = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), outputKey);
  expect(output.channel).toBe("source");
  await applyMarkdown(page, "# 이후 글\n\n별도 문장");
  const dialog = await openOutput(page);
  await dialog.getByRole("button", { name: "같은 HTML 원문 다시 복사", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "다시 복사됨", exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as CapturedClipboard).copiedText)).toBe(output.html);
  expect(await page.evaluate(() => (window as CapturedClipboard).copiedHtml)).toBe("");
});

test("does not report a newer cross-tab record as recopied while an older write finishes", async ({
  page,
  context,
}) => {
  await captureClipboard(page);
  await page.goto("./");
  await expect(page.locator(".article-editor")).toContainText("DC-CODE-PASTE");
  await applyMarkdown(page, "# 먼저 복사\n\n기존 결과");
  await page.locator('[data-copy-trigger="preview"]').click();
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), outputKey))
    .not.toBeNull();
  const other = await context.newPage();
  await captureClipboard(other);
  await other.goto("./");
  await expect(other.locator(".article-editor")).toContainText("기존 결과");
  await applyMarkdown(other, "# 다른 탭에서 복사\n\n새 복사 결과");
  const dialog = await openOutput(page);
  await page.evaluate(() => {
    const captured = window as CapturedClipboard & { releaseSavedCopy?: () => void };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        write: async (items: ClipboardItem[]) => {
          const html = await (await items[0].getType("text/html")).text();
          await new Promise<void>((resolve) => {
            captured.releaseSavedCopy = resolve;
          });
          captured.copiedHtml = html;
        },
      },
    });
  });
  await dialog.getByRole("button", { name: "같은 결과 다시 복사", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "복사 중", exact: true })).toBeDisabled();
  await other.locator('[data-copy-trigger="preview"]').click();
  await expect(
    page.frameLocator('iframe[title="복사 당시 글 미리보기"]').locator("body"),
  ).toContainText("새 복사 결과");
  await page.evaluate(() => {
    (window as CapturedClipboard & { releaseSavedCopy?: () => void }).releaseSavedCopy!();
  });
  await expect(
    dialog.getByRole("button", { name: "같은 결과 다시 복사", exact: true }),
  ).toBeEnabled();
  expect(await page.evaluate(() => (window as CapturedClipboard).copiedHtml)).toContain(
    "기존 결과",
  );
  await expect(dialog.getByRole("button", { name: "다시 복사됨", exact: true })).toHaveCount(0);
});
