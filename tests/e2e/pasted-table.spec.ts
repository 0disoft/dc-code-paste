import { expect, test } from "@playwright/test";

test("keeps exported layout wrappers out of pasted data tables", async ({ page }) => {
  await page.goto("./");
  const editor = page.locator(".article-editor");
  await expect(editor).toContainText("DC-CODE-PASTE");
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
  await page
    .getByLabel("Markdown 원문")
    .fill("# 글 제목\n\n앞 문단\n\n| 항목 | 값 |\n| --- | --- |\n| 수입 | 100 |\n\n뒤 문단");
  await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "HTML 원문 보기", exact: true }).click();
  const source = page.getByLabel("복사용 HTML 원문", { exact: true });
  await expect(source).toHaveValue(/<th[^>]*>항목<\/th>/);
  const html = await source.inputValue();
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
  await page.getByLabel("Markdown 원문").fill("다시 붙일 곳");
  await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
  await expect(editor).toBeFocused();
  await page.keyboard.press("Control+a");
  await editor.evaluate((element, source) => {
    const data = new DataTransfer();
    data.setData("text/html", source);
    data.setData("text/plain", "글 제목 앞 문단 항목 값 수입 100 뒤 문단");
    element.dispatchEvent(
      new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data }),
    );
  }, html);
  await expect(editor.locator("table")).toHaveCount(1);
  await expect(editor.locator("table th")).toHaveCount(2);
  await expect(editor.locator("p").filter({ hasText: "앞 문단" })).toBeVisible();
  await expect(editor.locator("p").filter({ hasText: "뒤 문단" })).toBeVisible();
  await expect(editor.locator("strong").filter({ hasText: "글 제목" })).toBeVisible();
});

test("keeps layout text around a nested data table and expands row spans to the end of their group", async ({
  page,
}) => {
  await page.goto("./");
  const editor = page.locator(".article-editor");
  await expect(editor).toContainText("DC-CODE-PASTE");
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
  await page.getByLabel("Markdown 원문").fill("표를 붙일 곳");
  await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
  await expect(editor).toBeFocused();
  await page.keyboard.press("Control+a");
  await editor.evaluate((element) => {
    const data = new DataTransfer();
    data.setData(
      "text/html",
      '<table role="presentation"><tr><td><p>앞 문단</p><table><tbody><tr><th rowspan="0">분기</th><td><div>첫째</div><div>둘째</div></td></tr><tr><td>세 번째</td></tr></tbody></table><p>뒤 문단</p></td></tr></table>',
    );
    data.setData("text/plain", "앞 문단 분기 첫째 둘째 세 번째 뒤 문단");
    element.dispatchEvent(
      new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data }),
    );
  });
  await expect(editor.locator("table")).toHaveCount(1);
  await expect(editor.locator("th")).toHaveAttribute("rowspan", "2");
  await expect(
    editor.locator("td").filter({ hasText: "첫째" }).locator("br:not(.ProseMirror-trailingBreak)"),
  ).toHaveCount(1);
  await expect(editor.locator("p").filter({ hasText: "앞 문단" })).toBeVisible();
  await expect(editor.locator("p").filter({ hasText: "뒤 문단" })).toBeVisible();
});

for (const mobile of [false, true]) {
  test(`keeps pasted table headers, merged cells and content through export and reload on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("./");
    const editor = page.locator(".article-editor");
    await expect(editor).toContainText("DC-CODE-PASTE");
    await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
    await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
    await page.getByLabel("Markdown 원문").fill("표를 붙일 곳");
    await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
    await expect(editor).toBeFocused();
    await page.keyboard.press("Control+a");
    await editor.evaluate((element) => {
      const data = new DataTransfer();
      data.setData(
        "text/html",
        '<table><caption>월별 수입</caption><thead><tr><th rowspan="2">월</th><th colspan="2">금액</th></tr><tr><th>수입</th><th>지출</th></tr></thead><tbody><tr><td>10월</td><td><p><strong><span style="color:rgb(37,99,235)">100</span></strong></p><p>만원</p></td><td><a href="https://example.com/source">20</a></td></tr><tr><td>11월</td><td>150</td><td>30</td></tr></tbody></table>',
      );
      data.setData("text/plain", "월별 수입 월 금액 수입 지출 10월 100 만원 20 11월 150 30");
      element.dispatchEvent(
        new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data }),
      );
    });
    const table = editor.locator("table.dc-data-table");
    await expect(table).toBeVisible();
    await expect(table.locator("tr")).toHaveCount(4);
    await expect(table.locator("caption")).toHaveText("월별 수입");
    await expect(table.getByRole("columnheader", { name: "월", exact: true })).toHaveAttribute(
      "rowspan",
      "2",
    );
    await expect(table.getByRole("columnheader", { name: "금액", exact: true })).toHaveAttribute(
      "colspan",
      "2",
    );
    const amount = table.locator("td").filter({ hasText: "100" });
    await expect(amount.locator("br:not(.ProseMirror-trailingBreak)")).toHaveCount(1);
    await expect(amount.locator("strong")).toHaveText("100");
    await expect(amount.locator("span")).toHaveCSS("color", "rgb(37, 99, 235)");
    await expect(table.locator("a")).toHaveAttribute("href", "https://example.com/source");
    await table.locator("caption").click();
    await page.keyboard.press("Home");
    await page.keyboard.insertText("변경된 ");
    await expect(table.locator("caption")).toHaveText("변경된 월별 수입");
    await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
    await page.getByRole("menuitem", { name: "HTML 원문 보기", exact: true }).click();
    const source = page.getByLabel("복사용 HTML 원문", { exact: true });
    await expect(source).toHaveValue(/<caption[^>]*>변경된 월별 수입<\/caption>/);
    await expect(source).toHaveValue(/rowspan="2"/);
    await expect(source).toHaveValue(/colspan="2"/);
    await expect(source).toHaveValue(/100[\s\S]*?<br>만원/);
    await expect(source).toHaveValue(/color:#2563eb/);
    await expect(source).toHaveValue(/href="https:\/\/example.com\/source"/);
    await expect(page.locator(".topbar-status")).toContainText("저장됨");
    await page.reload();
    await expect(table.locator("tr")).toHaveCount(4);
    await expect(table.locator("caption")).toHaveText("변경된 월별 수입");
    await expect(table.locator("th").first()).toHaveAttribute("rowspan", "2");
  });
}
