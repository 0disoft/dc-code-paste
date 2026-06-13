import { expect, test } from "@playwright/test";

test("renders the paste tool", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "디씨 글 디자인" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /디씨 복사/ })).toBeVisible();
  await expect(page.getByLabel("글 편집 도구")).toBeVisible();
  await expect(page.getByRole("button", { name: "블록 도구" })).toBeVisible();
  await expect(page.getByRole("button", { name: "코드 도구" })).toBeVisible();
  await expect(page.getByRole("button", { name: "스타일 도구" })).toBeVisible();
  await expect(page.getByRole("button", { name: "팁" })).toHaveCount(0);
  await expect(page.getByLabel("코드 파일명")).toHaveCount(0);
  await expect(page.getByLabel("기본 크기")).toHaveCount(0);
  await expect(page.getByLabel("코드 크기")).toHaveCount(0);
  await expect(page.getByLabel("줄번호")).toHaveCount(0);

  await page.getByRole("button", { name: "블록 도구" }).click();
  await expect(page.getByRole("button", { name: "블록 도구" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.getByRole("button", { name: "콜아웃", exact: true })).toBeVisible();
  await expect(page.getByLabel("콜아웃 색상 프리셋")).toBeVisible();
  await expect(page.getByLabel("사용자 콜아웃 색상")).toHaveCount(1);
  await expect(page.getByLabel("사용자 콜아웃 색상")).toHaveCSS("opacity", "0");
  const hiddenColorInputWidth = await page.getByLabel("사용자 콜아웃 색상").evaluate((input) => {
    return Number.parseFloat(getComputedStyle(input).width);
  });
  expect(hiddenColorInputWidth).toBeLessThanOrEqual(8);
  await expect(page.getByRole("button", { name: "초록 콜아웃" })).toBeVisible();
  await expect(page.getByRole("button", { name: "노랑 콜아웃" })).toBeVisible();
  await expect(page.getByRole("button", { name: "파랑 콜아웃" })).toBeVisible();
  await expect(page.getByRole("button", { name: "팁" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "주의" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "참고" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "성공" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "실패" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "실험" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "결론" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "반박" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "섹션" })).toBeVisible();
  await expect(page.getByRole("button", { name: "히어로" })).toBeVisible();
  await expect(page.getByRole("button", { name: "요약" })).toBeVisible();
  await expect(page.getByRole("button", { name: "튜토리얼" })).toBeVisible();
  await expect(page.getByRole("button", { name: "비교" })).toBeVisible();
  await expect(page.getByRole("button", { name: "CTA" })).toBeVisible();
  await expect(page.getByRole("button", { name: "버튼묶음" })).toBeVisible();
  await expect(page.getByRole("button", { name: "자료목록" })).toBeVisible();
  await expect(page.getByLabel("버튼묶음 정렬")).toBeVisible();
  await expect(page.getByRole("button", { name: "구분선" })).toBeVisible();
  await expect(page.getByRole("button", { name: "초기화" })).toBeVisible();
  await expect(page.getByRole("button", { name: "예시 템플릿" })).toBeVisible();
  await expect(page.getByRole("button", { name: "LLM 가이드 복사" })).toBeVisible();
  await expect(page.getByRole("button", { name: "저장함" })).toBeVisible();
  await expect(page.getByRole("button", { name: "초기화" })).toHaveCSS("font-weight", "500");
  await expect(page.getByRole("button", { name: /디씨 복사/ })).toHaveCSS("font-weight", "500");
  await expect(page.getByRole("region", { name: "프리셋" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "초안 히스토리" })).toHaveCount(0);
  await expect(page.getByLabel("인용 스타일")).toBeVisible();

  await page.getByRole("button", { name: "코드 도구" }).click();
  await expect(page.getByRole("button", { name: "팁" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "콜아웃" })).toHaveCount(0);
  await expect(page.getByLabel("콜아웃 색상 프리셋")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "코드", exact: true })).toBeVisible();
  await expect(page.getByLabel("복붙 구조")).toBeVisible();
  await expect(page.getByLabel("코드 파일명")).toBeVisible();
  await expect(page.getByLabel("코드 강조 줄")).toBeVisible();
  await expect(page.getByLabel("코드 추가 줄")).toBeVisible();
  await expect(page.getByLabel("코드 삭제 줄")).toBeVisible();
  await expect(page.getByLabel("코드 크기")).toBeVisible();
  await expect(page.getByLabel("코드 크기")).toHaveValue("15px");
  await expect(page.getByLabel("코드 테마")).toHaveValue("catppuccin-mocha");
  await expect(page.getByLabel("줄번호")).toBeVisible();
  await expect(page.getByLabel("문서 테마", { exact: true })).toHaveCount(0);
  await page
    .locator(".article-editor pre")
    .first()
    .evaluate((pre) => {
      const code = pre.querySelector("code") ?? pre;
      const rect = code.getBoundingClientRect();
      const lineHeight = Number.parseFloat(getComputedStyle(code).lineHeight);
      pre.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + 56,
          clientY: rect.top + lineHeight * 4 + 1,
          button: 2,
          buttons: 2,
        }),
      );
    });
  await expect(page.getByRole("menu", { name: "코드 5번 줄" })).toBeVisible();
  await page.getByRole("menuitem", { name: "추가줄" }).click();
  await expect(page.getByLabel("코드 추가 줄")).toHaveValue("5");
  await expect(page.getByLabel("코드 강조 줄")).toHaveValue("6");
  await page
    .locator(".article-editor pre")
    .first()
    .evaluate((pre) => {
      const code = pre.querySelector("code") ?? pre;
      const rect = code.getBoundingClientRect();
      const lineHeight = Number.parseFloat(getComputedStyle(code).lineHeight);
      pre.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + 56,
          clientY: rect.top + lineHeight * 5 + 1,
          button: 2,
          buttons: 2,
        }),
      );
    });
  await expect(page.getByRole("menu", { name: "코드 6번 줄" })).toBeVisible();
  await page.getByRole("menuitem", { name: "삭제줄" }).click();
  await expect(page.getByLabel("코드 삭제 줄")).toHaveValue("6");
  await expect(page.getByLabel("코드 강조 줄")).toHaveValue("");

  await page.getByRole("button", { name: "스타일 도구" }).click();
  await expect(page.getByLabel("기본 크기")).toBeVisible();
  await expect(page.getByLabel("기본 크기")).toHaveValue("17px");
  await expect(page.getByLabel("선택 크기")).toHaveValue("17px");
  await expect(page.getByLabel("기본 폰트")).toHaveCount(0);
  await expect(page.getByLabel("선택 폰트")).toHaveCount(0);
  await expect(page.getByLabel("코드 크기")).toHaveCount(0);
  await expect(page.getByLabel("코드 추가 줄")).toHaveCount(0);
  await expect(page.getByLabel("코드 삭제 줄")).toHaveCount(0);
  await expect(page.getByLabel("줄번호")).toHaveCount(0);
  await expect(page.locator(".article-editor")).toHaveCSS("word-break", "keep-all");
  await expect(page.locator(".article-editor pre").first()).toHaveCSS("word-break", "normal");

  await expect(page.locator(".editor-surface")).toContainText(
    "Go 반복문 정복: for 하나로 모든 루프를 제어한다",
  );
  await page.getByRole("button", { name: "초기화" }).click();
  await expect(page.locator(".editor-surface")).not.toContainText(
    "Go 반복문 정복: for 하나로 모든 루프를 제어한다",
  );
  await page.getByRole("button", { name: "예시 템플릿" }).click();
  await expect(page.locator(".editor-surface")).toContainText(
    "Go 반복문 정복: for 하나로 모든 루프를 제어한다",
  );

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
  if ((await page.getByLabel("문서 테마", { exact: true }).count()) === 0) {
    await page.getByRole("button", { name: "스타일 도구" }).click();
  }
  await page.getByLabel("문서 테마", { exact: true }).selectOption("darkEditorial");
  await expect(page.getByLabel("현재 문서 테마")).toHaveText("다크 에디토리얼");
  await expect(page.locator(".preview-surface")).toHaveClass(/preview-surface-dark/);
  const darkEditorCtaColors = await page.locator(".editor-surface").evaluate((surface) => {
    const cta = surface.querySelector<HTMLElement>(".dc-cta-button");

    if (!cta) {
      throw new Error("Expected sample document to include a CTA button");
    }

    return {
      ctaBackground: getComputedStyle(cta).backgroundColor,
      ctaColor: getComputedStyle(cta).color,
    };
  });
  expect(darkEditorCtaColors.ctaColor).not.toBe(darkEditorCtaColors.ctaBackground);
  await page.getByLabel("문서 테마", { exact: true }).selectOption("lightLecture");
  await expect(page.getByLabel("현재 문서 테마")).toHaveText("강의 라이트");
  await expect(page.locator(".preview-surface")).not.toHaveClass(/preview-surface-dark/);
  await page.getByRole("button", { name: "저장함" }).click();
  await expect(page.getByRole("button", { name: "저장함" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.getByRole("region", { name: "프리셋" })).toBeVisible();
  await expect(page.getByLabel("저장된 프리셋")).toContainText("프리셋 없음");
  await expect(page.getByRole("region", { name: "초안 히스토리" })).toBeVisible();
  await expect(page.getByLabel("저장된 초안")).toContainText("초안 없음");
  await page.getByRole("button", { name: "초안 스냅샷 저장" }).click();
  await expect(page.getByLabel("저장된 초안").getByText(/초안/)).toBeVisible();
  await page
    .getByLabel("저장된 초안")
    .getByRole("button")
    .filter({ hasText: /초안/ })
    .first()
    .dblclick();
  await page.getByLabel("초안 제목 변경").fill("첫 풀이 초안");
  await page.getByLabel("초안 제목 변경").press("Enter");
  await expect(page.getByLabel("저장된 초안").getByText("첫 풀이 초안")).toBeVisible();
  await page.getByLabel("프리셋 이름").fill("강의글 구조");
  await page.getByRole("button", { name: "프리셋 저장" }).click();
  await expect(page.getByLabel("저장된 프리셋").getByText("강의글 구조")).toBeVisible();
  await page
    .getByLabel("저장된 프리셋")
    .getByRole("button", { name: /강의글 구조/ })
    .dblclick();
  await page.getByLabel("프리셋 제목 변경").fill("풀이 템플릿");
  await page.getByLabel("프리셋 제목 변경").press("Enter");
  await expect(page.getByLabel("저장된 프리셋").getByText("풀이 템플릿")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: "프리셋" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "초안 히스토리" })).toHaveCount(0);
  await page.getByRole("button", { name: "저장함" }).click();
  await expect(page.getByLabel("저장된 프리셋").getByText("풀이 템플릿")).toBeVisible();
  await expect(page.getByLabel("저장된 초안").getByText("첫 풀이 초안")).toBeVisible();
  await expect(page.getByRole("button", { name: "HTML" })).toBeVisible();
  await page.getByRole("button", { name: "HTML" }).click();
  await expect(page.getByRole("button", { name: /원문 복사/ })).toBeVisible();
  const htmlSource = page.getByLabel("복사용 HTML 원문");
  await expect(htmlSource).toBeVisible();
  await expect(htmlSource).toHaveValue(/<table width="100%"/);
  await expect(htmlSource).toHaveValue(/bgcolor="#ffffff"/);
  await expect(htmlSource).toHaveValue(/GO의 유일한 반복자/);
  await expect(htmlSource).toHaveValue(/Go 반복문 정복: for 하나로 모든 루프를 제어한다/);
  await expect(htmlSource).toHaveValue(/C 언어 계열의 while, do-while 없이/);
  await expect(htmlSource).toHaveValue(/for문 기본기/);
  await expect(htmlSource).toHaveValue(/조건문으로 변신한 for/);
  await expect(htmlSource).toHaveValue(/range는 값 복사에 주의/);
  await expect(htmlSource).toHaveValue(/for 하나로 충분한 이유/);
  await expect(htmlSource).toHaveValue(/Go에는/);
  await expect(htmlSource).toHaveValue(/for 키워드 하나만 존재하며/);
  await expect(htmlSource).toHaveValue(/초기문과 증감문을 생략하면/);
  await expect(htmlSource).toHaveValue(/반환되는/);
  await expect(htmlSource).toHaveValue(/value/);
  await expect(htmlSource).toHaveValue(/Go Playground/);
  await expect(htmlSource).toHaveValue(/Tour of Go/);
  await expect(htmlSource).toHaveValue(/언어 명세 \(For문\)/);
  await expect(htmlSource).toHaveValue(/A Tour of Go - For/);
  await expect(htmlSource).toHaveValue(/Effective Go - For/);
  await expect(htmlSource).toHaveValue(/Go by Example: For/);
  await expect(htmlSource).toHaveValue(/basic_for\.go/);
  await expect(htmlSource).toHaveValue(/while_style\.go/);
  await expect(htmlSource).toHaveValue(/infinite_loop\.go/);
  await expect(htmlSource).toHaveValue(/range_with_index\.go/);
  await expect(htmlSource).toHaveValue(/text-align:center/);
  await expect(htmlSource).not.toHaveValue(/<pre/);
  await expect(htmlSource).toHaveValue(/&nbsp;&nbsp;&nbsp;&nbsp;/);
  await expect(htmlSource).toHaveValue(/for&nbsp;i&nbsp;:=&nbsp;0/);

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
  await expect(htmlSource).not.toHaveValue(/<pre/);

  await page
    .getByLabel("저장된 초안")
    .getByRole("button")
    .filter({ hasText: "첫 풀이 초안" })
    .click();
  await expect(htmlSource).toHaveValue(/Go 반복문 정복: for 하나로 모든 루프를 제어한다/);
  await expect(htmlSource).not.toHaveValue(/Markdown 강의/);

  await page.getByRole("button", { name: "Markdown" }).click();
  await page.getByLabel("Markdown 원문").fill("# 임시 문서\n\n프리셋 적용 전 상태");
  await page.getByRole("button", { name: "Markdown 적용하기" }).click();
  await expect(htmlSource).toHaveValue(/임시 문서/);
  await page
    .getByLabel("저장된 프리셋")
    .getByRole("button")
    .filter({ hasText: "풀이 템플릿" })
    .click();
  await expect(htmlSource).toHaveValue(/Go 반복문 정복: for 하나로 모든 루프를 제어한다/);
  await expect(htmlSource).not.toHaveValue(/임시 문서/);
});
