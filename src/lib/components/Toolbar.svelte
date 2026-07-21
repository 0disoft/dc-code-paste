<script lang="ts">
    import { getContext } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "$lib/state/workspace-context";
    import type { WorkspaceState } from "$lib/state/workspace.svelte";
    import { Undo2, Redo2, RotateCcw, LayoutTemplate, Check, Loader2, Clipboard, FileText, Sparkles, Save, Heading1, Rows3, Bold, Italic, Link2, LinkIcon, Code2, Paintbrush, List, Quote, SeparatorHorizontal, Type, BookOpen, Highlighter, Unlink, ChevronDown, SlidersHorizontal } from "lucide-svelte";

    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);
</script>

    <section class="toolbar" aria-label="글 편집 도구">
        <div class="tool-group command-group">
            <button
                type="button"
                title="실행 취소"
                aria-label="실행 취소"
                disabled={!workspace.canUndo()}
                onclick={() =>
                    workspace.runEditorCommand((current) =>
                        current.chain().focus().undo().run(),
                    )}
            >
                <Undo2 size={17} />
            </button>
            <button
                type="button"
                title="다시 실행"
                aria-label="다시 실행"
                disabled={!workspace.canRedo()}
                onclick={() =>
                    workspace.runEditorCommand((current) =>
                        current.chain().focus().redo().run(),
                    )}
            >
                <Redo2 size={17} />
            </button>
            <button
                type="button"
                title="초기화"
                aria-label="초기화"
                onclick={workspace.resetDraft}
            >
                <RotateCcw size={17} />
                <span>초기화</span>
            </button>
            <button
                type="button"
                title="예시 템플릿"
                aria-label="예시 템플릿"
                onclick={workspace.applyExampleTemplate}
            >
                <LayoutTemplate size={17} />
                <span>예시</span>
            </button>
            <button
                class="copy-button"
                type="button"
                title={workspace.copyLabel}
                aria-label={workspace.copyLabel}
                onclick={workspace.copyPreview}
                disabled={!workspace.html || workspace.isRendering}
            >
                {#if workspace.copyState === "copied"}
                    <Check size={17} />
                {:else if workspace.isRendering}
                    <span class="spin-icon"><Loader2 size={17} /></span>
                {:else}
                    <Clipboard size={17} />
                {/if}
                <span>{workspace.copyLabel}</span>
            </button>
            <button
                class:active={workspace.isMarkdownPanelOpen}
                type="button"
                title="Markdown"
                aria-label="Markdown"
                aria-expanded={workspace.isMarkdownPanelOpen}
                onclick={workspace.toggleMarkdownPanel}
            >
                <FileText size={17} />
                <span>MD</span>
            </button>
            <button
                class:active={workspace.llmPromptCopyState === "copied"}
                type="button"
                title="LLM 가이드 복사"
                aria-label="LLM 가이드 복사"
                onclick={workspace.copyLlmAuthoringGuide}
            >
                {#if workspace.llmPromptCopyState === "copied"}
                    <Check size={17} />
                {:else}
                    <Sparkles size={17} />
                {/if}
                <span>{workspace.llmPromptCopyLabel}</span>
            </button>
            <button
                class:active={workspace.isLlmPanelOpen || workspace.llmGenerationState === "loading"}
                type="button"
                title="AI 작성"
                aria-label="AI 작성"
                aria-expanded={workspace.isLlmPanelOpen}
                aria-controls="llm-panel"
                onclick={workspace.toggleLlmPanel}
            >
                {#if workspace.llmGenerationState === "loading"}
                    <span class="spin-icon"><Loader2 size={17} /></span>
                {:else}
                    <Sparkles size={17} />
                {/if}
                <span>AI</span>
            </button>
            <button
                class:active={workspace.isStoragePanelOpen}
                type="button"
                title="저장함"
                aria-label="저장함"
                aria-expanded={workspace.isStoragePanelOpen}
                aria-controls="storage-panel"
                onclick={workspace.toggleStoragePanel}
            >
                <Save size={17} />
                <span>저장함</span>
            </button>
        </div>

        <div class="tool-group inline-group">
            <button
                class:active={workspace.isActive("heading", { level: 1 })}
                type="button"
                title="제목"
                aria-label="제목"
                onclick={() =>
                    workspace.runEditorCommand((current) =>
                        current
                            .chain()
                            .focus()
                            .toggleHeading({ level: 1 })
                            .run(),
                    )}
            >
                <Heading1 size={17} />
            </button>
            <button
                class:active={workspace.isActive("paragraph")}
                type="button"
                title="문단"
                aria-label="문단"
                onclick={() =>
                    workspace.runEditorCommand((current) =>
                        current.chain().focus().setParagraph().run(),
                    )}
            >
                <Rows3 size={17} />
            </button>
            <button
                class:active={workspace.isActive("bold")}
                type="button"
                title="굵게"
                aria-label="굵게"
                onclick={() =>
                    workspace.runEditorCommand((current) =>
                        current.chain().focus().toggleBold().run(),
                    )}
            >
                <Bold size={17} />
            </button>
            <button
                class:active={workspace.isActive("italic")}
                type="button"
                title="기울임"
                aria-label="기울임"
                onclick={() =>
                    workspace.runEditorCommand((current) =>
                        current.chain().focus().toggleItalic().run(),
                    )}
            >
                <Italic size={17} />
            </button>
            <button
                class:active={workspace.isActive("link") || workspace.isLinkPanelOpen}
                type="button"
                title="링크"
                aria-label="링크"
                onclick={workspace.toggleLinkPanel}
            >
                <Link2 size={17} />
            </button>
            <button
                class:active={workspace.isActive("linkBox")}
                type="button"
                title="링크박스"
                aria-label="링크박스"
                onclick={workspace.applyLinkBox}
            >
                <LinkIcon size={17} />
                <span>링크박스</span>
            </button>
        </div>

        <div class="tool-group tool-panel-tabs" role="group" aria-label="도구 그룹">
            <button
                class:active={workspace.activeToolPanel === "blocks"}
                type="button"
                title={workspace.activeToolPanel === "blocks" ? "블록 도구 닫기" : "블록 도구 열기"}
                aria-label="블록 도구"
                aria-expanded={workspace.activeToolPanel === "blocks"}
                aria-controls="block-tools"
                onclick={() => workspace.toggleToolPanel("blocks")}
            >
                <Rows3 size={17} />
                <span>블록 도구</span>
                <ChevronDown class="panel-chevron" size={15} aria-hidden="true" />
            </button>
            <button
                class:active={workspace.activeToolPanel === "code"}
                type="button"
                title={workspace.activeToolPanel === "code" ? "코드 도구 닫기" : "코드 도구 열기"}
                aria-label="코드 도구"
                aria-expanded={workspace.activeToolPanel === "code"}
                aria-controls="code-tools"
                onclick={() => workspace.toggleToolPanel("code")}
            >
                <Code2 size={17} />
                <span>코드 도구</span>
                <ChevronDown class="panel-chevron" size={15} aria-hidden="true" />
            </button>
            <button
                class:active={workspace.activeToolPanel === "style"}
                type="button"
                title={workspace.activeToolPanel === "style" ? "글 모양 도구 닫기" : "글 모양 도구 열기"}
                aria-label="글 모양 도구"
                aria-expanded={workspace.activeToolPanel === "style"}
                aria-controls="style-tools"
                onclick={() => workspace.toggleToolPanel("style")}
            >
                <Paintbrush size={17} />
                <span>글 모양</span>
                <ChevronDown class="panel-chevron" size={15} aria-hidden="true" />
            </button>
        </div>

        {#if workspace.isLinkPanelOpen}
            <div class="tool-group link-tool">
                <label>
                    <span><Link2 size={15} /> 링크</span>
                    <input
                        class:error={workspace.linkError}
                        type="url"
                        bind:this={workspace.linkInput}
                        bind:value={workspace.linkDraft}
                        aria-label="링크 주소"
                        placeholder="https://example.com"
                        oninput={() => (workspace.linkError = false)}
                        onkeydown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                workspace.setLink();
                            }

                            if (event.key === "Escape") {
                                workspace.isLinkPanelOpen = false;
                                workspace.linkError = false;
                            }
                        }}
                    />
                </label>
                <button
                    type="button"
                    title="적용"
                    aria-label="적용"
                    onclick={workspace.setLink}
                >
                    <Check size={17} />
                </button>
                <button
                    type="button"
                    title="해제"
                    aria-label="해제"
                    onclick={workspace.unsetLink}
                >
                    <Unlink size={17} />
                </button>
            </div>
        {/if}

        {#if workspace.activeToolPanel === "blocks"}
            <div id="block-tools" class="tool-group tool-panel block-insert-group">
            <span class="panel-section-title">블록 추가</span>
            <button
                class:active={workspace.isActive("bulletList")}
                type="button"
                title="목록"
                aria-label="목록"
                onclick={() =>
                    workspace.runEditorCommand((current) =>
                        current.chain().focus().toggleBulletList().run(),
                    )}
            >
                <List size={17} />
            </button>
            <button
                class:active={workspace.isActive("blockquote")}
                type="button"
                title="인용"
                aria-label="인용"
                onclick={workspace.applyQuote}
            >
                <Quote size={17} />
            </button>
            <label>
                <span><Quote size={15} /> 인용</span>
                <select
                    bind:value={workspace.quoteStyle}
                    aria-label="인용 스타일"
                    onchange={workspace.updateActiveQuoteStyle}
                >
                    {#each workspace.quoteStyleOptions as item}
                        <option value={item.value}>{item.label}</option>
                    {/each}
                </select>
            </label>
            <button
                class:active={workspace.isActive("sectionHeading")}
                type="button"
                title="섹션"
                aria-label="섹션"
                onclick={workspace.applySectionHeading}
            >
                <Rows3 size={17} />
                <span>섹션</span>
            </button>
            <button
                class:active={workspace.isActive("heroBlock")}
                type="button"
                title="히어로"
                aria-label="히어로"
                onclick={workspace.applyHeroBlock}
            >
                <Heading1 size={17} />
                <span>히어로</span>
            </button>
            <button
                class:active={workspace.isActive("summaryBox")}
                type="button"
                title="요약"
                aria-label="요약"
                onclick={workspace.applySummaryBox}
            >
                <FileText size={17} />
                <span>요약</span>
            </button>
            <button
                class:active={workspace.isActive("tutorialBlock")}
                type="button"
                title="튜토리얼"
                aria-label="튜토리얼"
                onclick={workspace.applyTutorialBlock}
            >
                <Rows3 size={17} />
                <span>튜토리얼</span>
            </button>
            <button
                class:active={workspace.isActive("comparisonBlock")}
                type="button"
                title="비교"
                aria-label="비교"
                onclick={workspace.applyComparisonBlock}
            >
                <Rows3 size={17} />
                <span>비교</span>
            </button>
            <button
                type="button"
                title="구분선"
                aria-label="구분선"
                onclick={() =>
                    workspace.runEditorCommand((current) =>
                        current.chain().focus().setHorizontalRule().run(),
                    )}
            >
                <SeparatorHorizontal size={17} />
            </button>
            <button
                class:active={workspace.isCalloutActive()}
                type="button"
                title="콜아웃"
                aria-label="콜아웃"
                onclick={workspace.applySelectedCallout}
            >
                <Sparkles size={17} />
                <span>콜아웃</span>
            </button>
            <label class="callout-color-field">
                <span><Paintbrush size={15} /> 색상</span>
                <div class="callout-color-controls">
                    <div class="callout-color-swatches" aria-label="콜아웃 색상 프리셋">
                        {#each workspace.calloutColorOptions as item}
                            <button
                                class:active={workspace.activeCalloutKind === item.kind}
                                class="callout-color-swatch"
                                type="button"
                                aria-label={`${item.label} 콜아웃`}
                                title={`${item.label} 콜아웃`}
                                style={`--swatch:${workspace.calloutSwatchColor(item.kind, item.color)}`}
                                onclick={() =>
                                    workspace.applyCalloutPresetColor(item.kind, item.color)}
                                ondblclick={() =>
                                    workspace.openCalloutColorPicker(item.kind, item.color)}
                            ></button>
                        {/each}
                    </div>
                    <input
                        bind:this={workspace.calloutColorInput}
                        class="callout-color-input"
                        type="color"
                        bind:value={workspace.activeCalloutColor}
                        aria-label="사용자 콜아웃 색상"
                        tabindex="-1"
                        oninput={workspace.updateCalloutPickerColor}
                    />
                </div>
            </label>
            <button
                class:active={workspace.isActive("ctaButton")}
                type="button"
                title="CTA"
                aria-label="CTA"
                onclick={workspace.applyCtaButton}
            >
                <LinkIcon size={17} />
                <span>CTA</span>
            </button>
            <button
                class:active={workspace.isActive("ctaGroup")}
                type="button"
                title="버튼묶음"
                aria-label="버튼묶음"
                onclick={workspace.applyCtaGroup}
            >
                <Rows3 size={17} />
                <span>버튼묶음</span>
            </button>
            <button
                class:active={workspace.isActive("referenceList")}
                type="button"
                title="자료목록"
                aria-label="자료목록"
                onclick={workspace.applyReferenceList}
            >
                <BookOpen size={17} />
                <span>자료목록</span>
            </button>
            <label>
                <span><Rows3 size={15} /> 버튼</span>
                <select
                    bind:value={workspace.ctaGroupLayout}
                    aria-label="버튼묶음 정렬"
                    onchange={workspace.updateActiveCtaGroupLayout}
                >
                    {#each workspace.ctaGroupLayoutOptions as item}
                        <option value={item.value}>{item.label}</option>
                    {/each}
                </select>
            </label>
            {#if workspace.blockLabelTarget !== null}
                <span class="panel-section-divider" aria-hidden="true"></span>
                <span class="panel-section-title">선택 블록</span>
                <label class="block-label-field">
                    <span><Type size={15} /> 라벨</span>
                    <input
                        type="text"
                        bind:this={workspace.blockLabelInput}
                        bind:value={workspace.blockLabelDraft}
                        aria-label="블록 라벨"
                        placeholder={workspace.blockLabelPlaceholder()}
                        onkeydown={workspace.applyBlockLabelOnEnter}
                    />
                </label>
                <button
                    type="button"
                    title="라벨 적용"
                    aria-label="라벨 적용"
                    onclick={workspace.applyBlockLabel}
                >
                    <Check size={17} />
                    <span>적용</span>
                </button>
            {/if}
            </div>
        {/if}

        {#if workspace.activeToolPanel === "code"}
            <div id="code-tools" class="tool-group tool-panel tool-group-wide code-settings-group">
            <div class="panel-section panel-section-primary">
                <span class="panel-section-title">코드블록</span>
                <button
                    class="panel-primary-action"
                    class:active={workspace.isActive("codeBlock")}
                    type="button"
                    title={workspace.isActive("codeBlock") ? "코드블록 해제" : "선택한 내용 또는 현재 문단을 코드블록으로 바꾸기"}
                    aria-label={workspace.isActive("codeBlock") ? "코드블록 해제" : "코드블록 적용"}
                    aria-pressed={workspace.isActive("codeBlock")}
                    onclick={workspace.applyCodeBlock}
                >
                    <Code2 size={17} />
                    <span>{workspace.isActive("codeBlock") ? "코드블록 해제" : "코드블록 적용"}</span>
                </button>
                <label>
                    <span><Code2 size={15} /> 언어</span>
                    <select
                        bind:value={workspace.language}
                        aria-label="코드 언어"
                        onchange={() =>
                            workspace.runEditorCommand((current) =>
                                current
                                    .chain()
                                    .focus()
                                    .updateAttributes("codeBlock", { language: workspace.language })
                                    .run(),
                            )}
                    >
                        {#each workspace.supportedLanguageGroups as group}
                            <optgroup label={group.label}>
                                {#each group.languages as item}
                                    <option value={item.id}>{item.label}</option>
                                {/each}
                            </optgroup>
                        {/each}
                    </select>
                </label>
                <label>
                    <span><FileText size={15} /> 파일명</span>
                    <input
                        class="code-filename-input"
                        type="text"
                        bind:this={workspace.codeFilenameInput}
                        bind:value={workspace.codeFilename}
                        aria-label="코드 파일명"
                        placeholder="main.cpp"
                        onblur={workspace.applyCodeFilename}
                        onkeydown={(event) => {
                            if (event.key === "Enter") {
                                workspace.applyCodeFilename();
                            }
                        }}
                    />
                </label>
            </div>
            <details class="tool-disclosure">
                <summary>
                    <SlidersHorizontal size={16} aria-hidden="true" />
                    <span>세부 설정</span>
                    <ChevronDown class="disclosure-chevron" size={15} aria-hidden="true" />
                </summary>
                <div class="tool-disclosure-content">
                    <label>
                        <span><Highlighter size={15} /> 강조줄</span>
                        <input
                            class="line-highlight-input"
                            class:error={workspace.codeLineHighlightsInvalid}
                            type="text"
                            bind:value={workspace.codeLineHighlights}
                            aria-label="코드 강조 줄"
                            aria-invalid={workspace.codeLineHighlightsInvalid}
                            aria-describedby={workspace.codeLineHighlightsInvalid ? "code-line-range-help" : undefined}
                            placeholder="2,4-6"
                            onblur={workspace.applyCodeLineHighlights}
                            onkeydown={(event) => {
                                if (event.key === "Enter") {
                                    workspace.applyCodeLineHighlights();
                                }
                            }}
                        />
                    </label>
                    <label>
                        <span>추가줄</span>
                        <input
                            class="line-highlight-input"
                            class:error={workspace.codeAdditionLinesInvalid}
                            type="text"
                            bind:value={workspace.codeAdditionLines}
                            aria-label="코드 추가 줄"
                            aria-invalid={workspace.codeAdditionLinesInvalid}
                            aria-describedby={workspace.codeAdditionLinesInvalid ? "code-line-range-help" : undefined}
                            placeholder="2,4-6"
                            onblur={workspace.applyCodeAdditionLines}
                            onkeydown={(event) => {
                                if (event.key === "Enter") {
                                    workspace.applyCodeAdditionLines();
                                }
                            }}
                        />
                    </label>
                    <label>
                        <span>삭제줄</span>
                        <input
                            class="line-highlight-input"
                            class:error={workspace.codeDeletionLinesInvalid}
                            type="text"
                            bind:value={workspace.codeDeletionLines}
                            aria-label="코드 삭제 줄"
                            aria-invalid={workspace.codeDeletionLinesInvalid}
                            aria-describedby={workspace.codeDeletionLinesInvalid ? "code-line-range-help" : undefined}
                            placeholder="2,4-6"
                            onblur={workspace.applyCodeDeletionLines}
                            onkeydown={(event) => {
                                if (event.key === "Enter") {
                                    workspace.applyCodeDeletionLines();
                                }
                            }}
                        />
                    </label>
                    {#if workspace.codeLineHighlightsInvalid || workspace.codeAdditionLinesInvalid || workspace.codeDeletionLinesInvalid}
                        <span id="code-line-range-help" class="line-range-hint"
                            >{workspace.lineRangeHelp}</span
                        >
                    {/if}
                    <label>
                        <span><Paintbrush size={15} /> 테마</span>
                        <select bind:value={workspace.theme} aria-label="코드 테마">
                            {#each workspace.supportedThemes as item}
                                <option value={item.id}>{item.label}</option>
                            {/each}
                        </select>
                    </label>
                    <label>
                        <span>코드 글자</span>
                        <select bind:value={workspace.codeFontSize} aria-label="코드 글자 크기">
                            {#each workspace.codeSizes as item}
                                <option value={item}>{item}</option>
                            {/each}
                        </select>
                    </label>
                    <label class="switch">
                        <input type="checkbox" bind:checked={workspace.showLineNumbers} />
                        <span>줄번호</span>
                    </label>
                </div>
            </details>
            </div>
        {/if}

        {#if workspace.activeToolPanel === "style"}
            <div id="style-tools" class="tool-group tool-panel tool-group-wide typography-group">
            <span class="panel-section-title">문서</span>
            <label>
                <span><Paintbrush size={15} /> 글 배경</span>
                <select
                    bind:value={workspace.documentTheme}
                    aria-label="복사될 글 배경"
                    title="DC 야간모드와 별개로 복사될 글의 배경을 고릅니다"
                >
                    {#each workspace.documentThemes as item}
                        <option value={item.value}>{item.label}</option>
                    {/each}
                </select>
            </label>
            <label>
                <span>전체 글자</span>
                <select bind:value={workspace.bodyFontSize} aria-label="전체 글자 크기">
                    {#each workspace.bodySizes as item}
                        <option value={item}>{item}</option>
                    {/each}
                </select>
            </label>
            <span class="panel-section-divider" aria-hidden="true"></span>
            <span class="panel-section-title">선택 영역</span>
            <label>
                <span>선택 글자</span>
                <select
                    bind:value={workspace.selectionFontSize}
                    aria-label="선택 글자 크기"
                    onchange={() => workspace.setFontSize(workspace.selectionFontSize)}
                >
                    {#each workspace.bodySizes as item}
                        <option value={item}>{item}</option>
                    {/each}
                </select>
            </label>
            <div class="swatches" aria-label="글자색">
                {#each workspace.swatches as swatch}
                    <button
                        class="swatch"
                        type="button"
                        title={`${swatch.label} 글자색`}
                        aria-label={`${swatch.label} 글자색`}
                        style={`--swatch:${swatch.color}`}
                        onclick={() => workspace.setTextColor(swatch.color)}
                    ></button>
                {/each}
            </div>
            </div>
        {/if}
    </section>

<style>
    .toolbar {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        gap: 8px;
        align-items: stretch;
        padding: 8px;
        border: 1px solid color-mix(in oklch, var(--line) 44%, transparent);
        border-radius: 10px;
        background: color-mix(in oklch, var(--panel) 82%, transparent);
        box-shadow: 0 16px 38px oklch(0% 0 0 / 0.14);
        backdrop-filter: blur(10px);
    }

    .tool-group {
        display: flex;
        align-items: center;
        gap: 4px;
        min-width: 0;
        min-height: 40px;
        padding: 4px 6px;
        border: 0;
        border-radius: 8px;
        background: color-mix(in oklch, var(--panel-2) 28%, transparent);
    }

    .tool-group + .tool-group {
        box-shadow: inset 1px 0 0 color-mix(in oklch, var(--line) 42%, transparent);
    }

    .tool-group-wide {
        flex-wrap: wrap;
    }

    .command-group {
        grid-column: 1;
        width: max-content;
    }

    .inline-group {
        grid-column: 2;
        flex-wrap: nowrap;
        justify-content: flex-start;
        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-gutter: stable;
    }

    .tool-panel-tabs {
        grid-column: 3;
        width: max-content;
    }

    .toolbar .tool-panel-tabs button {
        min-width: 118px;
    }

    .panel-chevron,
    .disclosure-chevron {
        transition: transform 0.16s ease;
    }

    .tool-panel-tabs button.active .panel-chevron,
    .tool-disclosure[open] .disclosure-chevron {
        transform: rotate(180deg);
    }

    .link-tool,
    .tool-panel,
    .block-insert-group,
    .code-settings-group,
    .typography-group {
        grid-column: 1 / -1;
    }

    .block-insert-group {
        flex-wrap: nowrap;
        overflow-x: auto;
        overflow-y: hidden;
        padding-bottom: 8px;
        scrollbar-gutter: stable;
    }

    .block-insert-group > * {
        flex: 0 0 auto;
    }

    .panel-section {
        display: flex;
        align-items: center;
        gap: 4px;
        min-width: 0;
    }

    .panel-section-primary {
        flex-wrap: wrap;
    }

    .panel-section-title {
        flex: 0 0 auto;
        padding: 0 6px;
        color: var(--muted);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.02em;
    }

    .panel-section-divider {
        flex: 0 0 auto;
        width: 1px;
        height: 24px;
        margin: 0 4px;
        background: color-mix(in oklch, var(--line) 62%, transparent);
    }

    .tool-disclosure {
        flex: 0 1 auto;
        min-width: 0;
    }

    .tool-disclosure[open] {
        flex: 1 0 100%;
        width: 100%;
    }

    .tool-disclosure summary {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-width: 116px;
        height: 34px;
        padding: 0 9px;
        border: 1px solid color-mix(in oklch, var(--line) 62%, transparent);
        border-radius: 7px;
        background: color-mix(in oklch, var(--panel-2) 42%, transparent);
        color: var(--text);
        font-weight: 500;
        cursor: pointer;
        list-style: none;
    }

    .tool-disclosure summary::-webkit-details-marker {
        display: none;
    }

    .tool-disclosure summary:hover,
    .tool-disclosure summary:focus-visible {
        border-color: color-mix(in oklch, var(--accent) 52%, transparent);
        background: color-mix(in oklch, var(--accent) 12%, var(--panel-2));
    }

    .tool-disclosure summary:focus-visible {
        outline: 2px solid var(--focus);
        outline-offset: 2px;
    }

    .tool-disclosure-content {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
        margin-top: 6px;
        padding: 8px 6px 2px;
        border-top: 1px solid color-mix(in oklch, var(--line) 44%, transparent);
    }

    .toolbar button,
    .toolbar label,
    .switch {
        height: 34px;
        flex: 0 0 auto;
        white-space: nowrap;
    }

    .toolbar button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-width: 34px;
        padding: 0 9px;
        border: 1px solid transparent;
        border-radius: 7px;
        background: transparent;
        color: var(--text);
        font-weight: 500;
        cursor: pointer;
        transition:
            background-color 0.16s ease,
            border-color 0.16s ease,
            color 0.16s ease,
            transform 0.16s ease;
    }

    .toolbar button:hover:not(:disabled) {
        background: color-mix(in oklch, var(--panel-2) 72%, transparent);
    }

    .toolbar button:active:not(:disabled) {
        transform: translateY(1px);
    }

    .toolbar :global(svg) {
        flex: 0 0 auto;
    }

    .toolbar button span,
    .toolbar label span,
    .switch span {
        white-space: nowrap;
    }

    .toolbar button.active {
        border-color: color-mix(in oklch, var(--accent) 52%, transparent);
        background: color-mix(in oklch, var(--accent) 18%, transparent);
        color: var(--accent);
    }

    .toolbar button:disabled {
        cursor: not-allowed;
        opacity: 0.42;
    }

    .toolbar .copy-button {
        min-width: 112px;
        border-color: color-mix(in oklch, var(--accent) 62%, transparent);
        background: var(--accent);
        color: oklch(22.89% 0.055 118.8);
        font-weight: 500;
    }

    .toolbar .copy-button:hover:not(:disabled),
    .toolbar .copy-button:focus-visible:not(:disabled) {
        border-color: color-mix(in oklch, var(--accent) 82%, transparent);
        background: color-mix(in oklch, var(--accent) 88%, white 12%);
        color: oklch(18.8% 0.05 118.8);
    }

    .toolbar .copy-button:disabled {
        cursor: not-allowed;
        opacity: 0.72;
    }

    .toolbar .panel-primary-action {
        min-width: 132px;
        border-color: color-mix(in oklch, var(--accent) 62%, transparent);
        background: var(--accent);
        color: oklch(22.89% 0.055 118.8);
        font-weight: 700;
    }

    .toolbar .panel-primary-action:hover:not(:disabled),
    .toolbar .panel-primary-action:focus-visible:not(:disabled) {
        border-color: color-mix(in oklch, var(--accent) 82%, transparent);
        background: color-mix(in oklch, var(--accent) 88%, white 12%);
        color: oklch(18.8% 0.05 118.8);
    }

    .toolbar .panel-primary-action.active {
        border-color: color-mix(in oklch, var(--line) 72%, transparent);
        background: color-mix(in oklch, var(--panel-2) 82%, transparent);
        color: var(--text);
    }

    label {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        color: var(--muted);
        font-size: 13px;
        font-weight: 500;
    }

    label span {
        display: inline-flex;
        align-items: center;
        gap: 5px;
    }

    select {
        height: 34px;
        min-width: 104px;
        border: 1px solid color-mix(in oklch, var(--line) 62%, transparent);
        border-radius: 7px;
        background: color-mix(in oklch, var(--panel-2) 66%, transparent);
        padding: 0 9px;
    }

    input[type="url"] {
        width: min(320px, 48vw);
        height: 34px;
        border: 1px solid color-mix(in oklch, var(--line) 62%, transparent);
        border-radius: 7px;
        background: color-mix(in oklch, var(--panel-2) 66%, transparent);
        color: var(--text);
        padding: 0 10px;
    }

    input[type="url"]:focus {
        border-color: var(--accent);
        outline: none;
    }

    input[type="url"].error {
        border-color: var(--danger);
        background: color-mix(in oklch, var(--danger) 12%, var(--panel-2));
    }

    input[type="text"] {
        width: min(260px, 44vw);
        height: 34px;
        border: 1px solid color-mix(in oklch, var(--line) 62%, transparent);
        border-radius: 7px;
        background: color-mix(in oklch, var(--panel-2) 66%, transparent);
        color: var(--text);
        padding: 0 10px;
    }

    input[type="text"]:focus {
        border-color: var(--accent);
        outline: none;
    }

    input[type="text"].error {
        border-color: var(--danger);
        background: color-mix(in oklch, var(--danger) 12%, var(--panel-2));
    }

    input[type="text"]:disabled {
        cursor: not-allowed;
        opacity: 0.5;
    }

    .block-label-field input {
        width: 150px;
    }

    .callout-color-field {
        gap: 8px;
    }

    .callout-color-controls {
        display: inline-flex;
        gap: 8px;
        align-items: center;
    }

    .callout-color-swatches {
        display: inline-flex;
        gap: 6px;
        align-items: center;
    }

    .toolbar .callout-color-swatch {
        width: 24px;
        min-width: 24px;
        height: 24px;
        padding: 0;
        border-radius: 999px;
        background: var(--swatch);
    }

    .toolbar .callout-color-swatch.active {
        box-shadow:
            0 0 0 2px var(--panel-2),
            0 0 0 4px var(--accent);
    }

    .callout-color-input {
        position: absolute;
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
    }

    .code-filename-input,
    .line-highlight-input {
        width: 170px;
    }

    .line-range-hint {
        color: var(--danger);
        font-size: 12px;
        font-weight: 500;
    }

    .link-tool {
        flex-wrap: wrap;
    }

    .switch {
        padding: 0 10px;
        border: 1px solid color-mix(in oklch, var(--line) 62%, transparent);
        border-radius: 7px;
        background: color-mix(in oklch, var(--panel-2) 56%, transparent);
    }

    input[type="checkbox"] {
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

    @media (min-width: 721px) and (max-width: 1480px) {
        .toolbar {
            grid-template-columns: minmax(0, 1fr) auto;
        }

        .command-group {
            grid-column: 1;
        }

        .tool-panel-tabs {
            grid-column: 2;
        }

        .inline-group {
            grid-column: 1 / -1;
            width: 100%;
            overflow-x: visible;
            scrollbar-gutter: auto;
        }
    }

    @media (max-width: 720px) {
        .toolbar {
            grid-template-columns: minmax(0, 1fr);
        }

        .command-group,
        .inline-group,
        .tool-panel-tabs,
        .link-tool,
        .block-insert-group,
        .code-settings-group,
        .typography-group {
            grid-column: 1;
            width: 100%;
        }

        .tool-group {
            width: 100%;
            box-shadow: none;
        }

        .tool-group:last-child {
            padding-bottom: 6px;
        }

        .tool-panel-tabs {
            overflow-x: auto;
            overflow-y: hidden;
        }

        .panel-section {
            flex-wrap: wrap;
        }

        .tool-disclosure {
            width: 100%;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .panel-chevron,
        .disclosure-chevron {
            transition: none;
        }
    }
</style>
