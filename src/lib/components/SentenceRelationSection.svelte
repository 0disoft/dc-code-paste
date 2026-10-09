<script lang="ts">
    import { getContext } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import { sentenceRelationKinds, normalizeCustomRelationLabel, maxRelationLabelLength, type SentenceRelationKind } from "#lib/editor/sentence-relations-format.ts";
    import type { RelationAnchor } from "#lib/editor/sentence-relations.ts";
    import SentenceRelationsList from "./SentenceRelationsList.svelte";
    let { request = 0, onApplied, onNavigate, onCompare }: { request?: number; onApplied?: () => void; onNavigate: (anchor: RelationAnchor) => void; onCompare: (id: string) => void } = $props();
    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);
    let open = $state(false);
    let kind = $state<SentenceRelationKind>("condition");
    let name = $state("");
    const selection = $derived(workspace.sentenceRelationSelection);
    const canBegin = $derived(!!selection && (kind !== "custom" || !!normalizeCustomRelationLabel(name)));
    $effect(() => { if (request) open = true; });
    function begin() { if (workspace.beginSentenceRelation(kind, name)) onApplied?.(); }
</script>

<details class="ui-disclosure" bind:open>
    <summary>문장 관계</summary>
    <section class="ui-section" aria-label="문장 관계 연결">
        <p class="ui-hint">함께 읽을 두 구간을 연결합니다. 관계 이름을 직접 붙일 수도 있습니다.</p>
        {#if selection}<p class="selected-passage" aria-label="관계를 시작할 구간">{selection.parts.map((part) => part.text).join("\n")}</p>{/if}
        <label class="ui-field"><span class="ui-label">연결할 관계</span><select class="ui-select" id="sentence-relation-kind" aria-label="연결할 관계" bind:value={kind} disabled={!!workspace.pendingSentenceRelation}>{#each sentenceRelationKinds as item (item.value)}<option value={item.value}>{item.label}</option>{/each}</select></label>
        {#if kind === "custom"}
            <label class="ui-field"><span class="ui-label">관계 이름</span><input class="ui-input" aria-label="관계 이름" placeholder="예: 다시 떠오르는 장면" maxlength={maxRelationLabelLength} disabled={!!workspace.pendingSentenceRelation} bind:value={name} /></label>
            <p class="ui-hint">두 구간이 어떻게 이어지는지 한 줄로 적어 주세요. 최대 {maxRelationLabelLength}자입니다.</p>
        {/if}
        <button class="ui-btn ui-btn--outline" type="button" disabled={!canBegin || !!workspace.pendingSentenceRelation} onclick={begin}>연결 시작</button>
        <p class="ui-hint">구간마다 8,000자까지 선택할 수 있습니다. 코드는 제외합니다.</p>
        <SentenceRelationsList entries={workspace.selectedSentenceRelations} {onNavigate} {onCompare} onRemoved={onApplied} label="선택한 구간의 관계" />
    </section>
</details>

<style>
    .selected-passage { margin: 0; max-height: 150px; overflow: auto; padding: 10px; border-left: 2px solid var(--accent); background: var(--panel-2); color: var(--text); font-size: 0.8rem; line-height: 1.65; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
