import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const draftKey = "dc-code-paste:draft:v1";
type CopiedWindow = typeof window & { copiedMarkdownDraftPayload?: Record<string, string> };

async function ready(page: Page) {
  await expect(page.locator(".article-editor")).toBeVisible();
  await expect(page.getByRole("group", { name: "글쓰기 편집기", exact: true })).toHaveAttribute(
    "aria-busy",
    "false",
  );
}
async function openTool(page: Page, name: string) {
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}
async function storedMarkdown(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? "{}").markdownDraft ?? "",
    draftKey,
  );
}

for (const mobile of [false, true]) {
  test(`restores unapplied text and cleared buffers without changing public output on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1400, height: 900 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: {
          write: async (items: ClipboardItem[]) => {
            (window as CopiedWindow).copiedMarkdownDraftPayload = {
              "text/html": await (await items[0].getType("text/html")).text(),
              "text/plain": await (await items[0].getType("text/plain")).text(),
            };
          },
        },
      });
    });
    await page.goto("./");
    await ready(page);
    const original = await page.locator(".article-editor").textContent();
    const markdown = "# PRIVATE_UNAPPLIED_MARKDOWN\n\n  첫 줄\n\t다음 줄\n";
    await openTool(page, "Markdown");
    await page.getByLabel("Markdown 원문").fill(markdown);
    await expect.poll(() => storedMarkdown(page)).toBe(markdown);
    await expect(page.locator(".topbar-status")).toContainText("저장됨");
    await page.reload();
    await ready(page);
    expect(await page.locator(".article-editor").textContent()).toBe(original);
    await openTool(page, "Markdown");
    await expect(page.getByLabel("Markdown 원문")).toHaveValue(markdown);
    await page.getByRole("button", { name: "Markdown 닫기", exact: true }).click();
    await page.locator('[data-copy-trigger="preview"]').click();
    await expect
      .poll(() => page.evaluate(() => (window as CopiedWindow).copiedMarkdownDraftPayload))
      .toBeTruthy();
    const payload = await page.evaluate(() => (window as CopiedWindow).copiedMarkdownDraftPayload!);
    expect(payload["text/html"]).not.toContain("PRIVATE_UNAPPLIED_MARKDOWN");
    expect(payload["text/plain"]).not.toContain("PRIVATE_UNAPPLIED_MARKDOWN");
    await openTool(page, "Markdown");
    await page.getByRole("button", { name: "Markdown 비우기", exact: true }).click();
    await expect.poll(() => storedMarkdown(page)).toBe("");
    await page.reload();
    await ready(page);
    await openTool(page, "Markdown");
    await expect(page.getByLabel("Markdown 원문")).toHaveValue("");
    // Page exit must flush pending edits before the debounce fires.
    await page.getByLabel("Markdown 원문").fill("# PENDING_EXIT_FLUSH");
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
    expect(await storedMarkdown(page)).toBe("# PENDING_EXIT_FLUSH");
  });
}

test("persists AI output before applying it without saving credentials or request settings", async ({
  page,
}) => {
  const markdown = "# PRIVATE_UNAPPLIED_AI\n\n생성 원고\n";
  // The existing AI parser trims the response before handing it to the workspace.
  const generatedMarkdown = markdown.trim();
  await page.route("**/api/v1/models**", (route) =>
    route.fulfill({ contentType: "application/json", body: '{"data":[]}' }),
  );
  await page.route("https://openrouter.ai/api/v1/chat/completions", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        choices: [{ message: { content: markdown }, finish_reason: "stop" }],
      }),
    }),
  );
  await page.goto("./");
  await ready(page);
  await openTool(page, "AI 작성");
  await page.getByLabel("API 키").fill("sk-or-v1-private-persistence-test");
  await page.getByRole("combobox", { name: "모델", exact: true }).fill("private/test-model");
  await page.getByRole("textbox", { name: "요청", exact: true }).fill("PRIVATE_REQUEST_NOT_SAVED");
  await page.getByRole("button", { name: "AI 글 생성하기", exact: true }).click();
  await expect(page.getByLabel("Markdown 원문")).toHaveValue(generatedMarkdown);
  await expect.poll(() => storedMarkdown(page)).toBe(generatedMarkdown);
  const raw = await page.evaluate((key) => localStorage.getItem(key)!, draftKey);
  expect(raw).not.toContain("sk-or-v1-private-persistence-test");
  expect(raw).not.toContain("PRIVATE_REQUEST_NOT_SAVED");
  expect(raw).not.toContain("private/test-model");
  await page.reload();
  await ready(page);
  expect(await page.locator(".article-editor").textContent()).not.toContain("PRIVATE_UNAPPLIED_AI");
  await openTool(page, "Markdown");
  await expect(page.getByLabel("Markdown 원문")).toHaveValue(generatedMarkdown);
});

test("detects working-text-only tab conflicts and preserves the local buffer in recovery history", async ({
  page,
  context,
}) => {
  await page.goto("./");
  await ready(page);
  await openTool(page, "Markdown");
  await page.getByLabel("Markdown 원문").fill("# LOCAL_WORKING_BUFFER");
  await expect.poll(() => storedMarkdown(page)).toBe("# LOCAL_WORKING_BUFFER");
  const other = await context.newPage();
  await other.goto("./");
  await ready(other);
  await openTool(other, "Markdown");
  await expect(other.getByLabel("Markdown 원문")).toHaveValue("# LOCAL_WORKING_BUFFER");
  await other.getByLabel("Markdown 원문").fill("# REMOTE_WORKING_BUFFER");
  await expect.poll(() => storedMarkdown(other)).toBe("# REMOTE_WORKING_BUFFER");
  await expect(
    page.getByRole("alert").getByText("다른 탭에서 초안이 변경됐습니다 · 자동 저장 중지"),
  ).toBeVisible();
  await expect(page.getByLabel("Markdown 원문")).toHaveValue("# LOCAL_WORKING_BUFFER");
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
  expect(await storedMarkdown(page)).toBe("# REMOTE_WORKING_BUFFER");
  await page.getByRole("button", { name: "다른 탭 초안 불러오기", exact: true }).click();
  await openTool(page, "Markdown");
  await expect(page.getByLabel("Markdown 원문")).toHaveValue("# REMOTE_WORKING_BUFFER");
  expect(
    await page.evaluate(() => localStorage.getItem("dc-code-paste:draft-history:v1")),
  ).toContain("LOCAL_WORKING_BUFFER");
  await other.close();
});

test("includes working text in file backups and restores it with files and recovery points", async ({
  page,
}) => {
  await page.goto("./");
  await ready(page);
  await openTool(page, "Markdown");
  await page.getByLabel("Markdown 원문").fill("# PRIVATE_BACKUP_BUFFER");
  await expect.poll(() => storedMarkdown(page)).toBe("# PRIVATE_BACKUP_BUFFER");
  await openTool(page, "저장함");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "초안 파일 저장", exact: true }).click();
  const download = await downloadPromise;
  const snapshot = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(snapshot.markdownDraft).toBe("# PRIVATE_BACKUP_BUFFER");
  expect(JSON.stringify(snapshot.document)).not.toContain("PRIVATE_BACKUP_BUFFER");
  snapshot.markdownDraft = "# PRIVATE_FILE_BUFFER\n\t원문\n";
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("초안 JSON 파일", { exact: true }).setInputFiles({
    name: "pending-markdown.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(snapshot)),
  });
  await expect.poll(() => storedMarkdown(page)).toBe(snapshot.markdownDraft);
  await openTool(page, "Markdown");
  await expect(page.getByLabel("Markdown 원문")).toHaveValue(snapshot.markdownDraft);
  await openTool(page, "저장함");
  await page.locator(".draft-history-item").first().locator(".draft-history-apply").click();
  await openTool(page, "Markdown");
  await expect(page.getByLabel("Markdown 원문")).toHaveValue("# PRIVATE_BACKUP_BUFFER");
});
