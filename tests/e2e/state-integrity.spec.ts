import { expect, test, type Page } from "@playwright/test";

const draftKey = "dc-code-paste:draft:v1";
const historyKey = "dc-code-paste:draft-history:v1";

test("opens the editor when browser storage access is blocked", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Storage blocked", "SecurityError");
      },
    });
  });

  await page.goto("/");
  await waitForEditor(page);
  await page.locator(".article-editor").click();
  await page.keyboard.insertText("STORAGE_BLOCKED_EDIT");
  await expect(page.locator(".article-editor")).toContainText("STORAGE_BLOCKED_EDIT");
});

test("preserves an invalid saved draft before starting a new one", async ({ page }) => {
  const raw = '{"version":1,"document":{"type":"unknownNode"}}';
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [draftKey, raw]);
  await page.goto("/");

  await waitForEditor(page);
  await expect(page.getByRole("alert")).toContainText(
    "원본을 브라우저 저장소에 별도로 보관했습니다",
  );
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("dc-code-paste:draft-invalid-backup:v1")))
    .toBe(raw);
  await page.getByRole("button", { name: "새 초안 저장 시작" }).click();
  await expect(page.getByRole("alert")).not.toBeVisible();
});

test("reports a failed autosave while keeping the editor usable", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException("Storage full", "QuotaExceededError");
    };
  });
  await page.goto("/");
  await waitForEditor(page);

  await expect(page.getByText("저장 실패 · 이 탭의 내용을 복사해 보관하세요")).toBeVisible();
  await page.locator(".article-editor").click();
  await page.keyboard.insertText("UNSAVED_TEXT");
  await expect(page.locator(".article-editor")).toContainText("UNSAVED_TEXT");
  await page.getByRole("button", { name: "다시 저장" }).click();
  await expect(page.getByText("저장 실패 · 이 탭의 내용을 복사해 보관하세요")).toBeVisible();
});

test("stops a stale tab from overwriting another tab's draft", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForEditor(page);
  await expect(page.getByText(/저장됨/)).toBeVisible();

  const otherTab = await context.newPage();
  await otherTab.goto("/");
  await waitForEditor(otherTab);
  await openMarkdown(otherTab, "# OTHER_TAB_DRAFT");
  await expect.poll(() => storedDraftText(otherTab)).toContain("OTHER_TAB_DRAFT");

  await expect(page.getByText("다른 탭에서 초안이 변경됐습니다 · 자동 저장 중지")).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
  expect(await storedDraftText(page)).toContain("OTHER_TAB_DRAFT");
  await page.getByRole("button", { name: "다른 탭 초안 불러오기" }).click();
  await expect(page.locator(".article-editor")).toContainText("OTHER_TAB_DRAFT");
  await otherTab.close();
});

async function waitForEditor(page: Page) {
  await expect(page.locator(".article-editor")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".article-editor")).toContainText("DC-CODE-PASTE");
}

async function storedDraftText(page: Page): Promise<string> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return "";
    const snapshot = JSON.parse(raw) as {
      document?: { content?: { content?: { text?: string }[] }[] };
    };
    return (
      snapshot.document?.content
        ?.flatMap((node) => node.content?.map((child) => child.text ?? "") ?? [])
        .join("") ?? ""
    );
  }, draftKey);
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

test("renames a saved preset without applying it on double click", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForEditor(page);
  await page.getByRole("button", { name: "저장함" }).click();
  await page.getByLabel("프리셋 이름").fill("SAVED_PRESET");
  await page.getByRole("button", { name: "프리셋 저장" }).click();
  await page.getByRole("button", { name: "닫기" }).click();
  await openMarkdown(page, "# CURRENT_DRAFT");
  const historyBefore = await page.evaluate((key) => localStorage.getItem(key), historyKey);

  await page.getByRole("button", { name: "저장함" }).click();
  await page.getByRole("button", { name: "SAVED_PRESET 이름 변경" }).dblclick();
  await page.getByLabel("프리셋 제목 변경").fill("RENAMED_PRESET");
  await page.getByLabel("프리셋 제목 변경").press("Enter");

  await expect(page.locator(".article-editor")).toContainText("CURRENT_DRAFT");
  expect(await page.evaluate((key) => localStorage.getItem(key), historyKey)).toBe(historyBefore);
  await expect(page.getByRole("button", { name: "RENAMED_PRESET 이름 변경" })).toBeVisible();
});

test("ignores Enter and Escape while an input is composing", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForEditor(page);
  await page.getByRole("button", { name: "저장함" }).click();
  const name = page.getByLabel("프리셋 이름");
  await name.fill("조합 중 이름");
  await name.dispatchEvent("keydown", { key: "Enter", isComposing: true, bubbles: true });
  await expect(page.getByLabel("저장된 프리셋").getByRole("button")).toHaveCount(0);
  await name.dispatchEvent("keydown", { key: "Escape", isComposing: true, bubbles: true });
  await expect(page.getByLabel("프리셋 이름")).toBeVisible();

  await name.press("Enter");
  await expect(page.getByRole("button", { name: "조합 중 이름 이름 변경" })).toBeVisible();
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

test("selects model suggestions with the keyboard without losing focus", async ({ page }) => {
  await page.route("**/api/v1/models**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          { id: "test/alpha", name: "Alpha", architecture: { input_modalities: ["text"] } },
          { id: "test/beta", name: "Beta", architecture: { input_modalities: ["text"] } },
        ],
      }),
    }),
  );

  await page.goto("/");
  await waitForEditor(page);
  await page.getByRole("button", { name: "AI 작성" }).click();
  const modelInput = page.getByRole("combobox", { name: "모델" });
  await modelInput.fill("test/");
  const options = page.getByRole("listbox", { name: "모델 추천" }).getByRole("option");
  await expect(options).toHaveCount(2);
  await modelInput.press("ArrowDown");
  await expect(options.nth(0)).toHaveAttribute("aria-selected", "true");
  await expect(modelInput).toHaveAttribute("aria-activedescendant", "llm-model-option-0");
  await modelInput.press("ArrowDown");
  await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
  await modelInput.dispatchEvent("keydown", { key: "Enter", isComposing: true, bubbles: true });
  await expect(modelInput).toHaveValue("test/");
  await modelInput.press("Enter");
  await expect(modelInput).toHaveValue("test/beta");
  await expect(modelInput).toBeFocused();
  await expect(modelInput).toHaveAttribute("aria-expanded", "false");

  await modelInput.fill("test/");
  await expect(options).toHaveCount(2);
  await modelInput.press("Escape");
  await expect(modelInput).toHaveValue("test/");
  await expect(modelInput).toBeFocused();
  await expect(modelInput).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("button", { name: "AI 작성 닫기" })).toBeVisible();
});

test("keeps one LLM request in flight when its inputs change", async ({ page }) => {
  let releaseResponse!: () => void;
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  let requestCount = 0;

  await page.route("**/api/v1/models**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: '{"data":[]}' }),
  );
  await page.route("https://openrouter.ai/api/v1/chat/completions", async (route) => {
    requestCount += 1;
    await responseGate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"choices":[{"message":{"content":"# OBSOLETE_RESPONSE"}}]}',
    });
  });

  await page.goto("/");
  await waitForEditor(page);
  await page.getByRole("button", { name: "AI 작성" }).click();
  await page.getByLabel("API 키").fill("sk-or-v1-test");
  await page.getByRole("combobox", { name: "모델" }).fill("test/old-model");
  await page.getByRole("textbox", { name: "요청" }).fill("첫 요청");
  const generate = page.getByRole("button", { name: "AI 글 생성하기" });
  await generate.click();
  await expect.poll(() => requestCount).toBe(1);

  await page.getByLabel("API 키").fill("sk-or-v1-next");
  await page.getByRole("combobox", { name: "모델" }).fill("test/new-model");
  await page.getByRole("textbox", { name: "요청" }).fill("새 요청");
  await expect(generate).toBeDisabled();
  await expect(page.getByText("이전 요청 응답 대기")).toBeVisible();
  expect(requestCount).toBe(1);

  releaseResponse();
  await expect(generate).toBeEnabled();
  await expect(page.getByLabel("Markdown 원문")).not.toBeVisible();
  expect(requestCount).toBe(1);
});
