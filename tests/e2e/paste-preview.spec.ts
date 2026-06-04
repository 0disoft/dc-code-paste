import { expect, test } from "@playwright/test";

test("renders the paste tool", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "디씨 글 디자인" })).toBeVisible();
  await expect(page.getByRole("button", { name: /디씨 복사/ })).toBeVisible();
  await expect(page.getByLabel("글 편집 도구")).toBeVisible();
  await expect(page.getByRole("button", { name: "팁" })).toBeVisible();
  await expect(page.getByRole("button", { name: "주의" })).toBeVisible();
  await expect(page.getByRole("button", { name: "참고" })).toBeVisible();
  await expect(page.getByRole("button", { name: "코드" })).toBeVisible();
  await expect(page.getByRole("button", { name: "구분선" })).toBeVisible();
  await expect(page.getByRole("button", { name: "초기화" })).toBeVisible();
  await expect(page.getByText("글쓰기")).toBeVisible();
  await expect(page.getByLabel("현재 복붙 구조")).toHaveText("DC 테이블");
  await expect(page.getByRole("button", { name: "HTML" })).toBeVisible();
  await page.getByRole("button", { name: "HTML" }).click();
  await expect(page.getByRole("button", { name: /원문 복사/ })).toBeVisible();
  const htmlSource = page.getByLabel("복사용 HTML 원문");
  await expect(htmlSource).toBeVisible();
  await expect(htmlSource).toHaveValue(/<table width="100%"/);
  await expect(htmlSource).toHaveValue(/bgcolor="#fbfaf2"/);
  await expect(htmlSource).toHaveValue(/TIP/);
  await expect(htmlSource).toHaveValue(/LINK/);
  await expect(htmlSource).toHaveValue(/<pre/);
});
