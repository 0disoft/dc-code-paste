import { expect, test, type Page } from "@playwright/test";

async function openOutline(page: Page) {
  const tab = page.getByRole("tab", { name: "글 구성", exact: true });
  if (!(await tab.isVisible()))
    await page.getByRole("button", { name: "블록 삽입 패널", exact: true }).click();
  await tab.click();
}

async function markParagraph(page: Page, index: number, label: string) {
  await page.locator(".article-editor p").nth(index).click();
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+End");
  const toolbar = page.getByRole("toolbar", { name: "선택 문장 읽는 의도", exact: true });
  await toolbar.getByRole("button", { name: `읽는 의도: ${label}`, exact: true }).click();
  await expect(toolbar).toHaveCount(0);
}

for (const mobile of [false, true]) {
  test(`reads annotated paths and navigates from preview without editing on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1487, height: 900 });
    await page.goto("./");
    const editor = page.locator(".article-editor");
    await expect(editor).toContainText("DC-CODE-PASTE");
    await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
    await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
    await page
      .getByLabel("Markdown 원문")
      .fill(
        "# 읽기 점검\n\n**[첫 핵심](https://example.com/source)** 문장\n\n연결할 설명\n\n숫자로 본 근거\n\n남은 질문\n\n두 번째 핵심\n\n```js\nconsole.log(1);\n```",
      );
    await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
    await markParagraph(page, 0, "먼저 읽기");
    await markParagraph(page, 2, "근거");
    await markParagraph(page, 3, "아직 답하지 못한 질문");
    await markParagraph(page, 4, "먼저 읽기");
    await expect(page.locator(".topbar-status")).toContainText("저장됨");
    await page.reload();
    await expect(editor.locator('[data-reading-intent="focus"]')).toHaveCount(3);
    const original = await editor.textContent();
    await expect(page.getByRole("button", { name: "실행 취소", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "미리보기", exact: true }).click();
    await openOutline(page);
    const route = page.getByLabel("읽기 경로", { exact: true });
    await route.selectOption("focus");
    const path = page.getByRole("region", { name: "먼저 읽기 읽기 경로", exact: true });
    const navigation = path.getByRole("navigation", { name: "먼저 읽기 표시한 구간", exact: true });
    await expect(navigation.getByRole("button")).toHaveCount(2);
    await expect(navigation.getByRole("button").first()).toContainText("첫 핵심 문장");
    await expect(navigation.getByRole("button").last()).toContainText("두 번째 핵심");
    await expect(path).not.toContainText("연결할 설명");
    await expect(path).not.toContainText("console.log");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: testInfo.outputPath(`reading-path-${mobile ? "mobile" : "desktop"}.png`),
    });
    await navigation.getByRole("button").first().click();
    await expect(editor).toBeVisible();
    await expect(editor).toBeFocused();
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe("첫 핵심 문장");
    await expect(editor.locator("strong a, a strong")).toHaveText("첫 핵심");
    if (mobile)
      await expect(
        page.getByRole("button", { name: "블록 삽입 패널", exact: true }),
      ).toHaveAttribute("aria-pressed", "false");
    await openOutline(page);
    await path.getByRole("button", { name: "읽기 경로: 다음 구간", exact: true }).click();
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe("두 번째 핵심");
    expect(await editor.textContent()).toBe(original);
    await expect(page.getByRole("button", { name: "실행 취소", exact: true })).toBeDisabled();
    await openOutline(page);
    await expect(
      path.getByRole("button", { name: "읽기 경로: 다음 구간", exact: true }),
    ).toBeDisabled();
    await path.getByRole("button", { name: "읽기 경로: 이전 구간", exact: true }).click();
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe("첫 핵심 문장");
    await openOutline(page);
    await route.selectOption("evidence");
    const evidence = page.getByRole("region", { name: "근거 읽기 경로", exact: true });
    await expect(evidence.getByRole("navigation").getByRole("button")).toHaveCount(1);
    await expect(evidence).toContainText("숫자로 본 근거");
    await evidence
      .getByRole("searchbox", { name: "읽기 구간 검색", exact: true })
      .fill("없는 검색어");
    await expect(evidence).toContainText("검색어와 일치하는 구간이 없습니다.");
    await evidence.getByRole("searchbox", { name: "읽기 구간 검색", exact: true }).fill("");
    await route.selectOption("quote");
    await expect(
      page.getByRole("region", { name: "다른 사람의 말 읽기 경로", exact: true }),
    ).toContainText("아직 표시한 구간이 없습니다.");
    await route.selectOption("all");
    await expect(page.getByRole("navigation", { name: "글 구성", exact: true })).toContainText(
      "연결할 설명",
    );
    expect(await editor.textContent()).toBe(original);
  });
}
