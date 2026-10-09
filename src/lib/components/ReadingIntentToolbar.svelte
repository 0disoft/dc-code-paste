<script lang="ts">
    import { getContext, onMount, tick, untrack } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import ReadingIntentSection from "./ReadingIntentSection.svelte";
    import Bold from "@lucide/svelte/icons/bold";
    import Italic from "@lucide/svelte/icons/italic";
    import ChevronDown from "@lucide/svelte/icons/chevron-down";
    import { closeHistory } from "@tiptap/pm/history";
    import { readingIntentOptions } from "#lib/editor/reading-intent-format.ts";

    let { hidden = false, onSourceRequest, onRelationRequest, layoutRevision = 0 }: { hidden?: boolean; onSourceRequest?: () => void; onRelationRequest?: () => void; layoutRevision?: number } = $props();
    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);
    const selection = $derived(workspace.readingIntentSelection);
    let toolbar = $state<HTMLDivElement>();
    let position = $state<{ left: number; top: number } | null>(null);
    let dismissedSelection = $state<string | null>(null);
    let readingExpanded = $state(false);
    const readingLabel = $derived(selection.mixed ? "여러 의도" : readingIntentOptions.find((item) => item.value === selection.intent)?.shortLabel ?? "읽는 의도");

    function preserveSelection(event: PointerEvent) { event.preventDefault(); }

    function formatSelection(mark: "bold" | "italic") {
        if (!selection.canApply) return;
        workspace.runEditorCommand((current) => {
            const changed = current.chain().focus().command(({ tr }) => { closeHistory(tr); return true; }).toggleMark(mark).run();
            if (changed) current.view.dispatch(closeHistory(current.state.tr));
            return changed;
        });
    }

    $effect(() => {
        void workspace.editorSelectionRevision;
        void workspace.documentReplacementVersion;
        readingExpanded = false;
    });
    function selectionKey() {
        return `${workspace.editorSelectionRevision}:${workspace.documentReplacementVersion}:${selection.intent}:${selection.mixed}`;
    }

    $effect(() => {
        const action = workspace.selectionToolbarAction;
        if (action.revision) untrack(() => {
            dismissedSelection = action.dismiss ? selectionKey() : null;
            if (action.dismiss) readingExpanded = false;
        });
    });
    $effect(() => {
        void selection;
        if (dismissedSelection !== selectionKey()) dismissedSelection = null;
    });

    function updatePosition() {
        const current = workspace.editor;
        if (hidden || dismissedSelection === selectionKey() || !selection.canApply || !current || current.isDestroyed ||
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
        void workspace.documentReplacementVersion;
        void dismissedSelection;
        void hidden;
        void layoutRevision;
        void readingExpanded;
        void workspace.isMarkdownPanelOpen;
        void workspace.isStoragePanelOpen;
        void workspace.isLlmPanelOpen;
        untrack(updatePosition);
        void tick().then(updatePosition);
    });

    $effect(() => {
        if (!toolbar) return;
        const observer = new ResizeObserver(() => untrack(updatePosition));
        observer.observe(toolbar);
        return () => observer.disconnect();
    });

    onMount(() => {
        function handleEscape(event: KeyboardEvent) {
            const editorFocused = workspace.editor?.view.dom.contains(document.activeElement);
            const toolbarFocused = toolbar?.contains(document.activeElement);
            if (editorFocused && !event.isComposing && (
                event.key.startsWith("Arrow") || ["Home", "End", "PageUp", "PageDown"].includes(event.key) ||
                ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a")
            )) dismissedSelection = null;
            if (event.key === "Escape" && !hidden && selection.canApply && !event.isComposing && (editorFocused || toolbarFocused)) {
                event.preventDefault();
                event.stopPropagation();
                dismissedSelection = selectionKey();
                readingExpanded = false;
                position = null;
                if (toolbarFocused) workspace.editor?.commands.focus();
            }
        }
        window.addEventListener("keydown", handleEscape, true);
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);
        return () => {
            window.removeEventListener("keydown", handleEscape, true);
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
        };
    });
</script>

{#if position}
    <div class="reading-intent-toolbar" bind:this={toolbar} role="toolbar" aria-label="선택한 글자 도구" style:left={`${position.left}px`} style:top={`${position.top}px`}>
        <div class="selection-actions">
            <button class="ui-btn ui-btn--outline ui-btn--icon" class:is-active={workspace.isActive("bold")} type="button" aria-label="굵게" title="굵게" aria-pressed={workspace.isActive("bold")} onpointerdown={preserveSelection} onclick={() => formatSelection("bold")}><Bold size={16} aria-hidden="true" /></button>
            <button class="ui-btn ui-btn--outline ui-btn--icon" class:is-active={workspace.isActive("italic")} type="button" aria-label="기울임" title="기울임" aria-pressed={workspace.isActive("italic")} onpointerdown={preserveSelection} onclick={() => formatSelection("italic")}><Italic size={16} aria-hidden="true" /></button>
            <button class="ui-btn ui-btn--outline reading-toggle" class:is-active={selection.intent !== null || selection.mixed} type="button" aria-label="읽는 의도 선택" aria-expanded={readingExpanded} aria-controls="selection-reading-intents" onpointerdown={preserveSelection} onclick={() => readingExpanded = !readingExpanded}><span>{readingLabel}</span><ChevronDown size={14} aria-hidden="true" /></button>
            {#if onSourceRequest}<button class="ui-btn ui-btn--outline" type="button" aria-label="문장 출처 연결" onpointerdown={preserveSelection} onclick={onSourceRequest}>출처</button>{/if}
            {#if onRelationRequest}<button class="ui-btn ui-btn--outline" type="button" aria-label="문장 관계 연결" onpointerdown={preserveSelection} onclick={onRelationRequest}>관계</button>{/if}
        </div>
        {#if readingExpanded}
            <div class="selection-reading-intents" id="selection-reading-intents"><ReadingIntentSection compact /></div>
        {/if}
    </div>
{/if}

<style>
    .reading-intent-toolbar {
        position: fixed;
        z-index: 65;
        width: 288px;
        max-width: calc(100vw - 16px);
        padding: 6px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--surface);
        color: var(--text);
        box-shadow: var(--shadow-pop);
    }
    .reading-intent-toolbar :global(.ui-section) { padding: 0; border: 0; gap: 0; }
    .selection-actions { display: flex; align-items: center; gap: 4px; }
    .selection-actions .ui-btn { min-height: 32px; flex: 0 0 auto; }
    .selection-actions .ui-btn--icon { width: 32px; padding: 0; }
    .selection-actions .reading-toggle { flex: 1 1 auto; min-width: 0; justify-content: space-between; }
    .reading-toggle span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .selection-reading-intents { border-top: 1px solid var(--line); margin-top: 8px; padding-top: 8px; }
    .selection-reading-intents :global(.reading-intent-controls) { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; }
</style>
