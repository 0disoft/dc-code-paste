<script lang="ts">
  import {
    AlertTriangle,
    Bold,
    BookOpen,
    Check,
    Clipboard,
    Code2,
    Heading1,
    Highlighter,
    Italic,
    Link2,
    LinkIcon,
    List,
    Loader2,
    Paintbrush,
    Quote,
    Rows3,
    SeparatorHorizontal,
    Sparkles,
    Type,
    Undo2,
    Unlink,
    Redo2
  } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import type { Editor, JSONContent } from '@tiptap/core';
  import { copyDcHtml, copyPlainText } from '$lib/dc/clipboard';
  import {
    exportDocumentToDcHtml,
    type DcExportOptions,
    type DcExportStructure
  } from '$lib/dc/export-document';
  import { sampleDocument } from '$lib/editor/sample-document';
  import {
    defaultLanguage,
    defaultTheme,
    isSupportedLanguage,
    supportedLanguages,
    supportedThemes,
    type DcLanguageId,
    type DcThemeId
  } from '$lib/highlighter/catalog';
  import {
    calloutNodeNameByKind,
    isCalloutNodeName,
    type CalloutKind
  } from '$lib/editor/callout';
  import {
    selectedInlineRangeToCalloutCommand,
    selectedInlineRangeToCodeBlockCommand,
    selectedInlineRangeToLinkBoxCommand
  } from '$lib/editor/selection-commands';
  import { normalizeEditableLinkHref } from '$lib/editor/link';

  const fontFamilies = [
    { label: '맑은 고딕', value: 'Malgun Gothic, Apple SD Gothic Neo, Segoe UI, sans-serif' },
    { label: '고운 본문', value: 'Georgia, Times New Roman, serif' },
    { label: '둥근 산스', value: 'Inter, Pretendard, Segoe UI, sans-serif' },
    { label: '코드', value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }
  ];

  const bodySizes = ['14px', '15px', '16px', '17px', '18px'];
  const codeSizes = ['13px', '14px', '15px', '16px'];
  const exportStructures: { label: string; value: DcExportStructure }[] = [
    { label: 'DC 테이블', value: 'dcTable' },
    { label: '기본', value: 'modern' }
  ];
  const swatches = [
    'oklch(23.39% 0.012 255.51)',
    'oklch(56.77% 0.154 252.96)',
    'oklch(50.61% 0.142 146.57)',
    'oklch(57.8% 0.18 31.88)',
    'oklch(47.55% 0.145 302.98)'
  ];

  let editorHost = $state<HTMLDivElement>();
  let editor = $state<Editor>();
  let documentJson = $state<JSONContent>(sampleDocument);
  let language = $state<DcLanguageId>(defaultLanguage);
  let theme = $state<DcThemeId>(defaultTheme);
  let bodyFontFamily = $state(fontFamilies[0].value);
  let bodyFontSize = $state('15px');
  let selectionFontFamily = $state(fontFamilies[0].value);
  let selectionFontSize = $state('15px');
  let codeFontSize = $state('14px');
  let showLineNumbers = $state(false);
  let exportStructure = $state<DcExportStructure>('dcTable');
  let html = $state('');
  let isRendering = $state(false);
  let previewMode = $state<'rendered' | 'source'>('rendered');
  let copyState = $state<'idle' | 'copied' | 'error'>('idle');
  let sourceCopyState = $state<'idle' | 'copied' | 'error'>('idle');
  let isLinkPanelOpen = $state(false);
  let linkDraft = $state('');
  let linkError = $state(false);
  let editorSignal = $state(0);
  let renderTurn = 0;

  const htmlSize = $derived(`${Math.max(1, Math.ceil(html.length / 1024))}KB`);
  const copyLabel = $derived(copyState === 'copied' ? '복사됨' : '디씨 복사');
  const sourceCopyLabel = $derived(sourceCopyState === 'copied' ? '복사됨' : '원문 복사');

  function exportOptions(): DcExportOptions {
    return {
      theme,
      bodyFontFamily,
      bodyFontSize,
      codeFontSize,
      showLineNumbers,
      structure: exportStructure
    };
  }

  async function renderPreview(nextDocument: JSONContent, options: DcExportOptions) {
    const turn = ++renderTurn;
    isRendering = true;

    try {
      const nextHtml = await exportDocumentToDcHtml(nextDocument, options);

      if (turn === renderTurn) {
        html = nextHtml;
      }
    } finally {
      if (turn === renderTurn) {
        isRendering = false;
      }
    }
  }

  function refreshEditorState(nextEditor: Editor) {
    documentJson = nextEditor.getJSON();
    editorSignal += 1;
  }

  function isActive(name: string, attributes?: Record<string, unknown>) {
    void editorSignal;
    return editor?.isActive(name, attributes) ?? false;
  }

  function canUndo() {
    void editorSignal;
    return editor?.can().undo() ?? false;
  }

  function canRedo() {
    void editorSignal;
    return editor?.can().redo() ?? false;
  }

  function runEditorCommand(command: (current: Editor) => boolean) {
    if (!editor) {
      return;
    }

    command(editor);
    refreshEditorState(editor);
  }

  function applyCodeBlock() {
    runEditorCommand((current) => {
      if (current.isActive('codeBlock')) {
        return current.chain().focus().toggleCodeBlock({ language }).run();
      }

      if (current.chain().focus().command(selectedInlineRangeToCodeBlockCommand(language)).run()) {
        return true;
      }

      return current.chain().focus().setCodeBlock({ language }).run();
    });
  }

  function retargetActiveCallout(current: Editor, kind: CalloutKind) {
    const targetType = current.schema.nodes[calloutNodeNameByKind[kind]];

    if (!targetType) {
      return false;
    }

    const selectionFrom = current.state.selection.$from;

    for (let depth = selectionFrom.depth; depth > 0; depth -= 1) {
      const node = selectionFrom.node(depth);

      if (isCalloutNodeName(node.type.name)) {
        current.commands.focus();
        current.view.dispatch(current.state.tr.setNodeMarkup(selectionFrom.before(depth), targetType).scrollIntoView());
        return true;
      }
    }

    return false;
  }

  function applyCallout(kind: CalloutKind) {
    runEditorCommand((current) => {
      if (retargetActiveCallout(current, kind)) {
        return true;
      }

      if (current.chain().focus().command(selectedInlineRangeToCalloutCommand(kind)).run()) {
        return true;
      }

      return current.chain().focus().wrapIn(calloutNodeNameByKind[kind]).run();
    });
  }

  function selectedText() {
    if (!editor || editor.state.selection.empty) {
      return '';
    }

    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, '\n').trim();
  }

  function retargetActiveLinkBox(current: Editor, href: string) {
    const linkBoxType = current.schema.nodes.linkBox;

    if (!linkBoxType) {
      return false;
    }

    const selectionFrom = current.state.selection.$from;

    for (let depth = selectionFrom.depth; depth > 0; depth -= 1) {
      const node = selectionFrom.node(depth);

      if (node.type.name === 'linkBox') {
        current.commands.focus();
        current.view.dispatch(current.state.tr.setNodeMarkup(selectionFrom.before(depth), linkBoxType, { href }).scrollIntoView());
        return true;
      }
    }

    return false;
  }

  function applyLinkBox() {
    const href = normalizeEditableLinkHref(linkDraft) ?? normalizeEditableLinkHref(selectedText());

    if (!href) {
      isLinkPanelOpen = true;
      linkError = true;
      return;
    }

    linkError = false;
    linkDraft = href;
    runEditorCommand((current) => {
      if (retargetActiveLinkBox(current, href)) {
        return true;
      }

      if (current.chain().focus().command(selectedInlineRangeToLinkBoxCommand(href)).run()) {
        return true;
      }

      return current
        .chain()
        .focus()
        .insertContent({
          type: 'linkBox',
          attrs: { href },
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: href }]
            }
          ]
        })
        .run();
    });
  }

  function setLink() {
    if (!editor) {
      return;
    }

    const href = normalizeEditableLinkHref(linkDraft);
    if (!href) {
      linkError = true;
      return;
    }

    linkError = false;
    linkDraft = href;
    runEditorCommand((current) => current.chain().focus().extendMarkRange('link').setLink({ href }).run());
  }

  function unsetLink() {
    linkError = false;
    linkDraft = '';
    runEditorCommand((current) => current.chain().focus().extendMarkRange('link').unsetLink().run());
  }

  function toggleLinkPanel() {
    if (!editor) {
      return;
    }

    const existing = editor.getAttributes('link').href;
    linkDraft = typeof existing === 'string' ? existing : linkDraft;
    linkError = false;
    isLinkPanelOpen = !isLinkPanelOpen;
  }

  function setTextColor(color: string) {
    runEditorCommand((current) => current.chain().focus().setColor(color).run());
  }

  function setFontFamily(value: string) {
    runEditorCommand((current) => current.chain().focus().setFontFamily(value).run());
  }

  function setFontSize(value: string) {
    runEditorCommand((current) => current.chain().focus().setFontSize(value).run());
  }

  async function copyPreview() {
    copyState = 'idle';

    try {
      await copyDcHtml(html, editor?.getText() ?? '');
      copyState = 'copied';
      window.setTimeout(() => {
        copyState = 'idle';
      }, 1300);
    } catch {
      copyState = 'error';
    }
  }

  async function copySourceHtml() {
    sourceCopyState = 'idle';

    try {
      await copyPlainText(html);
      sourceCopyState = 'copied';
      window.setTimeout(() => {
        sourceCopyState = 'idle';
      }, 1300);
    } catch {
      sourceCopyState = 'error';
    }
  }

  onMount(() => {
    let disposed = false;
    let mountedEditor: Editor | undefined;

    async function mountEditor() {
      const [{ Editor }, { createEditorExtensions }] = await Promise.all([
        import('@tiptap/core'),
        import('$lib/editor/extensions')
      ]);

      if (disposed || !editorHost) {
        return;
      }

      mountedEditor = new Editor({
        element: editorHost,
        extensions: createEditorExtensions(),
        content: sampleDocument,
        editorProps: {
          attributes: {
            class: 'article-editor',
            spellcheck: 'false'
          }
        },
        onCreate: ({ editor: current }) => {
          editor = current;
          refreshEditorState(current);
        },
        onUpdate: ({ editor: current }) => {
          refreshEditorState(current);
        },
        onSelectionUpdate: ({ editor: current }) => {
          editorSignal += 1;
          const attrs = current.getAttributes('codeBlock');
          if (typeof attrs.language === 'string' && isSupportedLanguage(attrs.language)) {
            language = attrs.language;
          }
          const linkAttrs = current.getAttributes('link');
          if (typeof linkAttrs.href === 'string') {
            linkDraft = linkAttrs.href;
          }
          const linkBoxAttrs = current.getAttributes('linkBox');
          if (typeof linkBoxAttrs.href === 'string') {
            linkDraft = linkBoxAttrs.href;
          }
          const textStyleAttrs = current.getAttributes('textStyle');
          if (typeof textStyleAttrs.fontFamily === 'string') {
            selectionFontFamily = textStyleAttrs.fontFamily;
          }
          if (typeof textStyleAttrs.fontSize === 'string') {
            selectionFontSize = textStyleAttrs.fontSize;
          }
        }
      });
    }

    void mountEditor();

    return () => {
      disposed = true;
      mountedEditor?.destroy();
    };
  });

  $effect(() => {
    void renderPreview(documentJson, exportOptions());
  });
</script>

<main class="workspace">
  <header class="topbar">
    <div>
      <p class="eyebrow">dc-code-paste</p>
      <h1>디씨 글 디자인</h1>
    </div>

    <button class="copy-button" type="button" onclick={copyPreview} disabled={!html || isRendering}>
      {#if copyState === 'copied'}
        <Check size={18} />
      {:else if isRendering}
        <span class="spin-icon"><Loader2 size={18} /></span>
      {:else}
        <Clipboard size={18} />
      {/if}
      <span>{copyLabel}</span>
    </button>
  </header>

  <section class="toolbar" aria-label="글 편집 도구">
    <div class="tool-group">
      <button
        type="button"
        title="실행 취소"
        aria-label="실행 취소"
        disabled={!canUndo()}
        onclick={() => runEditorCommand((current) => current.chain().focus().undo().run())}
      >
        <Undo2 size={17} />
      </button>
      <button
        type="button"
        title="다시 실행"
        aria-label="다시 실행"
        disabled={!canRedo()}
        onclick={() => runEditorCommand((current) => current.chain().focus().redo().run())}
      >
        <Redo2 size={17} />
      </button>
    </div>

    <div class="tool-group">
      <button
        class:active={isActive('heading', { level: 1 })}
        type="button"
        title="제목"
        aria-label="제목"
        onclick={() => runEditorCommand((current) => current.chain().focus().toggleHeading({ level: 1 }).run())}
      >
        <Heading1 size={17} />
      </button>
      <button
        class:active={isActive('paragraph')}
        type="button"
        title="문단"
        aria-label="문단"
        onclick={() => runEditorCommand((current) => current.chain().focus().setParagraph().run())}
      >
        <Rows3 size={17} />
      </button>
      <button
        class:active={isActive('bold')}
        type="button"
        title="굵게"
        aria-label="굵게"
        onclick={() => runEditorCommand((current) => current.chain().focus().toggleBold().run())}
      >
        <Bold size={17} />
      </button>
      <button
        class:active={isActive('italic')}
        type="button"
        title="기울임"
        aria-label="기울임"
        onclick={() => runEditorCommand((current) => current.chain().focus().toggleItalic().run())}
      >
        <Italic size={17} />
      </button>
      <button class:active={isActive('link') || isLinkPanelOpen} type="button" title="링크" aria-label="링크" onclick={toggleLinkPanel}>
        <Link2 size={17} />
      </button>
      <button class:active={isActive('linkBox')} type="button" title="링크박스" aria-label="링크박스" onclick={applyLinkBox}>
        <LinkIcon size={17} />
        <span>링크박스</span>
      </button>
    </div>

    {#if isLinkPanelOpen}
      <div class="tool-group link-tool">
        <label>
          <span><Link2 size={15} /> URL</span>
          <input
            class:error={linkError}
            type="url"
            bind:value={linkDraft}
            aria-label="링크 주소"
            placeholder="https://example.com"
            oninput={() => (linkError = false)}
            onkeydown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                setLink();
              }

              if (event.key === 'Escape') {
                isLinkPanelOpen = false;
                linkError = false;
              }
            }}
          />
        </label>
        <button type="button" title="적용" aria-label="적용" onclick={setLink}>
          <Check size={17} />
        </button>
        <button type="button" title="해제" aria-label="해제" onclick={unsetLink}>
          <Unlink size={17} />
        </button>
      </div>
    {/if}

    <div class="tool-group">
      <button
        class:active={isActive('bulletList')}
        type="button"
        title="목록"
        aria-label="목록"
        onclick={() => runEditorCommand((current) => current.chain().focus().toggleBulletList().run())}
      >
        <List size={17} />
      </button>
      <button
        class:active={isActive('blockquote')}
        type="button"
        title="인용"
        aria-label="인용"
        onclick={() => runEditorCommand((current) => current.chain().focus().toggleBlockquote().run())}
      >
        <Quote size={17} />
      </button>
      <button
        type="button"
        title="구분선"
        aria-label="구분선"
        onclick={() => runEditorCommand((current) => current.chain().focus().setHorizontalRule().run())}
      >
        <SeparatorHorizontal size={17} />
      </button>
      <button class:active={isActive('tipBox')} type="button" onclick={() => applyCallout('tip')}>
        <Sparkles size={17} />
        <span>팁</span>
      </button>
      <button class:active={isActive('warningBox')} type="button" onclick={() => applyCallout('warning')}>
        <AlertTriangle size={17} />
        <span>주의</span>
      </button>
      <button class:active={isActive('referenceBox')} type="button" onclick={() => applyCallout('reference')}>
        <BookOpen size={17} />
        <span>참고</span>
      </button>
      <button class:active={isActive('emphasisBox')} type="button" onclick={() => applyCallout('emphasis')}>
        <Highlighter size={17} />
        <span>강조</span>
      </button>
    </div>

    <div class="tool-group tool-group-wide">
      <button class:active={isActive('codeBlock')} type="button" onclick={applyCodeBlock}>
        <Code2 size={17} />
        <span>코드</span>
      </button>
      <label>
        <span><Rows3 size={15} /> 복붙</span>
        <select bind:value={exportStructure} aria-label="복붙 구조">
          {#each exportStructures as item}
            <option value={item.value}>{item.label}</option>
          {/each}
        </select>
      </label>
      <label>
        <span><Code2 size={15} /> 언어</span>
        <select
          bind:value={language}
          aria-label="코드 언어"
          onchange={() => runEditorCommand((current) => current.chain().focus().updateAttributes('codeBlock', { language }).run())}
        >
          {#each supportedLanguages as item}
            <option value={item.id}>{item.label}</option>
          {/each}
        </select>
      </label>
      <label>
        <span><Paintbrush size={15} /> 테마</span>
        <select bind:value={theme} aria-label="코드 테마">
          {#each supportedThemes as item}
            <option value={item.id}>{item.label}</option>
          {/each}
        </select>
      </label>
    </div>

    <div class="tool-group tool-group-wide">
      <label>
        <span><Type size={15} /> 기본</span>
        <select bind:value={bodyFontFamily} aria-label="기본 폰트">
          {#each fontFamilies as item}
            <option value={item.value}>{item.label}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>본문</span>
        <select bind:value={bodyFontSize} aria-label="기본 크기">
          {#each bodySizes as item}
            <option value={item}>{item}</option>
          {/each}
        </select>
      </label>
      <label>
        <span><Type size={15} /> 선택</span>
        <select bind:value={selectionFontFamily} aria-label="선택 폰트" onchange={() => setFontFamily(selectionFontFamily)}>
          {#each fontFamilies as item}
            <option value={item.value}>{item.label}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>크기</span>
        <select bind:value={selectionFontSize} aria-label="선택 크기" onchange={() => setFontSize(selectionFontSize)}>
          {#each bodySizes as item}
            <option value={item}>{item}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>코드</span>
        <select bind:value={codeFontSize} aria-label="코드 크기">
          {#each codeSizes as item}
            <option value={item}>{item}</option>
          {/each}
        </select>
      </label>
      <label class="switch">
        <input type="checkbox" bind:checked={showLineNumbers} />
        <span>줄번호</span>
      </label>
      <div class="swatches" aria-label="글자색">
        {#each swatches as color}
          <button
            class="swatch"
            type="button"
            title="글자색"
            aria-label="글자색"
            style={`--swatch:${color}`}
            onclick={() => setTextColor(color)}
          ></button>
        {/each}
      </div>
    </div>
  </section>

  <section class="workbench">
    <div class="editor-panel">
      <div class="panel-head">
        <div class="panel-title">
          <Type size={18} />
          <span>글쓰기</span>
        </div>
        <span class="counter">{editor?.getText().length.toLocaleString() ?? 0}자</span>
      </div>
      <div class="editor-surface" bind:this={editorHost}></div>
    </div>

    <aside class="preview-panel" aria-live="polite">
      <div class="panel-head">
        <div class="panel-title">
          {#if isRendering}
            <span class="spin-icon"><Loader2 size={18} /></span>
          {:else}
            <Check size={18} />
          {/if}
          <span>미리보기</span>
        </div>
        <div class="preview-tools">
          <div class="mode-switch" aria-label="미리보기 형식">
            <button
              class:active={previewMode === 'rendered'}
              type="button"
              aria-pressed={previewMode === 'rendered'}
              onclick={() => (previewMode = 'rendered')}
            >
              미리보기
            </button>
            <button
              class:active={previewMode === 'source'}
              type="button"
              aria-pressed={previewMode === 'source'}
              onclick={() => (previewMode = 'source')}
            >
              HTML
            </button>
          </div>
          {#if previewMode === 'source'}
            <button class="source-copy-button" type="button" onclick={copySourceHtml} disabled={!html || isRendering}>
              {#if sourceCopyState === 'copied'}
                <Check size={15} />
              {:else}
                <Clipboard size={15} />
              {/if}
              <span>{sourceCopyLabel}</span>
            </button>
          {/if}
          <span class="counter">HTML {htmlSize}</span>
        </div>
      </div>

      {#if previewMode === 'rendered'}
        <div class="preview-surface">
          {#if html}
            {@html html}
          {:else}
            <div class="empty">...</div>
          {/if}
        </div>
      {:else}
        <textarea class="html-source" readonly spellcheck="false" aria-label="복사용 HTML 원문" value={html}></textarea>
      {/if}
    </aside>
  </section>

  {#if copyState === 'error'}
    <p class="copy-error">복사가 막혔어. 브라우저 권한을 확인해줘.</p>
  {/if}

  {#if sourceCopyState === 'error'}
    <p class="copy-error">원문 복사가 막혔어. HTML 원문을 직접 선택해서 복사해줘.</p>
  {/if}
</main>

<style>
  .workspace {
    width: min(1560px, calc(100vw - 28px));
    min-height: 100vh;
    margin: 0 auto;
    padding: 22px 0 34px;
  }

  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 16px;
  }

  .eyebrow {
    margin: 0 0 4px;
    color: var(--accent);
    font-size: 13px;
    font-weight: 800;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    font-size: clamp(30px, 4vw, 52px);
    line-height: 0.98;
    letter-spacing: 0;
  }

  .copy-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    min-width: 136px;
    height: 46px;
    border: 1px solid color-mix(in oklch, var(--accent) 72%, oklch(0% 0 0));
    border-radius: 8px;
    background: var(--accent);
    color: oklch(22.89% 0.055 118.8);
    font-weight: 900;
    cursor: pointer;
  }

  .copy-button:disabled {
    cursor: wait;
    opacity: 0.72;
  }

  .toolbar {
    position: sticky;
    top: 8px;
    z-index: 20;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    max-height: calc(100vh - 16px);
    margin-bottom: 12px;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 10px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: color-mix(in oklch, var(--panel) 98%, oklch(0% 0 0 / 0));
    box-shadow: 0 18px 44px oklch(0% 0 0 / 0.18);
    scrollbar-gutter: stable;
  }

  .tool-group {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    padding-right: 8px;
    border-right: 1px solid var(--line);
  }

  .tool-group:last-child {
    border-right: 0;
  }

  .tool-group-wide {
    flex-wrap: wrap;
  }

  .toolbar button,
  .toolbar label,
  .switch {
    height: 34px;
  }

  .toolbar button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-width: 34px;
    border: 1px solid var(--line);
    border-radius: 7px;
    background: var(--panel-2);
    color: var(--text);
    font-weight: 800;
    cursor: pointer;
  }

  .toolbar button.active {
    border-color: var(--accent);
    background: color-mix(in oklch, var(--accent) 22%, var(--panel-2));
    color: var(--accent);
  }

  .toolbar button:disabled {
    cursor: not-allowed;
    opacity: 0.42;
  }

  label {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: var(--muted);
    font-size: 13px;
    font-weight: 800;
  }

  label span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  select {
    height: 34px;
    border: 1px solid var(--line);
    border-radius: 7px;
    background: var(--panel-2);
    padding: 0 9px;
  }

  input[type='url'] {
    width: min(320px, 48vw);
    height: 34px;
    border: 1px solid var(--line);
    border-radius: 7px;
    background: var(--panel-2);
    color: var(--text);
    padding: 0 10px;
  }

  input[type='url']:focus {
    border-color: var(--accent);
    outline: none;
  }

  input[type='url'].error {
    border-color: var(--danger);
    background: color-mix(in oklch, var(--danger) 12%, var(--panel-2));
  }

  .link-tool {
    flex-wrap: wrap;
  }

  .switch {
    padding: 0 10px;
    border: 1px solid var(--line);
    border-radius: 7px;
    background: var(--panel-2);
  }

  input[type='checkbox'] {
    width: 16px;
    height: 16px;
    accent-color: var(--accent);
  }

  .swatches {
    display: inline-flex;
    gap: 5px;
  }

  .toolbar .swatch {
    min-width: 24px;
    width: 24px;
    height: 24px;
    border-radius: 999px;
    background: var(--swatch);
  }

  .workbench {
    display: grid;
    grid-template-columns: minmax(0, 1.08fr) minmax(420px, 0.92fr);
    gap: 12px;
    align-items: stretch;
  }

  .editor-panel,
  .preview-panel {
    min-width: 0;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: color-mix(in oklch, var(--panel) 90%, transparent);
    box-shadow: 0 20px 70px oklch(0% 0 0 / 0.16);
  }

  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 48px;
    padding: 0 14px;
    border-bottom: 1px solid var(--line);
  }

  .panel-title {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 850;
  }

  .counter {
    color: var(--muted);
    font-size: 13px;
    font-weight: 700;
  }

  .preview-tools {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    min-width: 0;
  }

  .mode-switch {
    display: inline-grid;
    grid-template-columns: repeat(2, minmax(74px, 1fr));
    height: 32px;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 7px;
    background: var(--panel-2);
  }

  .mode-switch button {
    border: 0;
    border-right: 1px solid var(--line);
    background: transparent;
    color: var(--muted);
    font-size: 13px;
    font-weight: 850;
    cursor: pointer;
  }

  .mode-switch button:last-child {
    border-right: 0;
  }

  .mode-switch button.active {
    background: color-mix(in oklch, var(--accent) 18%, transparent);
    color: var(--accent);
  }

  .source-copy-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 32px;
    border: 1px solid var(--line);
    border-radius: 7px;
    background: var(--panel-2);
    color: var(--text);
    font-size: 13px;
    font-weight: 850;
    cursor: pointer;
    white-space: nowrap;
  }

  .source-copy-button:disabled {
    cursor: wait;
    opacity: 0.66;
  }

  .editor-surface {
    min-height: 680px;
    padding: 18px;
    background: oklch(97.12% 0.012 97.41);
    color: oklch(21.18% 0.012 255.31);
  }

  .editor-surface :global(.article-editor) {
    min-height: 640px;
    outline: none;
    font-family: Malgun Gothic, Apple SD Gothic Neo, Segoe UI, sans-serif;
    font-size: 15px;
    line-height: 1.7;
  }

  .editor-surface :global(.article-editor > *:first-child) {
    margin-top: 0;
  }

  .editor-surface :global(.article-editor h1) {
    margin: 0 0 14px;
    color: oklch(24.19% 0.019 255.77);
    font-size: 28px;
    line-height: 1.22;
  }

  .editor-surface :global(.article-editor p) {
    margin: 0 0 14px;
  }

  .editor-surface :global(.article-editor pre) {
    margin: 0 0 16px;
    overflow: auto;
    border-radius: 7px;
    background: oklch(18.22% 0.017 258.21);
    color: oklch(90.2% 0.018 258.33);
    padding: 14px 16px;
  }

  .editor-surface :global(.article-editor code) {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  .editor-surface :global(.article-editor :not(pre) > code) {
    border-radius: 4px;
    background: oklch(94.93% 0.016 255.07);
    color: oklch(34.86% 0.087 278.64);
    padding: 1px 4px;
  }

  .editor-surface :global(.dc-callout) {
    margin: 0 0 16px;
    padding: 12px 14px;
    border-radius: 7px;
  }

  .editor-surface :global(.dc-callout-tip) {
    border-left: 4px solid oklch(70.89% 0.156 142.5);
    background: oklch(96.48% 0.047 142.49);
    color: oklch(30.18% 0.073 145.31);
  }

  .editor-surface :global(.dc-callout-warning) {
    border-left: 4px solid oklch(73.08% 0.151 60.74);
    background: oklch(96.87% 0.048 75.17);
    color: oklch(34.21% 0.082 52.58);
  }

  .editor-surface :global(.dc-callout-reference) {
    border-left: 4px solid oklch(68.74% 0.127 246.28);
    background: oklch(96.27% 0.036 247.39);
    color: oklch(32.26% 0.07 249.42);
  }

  .editor-surface :global(.dc-callout-emphasis) {
    border-left: 4px solid oklch(64.73% 0.162 303.08);
    background: oklch(96.21% 0.036 302.35);
    color: oklch(33.84% 0.091 303.69);
  }

  .editor-surface :global(.dc-link-box) {
    margin: 0 0 16px;
    padding: 12px 14px;
    border: 1px solid oklch(78.06% 0.088 247.23);
    border-left: 4px solid oklch(56.77% 0.154 252.96);
    border-radius: 7px;
    background: oklch(97.5% 0.025 247.64);
    color: oklch(28.43% 0.052 249.88);
  }

  .preview-surface {
    min-height: 680px;
    padding: 18px;
    overflow: auto;
    background: oklch(98.38% 0.01 97.33);
  }

  .html-source {
    display: block;
    width: 100%;
    min-height: 680px;
    resize: vertical;
    border: 0;
    border-radius: 0 0 8px 8px;
    background: oklch(17.93% 0.016 257.1);
    color: oklch(91.18% 0.019 247.75);
    padding: 18px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 13px;
    line-height: 1.6;
    outline: none;
    white-space: pre;
  }

  .preview-surface :global(pre) {
    max-width: 100%;
  }

  .empty {
    color: oklch(51.52% 0.02 87.11);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  .copy-error {
    margin: 14px 0 0;
    color: var(--danger);
    font-weight: 800;
  }

  .spin-icon {
    display: inline-flex;
    animation: spin 0.85s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 1120px) {
    .workbench {
      grid-template-columns: 1fr;
    }

    .preview-panel {
      min-width: 0;
    }
  }

  @media (max-width: 720px) {
    .workspace {
      width: min(100vw - 18px, 720px);
      padding-top: 16px;
    }

    .topbar {
      align-items: flex-start;
      flex-direction: column;
    }

    .copy-button {
      width: 100%;
    }

    .tool-group {
      width: 100%;
      border-right: 0;
      border-bottom: 1px solid var(--line);
      padding: 0 0 8px;
    }

    .tool-group:last-child {
      border-bottom: 0;
      padding-bottom: 0;
    }

    .editor-surface,
    .preview-surface,
    .html-source {
      min-height: 460px;
    }

    .panel-head {
      align-items: flex-start;
      flex-direction: column;
      padding: 11px 14px;
    }

    .preview-tools {
      width: 100%;
      flex-wrap: wrap;
      justify-content: space-between;
    }

    .editor-surface :global(.article-editor) {
      min-height: 420px;
    }
  }
</style>
