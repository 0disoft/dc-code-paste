<script lang="ts">
    import { onMount, setContext, tick, untrack } from "svelte";
    import type { PaletteBlockKind } from "#lib/editor/block-inspector.ts";
    import type { ReadingPassage } from "#lib/editor/reading-path.ts";
    import type { EmphasisPassage } from "#lib/editor/emphasis-review.ts";
    import { createWorkspaceState } from "#lib/state/workspace.svelte.ts";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import StoragePanel from "#lib/components/StoragePanel.svelte";
    import MarkdownPanel from "#lib/components/MarkdownPanel.svelte";
    import LLMPanel from "#lib/components/LLMPanel.svelte";
    import TopBar from "#lib/components/TopBar.svelte";
    import BlockSidebar from "#lib/components/BlockSidebar.svelte";
    import InspectorPanel from "#lib/components/InspectorPanel.svelte";
    import EditorCanvas from "#lib/components/EditorCanvas.svelte";
    import PreviewCanvas from "#lib/components/PreviewCanvas.svelte";
    import CopyRecovery from "#lib/components/CopyRecovery.svelte";
    import CopiedOutputDialog from "#lib/components/CopiedOutputDialog.svelte";

    type WorkspaceView = "editor" | "preview";

    const workspace = createWorkspaceState();

    let activeWorkspaceView = $state<WorkspaceView>("editor");
    let leftRailOpen = $state(false);
    let rightRailOpen = $state(false);
    let compact = $state(false);
    let focusMode = $state(false);
    const drawerMode = $derived(compact || focusMode);
    let sourceRequest = $state(0);

    async function onSourceRequest() {
        selectWorkspaceView("editor");
        leftRailOpen = false;
        rightRailOpen = true;
        sourceRequest++;
        await tick();
        document.getElementById("sentence-source-href")?.focus();
    }

    async function onSourceNavigate(href: string, from: number, to: number) {
        selectWorkspaceView("editor");
        if (drawerMode) closeRails();
        await tick();
        workspace.navigateSentenceSource(href, from, to);
    }

    async function onPassageNavigate(passage: ReadingPassage) {
        selectWorkspaceView("editor");
        if (drawerMode) closeRails();
        await tick();
        workspace.navigateReadingPassage(passage);
    }

    async function onEmphasisNavigate(passage: EmphasisPassage) {
        selectWorkspaceView("editor");
        if (drawerMode) closeRails();
        await tick();
        workspace.navigateEmphasisPassage(passage);
    }

    $effect(() => {
        const version = workspace.documentReplacementVersion;
        if (!version) return;
        untrack(() => {
            selectWorkspaceView("editor");
            closeRails();
            workspace.isStoragePanelOpen = false;
            void tick().then(() => {
                if (workspace.documentReplacementVersion === version) workspace.editor?.commands.focus("start");
            });
        });
    });

    onMount(() => {
        const query = window.matchMedia("(max-width: 1100px)");
        function updateMode() {
            const activeRail = document.activeElement?.closest(".rail");
            compact = query.matches;
            closeRails();
            if (activeRail && (compact || focusMode)) {
                const label = activeRail.id === "block-rail" ? "블록 삽입 패널" : "블록 설정 패널";
                void tick().then(() => document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)?.focus({ preventScroll: true }));
            }
        }
        updateMode();
        query.addEventListener("change", updateMode);
        return () => query.removeEventListener("change", updateMode);
    });

    async function toggleRail(side: "left" | "right") {
        const opening = side === "left" ? !leftRailOpen : !rightRailOpen;
        leftRailOpen = side === "left" && opening;
        rightRailOpen = side === "right" && opening;
        if (opening && drawerMode) {
            await tick();
            document.querySelector<HTMLElement>(`${side === "left" ? "#block-rail" : "#inspector-rail"} button`)?.focus();
        }
    }

    async function onPaletteInsert(kind?: PaletteBlockKind) {
        selectWorkspaceView("editor");
        if (drawerMode) {
            closeRails();
            if (kind === "link") rightRailOpen = true;
        }
        await tick();
        if (kind === "link") workspace.linkInput?.focus();
        else workspace.editor?.commands.focus();
    }

    function selectWorkspaceView(view: WorkspaceView) {
        activeWorkspaceView = view;
        workspace.setPreviewVisible(view === "preview");
    }

    async function onOutlineNavigate(index: number) {
        selectWorkspaceView("editor");
        if (drawerMode) closeRails();
        await tick();
        workspace.navigateToBlock(index);
    }

    async function onInspectorBlockAction() {
        selectWorkspaceView("editor");
        if (drawerMode) closeRails();
        await tick();
        workspace.editor?.commands.focus();
    }

    function showHtmlSource() {
        workspace.previewMode = "source";
        selectWorkspaceView("preview");
    }

    function closeRails() {
        leftRailOpen = false;
        rightRailOpen = false;
    }

    function captureCanvasPosition() {
        const scroller = document.querySelector<HTMLElement>(".canvas-view:not([hidden]) .canvas-scroll");
        if (!scroller) return () => {};
        const scrollTop = scroller.scrollTop;
        const bounds = scroller.getBoundingClientRect();
        const current = workspace.editor;
        const doc = current?.state.doc;
        let position: number | undefined;
        let offset: number | undefined;
        let anchor: HTMLElement | undefined;
        if (activeWorkspaceView === "editor" && current && !current.isDestroyed) {
            const selected = current.view.coordsAtPos(current.state.selection.from);
            if (selected.top >= bounds.top && selected.bottom <= bounds.bottom) position = current.state.selection.from;
            else {
                const editorBounds = current.view.dom.getBoundingClientRect();
                position = current.view.posAtCoords({ left: editorBounds.left + 8, top: bounds.top + 8 })?.pos;
            }
            if (position !== undefined) offset = current.view.coordsAtPos(position).top - bounds.top;
        } else {
            const blocks = "p, h1, h2, h3, pre, li, td";
            anchor = Array.from(scroller.querySelectorAll<HTMLElement>(`.preview-surface :is(${blocks}), .emphasis-review .passage-text`))
                .find((element) => element.textContent?.trim() && !element.querySelector(blocks) && element.getBoundingClientRect().bottom > bounds.top && element.getBoundingClientRect().top < bounds.bottom);
            if (anchor) offset = anchor.getBoundingClientRect().top - bounds.top;
        }
        return () => {
            if (!scroller.isConnected) return;
            scroller.scrollTop = scrollTop;
            const top = position !== undefined && current && !current.isDestroyed && current.state.doc === doc
                ? current.view.coordsAtPos(position).top
                : anchor?.isConnected ? anchor.getBoundingClientRect().top : undefined;
            if (top !== undefined && offset !== undefined) scroller.scrollTop += top - scroller.getBoundingClientRect().top - offset;
        };
    }

    async function toggleFocusMode() {
        const restorePosition = captureCanvasPosition();
        const next = !focusMode;
        focusMode = next;
        closeRails();
        if (next) {
            workspace.isMarkdownPanelOpen = false;
            workspace.isLlmPanelOpen = false;
            workspace.isStoragePanelOpen = false;
        }
        await tick();
        if (focusMode !== next) return;
        if (activeWorkspaceView === "editor") workspace.editor?.view.focus();
        else document.querySelector<HTMLButtonElement>(".topbar-preview")?.focus({ preventScroll: true });
        restorePosition();
    }

    async function dismissRail() {
        const label = leftRailOpen ? "블록 삽입 패널" : "블록 설정 패널";
        closeRails();
        await tick();
        document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)?.focus({ preventScroll: true });
    }

    function handleWindowKeydown(event: KeyboardEvent) {
        if (event.isComposing || !drawerMode || (!leftRailOpen && !rightRailOpen)) return;
        if (event.key === "Escape") {
            event.preventDefault();
            void dismissRail();
        } else if (event.key === "Tab") {
            const rail = document.getElementById(leftRailOpen ? "block-rail" : "inspector-rail");
            const targets = Array.from(rail?.querySelectorAll<HTMLElement>(
                'button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled]), a[href]:not([tabindex="-1"]), summary, [tabindex="0"]',
            ) ?? []).filter((element) => {
                const closed = element.closest("details:not([open])");
                return element.getClientRects().length > 0 && (!closed || closed.querySelector(":scope > summary") === element);
            });
            const first = targets[0];
            const last = targets.at(-1);
            if (event.shiftKey && (document.activeElement === first || !rail?.contains(document.activeElement))) {
                event.preventDefault();
                last?.focus();
            } else if (!event.shiftKey && (document.activeElement === last || !rail?.contains(document.activeElement))) {
                event.preventDefault();
                first?.focus();
            }
        }
    }

    setContext(WORKSPACE_CONTEXT_KEY, workspace);
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<div class="app-shell" class:is-focused={focusMode}>
    <TopBar
        view={activeWorkspaceView}
        onSelectView={selectWorkspaceView}
        onShowHtmlSource={showHtmlSource}
        leftRailOpen={leftRailOpen}
        rightRailOpen={rightRailOpen}
        onToggleLeftRail={() => toggleRail("left")}
        onToggleRightRail={() => toggleRail("right")}
        {focusMode}
        onToggleFocusMode={toggleFocusMode}
    />

    {#if drawerMode && (leftRailOpen || rightRailOpen)}
        <button
            class="rail-backdrop"
            type="button"
            aria-label="패널 닫기"
            onclick={dismissRail}
        ></button>
    {/if}

    {#if workspace.invalidDraftRaw}
        <div class="draft-recovery-banner" role="alert">
            <span>
                저장된 초안을 읽지 못했습니다.
                {workspace.invalidDraftBackupKey
                    ? "원본을 브라우저 저장소에 별도로 보관했습니다."
                    : "원본을 보존하기 위해 자동 저장을 중단했습니다."}
            </span>
            <button type="button" onclick={workspace.downloadInvalidDraft}>원본 내려받기</button>
            <button
                type="button"
                disabled={!workspace.invalidDraftBackupKey && !workspace.invalidDraftDownloaded}
                onclick={workspace.resumeDraftSaving}>새 초안 저장 시작</button
            >
        </div>
    {/if}

    <div class="app-body">
        <BlockSidebar open={leftRailOpen} compact={drawerMode} onInsert={onPaletteInsert} onNavigate={onOutlineNavigate} {onPassageNavigate} />

        <section class="canvas" aria-label="글쓰기 작업 영역" inert={drawerMode && (leftRailOpen || rightRailOpen)}>
            {#if workspace.isStoragePanelOpen ||
                workspace.isLlmPanelOpen ||
                workspace.isMarkdownPanelOpen}
                <div class="panel-dock">
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
                            loadError={workspace.storageLoadError}
                            renameTarget={workspace.renameTarget}
                            onClose={() => (workspace.isStoragePanelOpen = false)}
                            onPresetNameInput={workspace.clearPresetState}
                            onSavePreset={workspace.saveCurrentPreset}
                            onApplyPreset={workspace.applyPreset}
                            onBeginPresetRename={workspace.beginPresetRename}
                            onSavePresetRename={workspace.savePresetRename}
                            onDeletePreset={workspace.deletePreset}
                            onSaveDraftHistory={() =>
                                workspace.saveDraftHistorySnapshot({ automatic: false })}
                            onRestoreDraftHistory={workspace.restoreDraftHistorySnapshot}
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
                            openRouterModelStateLabel={workspace.openRouterModelStateLabel}
                            openCodeGoModelStateLabel={workspace.openCodeGoModelStateLabel}
                            activeLlmProvider={workspace.activeLlmProvider}
                            llmGenerationState={workspace.llmGenerationState}
                            llmGenerationStateLabel={workspace.llmGenerationStateLabel}
                            isLlmGenerateDisabled={workspace.isLlmGenerateDisabled}
                            onSelectProvider={workspace.selectLlmProvider}
                            onInputModel={workspace.updateLlmModel}
                            onSelectModel={workspace.selectLlmModel}
                            onFocusModelInput={workspace.openLlmModelAutocomplete}
                            onBlurModelInput={workspace.closeLlmModelAutocompleteSoon}
                            onCloseModelAutocomplete={workspace.closeLlmModelAutocomplete}
                            onSetOpenRouterTopWeeklyOnly={workspace.setOpenRouterTopWeeklyOnly}
                            onRefreshModels={workspace.refreshOpenRouterModels}
                            onInputApiKey={workspace.markLlmInputChanged}
                            onChangeApiKey={() => {
                                if (workspace.llmProvider === "openrouter") {
                                    void workspace.refreshOpenRouterModels();
                                }
                            }}
                            onInputPrompt={workspace.markLlmInputChanged}
                            onGenerate={workspace.generateMarkdownWithLlm}
                            onClose={workspace.closeLlmPanel}
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
            {/if}

            <EditorCanvas hidden={activeWorkspaceView !== "editor"} {onSourceRequest} layoutRevision={focusMode ? 1 : 0} />
            <PreviewCanvas hidden={activeWorkspaceView !== "preview"} {onEmphasisNavigate} />

            {#if workspace.codeLineContextMenu}
                <div
                    class="code-line-context-menu"
                    role="menu"
                    tabindex="-1"
                    aria-label={`코드 ${workspace.codeLineRangeLabel(
                        workspace.codeLineContextMenu.range,
                    )}`}
                    style={`left:${workspace.codeLineContextMenu.x}px;` +
                        `top:${workspace.codeLineContextMenu.y}px`}
                    bind:this={workspace.codeLineContextMenuElement}
                    onpointerdown={(event) => event.stopPropagation()}
                >
                    <span class="code-line-context-title">
                        {workspace.codeLineRangeLabel(workspace.codeLineContextMenu.range)}
                    </span>
                    {#each workspace.codeLineMarkers as marker (marker)}
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
        </section>

        <InspectorPanel open={rightRailOpen} compact={drawerMode} {sourceRequest} {onSourceNavigate} onBlockAction={onInspectorBlockAction} />
    </div>

    <CopyRecovery />
    <CopiedOutputDialog />
</div>

<style>
    .draft-recovery-banner {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin: 12px 12px 0;
        padding: 12px;
        border: 1px solid #fcd34d;
        border-radius: var(--radius);
        background: #fffbeb;
        color: #78350f;
        font-size: 0.84rem;
    }

    .draft-recovery-banner button {
        padding: 6px 10px;
        border: 1px solid currentColor;
        border-radius: var(--radius-sm);
        background: transparent;
        color: inherit;
        font-weight: 600;
        cursor: pointer;
    }

    .draft-recovery-banner button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .code-line-context-menu {
        position: fixed;
        z-index: 95;
        display: grid;
        min-width: 176px;
        gap: 4px;
        padding: 7px;
        border: 1px solid var(--line);
        border-radius: var(--radius);
        background: var(--surface);
        box-shadow: var(--shadow-pop);
    }

    .code-line-context-title {
        padding: 5px 7px 4px;
        color: var(--muted);
        font-size: 0.72rem;
        line-height: 1.2;
    }

    .code-line-context-menu button {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        min-height: 32px;
        padding: 0 9px;
        border: 1px solid transparent;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--text);
        font-size: 0.84rem;
        font-weight: 550;
        cursor: pointer;
    }

    .code-line-context-menu button:hover,
    .code-line-context-menu button.active {
        border-color: var(--accent-line);
        background: var(--accent-soft);
        color: var(--accent-strong);
    }
</style>
