<script lang="ts">
    import { getContext } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import Check from "@lucide/svelte/icons/check";
    import Loader2 from "@lucide/svelte/icons/loader-circle";
    import Clipboard from "@lucide/svelte/icons/clipboard";
    import Monitor from "@lucide/svelte/icons/monitor";
    import Smartphone from "@lucide/svelte/icons/smartphone";
    import ReadingLayoutComparison from "./ReadingLayoutComparison.svelte";
    import { readingLayoutOptions } from "#lib/editor/reading-layout.ts";
    import EmphasisReview from "./EmphasisReview.svelte";
    import type { EmphasisPassage } from "#lib/editor/emphasis-review.ts";

    type Props = {
        hidden?: boolean;
        onEmphasisNavigate: (passage: EmphasisPassage) => void;
    };

    let { hidden = false, onEmphasisNavigate }: Props = $props();

    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);
    let previewWidth = $state<"fit" | "desktop" | "mobile">("fit");
    let comparing = $state(false);
    let reviewing = $state(false);
    let comparisonToggle = $state<HTMLButtonElement>();
    const layoutLabel = $derived(readingLayoutOptions.find((item) => item.value === workspace.readingLayout)!.label);
    const widths = [
        { value: "fit", label: "맞춤", width: "100%" },
        { value: "desktop", label: "PC", width: "960px" },
        { value: "mobile", label: "모바일", width: "390px" },
    ] as const;
    const selectedWidth = $derived(widths.find((item) => item.value === previewWidth)!);

    const renderStatusLabel = $derived(
        workspace.isRendering
            ? "업데이트 중"
            : workspace.previewError
              ? "업데이트 실패"
              : "업데이트 완료",
    );
</script>

<div class="canvas-view" hidden={hidden}>
    <div class="preview-head">
        <div class="preview-status">
            {#if workspace.isRendering}
                <span class="spin-icon"><Loader2 size={16} /></span>
            {:else if !workspace.previewError}
                <Check size={16} aria-hidden="true" />
            {/if}
            <span class="preview-status-label" role="status">{renderStatusLabel}</span>
        </div>

        <div class="preview-tools">
            {#if workspace.previewMode === "rendered"}
                <button class="ui-btn ui-btn--outline" type="button" aria-expanded={comparing} aria-controls="reading-layout-comparison" onclick={() => { comparing = !comparing; if (comparing) reviewing = false; }} bind:this={comparisonToggle}>
                    {comparing ? "비교 닫기" : "배치 비교"}
                </button>
                <button class="ui-btn ui-btn--outline" type="button" aria-expanded={reviewing} aria-controls="emphasis-review" disabled={workspace.editorMountState !== "ready"} onclick={() => { reviewing = !reviewing; if (reviewing) comparing = false; }}>
                    {reviewing ? "강조 점검 닫기" : "강조 점검"}
                </button>
                {#if !reviewing}
                <div class="ui-segmented" role="group" aria-label="미리보기 폭">
                    {#each widths as item (item.value)}
                        <button type="button" class:is-active={previewWidth === item.value} aria-pressed={previewWidth === item.value} title={item.value === "fit" ? "작업 영역에 맞춤" : `${item.label} ${item.width} 폭으로 확인`} onclick={() => (previewWidth = item.value)}>
                            {#if item.value === "desktop"}<Monitor size={14} aria-hidden="true" />{:else if item.value === "mobile"}<Smartphone size={14} aria-hidden="true" />{/if}
                            {item.label}
                        </button>
                    {/each}
                </div>
                {/if}
            {/if}
            <span class="status-pill" aria-label="현재 복붙 구조">DC 테이블</span>
            <span class="status-pill" aria-label="현재 글 배경">{workspace.documentThemeLabel}</span>
            <span class="status-pill" aria-label="현재 읽기 배치">{layoutLabel}</span>
            <div class="ui-segmented" aria-label="미리보기 형식">
                <button
                    class:is-active={workspace.previewMode === "rendered"}
                    type="button"
                    aria-pressed={workspace.previewMode === "rendered"}
                    onclick={() => (workspace.previewMode = "rendered")}
                >
                    미리보기
                </button>
                <button
                    class:is-active={workspace.previewMode === "source"}
                    type="button"
                    aria-pressed={workspace.previewMode === "source"}
                    onclick={() => (workspace.previewMode = "source")}
                >
                    HTML
                </button>
            </div>
            {#if workspace.previewMode === "source"}
                <button
                    class="ui-btn ui-btn--primary"
                    type="button"
                    onclick={workspace.copySourceHtml}
                    data-copy-trigger="source"
                    disabled={workspace.isCopying || !workspace.html || workspace.isRendering || !!workspace.previewError}
                >
                    {#if workspace.activeCopyChannel === "source"}
                        <span class="spin-icon"><Loader2 size={15} aria-hidden="true" /></span>
                    {:else if workspace.sourceCopyState === "copied"}
                        <Check size={15} aria-hidden="true" />
                    {:else}
                        <Clipboard size={15} aria-hidden="true" />
                    {/if}
                    <span>{workspace.sourceCopyLabel}</span>
                </button>
            {/if}
            <span class="preview-size" title="HTML 원문의 UTF-8 기준 용량">{workspace.isRendering ? "HTML 생성 중" : `HTML ${workspace.htmlSize}`}</span>
        </div>
    </div>

    {#if workspace.previewError}
        <div class="canvas-notice is-error" role="alert">
            <span>{workspace.previewError}</span>
            <button class="ui-btn ui-btn--outline" type="button" onclick={workspace.retryPreview}>
                다시 시도
            </button>
        </div>
    {/if}

    <div class="canvas-scroll">
        {#if workspace.previewMode === "rendered"}
            {#if reviewing}
                <EmphasisReview onNavigate={onEmphasisNavigate} />
            {:else if comparing && !hidden}
                <ReadingLayoutComparison width={selectedWidth.width} onapply={() => { comparing = false; comparisonToggle?.focus(); }} />
            {:else}
            <div class="preview-stage">
                <p class="preview-width-note">{previewWidth === "fit" ? "작업 영역에 맞춤" : `${selectedWidth.label} · ${selectedWidth.width} · 좁은 화면에서는 가로로 스크롤하세요`}</p>
            <div
                class="preview-surface"
                class:preview-surface-dark={workspace.documentTheme === "darkEditorial"}
                style:width={selectedWidth.width}
            >
                {#if workspace.html}
                    {@html workspace.html}
                {/if}
            </div>
            </div>
            {/if}
        {:else}
            <textarea
                class="html-source"
                readonly
                disabled={workspace.isRendering}
                spellcheck="false"
                aria-busy={workspace.isRendering}
                aria-label={workspace.isRendering ? "HTML 원문 생성 중" : workspace.previewError ? "이전 미리보기 HTML 원문" : "복사용 HTML 원문"}
                placeholder={workspace.isRendering ? "글에 맞는 HTML 원문을 만드는 중입니다." : ""}
                value={workspace.isRendering ? "" : workspace.html}
            ></textarea>
        {/if}
    </div>
</div>

<style>
    .preview-stage {
        min-height: 100%;
        padding: 16px;
        background: var(--panel-2);
        min-width: 100%;
    }

    .preview-width-note {
        margin: 0 0 10px;
        color: var(--muted);
        font-size: 0.74rem;
    }

    .preview-surface {
        margin: 0 auto;
        padding: 0;
        overflow: auto;
    }

    .html-source:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: -2px;
    }

    .preview-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        padding: 10px 16px;
        border-bottom: 1px solid var(--line);
        background: var(--surface);
    }

    .preview-status {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        color: var(--ok);
    }

    .preview-status-label {
        color: var(--muted);
        font-size: 0.8rem;
        font-weight: 600;
    }

    .preview-tools {
        display: inline-flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        flex-wrap: wrap;
        min-width: 0;
    }

    .status-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 26px;
        padding: 0 9px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: var(--panel-2);
        color: var(--muted);
        font-size: 0.74rem;
        font-weight: 650;
        white-space: nowrap;
    }

    .preview-size {
        color: var(--faint);
        font-size: 0.74rem;
        font-weight: 600;
        white-space: nowrap;
    }

    .canvas-notice {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 12px 16px 0;
        padding: 10px 12px;
        border: 1px solid var(--line);
        border-radius: var(--radius);
        background: var(--panel-2);
        font-size: 0.82rem;
    }

    .canvas-notice.is-error {
        border-color: #fecaca;
        background: #fef2f2;
        color: #991b1b;
    }
</style>
