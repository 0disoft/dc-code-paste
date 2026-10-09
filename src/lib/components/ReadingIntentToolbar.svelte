<script lang="ts">
    import { getContext, onMount, tick, untrack } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import ReadingIntentSection from "./ReadingIntentSection.svelte";

    let { hidden = false, onSourceRequest }: { hidden?: boolean; onSourceRequest?: () => void } = $props();
    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);
    const selection = $derived(workspace.readingIntentSelection);
    let toolbar = $state<HTMLDivElement>();
    let position = $state<{ left: number; top: number } | null>(null);

    function updatePosition() {
        const current = workspace.editor;
        if (hidden || !selection.canApply || !current || current.isDestroyed ||
            workspace.isMarkdownPanelOpen || workspace.isStoragePanelOpen || workspace.isLlmPanelOpen) {
            position = null;
            return;
        }
        const start = current.view.coordsAtPos(current.state.selection.from);
        const end = current.view.coordsAtPos(current.state.selection.to);
        const canvas = current.view.dom.closest(".canvas-view")?.getBoundingClientRect();
        const headerBottom = Math.max(canvas?.top ?? 0, document.querySelector(".topbar")?.getBoundingClientRect().bottom ?? 0);
        const bottom = Math.min(canvas?.bottom ?? window.innerHeight, window.innerHeight);
        const left = Math.max(0, canvas?.left ?? 0);
        const right = Math.min(window.innerWidth, canvas?.right ?? window.innerWidth);
        if (end.bottom <= headerBottom || start.top >= bottom) { position = null; return; }
        const width = toolbar?.getBoundingClientRect().width ?? Math.min(320, window.innerWidth - 16);
        const height = toolbar?.getBoundingClientRect().height ?? 48;
        const above = start.top - height - 8;
        position = {
            left: Math.max(left + 8, Math.min(right - width - 8, (start.left + end.right - width) / 2)),
            top: Math.max(headerBottom + 8, Math.min(bottom - height - 8, above >= headerBottom + 8 ? above : end.bottom + 8)),
        };
    }

    $effect(() => {
        void selection;
        void hidden;
        void workspace.isMarkdownPanelOpen;
        void workspace.isStoragePanelOpen;
        void workspace.isLlmPanelOpen;
        untrack(updatePosition);
        void tick().then(updatePosition);
    });

    onMount(() => {
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);
        return () => {
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
        };
    });
</script>

{#if position}
    <div class="reading-intent-toolbar" bind:this={toolbar} role="toolbar" aria-label="선택 문장 읽는 의도" style:left={`${position.left}px`} style:top={`${position.top}px`}>
        <ReadingIntentSection compact {onSourceRequest} />
    </div>
{/if}

<style>
    .reading-intent-toolbar {
        position: fixed;
        z-index: 65;
        width: max-content;
        max-width: calc(100vw - 16px);
        padding: 6px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--surface);
        color: var(--text);
        box-shadow: var(--shadow-pop);
    }
    .reading-intent-toolbar :global(.ui-section) { padding: 0; border: 0; gap: 0; }
</style>
