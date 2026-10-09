import { expect, test, type Page } from "@playwright/test";

async function selectParagraph(page: Page, index: number) {
  await page.locator(".article-editor > p").nth(index).click();
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+End");
  await expect(page.getByRole("toolbar", { name: "선택한 글자 도구", exact: true })).toBeVisible();
}

for (const mobile of [false, true]) {
  test(`checks connections at the reading boundary without revealing future prose on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(mobile ? { width: 320, height: 844 } : { width: 1280, height: 900 });
    await page.goto("./");
    const editor = page.locator(".article-editor");
    await expect(editor).toContainText("DC-CODE-PASTE");
    await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
    await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
    await page
      .getByLabel("Markdown 원문")
      .fill(
        "# 읽는 순서\n\n**먼저 등장한 주장**\n\n이어지는 설명\n\n숨겨 놓은 근거\n\n마지막 문장",
      );
    await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
    await selectParagraph(page, 0);
    await page
      .getByRole("toolbar", { name: "선택한 글자 도구", exact: true })
      .getByRole("button", { name: "문장 관계 연결", exact: true })
      .click();
    await page.getByLabel("연결할 관계", { exact: true }).selectOption("evidence");
    await page.getByRole("button", { name: "연결 시작", exact: true }).click();
    const pending = page.getByRole("region", { name: "문장 관계 연결 중", exact: true });
    await expect(pending).toBeVisible();
    await selectParagraph(page, 2);
    await pending.getByRole("button", { name: "선택한 구간 연결", exact: true }).click();
    await expect(pending).toHaveCount(0);
    await expect(page.locator(".topbar-status")).toContainText("저장됨");
    await page.reload();
    await expect(editor).toContainText("먼저 등장한 주장");
    const original = await editor.textContent();
    await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
    await page.getByRole("menuitem", { name: "처음부터 읽어보기", exact: true }).click();
    const reader = page.getByRole("region", { name: "처음부터 읽어보기", exact: true });
    await expect(reader).toBeFocused();
    const frontierToggle = reader.getByRole("button", { name: "여기까지 나온 연결", exact: true });
    await expect(frontierToggle).toHaveCount(0);
    await reader.getByRole("button", { name: "차례로 펼치기", exact: true }).click();
    await frontierToggle.click();
    const frontier = reader.getByRole("region", { name: "여기까지 나온 연결", exact: true });
    await expect(frontier).toBeFocused();
    await expect(frontier).toContainText("여기까지 펼친 문장에 연결이 없습니다.");
    await expect(reader).not.toContainText("숨겨 놓은 근거");
    const next = reader.getByRole("button", { name: "다음 구간 펼치기", exact: true });
    await next.click();
    await expect(frontier.locator(".frontier-entry")).toHaveCount(1);
    await expect(frontier).toContainText("먼저 등장한 주장");
    await expect(frontier).toContainText("2구간 뒤에 연결 구간이 있습니다.");
    await expect(reader).not.toContainText("숨겨 놓은 근거");
    await next.click();
    await expect(frontier).toContainText("1구간 뒤에 연결 구간이 있습니다.");
    await expect(reader).not.toContainText("숨겨 놓은 근거");
    await frontier.scrollIntoViewIfNeeded();
    if (mobile)
      expect(
        await reader
          .locator(".reading-head")
          .evaluate((element) => element.getBoundingClientRect().height),
      ).toBeLessThan(200);
    await page.screenshot({
      path: testInfo.outputPath(`reading-frontier-pending-${mobile ? "mobile" : "desktop"}.png`),
    });
    await frontier.getByRole("button", { name: "연결 구간까지 펼치기", exact: true }).click();
    await expect(reader.locator(".reading-unit")).toHaveCount(4);
    await expect(reader.locator(".reading-unit").last()).toBeFocused();
    await expect(reader.locator(".reading-unit").last()).toBeInViewport();
    await expect(frontier).toContainText("연결 구간이 나왔음");
    await expect(frontier).toContainText("숨겨 놓은 근거");
    await expect(
      frontier.getByRole("button", { name: "연결 구간까지 펼치기", exact: true }),
    ).toHaveCount(0);
    await frontier.getByRole("button", { name: "처음 연결한 문장 다시 보기", exact: true }).click();
    await expect(reader.locator(".reading-unit").nth(1)).toBeFocused();
    await expect(reader.locator(".reading-unit").nth(1)).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.getByRole("button", { name: "실행 취소", exact: true })).toBeDisabled();
    await reader.getByRole("button", { name: "전부 펼치기", exact: true }).click();
    await expect(frontier).toHaveCount(0);
    await expect(frontierToggle).toHaveCount(0);
    await reader.getByRole("button", { name: "읽어보기 끝내기", exact: true }).click();
    await expect(editor).toBeFocused();
    expect(await editor.textContent()).toBe(original);
  });
}
