import { expect, test } from "@playwright/test";

test("renders the paste tool", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "디씨 글 디자인" })).toBeVisible();
  await expect(page.getByRole("button", { name: /디씨 복사/ })).toBeVisible();
  await expect(page.getByLabel("글 편집 도구")).toBeVisible();
  await expect(page.getByRole("button", { name: "팁" })).toBeVisible();
  await expect(page.getByRole("button", { name: "주의" })).toBeVisible();
  await expect(page.getByRole("button", { name: "참고" })).toBeVisible();
  await expect(page.getByRole("button", { name: "섹션" })).toBeVisible();
  await expect(page.getByRole("button", { name: "코드" })).toBeVisible();
  await expect(page.getByRole("button", { name: "CTA" })).toBeVisible();
  await expect(page.getByRole("button", { name: "구분선" })).toBeVisible();
  await expect(page.getByRole("button", { name: "초기화" })).toBeVisible();
  await expect(page.getByLabel("코드 파일명")).toBeVisible();
  await expect(page.getByLabel("코드 강조 줄")).toBeVisible();
  await expect(page.getByLabel("문서 테마", { exact: true })).toBeVisible();
  await expect(page.getByText("글쓰기")).toBeVisible();
  await expect(page.getByLabel("현재 복붙 구조")).toHaveText("DC 테이블");
  await expect(page.getByLabel("현재 문서 테마")).toHaveText("강의 라이트");
  await expect(page.getByRole("region", { name: "프리셋" })).toBeVisible();
  await expect(page.getByLabel("저장된 프리셋")).toContainText("프리셋 없음");
  await expect(page.getByRole("region", { name: "초안 히스토리" })).toBeVisible();
  await expect(page.getByLabel("저장된 초안")).toContainText("초안 없음");
  await page.getByRole("button", { name: "초안 스냅샷 저장" }).click();
  await expect(page.getByLabel("저장된 초안").getByText(/초안/)).toBeVisible();
  await page.getByLabel("프리셋 이름").fill("강의글 구조");
  await page.getByRole("button", { name: "프리셋 저장" }).click();
  await expect(page.getByLabel("저장된 프리셋").getByText("강의글 구조")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("저장된 프리셋").getByText("강의글 구조")).toBeVisible();
  await expect(page.getByLabel("저장된 초안").getByText(/초안/)).toBeVisible();
  await expect(page.getByRole("button", { name: "HTML" })).toBeVisible();
  await page.getByRole("button", { name: "HTML" }).click();
  await expect(page.getByRole("button", { name: /원문 복사/ })).toBeVisible();
  const htmlSource = page.getByLabel("복사용 HTML 원문");
  await expect(htmlSource).toBeVisible();
  await expect(htmlSource).toHaveValue(/<table width="100%"/);
  await expect(htmlSource).toHaveValue(/bgcolor="#fbfaf2"/);
  await expect(htmlSource).toHaveValue(/TIP/);
  await expect(htmlSource).toHaveValue(/LINK/);
  await expect(htmlSource).toHaveValue(/사용 방법 및 예시/);
  await expect(htmlSource).toHaveValue(/cppreference 열기/);
  await expect(htmlSource).toHaveValue(/main\.cpp/);
  await expect(htmlSource).toHaveValue(/<pre/);

  await page.getByRole("button", { name: "Markdown" }).click();
  await page
    .getByLabel("Markdown 원문")
    .fill(
      [
        "# Markdown 강의",
        "",
        "본문에서 `ios::sync_with_stdio(false)`를 쓴다.",
        "",
        "- 입력 크기를 본다.",
        "- 반복 횟수를 본다.",
        "",
        "[원문 보기](https://example.com/reference)",
        "",
        '```diff {2} title="patch.diff"',
        "-const oldValue = 1;",
        "+const newValue = 2;",
        "```",
      ].join("\n"),
    );
  await page.getByRole("button", { name: "Markdown 가져오기" }).click();
  await expect(htmlSource).toHaveValue(/Markdown 강의/);
  await expect(htmlSource).toHaveValue(/입력 크기를 본다/);
  await expect(htmlSource).toHaveValue(/LINK/);
  await expect(htmlSource).toHaveValue(/example.com\/reference/);
  await expect(htmlSource).toHaveValue(/oldValue/);
  await expect(htmlSource).toHaveValue(/newValue/);
  await expect(htmlSource).toHaveValue(/patch\.diff/);
  await expect(htmlSource).toHaveValue(/border-left:4px solid/);
  await expect(htmlSource).toHaveValue(/oklch\(24\.12% 0\.055 145\.21 \/ 0\.86\)/);
  await expect(htmlSource).toHaveValue(/<pre/);
});
