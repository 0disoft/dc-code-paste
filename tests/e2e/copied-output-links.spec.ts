import { expect, test, type Page } from "@playwright/test";

type CopyWindow = typeof window & { publicCopy?: Record<string, string> };
async function openTool(page: Page, name: string) {
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}

for (const mobile of [false, true]) {
  test(`preserves public links in copied and replayed text on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1400, height: 900 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: {
          write: async (items: ClipboardItem[]) => {
            (window as CopyWindow).publicCopy = {
              "text/html": await (await items[0].getType("text/html")).text(),
              "text/plain": await (await items[0].getType("text/plain")).text(),
            };
          },
        },
      });
    });
    await page.goto("./");
    const editor = page.locator(".article-editor");
    await expect(editor).toBeVisible();
    await openTool(page, "Markdown");
    const code = "\tconst answer = 1;\n  console.log(answer);";
    await page
      .getByLabel("Markdown 원문")
      .fill(
        [
          "공개 주장",
          "",
          ":::references",
          "[공식 참고 자료](https://example.com/reference)",
          ":::",
          "",
          ":::cta",
          "[가입하기](https://example.com/join)",
          ":::",
          "",
          "[일반 링크](https://example.com/inline)",
          "",
          "```js",
          code,
          "```",
        ].join("\n"),
      );
    await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
    await editor.locator(":scope > p").first().click();
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");
    await page
      .getByRole("toolbar", { name: "선택한 글자 도구", exact: true })
      .getByRole("button", { name: "문장 출처 연결", exact: true })
      .click();
    const form = page.getByRole("region", { name: "문장 출처", exact: true });
    await form.getByLabel("자료 주소", { exact: true }).fill("https://example.com/evidence");
    await form.getByLabel("자료 이름", { exact: false }).fill("공식 근거");
    await form.getByRole("button", { name: "출처 연결", exact: true }).click();
    if (mobile) await page.keyboard.press("Escape");
    await openTool(page, "Markdown");
    await page.getByLabel("Markdown 원문").fill("# PRIVATE_PENDING_WORK");
    await page.getByRole("button", { name: "Markdown 닫기", exact: true }).click();
    await page.locator('[data-copy-trigger="preview"]').click();
    await expect.poll(() => page.evaluate(() => (window as CopyWindow).publicCopy)).toBeTruthy();
    const payload = await page.evaluate(() => (window as CopyWindow).publicCopy!);
    for (const output of [payload["text/html"], payload["text/plain"]]) {
      for (const path of ["evidence", "reference", "join", "inline"])
        expect(output).toContain(`https://example.com/${path}`);
      expect(output).not.toContain("PRIVATE_PENDING_WORK");
    }
    expect(payload["text/plain"]).toContain("[출처: 공식 근거 (https://example.com/evidence)]");
    expect(payload["text/plain"]).toContain("공식 참고 자료 (https://example.com/reference)");
    expect(payload["text/plain"]).toContain("가입하기 (https://example.com/join)");
    expect(payload["text/plain"]).toContain(code);
    const output = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("dc-code-paste:last-copied-output:v1")!),
    );
    expect(output.plainText).toBe(payload["text/plain"]);
    await expect(page.locator(".topbar-status")).toContainText("저장됨");
    await page.reload();
    await expect(editor).toBeVisible();
    await openTool(page, "Markdown");
    await page.getByLabel("Markdown 원문").fill("# 복사 후 바뀐 글");
    await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
    await openTool(page, "마지막 복사 결과");
    const dialog = page.getByRole("dialog", { name: "마지막 복사 결과", exact: true });
    await dialog.getByRole("button", { name: "같은 결과 다시 복사", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "다시 복사됨", exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as CopyWindow).publicCopy)).toEqual(payload);
    await expect(editor).toContainText("복사 후 바뀐 글");
  });
}
