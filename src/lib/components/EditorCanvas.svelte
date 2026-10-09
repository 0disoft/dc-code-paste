<script lang="ts">
    import { getContext } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import { safeDcProseFontFamily } from "#lib/dc/font-stacks.ts";
    import { compositeColor } from "#lib/dc/sanitize-style.ts";
    import { documentTextColors } from "#lib/dc/document-colors.ts";
    import { isPaletteBlockKind } from "#lib/editor/block-inspector.ts";
    import ReadingIntentToolbar from "./ReadingIntentToolbar.svelte";
    import { readingLayoutMetrics } from "#lib/editor/reading-layout.ts";

    type Props = {
        hidden?: boolean;
        onSourceRequest?: () => void;
    };

    let { hidden = false, onSourceRequest }: Props = $props();

    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);
    const colors = $derived(documentTextColors[workspace.documentTheme]);
    const layout = $derived(readingLayoutMetrics(workspace.readingLayout));

    const BLOCK_MIME = "application/x-dc-block";

    function dragCarriesBlock(event: DragEvent): boolean {
        const types = event.dataTransfer?.types;
        if (!types) return false;
        for (const type of types) {
            if (type === BLOCK_MIME) return true;
        }
        return false;
    }

    function handleDragOver(event: DragEvent) {
        if (!dragCarriesBlock(event)) return;
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = "copy";
        }
    }

    /**
     * ProseMirror handles drops inside the editable and marks them with
     * preventDefault, so this only catches drops on the surface around it.
     */
    function handleDrop(event: DragEvent) {
        if (event.defaultPrevented) return;
        const kind = event.dataTransfer?.getData(BLOCK_MIME) ?? "";
        if (!isPaletteBlockKind(kind)) return;
        event.preventDefault();
        workspace.insertPaletteBlock(kind, { x: event.clientX, y: event.clientY });
    }
</script>

<div class="canvas-view" hidden={hidden}>
    <ReadingIntentToolbar {hidden} {onSourceRequest} />
    {#if workspace.editorMountState === "error"}
        <div class="canvas-notice is-error" role="alert">
            <span>편집기를 열지 못했습니다. 저장된 초안은 그대로 있습니다.</span>
            <button class="ui-btn ui-btn--outline" type="button" onclick={workspace.retryEditor}>
                다시 시도
            </button>
        </div>
    {:else if workspace.editorMountState === "loading"}
        <p class="canvas-notice" role="status">편집기 여는 중</p>
    {/if}

    <div class="canvas-scroll">
        <div
            class="editor-surface"
            class:editor-surface-dark={workspace.documentTheme === "darkEditorial"}
            class:editor-surface-clean={workspace.documentTheme === "cleanEditorial"}
            style={`--editor-article-background:${colors.background};--editor-article-color:${compositeColor(colors.fallback, colors.background)};` +
                `--editor-body-font-family:${safeDcProseFontFamily(workspace.bodyFontFamily)};` +
                `--editor-body-font-size:${workspace.bodyFontSize};` +
                `--editor-prose-line-height:${layout.lineHeight};--editor-paragraph-gap:${layout.paragraphGap}px;` +
                `--editor-list-line-height:${layout.listLineHeight};--editor-list-item-gap:${layout.listItemGap}px;` +
                `--editor-code-font-size:${workspace.codeFontSize}`}
            bind:this={workspace.editorHost}
            role="group"
            aria-label="글쓰기 편집기"
            ondragover={handleDragOver}
            ondrop={handleDrop}
        ></div>
    </div>
</div>

<style>
    .canvas-notice {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 12px 16px 0;
        padding: 10px 12px;
        border: 1px solid var(--line);
        border-radius: var(--radius);
        background: var(--panel-2);
        color: var(--muted);
        font-size: 0.82rem;
    }

    .canvas-notice.is-error {
        border-color: #fecaca;
        background: #fef2f2;
        color: #991b1b;
    }
</style>
