import { expect, test, type Page } from "@playwright/test";

async function openSettings(page: Page, tab: "선택한 블록" | "전체 글") {
  const target = page.getByRole("tab", { name: tab, exact: true });
  if (!(await target.isVisible()))
    await page.getByRole("button", { name: "블록 설정 패널", exact: true }).click();
  await target.click();
}

async function connectSource(page: Page, index: number, excerpt: string) {
  await page.locator(".article-editor > p").nth(index).click();
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+End");
  await page
    .getByRole("toolbar", { name: "선택한 글자 도구", exact: true })
    .getByRole("button", { name: "문장 출처 연결", exact: true })
    .click();
  const form = page.getByRole("region", { name: "문장 출처", exact: true });
  await form.getByLabel("자료 주소", { exact: true }).fill("https://example.com/source");
  await form.getByLabel("자료 이름", { exact: false }).fill("실험 기록");
  await form.getByLabel("근거 원문", { exact: false }).fill(excerpt);
  await form.getByRole("button", { name: "출처 연결", exact: true }).click();
}

for (const mobile of [false, true]) {
  test(`reviews changed source passages with independent history on ${mobile ? "mobile" : "desktop"}`, async ({
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
      .fill("# 출처 재확인\n\n**[검토할](https://example.com/original)** 문장\n\n유지할 다른 문장");
    await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
    await connectSource(page, 0, "첫 구간의 근거 원문");
    await connectSource(page, 1, "둘째 구간의 근거 원문");
    const sentence = editor.locator(":scope > p").first();
    const originalKey = await sentence
      .locator("[data-source-review]")
      .first()
      .getAttribute("data-source-review");
    await sentence.click();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.insertText("고친 ");
    const modified = await editor.textContent();
    await openSettings(page, "전체 글");
    const catalog = page.getByRole("region", { name: "이 글의 자료", exact: true });
    await catalog.getByRole("checkbox", { name: "다시 확인할 구간만 보기", exact: true }).check();
    await catalog.getByText("연결한 문장 보기", { exact: true }).click();
    const mentions = catalog.getByRole("button", { name: /^연결 \d+로 이동:/ });
    await expect(mentions).toHaveCount(1);
    await expect(catalog).toContainText("연결 구간 수정됨");
    await expect(catalog).toContainText("첫 구간의 근거 원문");
    await expect(catalog).not.toContainText("둘째 구간의 근거 원문");
    await catalog.locator(".mention-review").scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: testInfo.outputPath(`source-review-${mobile ? "mobile" : "desktop"}.png`),
    });
    await mentions.click();
    await openSettings(page, "선택한 블록");
    const form = page.getByRole("region", { name: "문장 출처", exact: true });
    const note = form.locator("[data-source-review-state]");
    const review = form.getByRole("button", { name: "현재 구간으로 기준 갱신", exact: true });
    await expect(note).toHaveAttribute("data-source-review-state", "changed");
    await expect(form.getByLabel("근거 원문", { exact: false })).toHaveValue("첫 구간의 근거 원문");
    await form.getByLabel("자료 이름", { exact: false }).fill("입력 중인 이름");
    await expect(review).toBeDisabled();
    await form.getByLabel("자료 이름", { exact: false }).fill("실험 기록");
    await review.click();
    expect(await editor.textContent()).toBe(modified);
    await expect(sentence.locator("[data-source-review]").first()).not.toHaveAttribute(
      "data-source-review",
      originalKey!,
    );
    await page.getByRole("button", { name: "실행 취소", exact: true }).click();
    expect(await editor.textContent()).toBe(modified);
    await openSettings(page, "선택한 블록");
    await expect(note).toHaveAttribute("data-source-review-state", "changed");
    await page.getByRole("button", { name: "다시 실행", exact: true }).click();
    await expect(note).toHaveAttribute("data-source-review-state", "unchanged");
    await expect(sentence.locator("a")).toHaveAttribute("href", "https://example.com/original");
    await openSettings(page, "전체 글");
    await catalog.getByRole("checkbox", { name: "다시 확인할 구간만 보기", exact: true }).check();
    await expect(catalog).toContainText("다시 확인할 구간이 없습니다.");
    await expect(page.locator(".topbar-status")).toContainText("저장됨");
    await page.reload();
    await expect(editor).toContainText("고친");
    await expect(page.getByRole("group", { name: "글쓰기 편집기", exact: true })).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await sentence.locator("strong").first().click();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowRight");
    await openSettings(page, "선택한 블록");
    await expect(note).toHaveAttribute("data-source-review-state", "unchanged");
    await expect(form.getByLabel("근거 원문", { exact: false })).toHaveValue("첫 구간의 근거 원문");
    expect(await editor.textContent()).toBe(modified);
  });
}

test("loads a legacy draft as untracked until the author updates its source baseline", async ({
  page,
}) => {
  await page.goto("./");
  const editor = page.locator(".article-editor");
  await expect(editor).toContainText("DC-CODE-PASTE");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("dc-code-paste:draft:v1")))
    .not.toBeNull();
  const draft = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("dc-code-paste:draft:v1")!),
  );
  draft.document = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "예전에 연결한 문장",
            marks: [
              {
                type: "sentenceSource",
                attrs: {
                  href: "https://example.com/legacy",
                  label: "과거 자료",
                  excerpt: "원래 발췌",
                },
              },
            ],
          },
        ],
      },
    ],
  };
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "저장함", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("초안 JSON 파일", { exact: true }).setInputFiles({
    name: "legacy.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(draft)),
  });
  await expect(editor).toHaveText("예전에 연결한 문장");
  await editor.locator("p").click();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await openSettings(page, "선택한 블록");
  const form = page.getByRole("region", { name: "문장 출처", exact: true });
  await expect(form.locator("[data-source-review-state]")).toHaveAttribute(
    "data-source-review-state",
    "untracked",
  );
  await form.getByRole("button", { name: "현재 구간으로 기준 갱신", exact: true }).click();
  await expect(form.locator("[data-source-review-state]")).toHaveAttribute(
    "data-source-review-state",
    "unchanged",
  );
  await expect(form.getByLabel("자료 주소", { exact: true })).toHaveValue(
    "https://example.com/legacy",
  );
  await expect(form.getByLabel("근거 원문", { exact: false })).toHaveValue("원래 발췌");
  await expect(editor).toHaveText("예전에 연결한 문장");
});
