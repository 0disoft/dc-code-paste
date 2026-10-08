import { expect, test, type Page } from "@playwright/test";

async function loadText(page: Page, markdown: string) {
  await page.goto("./");
  await expect(page.locator(".article-editor")).toContainText("DC-CODE-PASTE");
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
  await page.getByLabel("Markdown 원문").fill(markdown);
  await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
}

for (const mobile of [false, true]) {
  test(`keeps link entry open when clicking its input and apply button on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await loadText(page, "링크를 추가할 글자");
    await page.locator(".article-editor > p").click();
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");
    if (mobile) await page.getByRole("button", { name: "블록 삽입 패널", exact: true }).click();
    await page.getByRole("button", { name: "링크 삽입", exact: true }).click();
    const input = page.getByLabel("링크 주소", { exact: true });
    await input.click();
    await expect(input).toBeFocused();
    await input.fill("not a valid address");
    const apply = page
      .getByRole("group", { name: "링크 편집" })
      .getByRole("button", { name: "적용", exact: true });
    await apply.click();
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("alert")).toContainText("주소를 확인해 주세요");
    await expect(page.locator(".article-editor a")).toHaveCount(0);
    await input.fill("example.com/new");
    await expect(input).toHaveAttribute("aria-invalid", "false");
    await page
      .getByRole("group", { name: "링크 편집" })
      .getByRole("button", { name: "적용", exact: true })
      .click();
    await expect(page.locator(".article-editor a")).toHaveAttribute(
      "href",
      "https://example.com/new",
    );
  });
}

test("starts a new link with an empty address after editing another link", async ({ page }) => {
  await loadText(page, "기존 [링크](https://example.com/old) 설명\n\n새로 연결할 글자");
  await page.locator(".article-editor a").click();
  await expect(page.getByLabel("링크 주소", { exact: true })).toHaveValue(
    "https://example.com/old",
  );
  await page.locator(".article-editor > p").last().click();
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+End");
  await page.getByRole("button", { name: "링크 삽입", exact: true }).click();
  await expect(page.getByLabel("링크 주소", { exact: true })).toHaveValue("");
  const toggle = page.getByRole("button", { name: "링크", exact: true });
  await toggle.click();
  await expect(page.getByLabel("링크 주소", { exact: true })).not.toBeVisible();
  await toggle.click();
  await expect(page.getByLabel("링크 주소", { exact: true })).toBeFocused();
  await expect(page.getByLabel("링크 주소", { exact: true })).toHaveValue("");
});

test("reads and edits link box and reference addresses from their selected blocks", async ({
  page,
}) => {
  await loadText(
    page,
    "[블록 링크](https://example.com/box)\n\n:::references\n- [참고 문서](https://example.com/reference)\n:::",
  );
  for (const [selector, path] of [
    [".dc-link-box", "box"],
    [".dc-reference-item", "reference"],
  ]) {
    const block = page.locator(`.article-editor ${selector}`);
    await block.click();
    await page.getByRole("button", { name: "링크 삽입", exact: true }).click();
    const input = page.getByLabel("링크 주소", { exact: true });
    await expect(input).toHaveValue(`https://example.com/${path}`);
    await input.click();
    await input.fill(`https://example.com/${path}-updated`);
    await page
      .getByRole("group", { name: "링크 편집" })
      .getByRole("button", { name: "적용", exact: true })
      .click();
    await expect(block).toHaveAttribute("data-href", `https://example.com/${path}-updated`);
  }
  await expect(page.locator(".article-editor .dc-link-box")).toHaveText("블록 링크");
  await expect(page.locator(".article-editor .dc-reference-item")).toHaveText("참고 문서");
});
