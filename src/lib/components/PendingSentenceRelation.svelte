<script lang="ts">
    import { getContext } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import { sentenceRelationKinds } from "#lib/editor/sentence-relations-format.ts";
    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);
    const pending = $derived(workspace.pendingSentenceRelation);
    const selection = $derived(workspace.sentenceRelationSelection);
    const kind = $derived(sentenceRelationKinds.find((item) => item.value === pending?.kind)?.label);
    const overlaps = $derived(!!pending && !!selection && pending.passage.parts.some((first) => selection.parts.some((second) => first.from < second.to && first.to > second.from)));
    function cancel() { workspace.cancelSentenceRelation(); workspace.editor?.commands.focus(); }
</script>

{#if pending || workspace.sentenceRelationError}
    <section class="pending-relation" aria-label="문장 관계 연결 중">
        {#if pending}
            <p class="pending-hint" role="status">{kind} 구간을 선택한 뒤 연결하세요.</p>
            <details><summary>처음 선택한 구간 보기</summary><p class="pending-text">{pending.passage.parts.map((part) => part.text).join("\n")}</p></details>
        {/if}
        {#if workspace.sentenceRelationError}<p class="pending-error" role="alert">{workspace.sentenceRelationError}</p>{/if}
        <div class="pending-actions">
            {#if pending}<button class="ui-btn ui-btn--outline" type="button" disabled={!selection || overlaps} onpointerdown={(event) => event.preventDefault()} onclick={workspace.connectSentenceRelation}>선택한 구간 연결</button>{/if}
            <button class="ui-btn ui-btn--outline" type="button" onclick={cancel}>{pending ? "관계 연결 취소" : "닫기"}</button>
        </div>
    </section>
{/if}

<style>
    .pending-relation { flex: 0 0 auto; display: grid; gap: 8px; margin: 12px 16px 0; padding: 12px; border: 1px solid var(--accent-line); border-radius: var(--radius); background: var(--surface); color: var(--text); }
    .pending-hint, .pending-error { margin: 0; font-size: 0.85rem; line-height: 1.6; }
    .pending-error { color: var(--accent-strong); }
    .pending-relation summary { color: var(--muted); cursor: pointer; font-size: 0.78rem; }
    .pending-text { margin: 8px 0 0; max-height: 120px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.65; font-size: 0.82rem; }
    .pending-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    @media (max-width: 600px) { .pending-relation { margin-inline: 8px; } .pending-actions button { min-height: 44px; } }
</style>
