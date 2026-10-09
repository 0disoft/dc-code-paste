<script lang="ts">
    import { getContext } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import { sentenceRelationKinds, type SentenceRelationKind } from "#lib/editor/sentence-relations-format.ts";
    import type { RelationAnchor } from "#lib/editor/sentence-relations.ts";
    import SentenceRelationsList from "./SentenceRelationsList.svelte";
    let { request = 0, onApplied, onNavigate, onCompare }: { request?: number; onApplied?: () => void; onNavigate: (anchor: RelationAnchor) => void; onCompare: (id: string) => void } = $props();
    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);
    let open = $state(false);
    let kind = $state<SentenceRelationKind>("condition");
    const selection = $derived(workspace.sentenceRelationSelection);
    $effect(() => { if (request) open = true; });
    function begin() { if (workspace.beginSentenceRelation(kind)) onApplied?.(); }
</script>

<details class="ui-disclosure" bind:open>
    <summary>문장 관계</summary>
    <section class="ui-section" aria-label="문장 관계 연결">
        <p class="ui-hint">처음 구간을 정한 뒤, 그 구간의 근거·조건·반론을 연결합니다.</p>
        {#if selection}<p class="selected-passage" aria-label="관계를 시작할 구간">{selection.parts.map((part) => part.text).join("\n")}</p>{/if}
        <label class="ui-field"><span class="ui-label">연결할 관계</span><select class="ui-select" id="sentence-relation-kind" aria-label="연결할 관계" bind:value={kind} disabled={!!workspace.pendingSentenceRelation}>{#each sentenceRelationKinds as item (item.value)}<option value={item.value}>{item.label}</option>{/each}</select></label>
        <button class="ui-btn ui-btn--outline" type="button" disabled={!selection || !!workspace.pendingSentenceRelation} onclick={begin}>연결 시작</button>
        <p class="ui-hint">구간마다 8,000자까지 선택할 수 있습니다. 코드는 제외합니다.</p>
        <SentenceRelationsList entries={workspace.selectedSentenceRelations} {onNavigate} {onCompare} onRemoved={onApplied} label="선택한 구간의 관계" />
    </section>
</details>

<style>
    .selected-passage { margin: 0; max-height: 150px; overflow: auto; padding: 10px; border-left: 2px solid var(--accent); background: var(--panel-2); color: var(--text); font-size: 0.8rem; line-height: 1.65; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
