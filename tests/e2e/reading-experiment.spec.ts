import { expect, test, type Page } from "@playwright/test";

async function startReading(page: Page) {
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "처음부터 읽어보기", exact: true }).click();
  const reader = page.getByRole("region", { name: "처음부터 읽어보기", exact: true });
  await expect(reader).toBeVisible();
  await expect(reader).toBeFocused();
  return reader;
}

async function prepare(page: Page) {
  await page.goto("./");
  await expect(page.locator(".article-editor")).toContainText("DC-CODE-PASTE");
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
  await page
    .getByLabel("Markdown 원문")
    .fill(
      "# 처음 보는 글\n\n**[핵심 문장](https://example.com/source)** 입니다.\n\n설명은 뒤에 나옵니다.\n\n```js\nconsole.log('code');\n```\n\n---\n\n마지막 문장",
    );
  await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
  await expect(page.locator(".article-editor p").first()).toContainText("핵심 문장");
  await expect(page.locator(".topbar-status")).toContainText("저장됨");
  await page.reload();
  await expect(page.locator(".article-editor")).toContainText("처음 보는 글");
}

for (const mobile of [false, true]) {
  test(`reads progressively and saves notes back to the original passage on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(mobile ? { width: 320, height: 844 } : { width: 1487, height: 900 });
    await prepare(page);
    const editor = page.locator(".article-editor");
    const original = await editor.textContent();
    const reader = await startReading(page);
    await expect(page.locator(".topbar-title")).toContainText("읽는 중");
    await expect(editor).toBeHidden();
    await expect(reader.locator(".unit-document a")).toHaveAttribute(
      "href",
      "https://example.com/source",
    );
    await expect(reader.locator('[data-unit-code="true"]')).toContainText("console.log");
    await expect(reader.locator('[data-unit-code="true"] button')).toHaveCount(0);
    const units = reader.locator(".reading-unit");
    const count = await units.count();
    await reader.getByRole("button", { name: "차례로 펼치기", exact: true }).click();
    await expect(units).toHaveCount(1);
    await reader.getByRole("button", { name: "다음 구간 펼치기", exact: true }).click();
    await expect(units).toHaveCount(2);
    await reader.getByRole("button", { name: "전부 펼치기", exact: true }).click();
    await expect(units).toHaveCount(count);
    for (const width of ["PC", "모바일", "맞춤"]) {
      await reader.getByRole("button", { name: width, exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(
        await reader
          .locator(".reading-scroll")
          .evaluate((element) => element.scrollWidth <= element.clientWidth),
      ).toBe(true);
    }
    const noteButton = reader.getByRole("button", { name: "읽기 구간 2 메모", exact: true });
    await noteButton.click();
    await expect(reader.getByRole("textbox", { name: "읽기 메모", exact: true })).toBeFocused();
    await reader
      .getByRole("textbox", { name: "읽기 메모", exact: true })
      .fill("この説明はどこ？\n근거를 먼저 보고 싶다.");
    await reader.getByRole("button", { name: "읽기 메모 저장", exact: true }).click();
    await expect(noteButton).toBeFocused();
    await expect(reader).toContainText("읽기 메모를 저장했습니다.");
    await reader.getByRole("button", { name: "멈춘 자리 모아보기", exact: true }).click();
    const recap = reader.getByRole("region", { name: "멈춘 자리 모아보기", exact: true });
    await expect(recap.locator(".recap-item")).toHaveCount(1);
    await expect(recap.locator(".recap-text")).toBeHidden();
    await recap.getByText("메모 본문 보기", { exact: true }).click();
    await expect(recap).toContainText("근거를 먼저 보고 싶다.");
    await page.screenshot({
      path: testInfo.outputPath(`reading-experiment-${mobile ? "mobile" : "desktop"}.png`),
    });
    await expect(page.locator(".topbar-status")).toContainText("저장됨");
    await page.reload();
    await startReading(page);
    await reader.getByRole("button", { name: "멈춘 자리 모아보기", exact: true }).click();
    await expect(recap.locator(".recap-item")).toHaveCount(1);
    await recap
      .getByRole("button", { name: "읽기 메모 1 구간 1 원문으로 이동", exact: true })
      .click();
    await expect(reader).toBeHidden();
    await expect(editor).toBeFocused();
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe("핵심 문장 입니다.");
    expect(await editor.textContent()).toBe(original);
    await expect(editor.locator("strong a, a strong")).toHaveText("핵심 문장");
    const review = page.getByRole("region", { name: "고칠 때 참고할 읽기 메모", exact: true });
    await expect(review).toContainText("근거를 먼저 보고 싶다.");
    await expect(review).toHaveAttribute("data-note-state", "linked");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.type("보충");
    await expect(review).toHaveAttribute("data-note-state", "changed");
    await review.getByText("메모를 남긴 구간 보기", { exact: true }).click();
    await expect(review).toContainText("핵보충심 문장");
    await review.getByText("메모 당시 원문 보기", { exact: true }).click();
    await expect(review.locator(".note-part details p")).toHaveText("핵심 문장 입니다.");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: testInfo.outputPath(`reading-note-edit-${mobile ? "mobile" : "desktop"}.png`),
    });
    await page.getByRole("button", { name: "실행 취소", exact: true }).click();
    await expect(review).toHaveAttribute("data-note-state", "linked");
    expect(await editor.textContent()).toBe(original);
    await review.getByRole("button", { name: "계속 읽어보기", exact: true }).click();
    await expect(reader).toBeFocused();
    await expect(review).toBeHidden();
    await reader.getByRole("button", { name: "읽어보기 끝내기", exact: true }).click();
    await expect(review).toBeVisible();
    await review.getByRole("button", { name: "편집 중 읽기 메모 닫기", exact: true }).click();
    await expect(review).toHaveCount(0);
    await expect(editor).toBeFocused();
  });
}

test("keeps the editor selection on exit and undoes notes without leaving the reader", async ({
  page,
}) => {
  await prepare(page);
  const editor = page.locator(".article-editor");
  await editor.locator("p").first().click();
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+End");
  const selected = await page.evaluate(() => window.getSelection()?.toString());
  const reader = await startReading(page);
  const noteButton = reader.getByRole("button", { name: "읽기 구간 2 메모", exact: true });
  await noteButton.click();
  await reader.getByRole("textbox", { name: "읽기 메모", exact: true }).fill("설명 필요");
  await reader.getByRole("textbox", { name: "읽기 메모", exact: true }).press("Escape");
  await expect(noteButton).toBeFocused();
  await expect(reader.getByRole("textbox", { name: "읽기 메모", exact: true })).toHaveCount(0);
  await noteButton.click();
  await reader.getByRole("textbox", { name: "읽기 메모", exact: true }).fill("설명 필요");
  await reader.getByRole("button", { name: "읽기 메모 저장", exact: true }).click();
  await reader.getByRole("button", { name: "멈춘 자리 모아보기", exact: true }).click();
  const entries = reader.locator(".recap-item");
  await expect(entries).toHaveCount(1);
  await page.getByRole("button", { name: "실행 취소", exact: true }).click();
  await expect(entries).toHaveCount(0);
  await expect(reader).toBeVisible();
  await page.getByRole("button", { name: "다시 실행", exact: true }).click();
  await expect(entries).toHaveCount(1);
  await reader.getByRole("button", { name: "읽기 메모 1 삭제", exact: true }).click();
  await expect(entries).toHaveCount(0);
  await page.getByRole("button", { name: "실행 취소", exact: true }).click();
  await expect(entries).toHaveCount(1);
  await reader.getByRole("button", { name: "읽어보기 끝내기", exact: true }).click();
  await expect(editor).toBeFocused();
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(selected);
});
