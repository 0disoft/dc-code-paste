import { expect, test, type Page } from "@playwright/test";

type ClipboardWindow = typeof window & { copiedDocuments: string[] };
async function setup(page: Page) {
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
  await expect(page.locator(".article-editor")).toContainText("DC-CODE-PASTE");
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
  await page
    .getByLabel("Markdown 원문")
    .fill("# 생각을 담는 글\n\n**[원래 문장](https://example.com/source)**\n\n뒷 문장");
  await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
  await expect(page.locator(".topbar-status")).toContainText("저장됨");
  await page.reload();
  await expect(page.locator(".article-editor")).toContainText("생각을 담는 글");
}
async function openFragments(page: Page) {
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "생각 조각", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "생각 조각", exact: true });
  await expect(dialog.getByLabel("새 생각 조각", { exact: true })).toBeFocused();
  return dialog;
}
async function copied(page: Page, count: number) {
  await page.locator('[data-copy-trigger="preview"]').click();
  await expect
    .poll(() => page.evaluate(() => (window as ClipboardWindow).copiedDocuments.length))
    .toBe(count);
  return page.evaluate(() => (window as ClipboardWindow).copiedDocuments.at(-1)!);
}

for (const mobile of [false, true]) {
  test(`stores private fragments and revisits inserted prose without replacing a selection on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(mobile ? { width: 320, height: 844 } : { width: 1280, height: 900 });
    await setup(page);
    const editor = page.locator(".article-editor");
    const original = await editor.textContent();
    const html = await copied(page, 1);
    const dialog = await openFragments(page);
    const input = dialog.getByLabel("새 생각 조각", { exact: true });
    await input.fill("정리 전 첫 줄\n둘째 생각");
    await dialog.getByRole("button", { name: "조각 보관", exact: true }).click();
    const card = dialog.getByRole("article", { name: "생각 조각 1", exact: true });
    await expect(card).toContainText("아직 쓰지 않음");
    await dialog.getByRole("button", { name: "생각 조각 닫기", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "더보기 메뉴", exact: true })).toBeFocused();
    expect(await copied(page, 2)).toBe(html);
    expect(await editor.textContent()).toBe(original);
    await expect(page.locator(".topbar-status")).toContainText("저장됨");
    await page.reload();
    await expect(editor).toContainText("생각을 담는 글");
    await editor.locator("p").first().click();
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");
    await openFragments(page);
    await expect(card).toContainText("정리 전 첫 줄");
    await input.fill("닫았다 돌아와도 남겨 둘 입력");
    await input.press("Escape");
    await openFragments(page);
    await expect(input).toHaveValue("닫았다 돌아와도 남겨 둘 입력");
    await input.fill("");
    await card.getByRole("button", { name: "글로 넣기", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(editor).toBeFocused();
    await expect(editor.locator("p").first()).toHaveText("원래 문장");
    await expect(editor.locator("strong a, a strong")).toHaveText("원래 문장");
    await expect(editor.locator("p").nth(1)).toHaveText("정리 전 첫 줄");
    await expect(editor.locator("p").nth(2)).toHaveText("둘째 생각");
    await expect(editor.locator("p").last()).toHaveText("뒷 문장");
    await openFragments(page);
    await card.getByText("넣은 자리 보기", { exact: true }).click();
    await expect(card.locator(".fragment-use")).toHaveAttribute("data-use-state", "linked");
    await card.getByRole("button", { name: "조각 1 넣은 자리 1 구간 1 이동", exact: true }).click();
    await expect(editor).toBeFocused();
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe("정리 전 첫 줄");
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.insertText("고친 ");
    await openFragments(page);
    await card.getByText("넣은 자리 보기", { exact: true }).click();
    await expect(card.locator(".fragment-use")).toHaveAttribute("data-use-state", "changed");
    await card.getByRole("button", { name: "조각 수정", exact: true }).click();
    await card.getByLabel("보관할 조각 내용", { exact: true }).fill("조각만 따로 고친 내용");
    await card.getByRole("button", { name: "조각 수정 저장", exact: true }).click();
    await expect(card).toContainText("지금의 조각과 넣을 당시 내용이 다릅니다.");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: testInfo.outputPath(`thought-fragments-${mobile ? "mobile" : "desktop"}.png`),
    });
    await dialog.getByRole("button", { name: "생각 조각 닫기", exact: true }).click();
    const revisedHtml = await copied(page, 1);
    expect(revisedHtml).not.toContain("조각만 따로 고친 내용");
    const revisedText = await editor.textContent();
    await openFragments(page);
    await card.getByRole("button", { name: "조각 삭제", exact: true }).click();
    await expect(card).toHaveCount(0);
    await dialog.getByRole("button", { name: "생각 조각 닫기", exact: true }).click();
    expect(await editor.textContent()).toBe(revisedText);
    expect(await copied(page, 2)).toBe(revisedHtml);
    await page.getByRole("button", { name: "실행 취소", exact: true }).click();
    await openFragments(page);
    await expect(card).toContainText("조각만 따로 고친 내용");
    await expect(card).toContainText("넣은 자리 1");
  });
}

test("inserts code with exact indentation from the reader and restores its usage after reload", async ({
  page,
}) => {
  await setup(page);
  const dialog = await openFragments(page);
  const text = "  const value = '<script>';\n\treturn value;\n";
  await dialog.getByLabel("새 생각 조각", { exact: true }).fill(text);
  await dialog.getByRole("button", { name: "조각 보관", exact: true }).click();
  await dialog.getByRole("button", { name: "생각 조각 닫기", exact: true }).click();
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "처음부터 읽어보기", exact: true }).click();
  const reader = page.getByRole("region", { name: "처음부터 읽어보기", exact: true });
  await expect(reader).toBeFocused();
  await openFragments(page);
  const card = dialog.getByRole("article", { name: "생각 조각 1", exact: true });
  await card.getByRole("button", { name: "코드로 넣기", exact: true }).click();
  const editor = page.locator(".article-editor");
  await expect(editor).toBeFocused();
  await expect(reader).toBeHidden();
  await expect(editor.locator("pre code")).toHaveText(text);
  expect(await copied(page, 1)).not.toContain("thoughtFragment");
  await expect(page.locator(".topbar-status")).toContainText("저장됨");
  await page.reload();
  await expect(editor.locator("pre code")).toHaveText(text);
  await openFragments(page);
  await card.getByText("넣은 자리 보기", { exact: true }).click();
  await expect(card.locator(".fragment-use")).toHaveAttribute("data-use-state", "linked");
  await card.getByRole("button", { name: "조각 1 넣은 자리 1 구간 1 이동", exact: true }).click();
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(text);
});
