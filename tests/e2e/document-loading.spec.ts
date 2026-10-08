import { expect, test } from "@playwright/test";

for (const mobile of [false, true]) {
  test(`returns to writing after loading a template on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1487, height: 900 });
    await page.goto("./");
    const editor = page.locator(".article-editor");
    await expect(editor).toContainText("DC-CODE-PASTE");
    await page.getByRole("button", { name: "미리보기", exact: true }).click();
    if (mobile) await page.getByRole("button", { name: "블록 삽입 패널", exact: true }).click();
    await page.getByRole("tab", { name: "템플릿", exact: true }).click();
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: "뉴스 정리 템플릿", exact: true }).click();
    await expect(page.getByRole("tab", { name: "템플릿", exact: true })).toBeVisible();
    await expect(editor).not.toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "뉴스 정리 템플릿", exact: true }).click();
    await expect(editor).toBeVisible();
    await expect(editor).toBeFocused();
    await expect(editor).toContainText("뉴스 제목을 입력하세요");
    if (mobile)
      await expect(
        page.getByRole("button", { name: "블록 삽입 패널", exact: true }),
      ).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.insertText("바로 입력");
    await expect(editor).toContainText("바로 입력");
  });
}

test("shows imported Markdown instead of leaving the user in HTML preview", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator(".article-editor")).toContainText("DC-CODE-PASTE");
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "HTML 원문 보기", exact: true }).click();
  await expect(page.getByLabel("복사용 HTML 원문", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
  await page.getByLabel("Markdown 원문").fill("# 불러온 글\n\n바로 편집할 본문");
  await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
  await expect(page.locator(".article-editor")).toBeFocused();
  await expect(page.locator(".article-editor")).toContainText("바로 편집할 본문");
  await expect(page.getByLabel("복사용 HTML 원문", { exact: true })).not.toBeVisible();
});

test("keeps the first template recoverable when switching templates without editing", async ({
  page,
}) => {
  await page.goto("./");
  const editor = page.locator(".article-editor");
  await expect(editor).toContainText("DC-CODE-PASTE");
  await page.getByRole("tab", { name: "템플릿", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "뉴스 정리 템플릿", exact: true }).click();
  await expect(editor).toContainText("뉴스 제목을 입력하세요");
  await page.getByRole("tab", { name: "템플릿", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "칼럼 템플릿", exact: true }).click();
  await expect(editor).not.toContainText("뉴스 제목을 입력하세요");
  expect(
    await page.evaluate(() => localStorage.getItem("dc-code-paste:draft-history:v1")),
  ).toContain("뉴스 제목을 입력하세요");
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "저장함", exact: true }).click();
  await page.locator(".draft-history-item").first().getByRole("button").first().click();
  await expect(editor).toContainText("뉴스 제목을 입력하세요");
});

test("checkpoints an imported file with its preferences before starting another template", async ({
  page,
}) => {
  await page.goto("./");
  const editor = page.locator(".article-editor");
  await expect(editor).toContainText("DC-CODE-PASTE");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("dc-code-paste:draft:v1")))
    .not.toBeNull();
  const imported = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("dc-code-paste:draft:v1")!),
  );
  imported.document = {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "FILE_DRAFT_RECOVERY" }] }],
  };
  imported.preferences.bodyFontFamily = "Georgia";
  imported.preferences.documentTheme = "darkEditorial";
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "저장함", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("초안 JSON 파일", { exact: true }).setInputFiles({
    name: "imported.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(imported)),
  });
  await expect(editor).toHaveText("FILE_DRAFT_RECOVERY");
  await expect(editor).toHaveCSS("font-family", /Georgia/);
  await page.getByRole("tab", { name: "템플릿", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "뉴스 정리 템플릿", exact: true }).click();
  await expect(editor).toContainText("뉴스 제목을 입력하세요");
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "저장함", exact: true }).click();
  await page.locator(".draft-history-item").first().getByRole("button").first().click();
  await expect(editor).toHaveText("FILE_DRAFT_RECOVERY");
  await expect(editor).toHaveCSS("font-family", /Georgia/);
  await page.getByRole("tab", { name: "전체 글", exact: true }).click();
  await expect(page.getByLabel("복사될 글 배경", { exact: true })).toHaveValue("darkEditorial");
});
