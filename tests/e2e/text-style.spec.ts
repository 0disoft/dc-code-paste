import { expect, test } from "@playwright/test";

test("keeps inline emphasis in the body font while code blocks use coding fonts", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.locator(".article-editor")).toContainText("DC-CODE-PASTE");
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
  await page
    .getByLabel("Markdown 원문")
    .fill("`LLM 가이드`를 참고하세요.\n\n```javascript\nconst value = 1;\n```");
  await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();

  const editor = page.locator(".article-editor");
  const inlineCode = editor.locator("p code");
  const codeBlock = editor.locator("pre");
  await expect(inlineCode).toHaveText("LLM 가이드");
  await expect(inlineCode).toHaveCSS("font-family", /Pretendard/);
  await expect(codeBlock).toHaveCSS("font-family", /D2Coding/);
  await page.getByRole("tab", { name: "전체 글", exact: true }).click();
  await page.getByLabel("본문 글꼴", { exact: true }).selectOption({ label: "명조" });
  await expect(inlineCode).toHaveCSS(
    "font-family",
    await editor.evaluate((element) => getComputedStyle(element).fontFamily),
  );
  await expect(codeBlock).toHaveCSS("font-family", /D2Coding/);

  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "HTML 원문 보기", exact: true }).click();
  const html = await page.getByLabel("복사용 HTML 원문", { exact: true }).inputValue();
  expect(html).toMatch(/<code style="[^"]*font-family:inherit[^"]*">LLM 가이드<\/code>/);
  expect(html).toContain("font-family:Noto Serif KR,Batang,serif");
  expect(html).toContain("font-family:Cascadia Mono,D2Coding,monospace");
});

test("shows inherited text size instead of the previous selection's size", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator(".article-editor")).toContainText("DC-CODE-PASTE");
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
  await page.getByLabel("Markdown 원문").fill("# 서식 확인\n\n**꾸밀 문단**\n\n일반 문단");
  await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
  await expect(page.locator(".article-editor")).toBeFocused();
  const paragraphs = page.locator(".article-editor > p");
  await paragraphs.first().click();
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+End");
  await expect(page.getByRole("region", { name: "선택 영역", exact: true })).toContainText(
    "선택한 글자에 적용됩니다.",
  );
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe("꾸밀 문단");
  const size = page.getByLabel("선택 글자 크기", { exact: true });
  await size.selectOption("20px");
  await expect(paragraphs.first().locator("span")).toHaveCSS("font-size", "20px");
  await paragraphs.last().click();
  await expect(size).toHaveValue("");
  await expect(page.getByRole("button", { name: "글자 꾸밈 초기화", exact: true })).toBeDisabled();
  await paragraphs.first().click();
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+End");
  await expect(page.getByRole("region", { name: "선택 영역", exact: true })).toContainText(
    "선택한 글자에 적용됩니다.",
  );
  await expect(size).toHaveValue("20px");
  await page.getByRole("button", { name: "글자 꾸밈 초기화", exact: true }).click();
  await expect(size).toHaveValue("");
  await expect(paragraphs.first().locator("span")).toHaveCount(0);
  await expect(paragraphs.first().locator("strong")).toHaveText("꾸밀 문단");
});

test("sets, exports and restores body and selected fonts without losing links or bold", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.locator(".article-editor")).toContainText("DC-CODE-PASTE");
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
  await page
    .getByLabel("Markdown 원문")
    .fill("# 글꼴 확인\n\n**[꾸밀 문단](https://example.com)**\n\n일반 문단");
  await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();

  await page.getByRole("tab", { name: "전체 글", exact: true }).click();
  await page.getByLabel("본문 글꼴", { exact: true }).selectOption({ label: "명조" });
  await expect(page.locator(".article-editor")).toHaveCSS("font-family", /Noto Serif KR/);
  await page.getByRole("tab", { name: "선택한 블록", exact: true }).click();
  const paragraphs = page.locator(".article-editor > p");
  await paragraphs.first().click();
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+End");
  await expect(page.getByRole("region", { name: "선택 영역", exact: true })).toContainText(
    "선택한 글자에 적용됩니다.",
  );
  const font = page.getByLabel("선택 글꼴", { exact: true });
  await font.selectOption({ label: "Georgia" });
  await expect(page.locator(".article-editor")).toBeFocused();
  await page.getByLabel("선택 글자 크기", { exact: true }).selectOption("20px");
  await expect(page.locator(".article-editor")).toBeFocused();
  await page.getByRole("button", { name: "파랑 글자색", exact: true }).click();
  await expect(paragraphs.first().locator("span")).toHaveCSS("font-family", /Georgia/);
  await paragraphs.last().click();
  await expect(font).toHaveValue("");
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "HTML 원문 보기", exact: true }).click();
  const html = page.getByLabel("복사용 HTML 원문", { exact: true });
  await expect(html).toHaveValue(/font-family:Noto Serif KR,Batang,serif/);
  await expect(html).toHaveValue(/font-family:Georgia,Batang,serif/);
  await expect(page.locator(".topbar-status")).toContainText("저장됨");
  await page.reload();
  await expect(page.locator(".article-editor")).toHaveCSS("font-family", /Noto Serif KR/);
  await expect(paragraphs.first().locator("span")).toHaveCSS("font-family", /Georgia/);
  await page.getByRole("tab", { name: "전체 글", exact: true }).click();
  await expect(page.getByLabel("본문 글꼴", { exact: true })).toHaveValue(
    "Noto Serif KR,Batang,serif",
  );
  await page.getByRole("tab", { name: "선택한 블록", exact: true }).click();
  await paragraphs.first().click();
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+End");
  await expect(page.getByRole("region", { name: "선택 영역", exact: true })).toContainText(
    "선택한 글자에 적용됩니다.",
  );
  await expect(font).toHaveValue("Georgia,Batang,serif");
  await font.selectOption("");
  await expect(paragraphs.first().locator("span")).not.toHaveAttribute("style", /font-family/);
  await expect(paragraphs.first().locator("span")).toHaveCSS("font-size", "20px");
  await font.selectOption({ label: "Georgia" });
  await page.getByRole("button", { name: "글자 꾸밈 초기화", exact: true }).click();
  await expect(paragraphs.first().locator("span")).toHaveCount(0);
  await expect(paragraphs.first().locator("strong")).toHaveText("꾸밀 문단");
  await expect(paragraphs.first().locator("a")).toHaveAttribute("href", "https://example.com/");
});
