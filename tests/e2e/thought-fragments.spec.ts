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
  await expect(page.getByRole("group", { name: "글쓰기 편집기", exact: true })).toHaveAttribute(
    "aria-busy",
    "false",
  );
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
  await expect(page.locator('[data-copy-trigger="preview"]')).toBeEnabled();
  await expect(page.locator('[data-copy-trigger="preview"]')).toHaveAttribute(
    "aria-label",
    "복사됨",
  );
  return page.evaluate(() => (window as ClipboardWindow).copiedDocuments.at(-1)!);
}

for (const mobile of [false, true]) {
  test(`captures selected prose nearby and preserves public output on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await page.setViewportSize(mobile ? { width: 320, height: 844 } : { width: 1280, height: 900 });
    await setup(page);
    const editor = page.locator(".article-editor");
    const html = await copied(page, 1);
    const sentence = editor.locator("p").first();
    await sentence.click({ clickCount: 3 });
    await expect(editor).toBeFocused();
    await expect
      .poll(() => page.evaluate(() => window.getSelection()?.toString()))
      .toBe("원래 문장");
    const toolbar = page.getByRole("toolbar", { name: "선택한 글자 도구", exact: true });
    await expect(toolbar).toBeVisible();
    expect(
      await toolbar.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.left >= 0 && rect.right <= innerWidth && element.scrollWidth <= element.clientWidth
        );
      }),
    ).toBe(true);
    const storeButton = toolbar.getByRole("button", {
      name: "선택한 글 조각으로 보관",
      exact: true,
    });
    if (mobile) await storeButton.click();
    else {
      await storeButton.focus();
      await page.keyboard.press("Enter");
    }
    const dialog = page.getByRole("dialog", { name: "생각 조각", exact: true });
    await expect(dialog.getByRole("status", { name: "생각 조각 작업 결과" })).toContainText(
      "선택한 글을 조각으로 보관했습니다",
    );
    await expect(dialog.locator(".fragment-card > .fragment-text")).toHaveText("원래 문장");
    await expect(sentence.locator("strong a, a strong")).toHaveText("원래 문장");
    await expect(sentence.locator("a")).toHaveAttribute("href", "https://example.com/source");
    await dialog.getByRole("button", { name: "생각 조각 닫기", exact: true }).click();
    await expect(editor).toBeFocused();
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe("원래 문장");
    expect(await copied(page, 2)).toBe(html);
    await expect(page.locator(".topbar-status")).toContainText("저장됨");
    await page.reload();
    await expect(editor).toContainText("생각을 담는 글");
    await openFragments(page);
    await expect(dialog.locator(".fragment-card > .fragment-text")).toHaveText("원래 문장");
    await expect(dialog.getByRole("status", { name: "생각 조각 작업 결과" })).toHaveCount(0);
  });
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
    await expect(card).toContainText("아직 넣지 않음");
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

test("keeps fragments beside editable prose, preserves unfinished edits across presentations, and opens settings on request", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await setup(page);
  const editor = page.locator(".article-editor");
  const dialog = await openFragments(page);
  const input = dialog.getByLabel("새 생각 조각", { exact: true });
  await input.fill("아직 보관하지 않은 입력");
  await dialog.getByRole("button", { name: "생각 조각 본문 곁에 두기", exact: true }).click();
  await expect(dialog).toHaveAttribute("aria-modal", "false");
  await expect.poll(() => dialog.evaluate((element) => element.matches(":modal"))).toBe(false);
  await expect(input).toHaveValue("아직 보관하지 않은 입력");
  await expect(page.getByRole("button", { name: "실행 취소", exact: true })).toBeDisabled();
  const editorBounds = await page.locator(".canvas").boundingBox();
  const dialogBounds = await dialog.boundingBox();
  expect(editorBounds!.x + editorBounds!.width).toBeLessThanOrEqual(dialogBounds!.x + 1);
  await editor.locator("p").last().click();
  await expect(editor).toBeFocused();
  await page.keyboard.press("End");
  await page.keyboard.insertText(" 계속 쓰는 중");
  await expect(editor).toContainText("계속 쓰는 중");
  await expect(input).toHaveValue("아직 보관하지 않은 입력");
  await input.fill("곁에서 넣은 조각");
  await dialog.getByRole("button", { name: "조각 보관", exact: true }).click();
  const card = dialog.getByRole("article", { name: "생각 조각 1", exact: true });
  await editor.locator("p").first().click({ clickCount: 3 });
  await card.getByRole("button", { name: "글로 넣기", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(editor).toBeFocused();
  await expect(editor.locator("strong a, a strong")).toHaveText("원래 문장");
  await expect(editor.locator("p").nth(1)).toHaveText("곁에서 넣은 조각");
  await card.getByText("넣은 자리 보기", { exact: true }).click();
  await card.getByRole("button", { name: "조각 1 넣은 자리 1 구간 1 이동", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(editor).toBeFocused();
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe("곁에서 넣은 조각");
  await card.getByRole("button", { name: "조각 수정", exact: true }).click();
  const edit = card.getByLabel("보관할 조각 내용", { exact: true });
  await edit.fill("저장하지 않은 조각 수정");
  await input.fill("계속 담을 입력");
  await page.screenshot({ path: testInfo.outputPath("thought-fragments-docked.png") });
  await page.setViewportSize({ width: 320, height: 844 });
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect.poll(() => dialog.evaluate((element) => element.matches(":modal"))).toBe(true);
  await expect(input).toHaveValue("계속 담을 입력");
  await expect(edit).toHaveValue("저장하지 않은 조각 수정");
  await expect(
    dialog.getByRole("button", { name: "생각 조각 본문 곁에 두기", exact: true }),
  ).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1400, height: 900 });
  await expect(dialog).toHaveAttribute("aria-modal", "false");
  await expect(edit).toHaveValue("저장하지 않은 조각 수정");
  await dialog.getByRole("button", { name: "생각 조각 크게 열기", exact: true }).click();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(input).toHaveValue("계속 담을 입력");
  await expect(edit).toHaveValue("저장하지 않은 조각 수정");
  await dialog.getByRole("button", { name: "생각 조각 본문 곁에 두기", exact: true }).click();
  await expect(dialog).toHaveAttribute("aria-modal", "false");
  await edit.press("Escape");
  await expect(edit).toHaveCount(0);
  await expect(dialog).toBeVisible();
  const html = await copied(page, 1);
  expect(html).not.toContain("계속 담을 입력");
  expect(html).not.toContain("저장하지 않은 조각 수정");
  await input.press("Escape");
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitemcheckbox", { name: "집중해서 쓰기", exact: true }).click();
  await expect(page.locator(".app-shell")).toHaveClass(/is-focused/);
  await openFragments(page);
  await expect(dialog).toHaveAttribute("aria-modal", "false");
  await expect(input).toHaveValue("계속 담을 입력");
  await card.getByRole("button", { name: "조각 수정", exact: true }).click();
  await edit.fill("출처 확인 후 계속 작성할 수정 중 문장");
  await editor.locator("p").first().click({ clickCount: 3 });
  await page
    .getByRole("toolbar", { name: "선택한 글자 도구", exact: true })
    .getByRole("button", { name: "문장 출처 연결", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel("자료 주소", { exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await openFragments(page);
  await expect(edit).toHaveValue("출처 확인 후 계속 작성할 수정 중 문장");
  await expect(input).toHaveValue("계속 담을 입력");
  await card.getByRole("button", { name: "조각 수정 저장", exact: true }).click();
  await expect(edit).toHaveCount(0);
  await expect(card.locator(".fragment-text").first()).toHaveText(
    "출처 확인 후 계속 작성할 수정 중 문장",
  );
  await dialog.getByRole("button", { name: "생각 조각 닫기", exact: true }).click();
  expect(await copied(page, 2)).toBe(html);
});

for (const mobile of [false, true]) {
  test(`preserves pending fragment edits through closing and rejects stale saves on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await page.setViewportSize(mobile ? { width: 320, height: 844 } : { width: 1400, height: 900 });
    await setup(page);
    const dialog = await openFragments(page);
    await dialog.getByLabel("새 생각 조각", { exact: true }).fill("처음 보관한 원문");
    await dialog.getByRole("button", { name: "조각 보관", exact: true }).click();
    const card = dialog.getByRole("article", { name: "생각 조각 1", exact: true });
    const edit = card.getByLabel("보관할 조각 내용", { exact: true });
    const close = dialog.getByRole("button", { name: "생각 조각 닫기", exact: true });
    await card.getByRole("button", { name: "조각 수정", exact: true }).click();
    await edit.fill("저장한 새 원문");
    await card.getByRole("button", { name: "조각 수정 저장", exact: true }).click();
    await card.getByRole("button", { name: "조각 수정", exact: true }).click();
    await edit.fill("계속 작성 중인 비공개 수정문");
    await close.click();
    await openFragments(page);
    await expect(edit).toHaveValue("계속 작성 중인 비공개 수정문");
    await close.click();
    await page.getByRole("button", { name: "실행 취소", exact: true }).click();
    await openFragments(page);
    await expect(edit).toHaveValue("계속 작성 중인 비공개 수정문");
    await card.getByRole("button", { name: "조각 수정 저장", exact: true }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(edit).toHaveValue("계속 작성 중인 비공개 수정문");
    await card.getByRole("button", { name: "조각 수정 취소", exact: true }).click();
    await expect(card.locator(".fragment-text")).toHaveText("처음 보관한 원문");
    await close.click();
    await openFragments(page);
    await expect(edit).toHaveCount(0);
    await card.getByRole("button", { name: "조각 수정", exact: true }).click();
    await expect(edit).toHaveValue("처음 보관한 원문");
    await edit.fill("다시 확인하고 저장한 원문");
    await card.getByRole("button", { name: "조각 수정 저장", exact: true }).click();
    await close.click();
    await openFragments(page);
    await expect(edit).toHaveCount(0);
    await expect(card.locator(".fragment-text")).toHaveText("다시 확인하고 저장한 원문");
    await card.getByRole("button", { name: "조각 수정", exact: true }).click();
    await edit.fill("삭제한 조각에서 버릴 수정문");
    await card.getByRole("button", { name: "조각 삭제", exact: true }).click();
    await expect(card).toHaveCount(0);
    await close.click();
    await page.getByRole("button", { name: "실행 취소", exact: true }).click();
    await openFragments(page);
    await expect(edit).toHaveCount(0);
    await expect(card.locator(".fragment-text")).toHaveText("다시 확인하고 저장한 원문");
    await card.getByRole("button", { name: "조각 수정", exact: true }).click();
    await edit.fill("이전 문서에서 작성한 수정문");
    await close.click();
    await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
    await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
    await page.getByLabel("Markdown 원문").fill("# 교체한 글\n\n새 문서 본문");
    await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
    await expect(page.locator(".article-editor")).toContainText("새 문서 본문");
    await page.getByRole("button", { name: "실행 취소", exact: true }).click();
    await openFragments(page);
    await expect(edit).toHaveCount(0);
    await card.getByRole("button", { name: "조각 수정", exact: true }).click();
    await expect(edit).toHaveValue("다시 확인하고 저장한 원문");
  });
}

for (const mobile of [false, true]) {
  test(`finds fragment material and review states without losing unfinished edits on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await page.setViewportSize(mobile ? { width: 320, height: 844 } : { width: 1400, height: 900 });
    await setup(page);
    const editor = page.locator(".article-editor");
    const dialog = await openFragments(page);
    const input = dialog.getByLabel("새 생각 조각", { exact: true });
    for (const text of ["Alpha 첫 조각", "Beta 다음 조각", "Gamma 마지막 조각"]) {
      await input.fill(text);
      await dialog.getByRole("button", { name: "조각 보관", exact: true }).click();
    }
    const first = dialog.getByRole("article", { name: "생각 조각 1", exact: true });
    await first.getByRole("button", { name: "글로 넣기", exact: true }).click();
    const inserted = editor.locator("p").filter({ hasText: "Alpha 첫 조각" });
    await inserted.click();
    await page.keyboard.press("End");
    await page.keyboard.insertText(" 수정한 본문");
    await expect(inserted).toHaveText("Alpha 첫 조각 수정한 본문");
    const html = await copied(page, 1);
    await openFragments(page);
    const search = dialog.getByRole("searchbox", { name: "생각 조각 검색", exact: true });
    const filter = dialog.getByRole("combobox", { name: "생각 조각 보기", exact: true });
    await expect(filter.getByRole("option", { name: "다시 확인 (1)", exact: true })).toHaveCount(1);
    await filter.selectOption("review");
    await expect(dialog.getByRole("article")).toHaveCount(1);
    await expect(first.locator(".fragment-head")).toContainText("다시 확인");
    await search.fill("수정한 본문");
    await expect(dialog.getByRole("article")).toHaveCount(1);
    await search.fill("없는 검색 결과");
    await expect(dialog.getByRole("article")).toHaveCount(0);
    await expect(
      dialog.getByRole("status", { name: "생각 조각 검색 결과", exact: true }),
    ).toHaveText("3개 중 0개 표시");
    await expect(dialog).toContainText("조건에 맞는 조각이 없습니다.");
    await dialog.getByRole("button", { name: "검색 조건 지우기", exact: true }).click();
    const second = dialog.getByRole("article", { name: "생각 조각 2", exact: true });
    await second.getByRole("button", { name: "조각 수정", exact: true }).click();
    const edit = second.getByLabel("보관할 조각 내용", { exact: true });
    await edit.fill("고친 내용만");
    await search.fill("alpha");
    await expect(first).toBeVisible();
    await expect(edit).toBeHidden();
    await filter.selectOption("unused");
    await expect(dialog.getByRole("article")).toHaveCount(0);
    await dialog.getByRole("button", { name: "검색 조건 지우기", exact: true }).click();
    await expect(edit).toBeVisible();
    await expect(edit).toHaveValue("고친 내용만");
    await search.fill("beta");
    await expect(second).toBeVisible();
    await second.getByRole("button", { name: "조각 수정 저장", exact: true }).click();
    await expect(second).toBeHidden();
    await expect(search).toBeFocused();
    await search.fill("고친 내용만");
    await expect(second).toBeVisible();
    await expect(second).toContainText("고친 내용만");
    await input.fill("Delta 새 내용");
    await dialog.getByRole("button", { name: "조각 보관", exact: true }).click();
    await expect(search).toHaveValue("");
    await expect(filter).toHaveValue("all");
    await expect(dialog.getByRole("article")).toHaveCount(4);
    if (!mobile) {
      await dialog.getByRole("button", { name: "생각 조각 본문 곁에 두기", exact: true }).click();
      for (let index = 0; index < 2; index++) {
        await search.fill("없는 검색 결과");
        await inserted.click({ clickCount: 3 });
        await expect(editor).toBeFocused();
        await expect
          .poll(() => page.evaluate(() => window.getSelection()?.toString()))
          .toBe("Alpha 첫 조각 수정한 본문");
        await page
          .getByRole("toolbar", { name: "선택한 글자 도구", exact: true })
          .getByRole("button", { name: "선택한 글 조각으로 보관", exact: true })
          .click();
        await expect(search).toHaveValue("");
        await expect(dialog.getByRole("article")).toHaveCount(5 + index);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await dialog.getByRole("button", { name: "생각 조각 닫기", exact: true }).click();
    expect(await copied(page, 2)).toBe(html);
  });
}

for (const mobile of [false, true]) {
  test(`inspects visible fragment origins without revealing unread or private source material on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await page.setViewportSize(mobile ? { width: 320, height: 844 } : { width: 1280, height: 900 });
    await setup(page);
    const editor = page.locator(".article-editor");
    const dialog = await openFragments(page);
    const input = dialog.getByLabel("새 생각 조각", { exact: true });
    await input.fill("조각에서 온 첫 구간\n아직 읽지 않은 뒷 구간");
    await dialog.getByRole("button", { name: "조각 보관", exact: true }).click();
    await input.fill("PRIVATE_UNUSED_SNIPPET");
    await dialog.getByRole("button", { name: "조각 보관", exact: true }).click();
    const card = dialog.getByRole("article", { name: "생각 조각 1", exact: true });
    await card.getByRole("button", { name: "글로 넣기", exact: true }).click();
    await expect(editor.locator("p").first()).toHaveText("조각에서 온 첫 구간");
    await editor.locator("p").first().click();
    await page.keyboard.press("Home");
    await page.keyboard.insertText("수정한 ");
    await openFragments(page);
    await card.getByRole("button", { name: "조각 수정", exact: true }).click();
    await card.getByLabel("보관할 조각 내용", { exact: true }).fill("PRIVATE_SOURCE_UPDATE");
    await card.getByRole("button", { name: "조각 수정 저장", exact: true }).click();
    await dialog.getByRole("button", { name: "생각 조각 닫기", exact: true }).click();
    await expect(page.locator(".topbar-status")).toContainText("저장됨");
    await page.reload();
    await expect(editor.locator("p").first()).toHaveText("수정한 조각에서 온 첫 구간");
    const html = await copied(page, 1);
    expect(html).not.toContain("PRIVATE_SOURCE_UPDATE");
    expect(html).not.toContain("PRIVATE_UNUSED_SNIPPET");
    await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
    await page.getByRole("menuitem", { name: "처음부터 읽어보기", exact: true }).click();
    const reader = page.getByRole("region", { name: "처음부터 읽어보기", exact: true });
    await reader.getByRole("button", { name: "차례로 펼치기", exact: true }).click();
    await expect(reader).not.toContainText("아직 읽지 않은 뒷 구간");
    await expect(reader.locator(".reading-fragment-origins")).toHaveCount(0);
    await reader.getByRole("button", { name: "다음 구간 펼치기", exact: true }).click();
    const unit = reader.getByRole("article", { name: "읽기 구간 2", exact: true });
    await expect(unit).toHaveAttribute("aria-busy", "false");
    const origin = unit.locator(".reading-fragment-origins");
    await origin.locator("summary").click();
    await expect(origin.locator(".origin-entry")).toHaveAttribute("data-origin-state", "changed");
    await expect(origin).toContainText("보관한 조각도 수정된 상태입니다.");
    await expect(origin).toContainText("당시 내용은 글을 전부 펼친 뒤 볼 수 있습니다.");
    await expect(origin.locator(".origin-text")).toHaveCount(0);
    await expect(reader).not.toContainText("아직 읽지 않은 뒷 구간");
    await expect(reader).not.toContainText("PRIVATE_SOURCE_UPDATE");
    await expect(reader).not.toContainText("PRIVATE_UNUSED_SNIPPET");
    await reader.getByRole("button", { name: "다음 구간 펼치기", exact: true }).click();
    await expect(reader).toContainText("아직 읽지 않은 뒷 구간");
    await expect(origin.locator(".origin-text")).toHaveCount(0);
    await reader.getByRole("button", { name: "전부 펼치기", exact: true }).click();
    await expect(origin.locator(".origin-text")).toHaveText("조각에서 온 첫 구간");
    await expect(origin).not.toContainText("아직 읽지 않은 뒷 구간");
    await expect(reader).not.toContainText("PRIVATE_SOURCE_UPDATE");
    await expect(reader).not.toContainText("PRIVATE_UNUSED_SNIPPET");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await origin
      .getByRole("button", {
        name: "읽기 구간 2 조각 1 넣은 자리 1 구간 1 본문으로 이동",
        exact: true,
      })
      .click();
    await expect(editor).toBeFocused();
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(
      "수정한 조각에서 온 첫 구간",
    );
    expect(await copied(page, 2)).toBe(html);
  });
}

test("renders only expanded usage details while keeping large histories searchable and edits intact", async ({
  page,
}) => {
  await setup(page);
  const original = await page.locator(".article-editor").textContent();
  const originalHtml = await copied(page, 1);
  await page.evaluate(() => {
    const key = "dc-code-paste:draft:v1";
    const snapshot = JSON.parse(localStorage.getItem(key)!);
    snapshot.document.attrs = {
      ...snapshot.document.attrs,
      thoughtFragments: Array.from({ length: 16 }, (_, fragment) => ({
        id: `fixture-fragment-${fragment}`,
        text: `보관 조각 ${fragment + 1}`,
        createdAt: new Date().toISOString(),
        uses: Array.from({ length: 8 }, (_, use) => ({
          id: `fixture-use-${fragment}-${use}`,
          kind: "prose",
          parts: Array.from({ length: 128 }, (_, part) => ({
            id: `fixture-part-${fragment}-${use}-${part}`,
            text:
              fragment === 0 && use === 0 && part === 0
                ? "원래 문장"
                : `기록 ${fragment + 1}-${use + 1}-${part + 1}`,
          })),
        })),
      })),
    };
    const first = snapshot.document.content.find(
      (node: { type: string }) => node.type === "paragraph",
    );
    first.attrs = { ...first.attrs, thoughtFragmentAnchors: ["fixture-part-0-0-0"] };
    snapshot.updatedAt = new Date().toISOString();
    localStorage.setItem(key, JSON.stringify(snapshot));
  });
  await page.reload();
  const editor = page.locator(".article-editor");
  await expect(editor).toContainText("생각을 담는 글");
  const dialog = await openFragments(page);
  await expect(dialog.getByRole("article")).toHaveCount(16);
  await expect(dialog.locator(".fragment-part")).toHaveCount(0);
  const first = dialog.getByRole("article", { name: "생각 조각 1", exact: true });
  const toggle = first.getByText("넣은 자리 보기", { exact: true });
  await toggle.click();
  await expect(dialog.locator(".fragment-part")).toHaveCount(1024);
  await expect(first.locator(".fragment-use")).toHaveCount(8);
  await expect(
    first.getByRole("button", { name: "조각 1 넣은 자리 1 구간 1 이동", exact: true }),
  ).toBeEnabled();
  await toggle.click();
  await expect(dialog.locator(".fragment-part")).toHaveCount(0);
  await toggle.click();
  await first.getByRole("button", { name: "조각 수정", exact: true }).click();
  const edit = first.getByLabel("보관할 조각 내용", { exact: true });
  await edit.fill("저장 전 입력 유지");
  const search = dialog.getByRole("searchbox", { name: "생각 조각 검색", exact: true });
  await search.fill("기록 16-8-128");
  await expect(dialog.getByRole("article")).toHaveCount(1);
  await expect(dialog.getByRole("article", { name: "생각 조각 16", exact: true })).toBeVisible();
  await expect(dialog.locator(".fragment-part")).toHaveCount(0);
  await dialog.getByRole("button", { name: "검색 조건 지우기", exact: true }).click();
  await expect(edit).toHaveValue("저장 전 입력 유지");
  await expect(first.locator(".fragment-uses")).toHaveAttribute("open", "");
  await expect(dialog.locator(".fragment-part")).toHaveCount(1024);
  await first.getByRole("button", { name: "조각 수정 취소", exact: true }).click();
  await first.getByRole("button", { name: "조각 1 넣은 자리 1 구간 1 이동", exact: true }).click();
  await expect(editor).toBeFocused();
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe("원래 문장");
  expect(await editor.textContent()).toBe(original);
  await expect(page.getByRole("button", { name: "실행 취소", exact: true })).toBeDisabled();
  expect(await copied(page, 1)).toBe(originalHtml);
});
