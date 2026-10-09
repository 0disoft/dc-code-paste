import { expect, test } from "@playwright/test";

for (const mobile of [false, true]) {
  test(`reuses document sources without copying other excerpts and navigates their passages on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1487, height: 900 });
    await page.goto("./");
    const editor = page.locator(".article-editor");
    await expect(editor).toContainText("DC-CODE-PASTE");
    await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
    await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
    await page
      .getByLabel("Markdown 원문")
      .fill(
        "# 문장과 자료\n\n**첫 문장의 주장**을 설명합니다.\n\n둘째 문장에 다른 근거를 붙입니다.\n\n:::references\n- [공식 자료](https://example.com/evidence)\n- [다른 자료](https://example.com/other)\n:::",
      );
    await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
    const original = await editor.textContent();
    const paragraphs = editor.locator(":scope > p");
    const form = page.getByRole("region", { name: "문장 출처", exact: true });
    const picker = form.getByLabel("이 글의 자료에서 선택", { exact: true });
    const excerpt = form.getByLabel("근거 원문", { exact: false });
    const evidenceHref = "https://example.com/evidence";
    async function selectSentence(index: number) {
      await paragraphs.nth(index).click();
      await page.keyboard.press("Home");
      await page.keyboard.press("Shift+End");
      if (index === 0) {
        await expect(
          page.getByRole("toolbar", { name: "선택 문장 읽는 의도", exact: true }),
        ).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(
          page.getByRole("toolbar", { name: "선택 문장 읽는 의도", exact: true }),
        ).toHaveCount(0);
        await page.keyboard.press("Home");
        await page.keyboard.press("Shift+End");
      }
      await page
        .getByRole("toolbar", { name: "선택 문장 읽는 의도", exact: true })
        .getByRole("button", { name: "문장 출처 연결", exact: true })
        .click();
    }
    async function showCatalog() {
      if (mobile) await page.getByRole("button", { name: "블록 설정 패널", exact: true }).click();
      await page.getByRole("tab", { name: "전체 글", exact: true }).click();
    }
    await selectSentence(0);
    await picker.selectOption(evidenceHref);
    await expect(form.getByLabel("자료 주소", { exact: true })).toHaveValue(evidenceHref);
    await expect(form.getByLabel("자료 이름", { exact: false })).toHaveValue("공식 자료");
    await expect(excerpt).toHaveValue("");
    await excerpt.fill("첫 문장의 원문");
    await form.getByRole("button", { name: "출처 연결", exact: true }).click();
    await selectSentence(1);
    await picker.selectOption(evidenceHref);
    await expect(excerpt).toHaveValue("");
    await excerpt.fill("입력 중인 근거");
    await picker.selectOption("https://example.com/other");
    await expect(excerpt).toHaveValue("");
    await expect(form.getByLabel("자료 이름", { exact: false })).toHaveValue("다른 자료");
    await picker.selectOption(evidenceHref);
    await excerpt.fill("둘째 문장의 원문");
    await form.getByRole("button", { name: "출처 연결", exact: true }).click();
    await expect(paragraphs.nth(0).locator("[data-source-href]").first()).toHaveAttribute(
      "data-source-excerpt",
      "첫 문장의 원문",
    );
    expect(await editor.textContent()).toBe(original);
    await showCatalog();
    const catalog = page.getByRole("region", { name: "이 글의 자료", exact: true });
    await expect(catalog.locator(".source-card")).toHaveCount(2);
    const evidence = catalog.getByRole("link", { name: "공식 자료", exact: true }).locator("..");
    await expect(evidence).toContainText("연결 2곳 · 참고 자료 1개");
    await evidence.getByText("연결한 문장 보기", { exact: true }).click();
    await expect(evidence).toContainText("첫 문장의 원문");
    await expect(evidence).toContainText("둘째 문장의 원문");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: testInfo.outputPath(`document-sources-${mobile ? "mobile" : "desktop"}.png`),
    });
    await evidence
      .getByRole("button", {
        name: "연결 2로 이동: 둘째 문장에 다른 근거를 붙입니다.",
        exact: true,
      })
      .click();
    await expect
      .poll(() => page.evaluate(() => getSelection()?.toString()))
      .toBe("둘째 문장에 다른 근거를 붙입니다.");
    await page
      .getByRole("toolbar", { name: "선택 문장 읽는 의도", exact: true })
      .getByRole("button", { name: "문장 출처 연결", exact: true })
      .click();
    await expect(excerpt).toHaveValue("둘째 문장의 원문");
    await picker.selectOption(evidenceHref);
    await expect(excerpt).toHaveValue("둘째 문장의 원문");
    await form.getByRole("button", { name: "출처 해제", exact: true }).click();
    await showCatalog();
    await expect(evidence).toContainText("연결 1곳 · 참고 자료 1개");
    if (mobile) await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "실행 취소", exact: true }).click();
    if (mobile) await showCatalog();
    await expect(evidence).toContainText("연결 2곳 · 참고 자료 1개");
    await expect(page.locator(".topbar-status")).toContainText("저장됨");
    await page.reload();
    await expect(editor).toContainText("첫 문장의 주장");
    await showCatalog();
    await expect(evidence).toContainText("연결 2곳 · 참고 자료 1개");
    await expect(catalog.locator(".source-card")).toHaveCount(2);
    expect(await editor.textContent()).toBe(original);
  });
}
