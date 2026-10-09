<script module lang="ts">
    export type ThoughtFragmentEdit = { draft: string; baseline: string };
</script>

<script lang="ts">
    import { tick } from "svelte";
    import type { ThoughtFragmentEntry } from "#lib/editor/thought-fragments.ts";
    import { maxThoughtFragmentLength } from "#lib/editor/thought-fragments-format.ts";
    import { thoughtFragmentNeedsReview } from "#lib/editor/thought-fragment-query.ts";
    let { entry, index, visible = true, editState = $bindable(), onUpdate, onRemove, onInsert, onNavigate }: {
        entry: ThoughtFragmentEntry;
        index: number;
        visible?: boolean;
        editState?: ThoughtFragmentEdit;
        onUpdate: (id: string, text: string, expected: string) => boolean;
        onRemove: (id: string) => void;
        onInsert: (id: string, kind: "prose" | "code") => void;
        onNavigate: (id: string) => void;
    } = $props();
    const editing = $derived(editState !== undefined);
    let usesOpen = $state(false);
    let field = $state<HTMLTextAreaElement>();
    let editButton = $state<HTMLButtonElement>();
    const fieldId = $derived(`thought-fragment-${entry.fragment.id}`);
    const stateLabels = { linked: "그대로 있음", changed: "본문이 바뀜", missing: "구간 사라짐", duplicated: "표시가 여러 곳에 있음" };
    function edit() {
        if (!editState) editState = { draft: entry.fragment.text, baseline: entry.fragment.text };
        void tick().then(() => field?.focus());
    }
    function cancel() { editState = undefined; editButton?.focus({ preventScroll: true }); }
    function save() { if (editState && onUpdate(entry.fragment.id, editState.draft, editState.baseline)) cancel(); }
</script>

<article class="fragment-card" aria-label={`생각 조각 ${index + 1}`}>
    <div class="fragment-head"><strong>조각 {index + 1}</strong><span class:needs-review={thoughtFragmentNeedsReview(entry)}>{entry.uses.length ? `${thoughtFragmentNeedsReview(entry) ? "다시 확인 · " : ""}넣은 자리 ${entry.uses.length}` : "아직 넣지 않음"}</span></div>
    {#if editState}
        <label for={fieldId}>보관할 조각 내용</label>
        <textarea class="ui-input" id={fieldId} bind:this={field} bind:value={editState.draft} maxlength={maxThoughtFragmentLength} rows="4" onkeydown={(event) => { if (event.key === "Escape" && !event.isComposing) { event.preventDefault(); event.stopPropagation(); cancel(); } }}></textarea>
        <div class="fragment-actions"><button class="ui-btn ui-btn--primary" type="button" disabled={!editState.draft.trim()} onclick={save}>조각 수정 저장</button><button class="ui-btn ui-btn--outline" type="button" onclick={cancel}>조각 수정 취소</button></div>
    {:else}
        <pre class="fragment-text">{entry.fragment.text}</pre>
    {/if}
    <div class="fragment-actions">
        <button class="ui-btn ui-btn--outline" type="button" disabled={editing} onclick={() => onInsert(entry.fragment.id, "prose")}>글로 넣기</button>
        <button class="ui-btn ui-btn--outline" type="button" disabled={editing} onclick={() => onInsert(entry.fragment.id, "code")}>코드로 넣기</button>
        <button class="ui-btn ui-btn--outline" type="button" bind:this={editButton} onclick={edit}>조각 수정</button>
        <button class="ui-btn ui-btn--outline" type="button" onclick={() => onRemove(entry.fragment.id)}>조각 삭제</button>
    </div>
    {#if entry.uses.length}
        <details class="fragment-uses" bind:open={usesOpen}><summary>넣은 자리 보기</summary>
            {#if usesOpen && visible}
            {#each entry.uses as useEntry, useIndex (useEntry.use.id)}
                <section class="fragment-use" data-use-state={useEntry.state} aria-label={`조각 ${index + 1} 넣은 자리 ${useIndex + 1}`}>
                    <strong>{useEntry.use.kind === "code" ? "코드" : "글"} · {stateLabels[useEntry.state]}</strong>
                    {#if useEntry.sourceChanged}<p class="fragment-hint">지금의 조각과 넣을 당시 내용이 다릅니다.</p>{/if}
                    {#each useEntry.parts as part, partIndex (part.reference.id)}
                        <div class="fragment-part">
                            <pre class="fragment-text">{part.matches.length === 1 ? part.matches[0].text : part.reference.text}</pre>
                            {#if part.matches.length !== 1}<p class="fragment-hint">넣을 당시 내용</p>{:else if part.matches[0].text !== part.reference.text}<details><summary>넣을 당시 내용 보기</summary><pre class="fragment-text">{part.reference.text}</pre></details>{/if}
                            <button class="ui-btn ui-btn--outline" type="button" disabled={part.matches.length !== 1} aria-label={`조각 ${index + 1} 넣은 자리 ${useIndex + 1} 구간 ${partIndex + 1} 이동`} onclick={() => onNavigate(part.reference.id)}>본문으로 이동</button>
                        </div>
                    {/each}
                </section>
            {/each}
            {/if}
        </details>
    {/if}
</article>

<style>
    .fragment-card { display: grid; gap: 10px; min-width: 0; padding: 14px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel-2); }
    .fragment-head, .fragment-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
    .fragment-head { justify-content: space-between; font-size: 0.84rem; }
    .fragment-head span, .fragment-hint, label, summary { color: var(--muted); font-size: 0.78rem; }
    .fragment-head .needs-review { color: var(--accent-strong); font-weight: 600; }
    .fragment-hint { margin: 0; line-height: 1.65; }
    .fragment-text { margin: 0; max-height: 180px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; font-size: 0.84rem; line-height: 1.7; }
    textarea { width: 100%; height: auto; min-height: 7rem; resize: vertical; }
    summary { padding-block: 4px; cursor: pointer; }
    .fragment-use { display: grid; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--line); font-size: 0.8rem; }
    .fragment-part { display: grid; gap: 8px; min-width: 0; }
    button:focus-visible, textarea:focus-visible, summary:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
    @media (max-width: 600px) { button { min-height: 44px; } }
</style>
