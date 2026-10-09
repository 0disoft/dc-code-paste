<script lang="ts">
    import { getContext, tick } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import { maxThoughtFragmentLength, maxThoughtFragments } from "#lib/editor/thought-fragments-format.ts";
    import ThoughtFragmentCard from "./ThoughtFragmentCard.svelte";
    let { open, selectionStored = false, onClose, onInserted, onNavigate }: { open: boolean; selectionStored?: boolean; onClose: () => void; onInserted: () => void; onNavigate: (id: string) => void } = $props();
    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);
    const fragments = workspace.thoughtFragments;
    let dialog = $state<HTMLDialogElement>();
    let field = $state<HTMLTextAreaElement>();
    let draft = $state("");
    let status = $state("");
    let openedVersion = 0;
    let draftVersion = 0;
    $effect(() => {
        const version = workspace.documentReplacementVersion;
        if (version !== draftVersion) { draftVersion = version; draft = ""; }
        if (!dialog) return;
        if (open && !dialog.open) {
            openedVersion = workspace.documentReplacementVersion;
            status = selectionStored ? "선택한 글을 조각으로 보관했습니다. 본문은 그대로 있습니다." : "";
            dialog.showModal();
            void tick().then(() => { if (open && dialog?.open) field?.focus(); });
        } else if (!open && dialog.open) dialog.close();
    });
    const entries = $derived(open ? fragments.entries : []);
    function current() { return open && openedVersion === workspace.documentReplacementVersion; }
    function add() {
        if (current() && fragments.add(draft)) { draft = ""; status = "조각을 보관했습니다."; field?.focus(); }
    }
    function update(id: string, text: string, expected: string) { return current() && fragments.update(id, text, expected); }
    function remove(id: string) {
        if (current() && fragments.remove(id)) { status = "조각을 삭제했습니다. 본문에 넣었던 글은 그대로 있습니다."; field?.focus(); }
    }
    function insert(id: string, kind: "prose" | "code") { if (current() && fragments.insert(id, kind)) onInserted(); }
    function navigate(id: string) { if (current()) onNavigate(id); }
</script>

<dialog class="fragments-dialog" bind:this={dialog} aria-labelledby="thought-fragments-title" oncancel={onClose} onclose={onClose} onkeydown={(event) => event.stopPropagation()}>
    {#if open}
        <div class="fragments-content">
            <header><div><h2 id="thought-fragments-title">생각 조각</h2><p>정리하기 전 문장, 코드, 자료 주소를 일단 담아 두세요.</p></div><button class="ui-btn ui-btn--outline" type="button" aria-label="생각 조각 닫기" onclick={onClose}>닫기</button></header>
            <form onsubmit={(event) => { event.preventDefault(); add(); }}>
                <label for="thought-fragment-input">새 생각 조각</label>
                <textarea id="thought-fragment-input" class="ui-input" bind:this={field} bind:value={draft} rows="4" maxlength={maxThoughtFragmentLength}></textarea>
                <div class="fragments-actions"><p>{entries.length} / {maxThoughtFragments}개 · 초안에만 보관</p><button class="ui-btn ui-btn--primary" type="submit" disabled={!draft.trim() || entries.length >= maxThoughtFragments}>조각 보관</button></div>
            </form>
            <p class="fragments-hint">본문에 넣을 때 글과 코드를 고를 수 있습니다. 선택한 내용을 지우지 않고 그 뒤에 새 블록으로 넣습니다.</p>
            {#if fragments.error}<p class="fragments-error" role="alert">{fragments.error}</p>{/if}
            {#if status}<p class="fragments-hint" role="status">{status}</p>{/if}
            {#if !entries.length}<p class="fragments-hint">아직 보관한 조각이 없습니다.</p>{/if}
            <div class="fragments-list">
                {#each entries as entry, index (entry.fragment.id)}<ThoughtFragmentCard {entry} {index} onUpdate={update} onRemove={remove} onInsert={insert} onNavigate={navigate} />{/each}
            </div>
        </div>
    {/if}
</dialog>

<style>
    .fragments-dialog { width: min(760px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); padding: 0; border: 1px solid var(--line); border-radius: var(--radius-lg); background: var(--surface); color: var(--text); }
    .fragments-dialog::backdrop { background: rgb(0 0 0 / 45%); }
    .fragments-content { display: grid; gap: 14px; min-width: 0; padding: 20px; }
    header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    h2 { margin: 0; font-size: 1.1rem; }
    header p, .fragments-hint { margin: 6px 0 0; color: var(--muted); font-size: 0.8rem; line-height: 1.65; }
    form { display: grid; gap: 8px; min-width: 0; }
    label { font-size: 0.85rem; }
    textarea { width: 100%; resize: vertical; }
    .fragments-actions { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
    .fragments-actions p { margin: 0; color: var(--muted); font-size: 0.76rem; }
    .fragments-list { display: grid; gap: 12px; min-width: 0; }
    .fragments-error { margin: 0; color: var(--danger); font-size: 0.8rem; }
    button:focus-visible, textarea:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
    @media (max-width: 600px) { .fragments-content { padding: 14px; } button { min-height: 44px; } }
</style>
