<script lang="ts">
    import { getContext, tick } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import type { RelationAnchor, SentenceRelationEntry, RelationState } from "#lib/editor/sentence-relations.ts";
    import { sentenceRelationKinds } from "#lib/editor/sentence-relations-format.ts";
    let { entries, onNavigate, onRemoved, label = "문장 관계 목록" }: { entries: SentenceRelationEntry[]; onNavigate: (anchor: RelationAnchor) => void; onRemoved?: () => void; label?: string } = $props();
    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);
    let list = $state<HTMLElement>();
    const messages: Record<RelationState, string> = {
        linked: "연결한 구간이 유지되고 있습니다.",
        changed: "연결한 구간의 문장 또는 순서가 바뀌었습니다.",
        missing: "연결한 구간 일부가 없습니다. 연결 당시 원문을 확인하세요.",
        duplicated: "같은 표시가 여러 곳에 있습니다. 대상 구간을 확인하세요.",
    };
    async function remove(id: string) {
        if (!workspace.removeSentenceRelation(id)) return;
        if (onRemoved) onRemoved();
        else { await tick(); list?.focus({ preventScroll: true }); }
    }
</script>

<section class="relation-list" aria-label={label} tabindex="-1" bind:this={list}>
    <p class="ui-hint">작성자가 연결한 근거·조건·반론입니다. 관계와 연결 당시 원문은 초안에 보관합니다.</p>
    {#each entries as entry, index (entry.relation.id)}
        {@const kind = sentenceRelationKinds.find((item) => item.value === entry.relation.kind)!.label}
        <article class="relation-item" data-relation-state={entry.state} aria-label={`${kind} 관계 ${index + 1}`}>
            <div class="relation-head"><strong>{kind}</strong><span>{entry.state === "linked" ? "연결됨" : "다시 확인"}</span></div>
            {#if entry.state !== "linked"}<p class="relation-status" role="status">{messages[entry.state]}</p>{/if}
            {#each [{ label: "처음 선택한 구간", endpoint: entry.claim }, { label: `${kind} 구간`, endpoint: entry.related }] as side (side.label)}
                <div class="relation-side">
                    <h3>{side.label}</h3>
                    {#each side.endpoint.parts as part, partIndex (part.reference.id)}
                        <p class="relation-text">{part.matches.length === 1 ? part.matches[0].text : part.reference.text}</p>
                        {#if part.matches.length !== 1}<span class="relation-snapshot">연결 당시 원문 · {part.matches.length ? "표시가 여러 곳에 있음" : "구간 없음"}</span>{/if}
                        <button class="ui-btn ui-btn--outline" type="button" disabled={part.matches.length !== 1} aria-label={`${side.label} ${partIndex + 1} 이동`} onclick={() => onNavigate(part.matches[0])}>원문으로 이동{side.endpoint.parts.length > 1 ? ` · ${partIndex + 1}` : ""}</button>
                    {/each}
                </div>
            {/each}
            <button class="ui-btn ui-btn--outline relation-remove" type="button" aria-label={`문장 관계 ${index + 1} 해제`} onclick={() => remove(entry.relation.id)}>관계 해제</button>
        </article>
    {/each}
    {#if !entries.length}<p class="ui-hint">아직 연결한 관계가 없습니다. 글에서 구간을 선택하고 ‘관계’를 눌러 시작하세요.</p>{/if}
</section>

<style>
    .relation-list { display: grid; gap: 12px; outline: none; }
    .relation-list > p { margin: 0; }
    .relation-item { display: grid; gap: 12px; min-width: 0; padding: 12px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); }
    .relation-item[data-relation-state="missing"], .relation-item[data-relation-state="duplicated"] { border-color: var(--accent-line); }
    .relation-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .relation-head strong { color: var(--text); font-size: 0.86rem; }
    .relation-head span, .relation-snapshot { color: var(--muted); font-size: 0.72rem; }
    .relation-status { margin: 0; color: var(--accent-strong); font-size: 0.78rem; line-height: 1.65; }
    .relation-side { display: grid; gap: 8px; min-width: 0; }
    .relation-side h3 { margin: 0; color: var(--muted); font-size: 0.75rem; font-weight: 500; }
    .relation-text { margin: 0; color: var(--text); font-size: 0.85rem; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.7; }
    .relation-side button, .relation-remove { min-height: 36px; width: 100%; }
    .relation-remove { border-top-color: var(--line); color: var(--muted); }
    @media (max-width: 600px) { .relation-side button, .relation-remove { min-height: 44px; } }
</style>
