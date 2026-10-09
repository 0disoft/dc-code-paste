import { expect, test, type Page } from "@playwright/test";

type ClipboardWindow = typeof window & { copiedDocuments: string[] };

async function purposeDialog(page: Page) {
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "이 글의 목적", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "이 글의 목적", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox")).toBeFocused();
  return dialog;
}

test("keeps a non-paragraph ending unchanged when saving purpose and reading notes", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as ClipboardWindow).copiedDocuments = [];
    Object.defineProperty(navigator, "clipboard", {
      value: {
        write: async (items: ClipboardItem[]) => {
          (window as ClipboardWindow).copiedDocuments.push(
            await (await items[0].getType("text/html")).text(),
          );
        },
      },
    });
  });
  await page.goto("./");
  const editor = page.locator(".article-editor");
  await expect(editor).toContainText("DC-CODE-PASTE");
  await expect(page.locator(".topbar-status")).toContainText("저장됨");
  const content = await page.evaluate(
    () => JSON.parse(localStorage.getItem("dc-code-paste:draft:v1")!).document.content,
  );
  expect(content.at(-1).type).not.toBe("paragraph");
  const copy = page.locator('[data-copy-trigger="preview"]');
  await copy.click();
  await expect
    .poll(() => page.evaluate(() => (window as ClipboardWindow).copiedDocuments.length))
    .toBe(1);
  const html = await page.evaluate(() => (window as ClipboardWindow).copiedDocuments[0]);
  const dialog = await purposeDialog(page);
  await dialog.getByRole("textbox").fill("先に伝えたいことを確認する");
  await dialog.getByRole("button", { name: "목적 저장", exact: true }).click();
  await expect(page.locator(".topbar-status")).toContainText("저장됨");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("dc-code-paste:draft:v1")!).document.content,
    ),
  ).toEqual(content);
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "처음부터 읽어보기", exact: true }).click();
  const reader = page.getByRole("region", { name: "처음부터 읽어보기", exact: true });
  await expect(reader).toBeFocused();
  await reader
    .getByRole("button", { name: /^읽기 구간 \d+ 메모$/ })
    .first()
    .click();
  await reader
    .getByRole("textbox", { name: "읽기 메모", exact: true })
    .fill("이 설명을 다시 확인하고 싶다.");
  await reader.getByRole("button", { name: "읽기 메모 저장", exact: true }).click();
  await page.getByRole("button", { name: "실행 취소", exact: true }).click();
  await page.getByRole("button", { name: "다시 실행", exact: true }).click();
  await expect(editor.locator(":scope > p:last-child")).toHaveCount(0);
  await copy.click();
  await expect
    .poll(() => page.evaluate(() => (window as ClipboardWindow).copiedDocuments.length))
    .toBe(2);
  expect(await page.evaluate(() => (window as ClipboardWindow).copiedDocuments[1])).toBe(html);
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "마지막 복사 결과", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "마지막 복사 결과", exact: true })).toContainText(
    "현재 글이 복사 당시와 같습니다.",
  );
});

for (const mobile of [false, true]) {
  test(`keeps optional writing purpose in the draft and outside copied HTML on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(mobile ? { width: 320, height: 844 } : { width: 1280, height: 900 });
    await page.addInitScript(() => {
      (window as ClipboardWindow).copiedDocuments = [];
      Object.defineProperty(navigator, "clipboard", {
        value: {
          write: async (items: ClipboardItem[]) => {
            (window as ClipboardWindow).copiedDocuments.push(
              await (await items[0].getType("text/html")).text(),
            );
          },
        },
      });
    });
    await page.goto("./");
    const editor = page.locator(".article-editor");
    await expect(editor).toContainText("DC-CODE-PASTE");
    await expect(page.locator(".topbar-status")).toContainText("저장됨");
    await page.reload();
    await expect(editor).toContainText("DC-CODE-PASTE");
    // Opening the editor deliberately creates its insertion paragraph after a non-prose ending.
    await editor.locator("p").first().click();
    await expect(page.locator(".topbar-status")).toContainText("저장됨");
    await page.reload();
    await expect(editor).toContainText("DC-CODE-PASTE");
    const original = await editor.textContent();
    const copy = page.locator('[data-copy-trigger="preview"]');
    await copy.click();
    await expect
      .poll(() => page.evaluate(() => (window as ClipboardWindow).copiedDocuments.length))
      .toBe(1);
    const originalHtml = await page.evaluate(() => (window as ClipboardWindow).copiedDocuments[0]);
    const dialog = await purposeDialog(page);
    const field = dialog.getByRole("textbox");
    await expect(field).toHaveValue("");
    await dialog.getByRole("button", { name: "취소", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "더보기 메뉴", exact: true })).toBeFocused();
    await expect(page.getByRole("button", { name: "실행 취소", exact: true })).toBeDisabled();
    await editor.locator("p").first().click();
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");
    const selected = await page.evaluate(() => window.getSelection()?.toString());
    await purposeDialog(page);
    await field.fill("읽고 나면 설치 방법을 스스로 따라 할 수 있었으면.");
    await dialog.getByRole("button", { name: "목적 저장", exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(await editor.textContent()).toBe(original);
    const purpose = page.getByRole("group", { name: "이 글의 목적", exact: true });
    await expect(purpose).toBeVisible();
    await purpose.locator("summary").click();
    await expect(purpose.locator("p")).toHaveText(
      "읽고 나면 설치 방법을 스스로 따라 할 수 있었으면.",
    );
    await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
    await page.getByRole("menuitem", { name: "마지막 복사 결과", exact: true }).click();
    const copiedOutput = page.getByRole("dialog", { name: "마지막 복사 결과", exact: true });
    await expect(page.locator(".topbar-status")).toContainText("저장됨");
    await expect(copiedOutput).toContainText("현재 글이 복사 당시와 같습니다.");
    await expect(
      copiedOutput.getByRole("button", { name: "복사 당시 글 복원", exact: true }),
    ).toBeDisabled();
    await copiedOutput.getByRole("button", { name: "복사 결과 닫기", exact: true }).click();
    await copy.click();
    await expect
      .poll(() => page.evaluate(() => (window as ClipboardWindow).copiedDocuments.length))
      .toBe(2);
    expect(await page.evaluate(() => (window as ClipboardWindow).copiedDocuments[1])).toBe(
      originalHtml,
    );
    await page.getByRole("button", { name: "실행 취소", exact: true }).click();
    await expect(purpose).toHaveCount(0);
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(selected);
    await page.getByRole("button", { name: "다시 실행", exact: true }).click();
    await expect(purpose).toBeVisible();
    await expect(page.locator(".topbar-status")).toContainText("저장됨");
    await page.reload();
    await expect(purpose).toBeVisible();
    await purpose.locator("summary").click();
    await expect(purpose.locator("p")).toContainText("설치 방법을 스스로");
    await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
    await page.getByRole("menuitem", { name: "처음부터 읽어보기", exact: true }).click();
    const reader = page.getByRole("region", { name: "처음부터 읽어보기", exact: true });
    await expect(reader).toBeFocused();
    const readingPurpose = reader.getByRole("group", { name: "이 글의 목적", exact: true });
    await readingPurpose.locator("summary").click();
    await readingPurpose.getByRole("button", { name: "목적 수정", exact: true }).click();
    await expect(dialog).toBeVisible();
    await field.fill("保存しない編集");
    await field.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(
      readingPurpose.getByRole("button", { name: "목적 수정", exact: true }),
    ).toBeFocused();
    await expect(readingPurpose.locator("p")).toContainText("설치 방법을 스스로");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: testInfo.outputPath(`writing-purpose-${mobile ? "mobile" : "desktop"}.png`),
    });
    await readingPurpose.getByRole("button", { name: "목적 수정", exact: true }).click();
    await field.fill("");
    await dialog.getByRole("button", { name: "목적 저장", exact: true }).click();
    await expect(readingPurpose).toHaveCount(0);
    await expect(page.getByRole("button", { name: "더보기 메뉴", exact: true })).toBeFocused();
    await reader.getByRole("button", { name: "읽어보기 끝내기", exact: true }).click();
    expect(await editor.textContent()).toBe(original);
    await expect(page.locator(".topbar-status")).toContainText("저장됨");
    await page.reload();
    await expect(page.getByRole("group", { name: "이 글의 목적", exact: true })).toHaveCount(0);
  });
}
