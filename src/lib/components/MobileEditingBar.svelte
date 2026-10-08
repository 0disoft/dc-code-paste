<script lang="ts">
    import { getContext } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import Undo2 from "@lucide/svelte/icons/undo-2";
    import Redo2 from "@lucide/svelte/icons/redo-2";
    let { status }: { status: string } = $props();
    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);
</script>

<div class="mobile-editing-bar" aria-label="모바일 편집 도구">
    <button type="button" class="ui-btn" aria-label="실행 취소" disabled={!workspace.canUndo()}
        onclick={() => workspace.runEditorCommand((current) => current.chain().focus().undo().run())}>
        <Undo2 size={16} aria-hidden="true" /> 취소
    </button>
    <button type="button" class="ui-btn" aria-label="다시 실행" disabled={!workspace.canRedo()}
        onclick={() => workspace.runEditorCommand((current) => current.chain().focus().redo().run())}>
        <Redo2 size={16} aria-hidden="true" /> 다시
    </button>
    <span role="status" title={status}>{status}</span>
</div>

<style>
    .mobile-editing-bar { display: none; }
    @media (max-width: 600px) {
        .mobile-editing-bar {
            display: flex; align-items: center; gap: 4px;
            height: 40px; flex: 0 0 40px; padding: 0 8px;
            background: var(--surface); border-bottom: 1px solid var(--line);
        }
        span { margin-left: auto; min-width: 0; font-size: 11px; color: var(--muted);
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        button { padding-inline: 5px; font-size: 12px; }
    }
</style>
