import { expect, test, type Page } from "@playwright/test";

const draftKey = "dc-code-paste:draft:v1";
const historyKey = "dc-code-paste:draft-history:v1";

async function waitForEditor(page: Page) {
  await expect(page.locator(".article-editor")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".article-editor")).toContainText("DC-CODE-PASTE");
}

async function openMarkdown(page: Page, markdown: string) {
  await page.getByRole("button", { name: "Markdown" }).click();
  await page.getByLabel("Markdown 원문").fill(markdown);
  await page.getByRole("button", { name: "Markdown 적용하기" }).click();
}

test("flushes the latest edit when the page is leaving", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForEditor(page);

  const sentinel = "AUTOSAVE_FLUSH_SENTINEL";
  await page.locator(".article-editor").click();
  await page.keyboard.press("Control+End");
  await page.keyboard.insertText(sentinel);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));

  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), draftKey))
    .toContain(sentinel);
});

test("checkpoints the current draft before applying a preset", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForEditor(page);

  await page.getByRole("button", { name: "저장함" }).click();
  await page.getByLabel("프리셋 이름").fill("BASE_PRESET");
  await page.getByRole("button", { name: "프리셋 저장" }).click();
  await page.keyboard.press("Escape");

  const sentinel = "CURRENTDRAFTBEFOREPRESET";
  await openMarkdown(page, `# ${sentinel}\n\n복구되어야 하는 본문`);
  await page.getByRole("button", { name: "저장함" }).click();
  await page
    .getByLabel("저장된 프리셋")
    .getByRole("button")
    .filter({ hasText: "BASE_PRESET" })
    .click();

  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), historyKey))
    .toContain(sentinel);
});

test("ignores a late LLM response after the user edits Markdown", async ({ page }) => {
  let releaseResponse!: () => void;
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });

  await page.route("**/api/v1/models**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"data":[]}',
    });
  });
  await page.route("https://openrouter.ai/api/v1/chat/completions", async (route) => {
    await responseGate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"choices":[{"message":{"content":"# STALE_LLM_RESPONSE"}}]}',
    });
  });

  await page.goto("/");
  await waitForEditor(page);
  await page.getByRole("button", { name: "AI 작성" }).click();
  await page.getByLabel("API 키").fill("sk-or-v1-test");
  await page.getByRole("combobox", { name: "모델" }).fill("test/model");
  await page.getByRole("textbox", { name: "요청" }).fill("테스트 글 작성");
  await page.getByRole("button", { name: "AI 글 생성하기" }).click();

  await page.getByRole("button", { name: "AI 작성 닫기" }).click();
  await page.getByRole("button", { name: "Markdown" }).click();
  await page.getByLabel("Markdown 원문").fill("# MANUAL_MARKDOWN");
  releaseResponse();

  await expect(page.getByLabel("Markdown 원문")).toHaveValue("# MANUAL_MARKDOWN");
});
