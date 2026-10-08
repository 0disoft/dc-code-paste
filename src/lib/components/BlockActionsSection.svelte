<script lang="ts">
    import { getContext } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import ArrowUp from "@lucide/svelte/icons/arrow-up";
    import ArrowDown from "@lucide/svelte/icons/arrow-down";
    import Copy from "@lucide/svelte/icons/copy";
    import Trash2 from "@lucide/svelte/icons/trash";
    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);
    const actions = [
        {id: "up", label: "위로 이동", icon: ArrowUp},
        {id: "down", label: "아래로 이동", icon: ArrowDown},
        {id: "duplicate", label: "블록 복제", icon: Copy},
        {id: "delete", label: "블록 삭제", icon: Trash2},
    ] as const;
</script>
<section class="ui-section" aria-label="블록 작업">
    <span class="ui-section-title">블록 작업</span>
    <div class="block-actions">
        {#each actions as action (action.id)}
            {@const Icon = action.icon}
            <button class="ui-btn ui-btn--outline" type="button" aria-label={action.label}
                disabled={!workspace.selectedBlockActions[action.id]}
                onclick={() => workspace.runBlockAction(action.id)}>
                <Icon size={15} aria-hidden="true" /> {action.label}
            </button>
        {/each}
    </div>
    <p class="ui-hint">이동·복제·삭제는 실행 취소로 되돌릴 수 있습니다.</p>
</section>
<style>
    .block-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
</style>
