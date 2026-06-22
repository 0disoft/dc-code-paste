<script lang="ts">
    import { Check, Clipboard, Github, Loader2, Type } from "lucide-svelte";
    import { setContext } from "svelte";
    import { createWorkspaceState } from "$lib/state/workspace.svelte";
    import { WORKSPACE_CONTEXT_KEY } from "$lib/state/workspace-context";
    import StoragePanel from "$lib/components/StoragePanel.svelte";
    import MarkdownPanel from "$lib/components/MarkdownPanel.svelte";
    import LLMPanel from "$lib/components/LLMPanel.svelte";
    import Toolbar from "$lib/components/Toolbar.svelte";

    const workspace = createWorkspaceState();
    setContext(WORKSPACE_CONTEXT_KEY, workspace);
</script>


<main class="workspace">
    <div class="toolbar-shell">
    <Toolbar />

    {#if workspace.isStoragePanelOpen}
        <StoragePanel
            bind:presetName={workspace.presetName}
            bind:renameDraft={workspace.renameDraft}
            presetState={workspace.presetState}
            presetStateLabel={workspace.presetStateLabel}
            presets={workspace.presets}
            draftHistory={workspace.draftHistory}
            draftHistoryState={workspace.draftHistoryState}
            draftHistoryStateLabel={workspace.draftHistoryStateLabel}
            renameTarget={workspace.renameTarget}
            onClose={() => (workspace.isStoragePanelOpen = false)}
            onPresetNameInput={() => (workspace.presetState = "idle")}
            onSavePreset={workspace.saveCurrentPreset}
            onApplyPreset={(preset, event) =>
                workspace.scheduleCardApply(() => workspace.applyPreset(preset), event)}
            onBeginPresetRename={workspace.beginPresetRename}
            onSavePresetRename={workspace.savePresetRename}
            onDeletePreset={workspace.deletePreset}
            onSaveDraftHistory={() =>
                workspace.saveDraftHistorySnapshot({ automatic: false })}
            onRestoreDraftHistory={(snapshot, event) =>
                workspace.scheduleCardApply(
                    () => workspace.restoreDraftHistorySnapshot(snapshot),
                    event,
                )}
            onBeginDraftHistoryRename={workspace.beginDraftHistoryRename}
            onSaveDraftHistoryRename={workspace.saveDraftHistoryRename}
            onDeleteDraftHistory={workspace.deleteDraftHistory}
            onCancelRename={workspace.cancelRename}
            presetDateLabel={workspace.presetDateLabel}
            draftHistoryName={workspace.draftHistoryName}
            draftHistorySummary={workspace.draftHistorySummary}
        />
    {/if}

    {#if workspace.isLlmPanelOpen}
        <LLMPanel
            llmProvider={workspace.llmProvider}
            llmProviders={workspace.llmProviders}
            bind:llmModel={workspace.llmModel}
            bind:llmApiKey={workspace.llmApiKey}
            bind:llmUserPrompt={workspace.llmUserPrompt}
            shouldShowLlmModelAutocomplete={workspace.shouldShowLlmModelAutocomplete}
            activeLlmModelAutocompleteOptions={workspace.activeLlmModelAutocompleteOptions}
            isOpenRouterTopWeeklyOnly={workspace.isOpenRouterTopWeeklyOnly}
            openRouterModelState={workspace.openRouterModelState}
            openRouterModelError={workspace.openRouterModelError}
            openRouterModelStateLabel={workspace.openRouterModelStateLabel}
            openCodeGoModelStateLabel={workspace.openCodeGoModelStateLabel}
            activeLlmProvider={workspace.activeLlmProvider}
            llmGenerationState={workspace.llmGenerationState}
            llmGenerationError={workspace.llmGenerationError}
            llmGenerationStateLabel={workspace.llmGenerationStateLabel}
            isLlmGenerateDisabled={workspace.isLlmGenerateDisabled}
            onSelectProvider={workspace.selectLlmProvider}
            onInputModel={workspace.updateLlmModel}
            onSelectModel={workspace.selectLlmModel}
            onFocusModelInput={() => (workspace.isLlmModelAutocompleteOpen = true)}
            onBlurModelInput={workspace.closeLlmModelAutocompleteSoon}
            onSetOpenRouterTopWeeklyOnly={workspace.setOpenRouterTopWeeklyOnly}
            onRefreshModels={workspace.refreshOpenRouterModels}
            onInputApiKey={() => (workspace.llmGenerationState = "idle")}
            onChangeApiKey={() => {
                workspace.llmGenerationState = "idle";
                if (workspace.llmProvider === "openrouter") {
                    void workspace.refreshOpenRouterModels();
                }
            }}
            onInputPrompt={() => (workspace.llmGenerationState = "idle")}
            onGenerate={workspace.generateMarkdownWithLlm}
            onClose={() => (workspace.isLlmPanelOpen = false)}
        />
    {/if}

    {#if workspace.isMarkdownPanelOpen}
        <MarkdownPanel
            bind:markdownDraft={workspace.markdownDraft}
            markdownImportState={workspace.markdownImportState}
            markdownImportStateLabel={workspace.markdownImportStateLabel}
            onimport={workspace.importMarkdownDraft}
            onclear={workspace.clearMarkdownDraft}
            onclose={() => (workspace.isMarkdownPanelOpen = false)}
            oninput={workspace.resetMarkdownImportState}
        />
    {/if}
    </div>

    <section class="workbench">
        <div class="editor-panel">
            <div class="panel-head">
                <div class="panel-title">
                    <Type size={18} />
                    <span>글쓰기</span>
                </div>
                <span class="counter"
                    >{workspace.editor?.getText().length.toLocaleString() ?? 0}자</span
                >
            </div>
            <div
                class="editor-surface"
                class:editor-surface-dark={workspace.documentTheme === "darkEditorial"}
                style={`--editor-body-font-size:${workspace.bodyFontSize};--editor-code-font-size:${workspace.codeFontSize}`}
                bind:this={workspace.editorHost}
            ></div>
            {#if workspace.codeLineContextMenu}
                <div
                    class="code-line-context-menu"
                    role="menu"
                    tabindex="-1"
                    aria-label={`코드 ${workspace.codeLineRangeLabel(workspace.codeLineContextMenu.range)}`}
                    style={`left:${workspace.codeLineContextMenu.x}px;top:${workspace.codeLineContextMenu.y}px`}
                    bind:this={workspace.codeLineContextMenuElement}
                    onpointerdown={(event) => event.stopPropagation()}
                >
                    <span class="code-line-context-title"
                        >{workspace.codeLineRangeLabel(workspace.codeLineContextMenu.range)}</span
                    >
                    {#each workspace.codeLineMarkers as marker}
                        <button
                            class:active={workspace.codeLineContextMenuActive(marker)}
                            type="button"
                            role="menuitem"
                            onclick={() => workspace.toggleCodeLineMarker(marker)}
                        >
                            {workspace.codeLineMarkerLabel(marker)}
                        </button>
                    {/each}
                </div>
            {/if}
        </div>

        <aside class="preview-panel" aria-live="polite">
            <div class="panel-head">
                <div class="panel-title">
                    {#if workspace.isRendering}
                        <span class="spin-icon"><Loader2 size={18} /></span>
                    {:else}
                        <Check size={18} />
                    {/if}
                    <span>미리보기</span>
                </div>
                <div class="preview-tools">
                    <span class="status-pill" aria-label="현재 복붙 구조">DC 테이블</span>
                    <span class="status-pill" aria-label="현재 글 배경"
                        >{workspace.documentThemeLabel}</span
                    >
                    <div class="mode-switch" aria-label="미리보기 형식">
                        <button
                            class:active={workspace.previewMode === "rendered"}
                            type="button"
                            aria-pressed={workspace.previewMode === "rendered"}
                            onclick={() => (workspace.previewMode = "rendered")}
                        >
                            미리보기
                        </button>
                        <button
                            class:active={workspace.previewMode === "source"}
                            type="button"
                            aria-pressed={workspace.previewMode === "source"}
                            onclick={() => (workspace.previewMode = "source")}
                        >
                            HTML
                        </button>
                    </div>
                    {#if workspace.previewMode === "source"}
                        <button
                            class="source-copy-button"
                            type="button"
                            onclick={workspace.copySourceHtml}
                            disabled={!workspace.html || workspace.isRendering}
                        >
                            {#if workspace.sourceCopyState === "copied"}
                                <Check size={15} />
                            {:else}
                                <Clipboard size={15} />
                            {/if}
                            <span>{workspace.sourceCopyLabel}</span>
                        </button>
                    {/if}
                    <span class="counter">HTML {workspace.htmlSize}</span>
                </div>
            </div>

            {#if workspace.previewMode === "rendered"}
                <div
                    class="preview-surface"
                    class:preview-surface-dark={workspace.documentTheme ===
                        "darkEditorial"}
                >
                    {#if workspace.html}
                        {@html workspace.html}
                    {/if}
                </div>
            {:else}
                <textarea
                    class="html-source"
                    readonly
                    spellcheck="false"
                    aria-label="복사용 HTML 원문"
                    value={workspace.html}
                ></textarea>
            {/if}
        </aside>
    </section>

    {#if workspace.copyState === "error"}
        <p class="copy-error">복사가 막혔어. 브라우저 권한을 확인해줘.</p>
    {/if}

    {#if workspace.sourceCopyState === "error"}
        <p class="copy-error">
            원문 복사가 막혔어. HTML 원문을 직접 선택해서 복사해줘.
        </p>
    {/if}

    <a
        class="floating-github-link"
        href="https://github.com/0disoft/dc-code-paste"
        target="_blank"
        rel="noopener noreferrer"
        title="GitHub 저장소"
        aria-label="GitHub 저장소 새 탭으로 열기"
    >
        <Github size={21} />
    </a>
</main>

<style>    .workspace {
        width: min(1560px, calc(100vw - 28px));
        min-height: 100vh;
        margin: 0 auto;
        padding: 10px 0 34px;
    }

    .toolbar-shell {
        position: sticky;
        top: 8px;
        z-index: 20;
        display: grid;
        gap: 5px;
        max-height: calc(100vh - 16px);
        margin-bottom: 8px;
        overflow: auto;
        overscroll-behavior: contain;
        scrollbar-gutter: stable;
    }

    .floating-github-link {
        position: fixed;
        left: 12px;
        bottom: 12px;
        z-index: 35;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        border: 1px solid color-mix(in oklch, var(--line) 82%, transparent);
        border-radius: 999px;
        background: color-mix(in oklch, var(--panel) 92%, transparent);
        color: var(--muted);
        box-shadow: 0 16px 34px oklch(0% 0 0 / 0.2);
        text-decoration: none;
        backdrop-filter: blur(10px);
        transition:
            border-color 0.16s ease,
            color 0.16s ease,
            transform 0.16s ease;
    }

    .floating-github-link:hover,
    .floating-github-link:focus-visible {
        border-color: color-mix(in oklch, var(--accent) 68%, var(--line));
        color: var(--accent);
        transform: translateY(-1px);
        outline: none;
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

    .status-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 28px;
        padding: 0 9px;
        border: 1px solid color-mix(in oklch, var(--accent-2) 46%, var(--line));
        border-radius: 999px;
        background: color-mix(in oklch, var(--accent-2) 13%, var(--panel-2));
        color: color-mix(in oklch, var(--accent-2) 70%, var(--text));
        font-size: 12px;
        font-weight: 850;
        white-space: nowrap;
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
        cursor: not-allowed;
        opacity: 0.66;
    }

    .editor-surface {
        min-height: 680px;
        padding: 18px;
        background: oklch(97.12% 0.012 97.41);
        color: oklch(21.18% 0.012 255.31);
    }

    .editor-surface-dark {
        background: oklch(7.2% 0.012 94.1);
        color: oklch(94.12% 0.012 93.37);
    }

    .code-line-context-menu {
        position: fixed;
        z-index: 50;
        display: grid;
        min-width: 176px;
        gap: 4px;
        padding: 7px;
        border: 1px solid var(--line);
        border-radius: 7px;
        background: var(--panel);
        box-shadow: 0 14px 34px oklch(0% 0 0 / 0.32);
    }

    .code-line-context-title {
        padding: 5px 7px 4px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.2;
    }

    .code-line-context-menu button {
        justify-content: flex-start;
        min-height: 32px;
        border: 1px solid transparent;
        border-radius: 6px;
        background: transparent;
        color: var(--text);
        font-size: 14px;
        font-weight: 500;
    }

    .code-line-context-menu button:hover,
    .code-line-context-menu button.active {
        border-color: color-mix(in oklch, var(--accent) 48%, transparent);
        background: color-mix(in oklch, var(--accent) 16%, transparent);
        color: var(--accent);
    }

    .editor-surface :global(.article-editor) {
        min-height: 640px;
        outline: none;
        font-family:
            Pretendard,
            Noto Sans KR,
            Noto Sans CJK KR,
            본고딕,
            Nanum Gothic,
            NanumSquare Neo,
            나눔고딕,
            나눔스퀘어,
            나눔바른고딕,
            AppleGothic,
            Segoe UI,
            Malgun Gothic,
            맑은 고딕,
            Noto Sans,
            Arial,
            Helvetica Neue,
            Helvetica,
            sans-serif;
        font-size: var(--editor-body-font-size, 17px);
        line-height: 1.7;
        overflow-wrap: break-word;
        word-break: keep-all;
    }

    .editor-surface :global(.article-editor > *:first-child) {
        margin-top: 0;
    }

    .editor-surface :global(.article-editor h1) {
        margin: 0 0 14px;
        color: oklch(24.19% 0.019 255.77);
        font-size: 26px;
        font-weight: 700;
        line-height: 1.22;
    }

    .editor-surface-dark :global(.article-editor h1) {
        color: oklch(98.32% 0.006 93.08);
    }

    .editor-surface :global(.article-editor p) {
        margin: 0 0 14px;
    }

    .editor-surface-dark :global(.article-editor a) {
        color: oklch(83.57% 0.141 84.66);
    }

    .editor-surface :global(.article-editor pre) {
        position: relative;
        margin: 0 0 16px;
        overflow: auto;
        border: 1px solid oklch(25.36% 0.021 258.42);
        border-radius: 7px;
        background: oklch(18.22% 0.017 258.21);
        color: oklch(90.2% 0.018 258.33);
        padding: 14px 16px;
        box-shadow: inset 0 1px 0 oklch(100% 0 0 / 0.04);
        font-size: var(--editor-code-font-size, 15px);
        line-height: 1.4;
        font-family:
            Cascadia Mono,
            D2Coding,
            나눔고딕코딩,
            Noto Sans Mono CJK,
            JetBrains Mono,
            Fira Code,
            Hack,
            Source Code Pro,
            IBM Plex Mono,
            Roboto Mono,
            Consolas,
            Menlo,
            Monaco,
            monospace;
        overflow-wrap: normal;
        word-break: normal;
    }

    .editor-surface :global(.article-editor pre.dc-editor-code[data-filename]) {
        padding-top: 46px;
    }

    .editor-surface
        :global(.article-editor pre.dc-editor-code[data-filename]::before) {
        position: absolute;
        top: 0;
        right: 0;
        left: 0;
        display: block;
        padding: 8px 16px;
        border-bottom: 1px solid oklch(28.89% 0.019 258.78);
        background: oklch(13.54% 0.017 258.36);
        color: oklch(92.34% 0.018 258.5);
        content: attr(data-filename);
        font-size: 13px;
        font-weight: 800;
        line-height: 1.1;
        cursor: text;
    }

    .editor-surface :global(.article-editor pre code) {
        display: block;
        min-width: max-content;
        font-family: inherit;
    }

    .editor-surface :global(.article-editor .dc-code-line) {
        display: inline-block;
        width: 100%;
        margin-right: -100%;
        height: 1.4em;
        pointer-events: none;
        vertical-align: top;
    }

    .editor-surface :global(.article-editor .dc-code-line-highlight) {
        background: oklch(38.8% 0.126 91.8 / 0.9);
    }

    .editor-surface :global(.article-editor .dc-code-line-addition) {
        background: oklch(31.8% 0.115 145.18 / 0.94);
    }

    .editor-surface :global(.article-editor .dc-code-line-deletion) {
        background: oklch(32.2% 0.125 24.13 / 0.94);
    }

    .editor-surface :global(.article-editor .dc-code-token-keyword) {
        color: oklch(74.26% 0.139 304.74);
        font-weight: 800;
    }

    .editor-surface :global(.article-editor .dc-code-token-string) {
        color: oklch(78.2% 0.144 145.22);
    }

    .editor-surface :global(.article-editor .dc-code-token-comment) {
        color: oklch(62.18% 0.027 257.46);
        font-style: italic;
    }

    .editor-surface :global(.article-editor .dc-code-token-number) {
        color: oklch(80.21% 0.118 69.52);
    }

    .editor-surface :global(.article-editor .dc-code-token-function) {
        color: oklch(78.12% 0.098 235.62);
        font-weight: 700;
    }

    .editor-surface :global(.article-editor :not(pre) > code) {
        border-radius: 4px;
        background: oklch(94.93% 0.016 255.07);
        color: oklch(34.86% 0.087 278.64);
        font-family:
            D2Coding,
            Pretendard,
            Cascadia Mono,
            나눔고딕코딩,
            Noto Sans Mono CJK,
            JetBrains Mono,
            Fira Code,
            Hack,
            Source Code Pro,
            IBM Plex Mono,
            Roboto Mono,
            Consolas,
            Menlo,
            Monaco,
            monospace;
        font-weight: 700;
        padding: 1px 4px;
    }

    .editor-surface-dark :global(.article-editor :not(pre) > code) {
        background: oklch(18.92% 0.02 83.18);
        color: oklch(96.51% 0.015 91.73);
    }

    .editor-surface :global(.article-editor blockquote) {
        position: relative;
        margin: 0 0 18px;
        padding: 13px 16px 13px 48px;
        border-left: 3px solid oklch(61.2% 0.049 77.83);
        border-top: 1px solid oklch(61.2% 0.049 77.83);
        border-bottom: 1px solid oklch(61.2% 0.049 77.83);
        color: oklch(37.24% 0.026 77.36);
        font-style: italic;
    }

    .editor-surface
        :global(.article-editor blockquote[data-quote-style="academic"]) {
        padding: 12px 16px;
        border-left: 4px solid oklch(61.2% 0.049 77.83);
        border-top: 1px solid oklch(83.11% 0.026 78.4);
        border-bottom: 1px solid oklch(83.11% 0.026 78.4);
        color: oklch(37.24% 0.026 77.36);
        font-style: normal;
    }

    .editor-surface
        :global(
            .article-editor blockquote[data-quote-style="academic"]::before
        ) {
        position: static;
        display: block;
        margin: 0 0 7px;
        color: oklch(43.22% 0.022 255.32);
        content: "QUOTE";
        font-size: 12px;
        font-weight: 900;
        line-height: 1.2;
    }

    .editor-surface
        :global(.article-editor blockquote[data-quote-style="pull"]) {
        margin: 20px 0;
        padding: 18px 20px;
        border: 0;
        border-top: 1px solid oklch(86.22% 0.014 255.48);
        border-bottom: 1px solid oklch(86.22% 0.014 255.48);
        color: oklch(24.19% 0.019 255.77);
        font-size: 21px;
        font-style: normal;
        font-weight: 900;
        line-height: 1.48;
        text-align: center;
    }

    .editor-surface
        :global(.article-editor blockquote[data-quote-style="pull"]::before) {
        display: none;
    }

    .editor-surface
        :global(.article-editor blockquote[data-quote-style="bigQuote"]) {
        padding: 18px 18px 16px;
        border: 1px solid oklch(61.2% 0.049 77.83);
        border-left: 4px solid oklch(61.2% 0.049 77.83);
        background: oklch(98.38% 0.01 97.33);
    }

    .editor-surface
        :global(
            .article-editor blockquote[data-quote-style="bigQuote"]::before
        ) {
        position: static;
        display: block;
        margin: 0 0 4px;
        font-size: 56px;
        line-height: 0.82;
    }

    .editor-surface-dark
        :global(.article-editor blockquote[data-quote-style="academic"]) {
        border-left-color: oklch(84.08% 0.11 84.51);
        border-top-color: oklch(35.04% 0.033 84.06);
        border-bottom-color: oklch(35.04% 0.033 84.06);
        color: oklch(87.91% 0.018 86.38);
    }

    .editor-surface-dark
        :global(
            .article-editor blockquote[data-quote-style="academic"]::before
        ) {
        color: oklch(71.26% 0.021 84.88);
    }

    .editor-surface-dark
        :global(.article-editor blockquote[data-quote-style="pull"]) {
        border-top-color: oklch(34.91% 0.033 83.29);
        border-bottom-color: oklch(34.91% 0.033 83.29);
        color: oklch(98.32% 0.006 93.08);
    }

    .editor-surface-dark
        :global(.article-editor blockquote[data-quote-style="bigQuote"]) {
        border-color: oklch(84.08% 0.11 84.51);
        border-left-color: oklch(84.08% 0.11 84.51);
        background: oklch(9.76% 0.011 94.84);
    }

    .editor-surface :global(.article-editor blockquote::before) {
        position: absolute;
        top: 10px;
        left: 16px;
        color: oklch(74.61% 0.063 77.91);
        content: "“";
        font-size: 34px;
        font-style: normal;
        font-weight: 900;
        line-height: 1;
    }

    .editor-surface :global(.article-editor blockquote p) {
        margin: 0 0 8px;
        color: inherit;
    }

    .editor-surface :global(.article-editor blockquote > *:last-child) {
        margin-bottom: 0;
    }

    .editor-surface :global(.dc-section-heading) {
        margin: 24px 0 14px;
        padding: 4px 0 4px 14px;
        border-left: 4px solid oklch(61.2% 0.049 77.83);
        color: oklch(25.72% 0.021 255.63);
        font-size: 20px;
        font-weight: 900;
        line-height: 1.35;
    }

    .editor-surface-dark :global(.dc-section-heading) {
        border-left-color: oklch(88.91% 0.091 87.72);
        color: oklch(97.22% 0.008 92.87);
    }

    .editor-surface :global(.article-editor .dc-cta-button) {
        display: inline-block;
        margin: 0 10px 16px 0;
        padding: 11px 22px;
        border: 1px solid oklch(70.74% 0.08 82.27);
        background: oklch(93.5% 0.044 88.16);
        color: oklch(26.32% 0.03 80.84);
        font-weight: 900;
        line-height: 1.2;
        text-decoration: none;
    }

    .editor-surface-dark :global(.article-editor .dc-cta-button) {
        border-color: oklch(96.28% 0.022 90.84);
        background: oklch(91.44% 0.064 90.52);
        color: oklch(13.77% 0.018 87.82);
    }

    .editor-surface :global(.article-editor .dc-cta-group) {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        margin: 0 0 16px;
    }

    .editor-surface
        :global(.article-editor .dc-cta-group[data-layout="vertical"]) {
        align-items: flex-start;
        flex-direction: column;
    }

    .editor-surface :global(.article-editor .dc-cta-group .dc-cta-button) {
        margin: 0;
    }

    .editor-surface :global(.dc-reference-list) {
        margin: 0 0 16px;
        padding: 0;
        overflow: hidden;
        border: 1px solid oklch(78.06% 0.088 247.23);
        border-left: 4px solid oklch(56.77% 0.154 252.96);
        border-radius: 7px;
        background: oklch(97.5% 0.025 247.64);
        color: oklch(28.43% 0.052 249.88);
        list-style: none;
    }

    .editor-surface :global(.dc-reference-item) {
        display: grid;
        grid-template-columns: 34px minmax(0, 1fr);
        gap: 10px;
        align-items: center;
        margin: 0;
        padding: 11px 14px 11px 12px;
        border-bottom: 1px solid oklch(88.91% 0.035 247.16);
        line-height: 1.18;
    }

    .editor-surface :global(.dc-reference-item:last-child) {
        border-bottom: 0;
    }

    .editor-surface :global(.dc-reference-item::before) {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 30px;
        height: 18px;
        border-radius: 4px;
        background: oklch(56.77% 0.154 252.96);
        color: oklch(99.21% 0.006 247.8);
        content: counter(list-item, decimal-leading-zero);
        font-size: 11px;
        font-weight: 900;
        line-height: 18px;
        align-self: center;
    }

    .editor-surface :global(.dc-reference-item a) {
        display: inline-block;
        margin: 0;
        line-height: 1.18;
        vertical-align: middle;
    }

    .editor-surface-dark :global(.dc-reference-list) {
        border-color: oklch(34.06% 0.044 236.72);
        border-left-color: oklch(74.22% 0.14 232.34);
        background: oklch(9.8% 0.014 94.7);
        color: oklch(91.87% 0.029 233.82);
    }

    .editor-surface-dark :global(.dc-reference-item) {
        border-bottom-color: oklch(24.21% 0.025 236.68);
    }

    .editor-surface-dark :global(.dc-reference-item::before) {
        background: oklch(74.22% 0.14 232.34);
        color: oklch(8.61% 0.019 237.62);
    }

    .editor-surface :global(.dc-summary-box) {
        margin: 0 0 18px;
        padding: 14px 16px;
        border: 1px solid oklch(84.22% 0.041 88.36);
        border-top: 4px solid oklch(61.2% 0.049 77.83);
        border-radius: 7px;
        background: oklch(97.68% 0.02 91.92);
        color: oklch(25.72% 0.021 255.63);
    }

    .editor-surface :global(.dc-summary-box::before) {
        display: block;
        margin: 0 0 9px;
        color: oklch(36.42% 0.042 78.12);
        content: attr(data-label);
        font-size: 12px;
        font-weight: 900;
        line-height: 1.2;
    }

    .editor-surface :global(.dc-summary-list) {
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .editor-surface :global(.dc-summary-item) {
        position: relative;
        margin: 0 0 7px;
        padding-left: 28px;
        line-height: 1.62;
        list-style: none;
        min-width: 0;
    }

    .editor-surface :global(.dc-summary-item:last-child) {
        margin-bottom: 0;
    }

    .editor-surface :global(.dc-summary-item::before) {
        position: absolute;
        top: 0.81em;
        left: 0;
        width: 8px;
        height: 8px;
        transform: translateY(-50%);
        border-radius: 999px;
        background: oklch(61.2% 0.049 77.83);
        content: "";
    }

    .editor-surface-dark :global(.dc-summary-box) {
        border-color: oklch(36.21% 0.032 84.68);
        border-top-color: oklch(84.08% 0.11 84.51);
        background: oklch(10.18% 0.015 94.76);
        color: oklch(94.12% 0.012 93.37);
    }

    .editor-surface-dark :global(.dc-summary-box::before) {
        color: oklch(88.91% 0.091 87.72);
    }

    .editor-surface-dark :global(.dc-summary-item::before) {
        background: oklch(84.08% 0.11 84.51);
    }

    .editor-surface :global(.dc-hero-block) {
        margin: 0 0 22px;
        padding: 22px 24px;
        border: 1px solid oklch(84.22% 0.041 88.36);
        border-top: 4px solid oklch(61.2% 0.049 77.83);
        background: oklch(97.68% 0.02 91.92);
        color: oklch(24.19% 0.019 255.77);
    }

    .editor-surface :global(.dc-hero-rule) {
        display: none;
    }

    .editor-surface :global(.dc-hero-label) {
        display: block;
        margin: 0 0 16px;
        color: oklch(45.61% 0.026 79.44);
        font-size: 12px;
        font-weight: 900;
        line-height: 1.2;
    }

    .editor-surface :global(.dc-hero-body h1) {
        margin: 0 0 12px;
        color: oklch(24.19% 0.019 255.77);
        font-size: 28px;
        font-weight: 700;
        line-height: 1.22;
    }

    .editor-surface :global(.dc-hero-body p) {
        margin: 0;
        color: oklch(43.22% 0.022 255.32);
        font-size: 17px;
        font-weight: 700;
        line-height: 1.62;
    }

    .editor-surface-dark :global(.dc-hero-block) {
        border-color: oklch(28.12% 0.03 83.2);
        border-top-color: oklch(84.08% 0.11 84.51);
        background: oklch(6.62% 0.012 94.34);
        color: oklch(98.32% 0.006 93.08);
    }

    .editor-surface-dark :global(.dc-hero-label) {
        color: oklch(84.08% 0.11 84.51);
    }

    .editor-surface-dark :global(.dc-hero-body h1) {
        color: oklch(98.32% 0.006 93.08);
    }

    .editor-surface-dark :global(.dc-hero-body p) {
        color: oklch(78.72% 0.023 86.9);
    }

    .editor-surface :global(.dc-tutorial-block) {
        counter-reset: dc-tutorial-step;
        display: grid;
        gap: 12px;
        margin: 0 0 18px;
    }

    .editor-surface :global(.dc-tutorial-step) {
        counter-increment: dc-tutorial-step;
        padding: 14px 16px;
        border: 1px solid oklch(85.31% 0.027 84.92);
        border-left: 4px solid oklch(61.2% 0.049 77.83);
        border-radius: 7px;
        background: oklch(99.1% 0.009 93.08);
        color: oklch(31.82% 0.02 255.28);
    }

    .editor-surface :global(.dc-tutorial-head) {
        display: grid;
        grid-template-columns: 42px minmax(0, 1fr);
        gap: 0;
        align-items: center;
        margin: 0 0 8px;
    }

    .editor-surface :global(.dc-tutorial-number::before) {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 34px;
        height: 22px;
        border-radius: 4px;
        background: oklch(61.2% 0.049 77.83);
        color: oklch(99.1% 0.006 93.08);
        content: attr(data-number);
        font-size: 12px;
        font-weight: 900;
        line-height: 22px;
    }

    .editor-surface :global(.dc-tutorial-number:not([data-number])::before) {
        content: counter(dc-tutorial-step, decimal-leading-zero);
    }

    .editor-surface :global(.dc-tutorial-title) {
        color: oklch(25.72% 0.021 255.63);
        font-size: 18px;
        font-weight: 900;
        line-height: 1.32;
    }

    .editor-surface :global(.dc-tutorial-body) {
        padding-left: 34px;
    }

    .editor-surface :global(.dc-tutorial-body > *:last-child) {
        margin-bottom: 0;
    }

    .editor-surface-dark :global(.dc-tutorial-step) {
        border-color: oklch(34.91% 0.033 83.29);
        border-left-color: oklch(84.08% 0.11 84.51);
        background: oklch(12.04% 0.017 94.12);
        color: oklch(88.62% 0.016 91.83);
    }

    .editor-surface-dark :global(.dc-tutorial-number::before) {
        background: oklch(84.08% 0.11 84.51);
        color: oklch(10.18% 0.015 94.76);
    }

    .editor-surface-dark :global(.dc-tutorial-title) {
        color: oklch(97.22% 0.008 92.87);
    }

    .editor-surface :global(.dc-comparison-block) {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin: 0 0 18px;
    }

    .editor-surface :global(.dc-comparison-column) {
        min-width: 0;
        padding: 13px 15px;
        border: 1px solid oklch(85.31% 0.027 84.92);
        border-left: 4px solid oklch(62.42% 0.178 24.04);
        border-radius: 7px;
        background: oklch(97.18% 0.032 24.18);
        color: oklch(31.82% 0.02 255.28);
    }

    .editor-surface :global(.dc-comparison-column[data-side="right"]) {
        border-left-color: oklch(66.42% 0.152 154.12);
        background: oklch(96.78% 0.033 154.76);
    }

    .editor-surface :global(.dc-comparison-title) {
        display: block;
        margin: 0 0 8px;
        color: oklch(34.1% 0.098 24.62);
        font-size: 12px;
        font-weight: 900;
        line-height: 1.2;
    }

    .editor-surface
        :global(.dc-comparison-column[data-side="right"] .dc-comparison-title) {
        color: oklch(29.24% 0.08 154.12);
    }

    .editor-surface :global(.dc-comparison-body > *:last-child) {
        margin-bottom: 0;
    }

    .editor-surface-dark :global(.dc-comparison-column) {
        border-color: oklch(31.22% 0.028 84.54);
        border-left-color: oklch(75.02% 0.17 24.82);
        background: oklch(13.02% 0.026 24.58);
        color: oklch(91.88% 0.016 91.83);
    }

    .editor-surface-dark :global(.dc-comparison-column[data-side="right"]) {
        border-left-color: oklch(76.71% 0.151 154.54);
        background: oklch(12.42% 0.022 154.8);
    }

    .editor-surface-dark :global(.dc-comparison-title) {
        color: oklch(93.14% 0.03 24.92);
    }

    .editor-surface-dark
        :global(.dc-comparison-column[data-side="right"] .dc-comparison-title) {
        color: oklch(92.34% 0.029 154.17);
    }

    .editor-surface :global(.dc-data-table) {
        width: 100%;
        margin: 0 0 16px;
        border-collapse: collapse;
        table-layout: fixed;
        color: oklch(23.39% 0.012 255.51);
        font-size: var(--editor-body-font-size, 17px);
        line-height: 1.62;
    }

    .editor-surface :global(.dc-data-table-cell) {
        border: 1px solid oklch(84.71% 0.018 83.76);
        padding: 8px 10px;
        background: oklch(99.2% 0.006 91.5);
        text-align: left;
        vertical-align: top;
        overflow-wrap: break-word;
    }

    .editor-surface :global(th.dc-data-table-cell) {
        background: oklch(95.64% 0.026 83.11);
        color: oklch(24.19% 0.019 255.77);
        font-weight: 700;
    }

    .editor-surface-dark :global(.dc-data-table) {
        color: #e8e8e8;
    }

    .editor-surface-dark :global(.dc-data-table-cell) {
        border-color: #3a3a3a;
        background: #151515;
        color: #e8e8e8;
    }

    .editor-surface-dark :global(th.dc-data-table-cell) {
        background: #242424;
        color: #f4f4f4;
    }

    .editor-surface :global(.dc-callout) {
        margin: 0 0 16px;
        padding: 12px 14px;
        border-left: 4px solid var(--dc-callout-border);
        border-radius: 7px;
        background: var(--dc-callout-background);
        color: var(--dc-callout-text);
    }

    .editor-surface-dark :global(.dc-callout) {
        border-left-color: var(--dc-callout-dark-border);
        background: var(--dc-callout-dark-background);
        color: var(--dc-callout-dark-text);
    }

    .editor-surface :global(.dc-callout-tip) {
        --dc-callout-border: oklch(70.89% 0.156 142.5);
        --dc-callout-background: oklch(96.48% 0.047 142.49);
        --dc-callout-text: oklch(30.18% 0.073 145.31);
    }

    .editor-surface-dark :global(.dc-callout-tip) {
        --dc-callout-dark-border: oklch(76.13% 0.153 142.04);
        --dc-callout-dark-background: oklch(11.88% 0.018 142.78);
        --dc-callout-dark-text: oklch(91.89% 0.026 143.2);
    }

    .editor-surface :global(.dc-callout-warning) {
        --dc-callout-border: oklch(73.08% 0.151 60.74);
        --dc-callout-background: oklch(96.87% 0.048 75.17);
        --dc-callout-text: oklch(34.21% 0.082 52.58);
    }

    .editor-surface-dark :global(.dc-callout-warning) {
        --dc-callout-dark-border: oklch(78.46% 0.145 69.41);
        --dc-callout-dark-background: oklch(12.26% 0.018 58.76);
        --dc-callout-dark-text: oklch(92.96% 0.03 76.33);
    }

    .editor-surface :global(.dc-callout-reference) {
        --dc-callout-border: oklch(68.74% 0.127 246.28);
        --dc-callout-background: oklch(96.27% 0.036 247.39);
        --dc-callout-text: oklch(32.26% 0.07 249.42);
    }

    .editor-surface-dark :global(.dc-callout-reference) {
        --dc-callout-dark-border: oklch(72.52% 0.142 232.16);
        --dc-callout-dark-background: oklch(11.62% 0.021 245.9);
        --dc-callout-dark-text: oklch(91.87% 0.029 233.82);
    }

    .editor-surface :global(.dc-callout-emphasis) {
        --dc-callout-border: oklch(64.73% 0.162 303.08);
        --dc-callout-background: oklch(96.21% 0.036 302.35);
        --dc-callout-text: oklch(33.84% 0.091 303.69);
    }

    .editor-surface-dark :global(.dc-callout-emphasis) {
        --dc-callout-dark-border: oklch(73.79% 0.151 303.45);
        --dc-callout-dark-background: oklch(12.04% 0.022 302.17);
        --dc-callout-dark-text: oklch(93.04% 0.029 303.2);
    }

    .editor-surface :global(.dc-callout-success) {
        --dc-callout-border: oklch(66.42% 0.152 154.12);
        --dc-callout-background: oklch(96.12% 0.041 152.76);
        --dc-callout-text: oklch(29.24% 0.08 154.12);
    }

    .editor-surface-dark :global(.dc-callout-success) {
        --dc-callout-dark-border: oklch(76.71% 0.151 154.54);
        --dc-callout-dark-background: oklch(11.76% 0.02 154.8);
        --dc-callout-dark-text: oklch(92.34% 0.029 154.17);
    }

    .editor-surface :global(.dc-callout-failure) {
        --dc-callout-border: oklch(62.42% 0.178 24.04);
        --dc-callout-background: oklch(96.23% 0.039 24.18);
        --dc-callout-text: oklch(34.1% 0.098 24.62);
    }

    .editor-surface-dark :global(.dc-callout-failure) {
        --dc-callout-dark-border: oklch(75.02% 0.17 24.82);
        --dc-callout-dark-background: oklch(12.02% 0.021 24.58);
        --dc-callout-dark-text: oklch(93.14% 0.03 24.92);
    }

    .editor-surface :global(.dc-callout-experiment) {
        --dc-callout-border: oklch(62.11% 0.15 263.9);
        --dc-callout-background: oklch(96.2% 0.032 264.42);
        --dc-callout-text: oklch(31.56% 0.081 264.1);
    }

    .editor-surface-dark :global(.dc-callout-experiment) {
        --dc-callout-dark-border: oklch(73.44% 0.145 264.2);
        --dc-callout-dark-background: oklch(11.48% 0.022 264.32);
        --dc-callout-dark-text: oklch(92.52% 0.031 264.14);
    }

    .editor-surface :global(.dc-callout-conclusion) {
        --dc-callout-border: oklch(72.44% 0.119 91.73);
        --dc-callout-background: oklch(96.87% 0.042 94.2);
        --dc-callout-text: oklch(34.5% 0.065 88.3);
    }

    .editor-surface-dark :global(.dc-callout-conclusion) {
        --dc-callout-dark-border: oklch(80.18% 0.126 91.43);
        --dc-callout-dark-background: oklch(12.18% 0.018 91.22);
        --dc-callout-dark-text: oklch(93.56% 0.027 91.42);
    }

    .editor-surface :global(.dc-callout-rebuttal) {
        --dc-callout-border: oklch(64.8% 0.157 330.2);
        --dc-callout-background: oklch(96.1% 0.038 330.12);
        --dc-callout-text: oklch(34.4% 0.096 329.55);
    }

    .editor-surface-dark :global(.dc-callout-rebuttal) {
        --dc-callout-dark-border: oklch(75.91% 0.154 330.36);
        --dc-callout-dark-background: oklch(12.11% 0.023 330.24);
        --dc-callout-dark-text: oklch(93.11% 0.031 330.24);
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

    .editor-surface-dark :global(.dc-link-box) {
        border-color: oklch(34.06% 0.044 236.72);
        border-left-color: oklch(74.22% 0.14 232.34);
        background: oklch(10.35% 0.015 93.61);
        color: oklch(90.9% 0.024 237.46);
    }

    .preview-surface {
        min-height: 680px;
        padding: 18px;
        overflow: auto;
        background: oklch(98.38% 0.01 97.33);
    }

    .preview-surface-dark {
        background: oklch(7.2% 0.012 94.1);
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
        font-family:
            Cascadia Mono,
            D2Coding,
            나눔고딕코딩,
            Noto Sans Mono CJK,
            JetBrains Mono,
            Fira Code,
            Hack,
            Source Code Pro,
            IBM Plex Mono,
            Roboto Mono,
            Consolas,
            Menlo,
            Monaco,
            monospace;
        font-size: 13px;
        line-height: 1.6;
        outline: none;
        white-space: pre;
    }

    .preview-surface :global(pre) {
        max-width: 100%;
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

        .editor-surface :global(.dc-comparison-block) {
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

        .floating-github-link {
            left: 8px;
            bottom: 8px;
            width: 42px;
            height: 42px;
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
