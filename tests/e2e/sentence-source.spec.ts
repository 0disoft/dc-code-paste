import { expect, test } from "@playwright/test";

type CapturedClipboard = typeof window & { copiedHtml: string };
for (const mobile of [false, true]) {
  test(`connects, edits and removes a sentence source without replacing its text or links on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1487, height: 900 });
    await page.addInitScript(() => {
      (window as CapturedClipboard).copiedHtml = "";
      Object.defineProperty(navigator, "clipboard", {
        value: {
          write: async (items: ClipboardItem[]) => {
            (window as CapturedClipboard).copiedHtml = await (
              await items[0].getType("text/html")
            ).text();
          },
        },
      });
    });
    await page.goto("./");
    const editor = page.locator(".article-editor");
    await expect(editor).toContainText("DC-CODE-PASTE");
    await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
    await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
    await page
      .getByLabel("Markdown 원문")
      .fill(
        "# 출처를 가까이\n\n**기억할 핵심** [문장의 기존 링크](https://example.com/original)\n\n내용을 설명하는 문장",
      );
    await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
    const original = await editor.textContent();
    if (mobile) await page.getByRole("button", { name: "블록 설정 패널", exact: true }).click();
    await page.getByRole("tab", { name: "전체 글", exact: true }).click();
    if (mobile) await page.keyboard.press("Escape");
    const sentence = editor.locator("p").first();
    await sentence.click();
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");
    await page
      .getByRole("toolbar", { name: "선택 문장 읽는 의도", exact: true })
      .getByRole("button", { name: "문장 출처 연결", exact: true })
      .click();
    const form = page.getByRole("region", { name: "문장 출처", exact: true });
    const href = form.getByLabel("자료 주소", { exact: true });
    await expect(href).toBeFocused();
    await expect(form.getByLabel("출처를 연결할 문장", { exact: true })).toHaveText(
      "기억할 핵심 문장의 기존 링크",
    );
    await href.fill("javascript:alert(1)");
    await form.getByRole("button", { name: "출처 연결", exact: true }).click();
    await expect(form.getByRole("alert")).toContainText("http 또는 https");
    await expect(sentence.locator("[data-source-href]")).toHaveCount(0);
    await href.fill("example.com/evidence");
    await form.getByLabel("자료 이름", { exact: false }).fill("실험 기록");
    const excerpt = "측정한 근거 원문\n둘째 줄";
    await form.getByLabel("근거 원문", { exact: false }).fill(excerpt);
    await page.screenshot({
      path: testInfo.outputPath(`sentence-source-${mobile ? "mobile" : "desktop"}.png`),
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await form.getByRole("button", { name: "출처 연결", exact: true }).click();
    await expect(sentence.locator("[data-source-href]").first()).toHaveAttribute(
      "data-source-href",
      "https://example.com/evidence",
    );
    await expect(sentence.locator("[data-source-href]").first()).toHaveAttribute(
      "data-source-excerpt",
      excerpt,
    );
    expect(await editor.textContent()).toBe(original);
    await expect(sentence.locator("strong")).toHaveText("기억할 핵심");
    await expect(sentence.locator("a")).toHaveAttribute("href", "https://example.com/original");
    await page.getByRole("button", { name: "실행 취소", exact: true }).click();
    await expect(sentence.locator("[data-source-href]")).toHaveCount(0);
    await page.getByRole("button", { name: "다시 실행", exact: true }).click();
    await expect(sentence.locator("[data-source-href]").first()).toHaveAttribute(
      "data-source-label",
      "실험 기록",
    );
    await page.getByRole("button", { name: "미리보기", exact: true }).click();
    const preview = page.locator(".preview-surface");
    await expect(preview.getByRole("link", { name: "[출처: 실험 기록]", exact: true })).toHaveCount(
      1,
    );
    await expect(preview.locator("a a")).toHaveCount(0);
    await expect(
      preview.getByRole("link", { name: "문장의 기존 링크", exact: true }),
    ).toHaveAttribute("href", "https://example.com/original");
    await page.getByRole("button", { name: "디씨 복사", exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => (window as CapturedClipboard).copiedHtml))
      .toContain("[출처: 실험 기록]");
    const copied = await page.evaluate(() => (window as CapturedClipboard).copiedHtml);
    expect(copied.match(/\[출처: 실험 기록\]/g)).toHaveLength(1);
    expect(copied).toContain('href="https://example.com/original"');
    await expect(page.locator(".topbar-status")).toContainText("저장됨");
    await page.reload();
    await expect(sentence.locator("[data-source-href]").first()).toHaveAttribute(
      "data-source-excerpt",
      excerpt,
    );
    expect(await editor.textContent()).toBe(original);
    await sentence.locator("strong").click();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowRight");
    if (mobile) await page.getByRole("button", { name: "블록 설정 패널", exact: true }).click();
    await expect(href).toHaveValue("https://example.com/evidence");
    await expect(form.getByLabel("근거 원문", { exact: false })).toHaveValue(excerpt);
    await form.getByLabel("자료 이름", { exact: false }).fill("수정한 기록");
    await form.getByRole("button", { name: "출처 수정", exact: true }).click();
    await expect(sentence.locator("[data-source-href]").first()).toHaveAttribute(
      "data-source-label",
      "수정한 기록",
    );
    expect(await editor.textContent()).toBe(original);
    if (mobile) await page.getByRole("button", { name: "블록 설정 패널", exact: true }).click();
    await form.getByRole("button", { name: "출처 해제", exact: true }).click();
    await expect(sentence.locator("[data-source-href]")).toHaveCount(0);
    await expect(sentence.locator("a")).toHaveAttribute("href", "https://example.com/original");
    expect(await editor.textContent()).toBe(original);
  });
}
