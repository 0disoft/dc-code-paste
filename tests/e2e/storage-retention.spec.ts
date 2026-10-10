import { expect, test, type Page } from "@playwright/test";

async function openTool(page: Page, name: string) {
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}

test("keeps all presets when full and allows a new save only after explicit deletion", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.locator(".article-editor")).toBeVisible();
  await expect(page.locator(".topbar-status")).toContainText("저장됨");
  await page.evaluate(() => {
    const snapshot = JSON.parse(localStorage.getItem("dc-code-paste:draft:v1")!);
    localStorage.setItem(
      "dc-code-paste:presets:v1",
      JSON.stringify({
        version: 1,
        presets: Array.from({ length: 30 }, (_, index) => ({
          version: 1,
          id: `preset-${index}`,
          name: `보관 프리셋 ${index}`,
          createdAt: snapshot.updatedAt,
          updatedAt: snapshot.updatedAt,
          document: snapshot.document,
          preferences: snapshot.preferences,
        })),
      }),
    );
  });
  await page.reload();
  await expect(page.locator(".article-editor")).toBeVisible();
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "저장함", exact: true }).click();
  const raw = await page.evaluate(() => localStorage.getItem("dc-code-paste:presets:v1"));
  await page.getByLabel("프리셋 이름", { exact: true }).fill("새로 보관할 글");
  await page.getByRole("button", { name: "프리셋 저장", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("기존 프리셋을 삭제한 뒤 저장해 주세요");
  await expect(page.getByLabel("프리셋 이름", { exact: true })).toHaveValue("새로 보관할 글");
  expect(await page.evaluate(() => localStorage.getItem("dc-code-paste:presets:v1"))).toBe(raw);
  await page.getByRole("button", { name: "보관 프리셋 29 삭제", exact: true }).click();
  await page.getByRole("button", { name: "프리셋 저장", exact: true }).click();
  await expect(page.locator(".preset-item")).toHaveCount(30);
  await expect(page.locator(".preset-apply").filter({ hasText: "보관 프리셋 0" })).toHaveCount(1);
  await expect(page.locator(".preset-apply").filter({ hasText: "새로 보관할 글" })).toHaveCount(1);
});

for (const mobile of [false, true]) {
  test(`protects manual and legacy drafts through automatic rotation on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1400, height: 900 });
    await page.addInitScript(() => {
      const now = Date.now.bind(Date);
      let offset = 0;
      Date.now = () => now() + offset;
      window.addEventListener("advance-retention-clock", () => {
        offset += 31_000;
      });
    });
    await page.goto("./");
    await expect(page.locator(".article-editor")).toBeVisible();
    await openTool(page, "Markdown");
    await page.getByLabel("Markdown 원문").fill("# PRIVATE_MANUAL_WORKING_TEXT");
    await expect
      .poll(() =>
        page.evaluate(
          () => JSON.parse(localStorage.getItem("dc-code-paste:draft:v1") ?? "null")?.markdownDraft,
        ),
      )
      .toBe("# PRIVATE_MANUAL_WORKING_TEXT");
    await openTool(page, "저장함");
    await page.getByRole("button", { name: "초안 스냅샷 저장", exact: true }).click();
    await expect(page.locator('.draft-history-item[data-retention="manual"]')).toHaveCount(1);
    await page.evaluate(() => {
      const history = JSON.parse(localStorage.getItem("dc-code-paste:draft-history:v1")!);
      const { kind: _kind, ...original } = history[0];
      localStorage.setItem(
        "dc-code-paste:draft-history:v1",
        JSON.stringify([
          { ...original, id: "legacy-unnamed" },
          { ...original, id: "named-recovery", kind: "automatic", name: "이름 붙인 최종본" },
          ...history,
        ]),
      );
    });
    await page.reload();
    await expect(page.locator(".article-editor")).toBeVisible();
    await openTool(page, "Markdown");
    for (let index = 0; index < 12; index++) {
      await page.evaluate(() => window.dispatchEvent(new Event("advance-retention-clock")));
      await page.getByLabel("Markdown 원문").fill(`# AUTOMATIC_WORKING_TEXT_${index}`);
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              JSON.parse(localStorage.getItem("dc-code-paste:draft:v1") ?? "null")?.markdownDraft,
          ),
        )
        .toBe(`# AUTOMATIC_WORKING_TEXT_${index}`);
    }
    await openTool(page, "저장함");
    await expect(page.locator('.draft-history-item[data-retention="manual"]')).toHaveCount(3);
    await expect(page.locator('.draft-history-item[data-retention="automatic"]')).toHaveCount(10);
    await expect(
      page.getByRole("button", { name: "이름 붙인 최종본 삭제", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => localStorage.getItem("dc-code-paste:draft-history:v1")),
    ).toContain("legacy-unnamed");
    await page
      .locator('.draft-history-item[data-retention="manual"]')
      .last()
      .locator(".draft-history-apply")
      .click();
    await openTool(page, "Markdown");
    await expect(page.getByLabel("Markdown 원문")).toHaveValue("# PRIVATE_MANUAL_WORKING_TEXT");
    expect(await page.locator(".article-editor").textContent()).not.toContain(
      "PRIVATE_MANUAL_WORKING_TEXT",
    );
  });
}

test("keeps full manual history intact and refuses naming another automatic record until deletion", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.locator(".topbar-status")).toContainText("저장됨");
  await page.evaluate(() => {
    const snapshot = JSON.parse(localStorage.getItem("dc-code-paste:draft:v1")!);
    const manual = Array.from({ length: 30 }, (_, index) => ({
      ...snapshot,
      id: `manual-${index}`,
      kind: "manual",
      name: `보관 초안 ${index}`,
      createdAt: snapshot.updatedAt,
    }));
    localStorage.setItem(
      "dc-code-paste:draft-history:v1",
      JSON.stringify([
        { ...snapshot, id: "automatic-one", kind: "automatic", createdAt: snapshot.updatedAt },
        ...manual,
      ]),
    );
  });
  await page.reload();
  await expect(page.locator(".article-editor")).toBeVisible();
  await openTool(page, "저장함");
  const raw = await page.evaluate(() => localStorage.getItem("dc-code-paste:draft-history:v1"));
  await page.getByRole("button", { name: "초안 스냅샷 저장", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("기존 보관본을 삭제한 뒤 저장해 주세요");
  expect(await page.evaluate(() => localStorage.getItem("dc-code-paste:draft-history:v1"))).toBe(
    raw,
  );
  await page
    .locator('.draft-history-item[data-retention="automatic"]')
    .locator(".item-rename")
    .click();
  const rename = page.getByLabel("초안 제목 변경", { exact: true });
  await rename.fill("계속 보관할 자동 기록");
  await rename.press("Enter");
  await expect(rename).toHaveValue("계속 보관할 자동 기록");
  expect(await page.evaluate(() => localStorage.getItem("dc-code-paste:draft-history:v1"))).toBe(
    raw,
  );
  await rename.press("Escape");
  await page.getByRole("button", { name: "보관 초안 0 삭제", exact: true }).click();
  await page.getByRole("button", { name: "초안 스냅샷 저장", exact: true }).click();
  await expect(page.locator('.draft-history-item[data-retention="manual"]')).toHaveCount(30);
  await expect(page.getByRole("button", { name: "보관 초안 29 삭제", exact: true })).toBeVisible();
  await expect(page.locator('.draft-history-item[data-retention="automatic"]')).toHaveCount(1);
});
