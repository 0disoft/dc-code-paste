import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const draftKey = "dc-code-paste:draft:v1";
const invalidRaw = "{broken draft kept for download\n";
type RecoveryWindow = typeof window & { blockDraftRemoval?: boolean };

async function openInvalidDraft(page: Page) {
  await page.addInitScript(
    ({ draftKey, invalidRaw }) => {
      const setItem = Storage.prototype.setItem;
      const removeItem = Storage.prototype.removeItem;
      if (!localStorage.getItem(draftKey)) setItem.call(localStorage, draftKey, invalidRaw);
      Storage.prototype.setItem = function (key, value) {
        if (key.startsWith("dc-code-paste:draft-invalid-backup:v1")) {
          throw new DOMException("Backup storage blocked", "QuotaExceededError");
        }
        setItem.call(this, key, value);
      };
      Storage.prototype.removeItem = function (key) {
        if (key === draftKey && (window as RecoveryWindow).blockDraftRemoval) {
          throw new DOMException("Draft removal blocked", "SecurityError");
        }
        removeItem.call(this, key);
      };
    },
    { draftKey, invalidRaw },
  );
  await page.goto("./");
  await expect(page.getByRole("group", { name: "글쓰기 편집기", exact: true })).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.getByRole("button", { name: "새 초안 저장 시작", exact: true })).toBeDisabled();
  expect(await page.evaluate((key) => localStorage.getItem(key), draftKey)).toBe(invalidRaw);
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "원본 내려받기", exact: true }).click();
  const download = await downloaded;
  expect(await readFile((await download.path())!, "utf8")).toBe(invalidRaw);
  await expect(page.getByRole("button", { name: "새 초안 저장 시작", exact: true })).toBeEnabled();
}

test("resumes saving without a false tab conflict after downloading an invalid draft", async ({
  page,
}) => {
  await openInvalidDraft(page);
  const original = await page.locator(".article-editor").textContent();
  await page.getByRole("button", { name: "새 초안 저장 시작", exact: true }).click();
  await expect(page.locator(".topbar-status")).toContainText("저장됨");
  await expect(page.getByRole("button", { name: "새 초안 저장 시작", exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "다른 탭 초안 불러오기", exact: true }),
  ).toHaveCount(0);
  const saved = await page.evaluate((key) => localStorage.getItem(key), draftKey);
  expect(saved).not.toBe(invalidRaw);
  expect(JSON.parse(saved!).document.type).toBe("doc");
  await page.reload();
  await expect(page.locator(".article-editor")).toBeVisible();
  expect(await page.locator(".article-editor").textContent()).toBe(original);
  await expect(page.locator(".topbar-status")).toContainText("저장됨");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("keeps the invalid original and warning when removal fails and permits a later retry", async ({
  page,
}) => {
  await openInvalidDraft(page);
  await page.evaluate(() => {
    (window as RecoveryWindow).blockDraftRemoval = true;
  });
  await page.getByRole("button", { name: "새 초안 저장 시작", exact: true }).click();
  expect(await page.evaluate((key) => localStorage.getItem(key), draftKey)).toBe(invalidRaw);
  await expect(page.getByRole("button", { name: "새 초안 저장 시작", exact: true })).toBeEnabled();
  await page.evaluate(() => {
    (window as RecoveryWindow).blockDraftRemoval = false;
  });
  await page.getByRole("button", { name: "새 초안 저장 시작", exact: true }).click();
  await expect(page.locator(".topbar-status")).toContainText("저장됨");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("does not delete another tab's newer draft when resuming from an invalid original", async ({
  page,
}) => {
  await openInvalidDraft(page);
  const remote = JSON.stringify({
    version: 2,
    updatedAt: new Date().toISOString(),
    document: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "다른 탭의 최신 초안" }] }],
    },
    preferences: {
      language: "cpp",
      theme: "github-light",
      bodyFontFamily: "sans-serif",
      bodyFontSize: "18px",
      selectionFontFamily: "sans-serif",
      selectionFontSize: "18px",
      codeFontSize: "15px",
      showLineNumbers: false,
      documentTheme: "cleanEditorial",
      structure: "dcTable",
    },
  });
  // Autosave is still disabled, so the resume path must compare the key before removing it.
  await page.evaluate(({ draftKey, remote }) => localStorage.setItem(draftKey, remote), {
    draftKey,
    remote,
  });
  await page.getByRole("button", { name: "새 초안 저장 시작", exact: true }).click();
  await expect(page.locator(".topbar-status")).toContainText("저장 충돌");
  expect(await page.evaluate((key) => localStorage.getItem(key), draftKey)).toBe(remote);
  await page.getByRole("button", { name: "다른 탭 초안 불러오기", exact: true }).click();
  await expect(page.locator(".article-editor")).toContainText("다른 탭의 최신 초안");
  await expect(page.locator(".topbar-status")).toContainText("저장됨");
});
