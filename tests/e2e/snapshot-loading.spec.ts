import { expect, test } from "@playwright/test";

for (const kind of ["preset", "history"] as const) {
  for (const mobile of [false, true]) {
    test(`rejects a ${kind} with invalid document nesting on ${mobile ? "mobile" : "desktop"}`, async ({
      page,
    }) => {
      if (mobile) await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("./");
      const editor = page.locator(".article-editor");
      await expect(editor).toContainText("DC-CODE-PASTE");
      await expect
        .poll(() => page.evaluate(() => localStorage.getItem("dc-code-paste:draft:v1")))
        .not.toBeNull();
      await page.evaluate((kind) => {
        const saved = JSON.parse(localStorage.getItem("dc-code-paste:draft:v1")!);
        const snapshot = {
          ...saved,
          version: kind === "preset" ? 1 : 2,
          id: "unreadable-snapshot",
          name: "읽을 수 없는 글",
          createdAt: saved.updatedAt,
          document: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "heading",
                    attrs: { level: 1 },
                    content: [{ type: "text", text: "INVALID_NESTING" }],
                  },
                ],
              },
            ],
          },
        };
        const valid = {
          ...snapshot,
          id: "valid-snapshot",
          name: "정상 글",
          document: {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: "VALID_SNAPSHOT" }] }],
          },
          preferences: {
            ...saved.preferences,
            bodyFontFamily: "Georgia",
            documentTheme: "darkEditorial",
          },
        };
        if (kind === "preset")
          localStorage.setItem(
            "dc-code-paste:presets:v1",
            JSON.stringify({ version: 1, presets: [snapshot, valid] }),
          );
        else
          localStorage.setItem("dc-code-paste:draft-history:v1", JSON.stringify([snapshot, valid]));
      }, kind);
      await page.reload();
      await expect(editor).toContainText("DC-CODE-PASTE");
      await expect(page.locator(".topbar-status")).toContainText("저장됨");
      const original = await editor.textContent();
      const saved = await page.evaluate(() => localStorage.getItem("dc-code-paste:draft:v1"));
      const history = await page.evaluate(() =>
        localStorage.getItem("dc-code-paste:draft-history:v1"),
      );
      await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
      await page.getByRole("menuitem", { name: "저장함", exact: true }).click();
      await page
        .locator(kind === "preset" ? ".preset-item" : ".draft-history-item")
        .first()
        .getByRole("button")
        .first()
        .click();
      await expect(page.locator("#storage-panel").getByRole("alert")).toContainText(
        "문서 구조를 읽을 수 없습니다",
      );
      expect(await editor.textContent()).toBe(original);
      await expect(editor).not.toContainText("INVALID_NESTING");
      expect(await page.evaluate(() => localStorage.getItem("dc-code-paste:draft:v1"))).toBe(saved);
      expect(
        await page.evaluate(() => localStorage.getItem("dc-code-paste:draft-history:v1")),
      ).toBe(history);
      await page
        .locator(kind === "preset" ? ".preset-item" : ".draft-history-item")
        .filter({ hasText: "정상 글" })
        .getByRole("button")
        .first()
        .click();
      await expect(editor).toHaveText("VALID_SNAPSHOT");
      await expect(editor).toBeFocused();
      await expect(editor).toHaveCSS("font-family", /Georgia/);
      await expect(page.locator(".editor-surface")).toHaveClass(/editor-surface-dark/);
      await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
      await page.getByRole("menuitem", { name: "저장함", exact: true }).click();
      await expect(page.locator("#storage-panel").getByRole("alert")).toHaveCount(0);
    });
  }
}
