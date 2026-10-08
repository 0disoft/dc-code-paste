import { expect, test } from "@playwright/test";

for (const mobile of [false, true]) {
  for (const close of ["button", "escape"] as const) {
    test(`cancels a pending file import with ${close} on ${mobile ? "mobile" : "desktop"}`, async ({
      page,
    }) => {
      if (mobile) await page.setViewportSize({ width: 390, height: 844 });
      await page.addInitScript(() => {
        const read = File.prototype.text;
        File.prototype.text = async function () {
          const text = await read.call(this);
          if (this.name === "slow-draft.json") {
            await new Promise<void>((resolve) => {
              window.addEventListener("finish-draft-read", () => resolve(), { once: true });
              document.documentElement.dataset.draftReadWaiting = "true";
            });
          }
          return text;
        };
      });
      await page.goto("./");
      const editor = page.locator(".article-editor");
      await expect(editor).toContainText("DC-CODE-PASTE");
      await expect
        .poll(() => page.evaluate(() => localStorage.getItem("dc-code-paste:draft:v1")))
        .not.toBeNull();
      const snapshot = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("dc-code-paste:draft:v1")!),
      );
      snapshot.document = {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "CANCELLED_FILE_CONTENT" }] },
        ],
      };
      const original = await editor.textContent();
      let confirmations = 0;
      page.on("dialog", async (dialog) => {
        confirmations += 1;
        await dialog.accept();
      });
      await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
      await page.getByRole("menuitem", { name: "저장함", exact: true }).click();
      await page.getByLabel("초안 JSON 파일", { exact: true }).setInputFiles({
        name: "slow-draft.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(snapshot)),
      });
      await expect(
        page.getByRole("button", { name: "초안 파일 불러오기", exact: true }),
      ).toBeDisabled();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.dataset.draftReadWaiting))
        .toBe("true");
      if (close === "button") await page.getByRole("button", { name: "닫기", exact: true }).click();
      else await page.keyboard.press("Escape");
      await expect(page.locator("#storage-panel")).toHaveCount(0);
      await page.evaluate(async () => {
        window.dispatchEvent(new Event("finish-draft-read"));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      });
      expect(confirmations).toBe(0);
      expect(await editor.textContent()).toBe(original);
      await expect(editor).not.toContainText("CANCELLED_FILE_CONTENT");
      await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
      await page.getByRole("menuitem", { name: "저장함", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "초안 파일 불러오기", exact: true }),
      ).toBeEnabled();
      await expect(page.locator("#storage-panel").getByRole("alert")).toHaveCount(0);
      snapshot.document.content[0].content[0].text = "NEW_FILE_CONTENT";
      await page.getByLabel("초안 JSON 파일", { exact: true }).setInputFiles({
        name: "new-draft.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(snapshot)),
      });
      await expect(editor).toHaveText("NEW_FILE_CONTENT");
      await expect(editor).toBeFocused();
      expect(confirmations).toBe(1);
    });
  }
}
