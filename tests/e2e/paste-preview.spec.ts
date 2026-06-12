import { expect, test } from "@playwright/test";

test("renders the paste tool", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "디씨 글 디자인" })).toBeVisible();
  await expect(page.getByRole("button", { name: /디씨 복사/ })).toBeVisible();
  await expect(page.getByLabel("글 편집 도구")).toBeVisible();
  await expect(page.getByRole("button", { name: "팁" })).toBeVisible();
  await expect(page.getByRole("button", { name: "주의" })).toBeVisible();
  await expect(page.getByRole("button", { name: "참고" })).toBeVisible();
  await expect(page.getByRole("button", { name: "성공" })).toBeVisible();
  await expect(page.getByRole("button", { name: "실패" })).toBeVisible();
  await expect(page.getByRole("button", { name: "실험" })).toBeVisible();
  await expect(page.getByRole("button", { name: "결론" })).toBeVisible();
  await expect(page.getByRole("button", { name: "반박" })).toBeVisible();
  await expect(page.getByRole("button", { name: "섹션" })).toBeVisible();
  await expect(page.getByRole("button", { name: "히어로" })).toBeVisible();
  await expect(page.getByRole("button", { name: "요약" })).toBeVisible();
  await expect(page.getByRole("button", { name: "튜토리얼" })).toBeVisible();
  await expect(page.getByRole("button", { name: "비교" })).toBeVisible();
  await expect(page.getByRole("button", { name: "코드" })).toBeVisible();
  await expect(page.getByRole("button", { name: "CTA" })).toBeVisible();
  await expect(page.getByRole("button", { name: "버튼묶음" })).toBeVisible();
  await expect(page.getByRole("button", { name: "자료목록" })).toBeVisible();
  await expect(page.getByLabel("버튼묶음 정렬")).toBeVisible();
  await expect(page.getByRole("button", { name: "구분선" })).toBeVisible();
  await expect(page.getByRole("button", { name: "초기화" })).toBeVisible();
  await expect(page.getByRole("button", { name: "LLM 가이드 복사" })).toBeVisible();
  await expect(page.getByLabel("인용 스타일")).toBeVisible();
  await expect(page.getByLabel("코드 파일명")).toBeVisible();
  await expect(page.getByLabel("코드 강조 줄")).toBeVisible();
  await expect(page.getByLabel("문서 테마", { exact: true })).toBeVisible();
  await expect(page.getByLabel("기본 폰트")).toHaveCount(0);
  await expect(page.getByLabel("선택 폰트")).toHaveCount(0);

  const crampedToolbarItems = await page
    .getByLabel("글 편집 도구")
    .locator("button, label")
    .evaluateAll((items) =>
      items
        .map((item) => {
          const element = item as HTMLElement;
          const box = element.getBoundingClientRect();

          return {
            height: box.height,
            label:
              element.textContent?.replace(/\s+/g, " ").trim() ??
              element.getAttribute("aria-label") ??
              "",
            overflow: element.scrollHeight - element.clientHeight,
          };
        })
        .filter((item) => item.height > 44 || item.overflow > 2),
    );
  expect(crampedToolbarItems).toEqual([]);

  await expect(page.getByText("글쓰기")).toBeVisible();
  await expect(page.getByLabel("현재 복붙 구조")).toHaveText("DC 테이블");
  await expect(page.getByLabel("현재 문서 테마")).toHaveText("강의 라이트");
  await page.getByLabel("문서 테마", { exact: true }).selectOption("darkEditorial");
  await expect(page.getByLabel("현재 문서 테마")).toHaveText("다크 에디토리얼");
  await expect(page.locator(".preview-surface")).toHaveClass(/preview-surface-dark/);
  const darkEditorCtaColors = await page.locator(".editor-surface").evaluate((surface) => {
    const cta = surface.querySelector<HTMLElement>(".dc-cta-button");
    const regularLink = surface.querySelector<HTMLElement>("a:not(.dc-cta-button)");

    if (!cta || !regularLink) {
      throw new Error("Expected sample document to include a CTA button and a regular link");
    }

    return {
      ctaBackground: getComputedStyle(cta).backgroundColor,
      ctaColor: getComputedStyle(cta).color,
      regularLinkColor: getComputedStyle(regularLink).color,
    };
  });
  expect(darkEditorCtaColors.ctaColor).not.toBe(darkEditorCtaColors.regularLinkColor);
  expect(darkEditorCtaColors.ctaColor).not.toBe(darkEditorCtaColors.ctaBackground);
  await page.getByLabel("문서 테마", { exact: true }).selectOption("lightLecture");
  await expect(page.getByLabel("현재 문서 테마")).toHaveText("강의 라이트");
  await expect(page.locator(".preview-surface")).not.toHaveClass(/preview-surface-dark/);
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
  await expect(htmlSource).toHaveValue(/CODING GUIDE/);
  await expect(htmlSource).toHaveValue(/C\+\+로 보는 입력 최적화/);
  await expect(htmlSource).toHaveValue(/입출력 병목을 예제와 비교로 빠르게 잡아내는 강의 노트/);
  await expect(htmlSource).toHaveValue(/TIP/);
  await expect(htmlSource).toHaveValue(/성공/);
  await expect(htmlSource).toHaveValue(/실패/);
  await expect(htmlSource).toHaveValue(/실험/);
  await expect(htmlSource).toHaveValue(/결론/);
  await expect(htmlSource).toHaveValue(/반박/);
  await expect(htmlSource).toHaveValue(/LINK/);
  await expect(htmlSource).toHaveValue(/핵심 요약/);
  await expect(htmlSource).toHaveValue(/입출력 병목은 코드보다 데이터 흐름에서 먼저 찾는다/);
  await expect(htmlSource).toHaveValue(/사용 방법 및 예시/);
  await expect(htmlSource).toHaveValue(/입력 규모 확인/);
  await expect(htmlSource).toHaveValue(/입출력 계열 고정/);
  await expect(htmlSource).toHaveValue(/>01<\/span>/);
  await expect(htmlSource).toHaveValue(/Before/);
  await expect(htmlSource).toHaveValue(/After/);
  await expect(htmlSource).toHaveValue(/endl을 반복문 안에서 계속 쓰면/);
  await expect(htmlSource).toHaveValue(/\\n으로 출력/);
  await expect(htmlSource).toHaveValue(/cppreference 열기/);
  await expect(htmlSource).toHaveValue(/GitHub/);
  await expect(htmlSource).toHaveValue(/원문/);
  await expect(htmlSource).toHaveValue(/다운로드/);
  await expect(htmlSource).toHaveValue(/실행하기/);
  await expect(htmlSource).toHaveValue(/cppreference ios_base::sync_with_stdio/);
  await expect(htmlSource).toHaveValue(/예제 코드 저장소/);
  await expect(htmlSource).toHaveValue(/main\.cpp/);
  await expect(htmlSource).toHaveValue(/text-align:center/);
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
  await page.getByRole("button", { name: "Markdown 적용하기" }).click();
  await expect(htmlSource).toHaveValue(/Markdown 강의/);
  await expect(htmlSource).toHaveValue(/입력 크기를 본다/);
  await expect(htmlSource).toHaveValue(/LINK/);
  await expect(htmlSource).toHaveValue(/example.com\/reference/);
  await expect(htmlSource).toHaveValue(/oldValue/);
  await expect(htmlSource).toHaveValue(/newValue/);
  await expect(htmlSource).toHaveValue(/patch\.diff/);
  await expect(htmlSource).toHaveValue(/border-left:4px solid/);
  await expect(htmlSource).toHaveValue(/background-color:#[0-9a-f]{6}/);
  await expect(htmlSource).not.toHaveValue(/oklch\(/);
  await expect(htmlSource).toHaveValue(/<pre/);
});
