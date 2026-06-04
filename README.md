# dc-code-paste

디씨인사이드 글쓰기 화면에 붙여넣을 리치 텍스트 HTML을 만드는 정적 웹 도구.
프로그래밍 강의 글처럼 설명, 팁상자, 참고 링크, 코드블록이 섞인 글을 편집한 뒤
복사해서 붙여넣는 흐름을 목표로 한다.

## Stack

- SvelteKit 2 + Svelte 5
- Tiptap / ProseMirror
- Shiki
- TypeScript with `tsgo`
- Oxlint + Oxfmt
- Bun
- GitHub Pages

## Local Setup

```sh
bun install
bun run check
bun run typecheck:go
bun run lint
bun run format:check
bun run test
bun run build
```

## GitHub Pages

The app is built with `@sveltejs/adapter-static`.

`BASE_PATH=/dc-code-paste` is set in `.github/workflows/pages.yml` so the deployed app works at:

```txt
https://0disoft.github.io/dc-code-paste/
```

## Paste Contract

The app keeps an editor document model internally, then exports inline-style HTML for rich-text
paste targets:

- Paste structure: `DC 테이블` uses table wrappers with `bgcolor` fallbacks for stricter DCInside
  paste surfaces; `기본` keeps a lighter `div` wrapper for ordinary rich-text paste targets
- Article canvas: root wrapper with an inline light background, padding, font, and text color so
  prose stays readable when pasted into DCInside dark mode
- Prose blocks: paragraph, heading, list, quote, divider
- Design blocks: `tipBox`, `warningBox`, `referenceBox`, `emphasisBox`, `linkBox`
- Code blocks: Tiptap `codeBlock` rendered through Shiki on demand

```html
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fbfaf2" style="...">
  <tbody>
    <tr>
      <td style="...">
        <p style="...">...</p>
        <table
          width="100%"
          cellpadding="0"
          cellspacing="0"
          border="0"
          bgcolor="#e6fbe4"
          style="..."
        >
          <tbody>
            <tr>
              <td style="...">...</td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  </tbody>
</table>
```

`기본` structure keeps the same content contract with simpler block wrappers:

```html
<div style="...">
  <p style="...">...</p>
  <div style="...">...</div>
  <pre style="..."><code><span style="color:oklch(...)">...</span></code></pre>
</div>
```

`디씨 복사` writes both `text/html` and `text/plain` for rich paste targets. The preview panel can
also switch to `HTML` mode, where `원문 복사` copies the exported inline HTML as plain text for
editors that expect raw HTML source.

Older `calloutBox` documents with a `kind` attribute are still accepted by the exporter, but new
editor content uses the explicit box node names above.

## Manual DC Paste Check

Before treating a release as ready, check both paste paths in a browser:

1. Start with the default sample article, which already includes a paragraph, heading, tip box,
   warning box, reference box, link box, quote, lists, divider, and code block.
2. Click `디씨 복사`, paste into the normal DCInside editor, and confirm the rendered style survives.
3. Switch the preview panel to `HTML`, click `원문 복사`, paste into DCInside's HTML mode, and confirm
   the same article renders after leaving HTML mode.
4. Confirm code colors, box spacing, links, and body font size match the preview closely enough.
