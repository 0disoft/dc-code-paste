import { expect, test, type Page } from "@playwright/test";

type ClipboardWindow = typeof window & { copiedDocuments: string[] };

async function markdown(page: Page, value: string) {
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
  await page.getByLabel("Markdown 원문").fill(value);
  await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
}

async function markFocus(page: Page, index: number) {
  await page.locator(".article-editor > p").nth(index).click();
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+End");
  const toolbar = page.getByRole("toolbar", { name: "선택한 글자 도구", exact: true });
  await toolbar.getByRole("button", { name: "읽는 의도 선택", exact: true }).click();
  await toolbar.getByRole("button", { name: "읽는 의도: 먼저 읽기", exact: true }).click();
  await expect(toolbar).toHaveCount(0);
}

async function review(page: Page) {
  await page.getByRole("button", { name: "미리보기", exact: true }).click();
  const panel = page.getByRole("region", { name: "강조 점검", exact: true });
  if (!(await panel.isVisible()))
    await page.getByRole("button", { name: "강조 점검", exact: true }).click();
  return panel;
}

for (const mobile of [false, true]) {
  test(`reviews explicit emphasis and returns to its source without changing clipboard output on ${mobile ? "mobile" : "desktop"}`, async ({
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
    const long = `긴 강조 문장은 ${"중간을 자르지 않고 모두 읽습니다. ".repeat(35)}마지막까지 보이는 문장`;
    await markdown(
      page,
      [
        "# 글의 입구",
        "**[첫 핵심](https://example.com/source)** 문장",
        "평범한 설명",
        "먼저 확인할 조건",
        "## 다른 절",
        `**${long}**`,
        "```js\nconst code = 1;\n```",
      ].join("\n\n"),
    );
    await markFocus(page, 0);
    await markFocus(page, 2);
    await expect(page.locator(".topbar-status")).toContainText("저장됨");
    await page.reload();
    await expect(page.getByRole("group", { name: "글쓰기 편집기", exact: true })).toHaveAttribute(
      "aria-busy",
      "false",
    );
    const original = await editor.textContent();
    const copy = page.locator('[data-copy-trigger="preview"]');
    await copy.click();
    await expect
      .poll(() => page.evaluate(() => (window as ClipboardWindow).copiedDocuments.length))
      .toBe(1);
    const originalHtml = await page.evaluate(() => (window as ClipboardWindow).copiedDocuments[0]);
    const panel = await review(page);
    const passages = panel
      .getByRole("list", { name: "강조한 본문 구간", exact: true })
      .getByRole("listitem");
    await expect(passages).toHaveCount(3);
    await expect(passages.nth(0).locator(".passage-text")).toHaveText("첫 핵심 문장");
    await expect(passages.nth(0).getByLabel("강조 방식", { exact: true })).toHaveText(
      "굵게먼저 읽기",
    );
    await expect(passages.nth(1).locator(".passage-text")).toHaveText("먼저 확인할 조건");
    await expect(passages.nth(2).locator(".passage-text")).toHaveText(long);
    await expect(passages.nth(2)).toContainText("다른 절");
    await expect(panel).not.toContainText("const code");
    await expect(panel.getByLabel("전체 본문 강조 현황", { exact: true })).toContainText("3개");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: testInfo.outputPath(`emphasis-review-${mobile ? "mobile" : "desktop"}.png`),
    });
    await copy.click();
    await expect
      .poll(() => page.evaluate(() => (window as ClipboardWindow).copiedDocuments.length))
      .toBe(2);
    expect(await page.evaluate(() => (window as ClipboardWindow).copiedDocuments[1])).toBe(
      originalHtml,
    );
    const search = panel.getByRole("searchbox", { name: "강조 구간 검색", exact: true });
    await search.fill("조건");
    await expect(passages).toHaveCount(1);
    await expect(panel.getByLabel("전체 본문 강조 현황", { exact: true })).toContainText("3개");
    await panel.getByRole("button", { name: "강조 구간 1 편집", exact: true }).click();
    await expect(editor).toBeFocused();
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe("먼저 확인할 조건");
    expect(await editor.textContent()).toBe(original);
    await expect(page.getByRole("button", { name: "실행 취소", exact: true })).toBeDisabled();
    const toolbar = page.getByRole("toolbar", { name: "선택한 글자 도구", exact: true });
    await toolbar.getByRole("button", { name: "읽는 의도 선택", exact: true }).click();
    await toolbar.getByRole("button", { name: "읽는 의도 해제", exact: true }).click();
    await page.getByRole("button", { name: "미리보기", exact: true }).click();
    await expect(search).toHaveValue("조건");
    await expect(panel).toContainText("검색어와 일치하는 강조 구간이 없습니다.");
    await expect(panel.getByLabel("전체 본문 강조 현황", { exact: true })).toContainText("2개");
    await page.getByRole("button", { name: "실행 취소", exact: true }).click();
    await expect(passages).toHaveCount(1);
    await expect(panel.getByLabel("전체 본문 강조 현황", { exact: true })).toContainText("3개");
    await search.fill("");
    await passages.first().getByRole("button", { name: "강조 구간 1 편집", exact: true }).click();
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe("첫 핵심 문장");
    await expect(editor.locator("p").first().locator("a")).toHaveAttribute(
      "href",
      "https://example.com/source",
    );
    expect(await editor.textContent()).toBe(original);
    await page.getByRole("button", { name: "미리보기", exact: true }).click();
    await page.getByRole("button", { name: "배치 비교", exact: true }).click();
    await expect(panel).toHaveCount(0);
    await expect(page.getByRole("region", { name: "읽기 배치 비교", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "강조 점검", exact: true }).click();
    await expect(page.getByRole("region", { name: "읽기 배치 비교", exact: true })).toHaveCount(0);
    await expect(passages).toHaveCount(3);
    await page.getByRole("button", { name: "강조 점검 닫기", exact: true }).click();
    await expect(page.locator(".preview-surface")).toContainText("첫 핵심 문장");
  });
}

test("preserves the reviewed passage position through focus mode", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("./");
  await expect(page.locator(".article-editor")).toContainText("DC-CODE-PASTE");
  await markdown(
    page,
    `# 오래 읽는 글\n\n${Array.from({ length: 30 }, (_, index) => `**강조 ${index + 1}. ${"생각할 여유를 두고 읽는 문장. ".repeat(8)}**`).join("\n\n")}`,
  );
  const panel = await review(page);
  const passage = panel.locator(".passage-text").nth(19);
  await passage.scrollIntoViewIfNeeded();
  await passage.evaluate((element) => {
    const scroller = element.closest(".canvas-scroll")!;
    scroller.scrollTop +=
      element.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 8;
  });
  const readingOffset = () =>
    passage.evaluate(
      (element) =>
        element.getBoundingClientRect().top -
        element.closest(".canvas-scroll")!.getBoundingClientRect().top,
    );
  const originalOffset = await readingOffset();
  for (const label of ["집중해서 쓰기", "집중 모드 끝내기"]) {
    await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
    await page.getByRole("menuitemcheckbox", { name: label, exact: true }).click();
    await expect.poll(readingOffset).toBeCloseTo(originalOffset, 0);
    await expect(panel).toBeVisible();
  }
});

test("explains how to mark prose when only titles and code are emphasized", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator(".article-editor")).toContainText("DC-CODE-PASTE");
  await markdown(page, "# **굵은 제목**\n\n평범한 문장\n\n```js\nconst code = 1;\n```");
  const panel = await review(page);
  await expect(panel).toContainText("아직 강조한 본문이 없습니다.");
  await expect(panel.getByRole("listitem")).toHaveCount(0);
  await expect(panel.getByLabel("전체 본문 강조 현황", { exact: true })).toContainText("0개");
});
