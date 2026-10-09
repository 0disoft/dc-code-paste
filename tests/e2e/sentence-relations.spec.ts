import { expect, test, type Page } from "@playwright/test";

type ClipboardWindow = typeof window & { copiedDocuments: string[] };

async function setup(page: Page, markdown: string) {
  await page.goto("./");
  await expect(page.locator(".article-editor")).toContainText("DC-CODE-PASTE");
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
  await page.getByLabel("Markdown 원문").fill(markdown);
  await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
  await expect(page.locator(".topbar-status")).toContainText("저장됨");
  await page.reload();
  await expect(page.getByRole("group", { name: "글쓰기 편집기", exact: true })).toHaveAttribute(
    "aria-busy",
    "false",
  );
}

async function select(page: Page, first: number, last = first) {
  if (first === last) {
    await page.locator(".article-editor > p").nth(first).click();
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");
  } else {
    await page.locator(".article-editor").focus();
    await page.evaluate(
      ({ first, last }) => {
        const blocks = document.querySelectorAll(".article-editor > p");
        const range = document.createRange();
        range.setStart(blocks[first], 0);
        range.setEnd(blocks[last], blocks[last].childNodes.length);
        window.getSelection()!.removeAllRanges();
        window.getSelection()!.addRange(range);
      },
      { first, last },
    );
  }
  await expect(page.getByRole("toolbar", { name: "선택한 글자 도구", exact: true })).toBeVisible();
}

async function begin(page: Page, first: number, kind = "condition", last = first) {
  await select(page, first, last);
  await page
    .getByRole("toolbar", { name: "선택한 글자 도구", exact: true })
    .getByRole("button", { name: "문장 관계 연결", exact: true })
    .click();
  await page.getByLabel("연결할 관계", { exact: true }).selectOption(kind);
  await page.getByRole("button", { name: "연결 시작", exact: true }).click();
  await expect(page.getByRole("region", { name: "문장 관계 연결 중", exact: true })).toBeVisible();
}

async function relations(page: Page) {
  const outline = page.getByRole("tab", { name: "글 구성", exact: true });
  if (!(await outline.isVisible()))
    await page.getByRole("button", { name: "블록 삽입 패널", exact: true }).click();
  await outline.click();
  await page.getByLabel("읽기 경로", { exact: true }).selectOption("relations");
  return page.getByRole("region", { name: "문장 관계 목록", exact: true });
}

async function blockAction(page: Page, name: string) {
  const action = page.getByRole("button", { name, exact: true });
  if (!(await action.isVisible()))
    await page.getByRole("button", { name: "블록 설정 패널", exact: true }).click();
  await action.click();
}

for (const mobile of [false, true]) {
  test(`connects passages through reload, edits, duplication, deletion and undo on ${mobile ? "mobile" : "desktop"}`, async ({
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
    await setup(
      page,
      "# 생각을 잇는 글\n\n**[결론](https://example.com/original)** 문장\n\n함께 읽어야 할 조건\n\n참고하는 근거\n\n다른 의견",
    );
    const editor = page.locator(".article-editor");
    const original = await editor.textContent();
    const copy = page.locator('[data-copy-trigger="preview"]');
    await copy.click();
    await expect
      .poll(() => page.evaluate(() => (window as ClipboardWindow).copiedDocuments.length))
      .toBe(1);
    const html = await page.evaluate(() => (window as ClipboardWindow).copiedDocuments[0]);
    await begin(page, 0);
    await expect(page.getByRole("button", { name: "실행 취소", exact: true })).toBeDisabled();
    const pending = page.getByRole("region", { name: "문장 관계 연결 중", exact: true });
    await expect(
      pending.getByRole("button", { name: "선택한 구간 연결", exact: true }),
    ).toBeDisabled();
    await select(page, 1);
    await pending.getByRole("button", { name: "선택한 구간 연결", exact: true }).click();
    await expect(pending).toHaveCount(0);
    expect(await editor.textContent()).toBe(original);
    await expect(editor.locator("p").first().locator("strong")).toHaveText("결론");
    await expect(editor.locator("p").first().locator("a")).toHaveAttribute(
      "href",
      "https://example.com/original",
    );
    await copy.click();
    await expect
      .poll(() => page.evaluate(() => (window as ClipboardWindow).copiedDocuments.length))
      .toBe(2);
    expect(await page.evaluate(() => (window as ClipboardWindow).copiedDocuments[1])).toBe(html);
    await expect(page.locator(".topbar-status")).toContainText("저장됨");
    await page.reload();
    let list = await relations(page);
    const card = list.getByRole("article", { name: "조건 관계 1", exact: true });
    await expect(card).toHaveAttribute("data-relation-state", "linked");
    await card.getByRole("button", { name: "조건 구간 1 이동", exact: true }).click();
    await expect(editor).toBeFocused();
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(
      "함께 읽어야 할 조건",
    );
    await expect(page.getByRole("button", { name: "실행 취소", exact: true })).toBeDisabled();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.insertText("고친 ");
    list = await relations(page);
    await expect(card).toHaveAttribute("data-relation-state", "changed");
    await page.getByRole("button", { name: "실행 취소", exact: true }).click();
    await expect(card).toHaveAttribute("data-relation-state", "linked");
    await card.getByRole("button", { name: "조건 구간 1 이동", exact: true }).click();
    await blockAction(page, "블록 복제");
    list = await relations(page);
    await expect(card).toHaveAttribute("data-relation-state", "duplicated");
    await expect(
      card.getByRole("button", { name: "조건 구간 1 이동", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "실행 취소", exact: true }).click();
    await expect(card).toHaveAttribute("data-relation-state", "linked");
    await card.getByRole("button", { name: "조건 구간 1 이동", exact: true }).click();
    await blockAction(page, "블록 삭제");
    list = await relations(page);
    await expect(card).toHaveAttribute("data-relation-state", "missing");
    await expect(card).toContainText("함께 읽어야 할 조건");
    await expect(card).toContainText("연결 당시 원문");
    await expect(
      card.getByRole("button", { name: "조건 구간 1 이동", exact: true }),
    ).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: testInfo.outputPath(`sentence-relations-${mobile ? "mobile" : "desktop"}.png`),
    });
    const afterDelete = await editor.textContent();
    await card.getByRole("button", { name: "문장 관계 1 해제", exact: true }).click();
    await expect(list.getByRole("article")).toHaveCount(0);
    expect(await editor.textContent()).toBe(afterDelete);
    await page.getByRole("button", { name: "실행 취소", exact: true }).click();
    await expect(card).toHaveAttribute("data-relation-state", "missing");
    await expect(page.locator(".topbar-status")).toContainText("저장됨");
    await page.reload();
    await relations(page);
    await expect(card).toHaveAttribute("data-relation-state", "missing");
    expect(await editor.textContent()).toBe(afterDelete);
  });
}

test("connects a multi-paragraph endpoint and navigates each part", async ({ page }) => {
  await setup(page, "# 여러 구간\n\n첫 문장\n\n둘째 문장\n\n다른 의견");
  await begin(page, 0, "counterpoint", 1);
  await select(page, 2);
  await page.getByRole("button", { name: "선택한 구간 연결", exact: true }).click();
  const list = await relations(page);
  const card = list.getByRole("article", { name: "반론 관계 1", exact: true });
  await expect(card).toHaveAttribute("data-relation-state", "linked");
  await expect(card.getByRole("button", { name: /^처음 선택한 구간 \d 이동$/ })).toHaveCount(2);
  await card.getByRole("button", { name: "처음 선택한 구간 2 이동", exact: true }).click();
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe("둘째 문장");
});

test("cancels uncommitted connections and refuses a first passage changed during selection", async ({
  page,
}) => {
  await setup(page, "# 연결 시작\n\n처음 문장\n\n조건 문장\n\n```js\nconst code = 1;\n```");
  const editor = page.locator(".article-editor");
  const original = await editor.textContent();
  await begin(page, 0, "evidence");
  await page.getByRole("button", { name: "관계 연결 취소", exact: true }).click();
  await expect(page.getByRole("region", { name: "문장 관계 연결 중", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "실행 취소", exact: true })).toBeDisabled();
  expect(await editor.textContent()).toBe(original);
  await begin(page, 0);
  await page.keyboard.insertText("고친 문장");
  await expect(page.getByRole("alert")).toContainText("처음 선택한 구간이 바뀌었습니다.");
  await expect(page.getByRole("button", { name: "선택한 구간 연결", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "실행 취소", exact: true }).click();
  expect(await editor.textContent()).toBe(original);
  await page
    .getByRole("region", { name: "문장 관계 연결 중", exact: true })
    .getByRole("button", { name: "닫기", exact: true })
    .click();
  await editor.locator("pre").click();
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+End");
  await expect(page.getByRole("toolbar", { name: "선택한 글자 도구", exact: true })).toHaveCount(0);
  const list = await relations(page);
  await expect(list.getByRole("article")).toHaveCount(0);
});
