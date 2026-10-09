import { expect, test, type Page } from "@playwright/test";

const outputKey = "dc-code-paste:last-copied-output:v1";
type CapturedWindow = typeof window & {
  copiedFragments: string[];
  copiedPlain: string[];
  denyFragment: boolean;
};

async function setup(page: Page) {
  await page.addInitScript(() => {
    const captured = window as CapturedWindow;
    captured.copiedFragments = [];
    captured.copiedPlain = [];
    captured.denyFragment = false;
    Object.defineProperty(navigator, "clipboard", {
      value: {
        write: async (items: ClipboardItem[]) => {
          if (captured.denyFragment) throw new Error("Clipboard denied");
          captured.copiedFragments.push(await (await items[0].getType("text/html")).text());
          captured.copiedPlain.push(await (await items[0].getType("text/plain")).text());
        },
      },
    });
    document.execCommand = () => false;
  });
  await page.goto("./");
  await expect(page.locator(".article-editor")).toContainText("DC-CODE-PASTE");
  await markdown(
    page,
    "# 보내는 글\n\n**보존할 문장** [자료](https://example.com/old)\n\n남길 문장\n\n1. 첫 항목\n2. 둘째 항목\n\n```js\n  return value;\n```",
  );
  await page.locator('[data-copy-trigger="preview"]').click();
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), outputKey))
    .not.toBeNull();
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!) as { html: string; plainText: string },
    outputKey,
  );
}

async function markdown(page: Page, text: string) {
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "Markdown", exact: true }).click();
  await page.getByLabel("Markdown 원문", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Markdown 적용하기", exact: true }).click();
}

async function open(page: Page) {
  await page.getByRole("button", { name: "더보기 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "마지막 복사 결과", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "마지막 복사 결과", exact: true });
  await dialog.getByRole("tab", { name: "현재 글과 비교", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    dialog.getByRole("tab", { name: "붙여넣은 결과와 비교", exact: true }),
  ).toBeFocused();
  return dialog;
}

async function paste(page: Page, html: string, plain = "돌아온 글") {
  await page.getByLabel("붙여넣은 결과", { exact: true }).evaluate(
    (element, payload) => {
      const data = new DataTransfer();
      data.setData("text/html", payload.html);
      data.setData("text/plain", payload.plain);
      element.dispatchEvent(
        new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
      );
    },
    { html, plain },
  );
}

for (const mobile of [false, true]) {
  test(`compares actual paste data and recopies only a saved passage on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(mobile ? { width: 320, height: 844 } : { width: 1440, height: 900 });
    const output = await setup(page);
    const originalRecord = await page.evaluate((key) => localStorage.getItem(key), outputKey);
    await markdown(page, "# 편집 중인 글\n\n나중에 쓴 문장");
    const current = await page.locator(".article-editor").textContent();
    const returned = await page.evaluate((html) => {
      const root = document.createElement("template");
      root.innerHTML = html;
      const strong = Array.from(root.content.querySelectorAll("strong")).find(
        (element) => element.textContent === "보존할 문장",
      )!;
      const paragraph = strong.closest("p,td")!;
      strong.textContent = "고친 문장";
      paragraph.querySelector("a")!.setAttribute("href", "https://example.com/new");
      Array.from(root.content.querySelectorAll("p,td"))
        .find((element) => element.textContent === "남길 문장")!
        .remove();
      const list = Array.from(root.content.querySelectorAll("table")).find((table) =>
        Array.from(table.rows).some((row) => row.cells[0]?.textContent === "1."),
      )!;
      const rows = Array.from(list.rows);
      rows[0].parentElement!.insertBefore(rows[1], rows[0]);
      return root.innerHTML;
    }, output.html);
    const dialog = await open(page);
    await paste(page, returned);
    await dialog.getByRole("button", { name: "붙여넣기 결과 비교", exact: true }).click();
    const result = dialog.getByRole("region", { name: "붙여넣기 비교 결과", exact: true });
    await expect(result).toContainText("보존할 문장");
    await expect(result).toContainText("고친 문장");
    await expect(
      result.getByRole("region", { name: "복사 당시", exact: true }).first(),
    ).toContainText("남길 문장");
    await expect(
      result.getByRole("region", { name: "돌아온 내용", exact: true }).first(),
    ).not.toContainText("남길 문장");
    await expect(result.getByRole("region", { name: "링크 변화", exact: true })).toContainText(
      "https://example.com/new",
    );
    await expect(result.getByRole("region", { name: "목록 변화", exact: true })).toContainText(
      "둘째 항목",
    );
    await dialog.getByRole("tab", { name: "현재 글과 비교", exact: true }).click();
    await dialog.getByRole("tab", { name: "붙여넣은 결과와 비교", exact: true }).click();
    await expect(result).toContainText("고친 문장");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await result.getByRole("button", { name: "복사 당시 구간 2 다시 복사", exact: true }).click();
    await expect(dialog).toContainText("선택한 구간을 다시 복사했습니다.");
    const fragment = await page.evaluate(() => (window as CapturedWindow).copiedFragments.at(-1)!);
    expect(fragment).toContain("보존할 문장");
    expect(fragment).toContain('href="https://example.com/old"');
    expect(fragment).not.toContain("남길 문장");
    expect(fragment).not.toContain("보내는 글");
    expect(await page.locator(".article-editor").textContent()).toBe(current);
    expect(await page.evaluate((key) => localStorage.getItem(key), outputKey)).toBe(originalRecord);
    await result.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath(`roundtrip-${mobile ? "mobile" : "desktop"}.png`),
    });
    await paste(page, output.html, output.plainText);
    await expect(result).toHaveCount(0);
    await dialog.getByRole("button", { name: "붙여넣기 결과 비교", exact: true }).click();
    await expect(result).toContainText("텍스트 차이가 없습니다.");
    await expect(result).toContainText("링크 그대로");
    await expect(result).toContainText("목록 그대로");
  });
}

test("keeps rich checks unknown for plain input and exposes manual recovery on denial", async ({
  page,
}) => {
  const output = await setup(page);
  const current = await page.locator(".article-editor").textContent();
  const dialog = await open(page);
  await page.getByLabel("붙여넣은 결과", { exact: true }).fill("보내는 글\n고친 문장");
  await dialog.getByRole("button", { name: "붙여넣기 결과 비교", exact: true }).click();
  const result = dialog.getByRole("region", { name: "붙여넣기 비교 결과", exact: true });
  await expect(result).toContainText("일반 텍스트만 가져왔습니다");
  await expect(result).toContainText("링크 확인할 수 없음");
  await expect(result.getByRole("region", { name: "링크 변화", exact: true })).toHaveCount(0);
  await page.evaluate(() => {
    (window as CapturedWindow).denyFragment = true;
  });
  await result.getByRole("button", { name: "복사 당시 구간 2 다시 복사", exact: true }).click();
  await expect(dialog.getByLabel("구간 복구 HTML 원문", { exact: true })).toHaveValue(
    /보존할 문장/,
  );
  await expect(dialog.getByRole("alert")).toBeVisible();
  await dialog
    .getByRole("button", { name: "원문 전체 선택", exact: true })
    .filter({ visible: true })
    .click();
  await expect(dialog.getByLabel("구간 복구 HTML 원문", { exact: true })).toBeFocused();
  expect(await page.locator(".article-editor").textContent()).toBe(current);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).html, outputKey)).toBe(
    output.html,
  );
});

test("keeps pasted markup inert, resets stale results on typing, and rejects oversized input", async ({
  page,
}) => {
  const output = await setup(page);
  const dialog = await open(page);
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("example.test")) requests.push(request.url());
  });
  await paste(
    page,
    '<p>가져온 글</p><img src="https://example.test/image" onerror="window.roundtripInjection=1"><script>window.roundtripInjection=2</script>',
  );
  await dialog.getByRole("button", { name: "붙여넣기 결과 비교", exact: true }).click();
  const result = dialog.getByRole("region", { name: "붙여넣기 비교 결과", exact: true });
  await expect(result).toContainText("가져온 글");
  expect(await page.evaluate(() => "roundtripInjection" in window)).toBe(false);
  expect(requests).toEqual([]);
  await page.getByLabel("붙여넣은 결과", { exact: true }).fill("직접 고친 글");
  await expect(result).toHaveCount(0);
  await paste(page, "글".repeat(1_500_001), "큰 글");
  await expect(dialog.getByRole("alert")).toContainText("내용이 너무 큽니다");
  await expect(
    dialog.getByRole("button", { name: "붙여넣기 결과 비교", exact: true }),
  ).toBeDisabled();
  await paste(page, output.html, output.plainText);
  await expect(
    dialog.getByRole("button", { name: "붙여넣기 결과 비교", exact: true }),
  ).toBeEnabled();
  await dialog.locator("summary").filter({ hasText: "HTML 원문을 직접 붙여넣기" }).click();
  await page.getByLabel("붙여넣은 HTML 원문", { exact: true }).fill("<p>원문으로 입력한 글</p>");
  await dialog.getByRole("button", { name: "붙여넣기 결과 비교", exact: true }).click();
  await expect(result).toContainText("원문으로 입력한 글");
});

test("recovers link-only changes and reports an isolated missing passage", async ({ page }) => {
  const output = await setup(page);
  const dialog = await open(page);
  await paste(page, output.html.replace("https://example.com/old", "https://example.com/new"));
  await dialog.getByRole("button", { name: "붙여넣기 결과 비교", exact: true }).click();
  const result = dialog.getByRole("region", { name: "붙여넣기 비교 결과", exact: true });
  await expect(result).toContainText("텍스트 차이가 없습니다.");
  await expect(result).toContainText("링크 바뀜");
  await result.locator("summary").filter({ hasText: "복사 당시 구간 선택" }).click();
  await result.getByLabel("복구할 구간 찾기", { exact: true }).fill("보존할 문장");
  await expect(result.getByRole("button", { name: /^보관한 구간 \d+ 복사$/ })).toHaveCount(1);
  await result.getByRole("button", { name: "보관한 구간 2 복사", exact: true }).click();
  expect(await page.evaluate(() => (window as CapturedWindow).copiedFragments.at(-1)!)).toContain(
    'href="https://example.com/old"',
  );
  const removed = await page.evaluate((html) => {
    const template = document.createElement("template");
    template.innerHTML = html;
    Array.from(template.content.querySelectorAll("p,td"))
      .find((element) => element.textContent === "남길 문장")!
      .remove();
    return template.innerHTML;
  }, output.html);
  await paste(page, removed);
  await dialog.getByRole("button", { name: "붙여넣기 결과 비교", exact: true }).click();
  await expect(result).toContainText("돌아오지 않은 구간");
  await expect(result).toContainText("남길 문장");
});
