<script lang="ts">
    import { getContext, tick, untrack } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import { maxThoughtFragmentLength, maxThoughtFragments } from "#lib/editor/thought-fragments-format.ts";
    import ThoughtFragmentCard, { type ThoughtFragmentEdit } from "./ThoughtFragmentCard.svelte";
    import { queryThoughtFragments, thoughtFragmentNeedsReview, type ThoughtFragmentFilter } from "#lib/editor/thought-fragment-query.ts";
    let { open, selectionStored = 0, dockAvailable = false, docked = false, onToggleDock, onClose, onInserted, onNavigate }: { open: boolean; selectionStored?: number; dockAvailable?: boolean; docked?: boolean; onToggleDock: () => void; onClose: () => void; onInserted: () => void; onNavigate: (id: string) => void } = $props();
    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);
    const fragments = workspace.thoughtFragments;
    let dialog = $state<HTMLDialogElement>();
    let field = $state<HTMLTextAreaElement>();
    let draft = $state("");
    // Cards unmount when another tool closes the panel; keep their unsaved edits here.
    let edits = $state<Record<string, ThoughtFragmentEdit | undefined>>({});
    let status = $state("");
    let query = $state("");
    let filter = $state<ThoughtFragmentFilter>("all");
    let searchField = $state<HTMLInputElement>();
    let openedVersion = 0;
    let draftVersion = 0;
    $effect(() => {
        const version = workspace.documentReplacementVersion;
        if (version !== draftVersion) { draftVersion = version; draft = ""; edits = {}; resetSearch(); }
        if (!dialog) return;
        if (open) {
            const wasOpen = dialog.open;
            const beside = docked && dockAvailable;
            if (!wasOpen || dialog.matches(":modal") === beside) {
                const focused = document.activeElement instanceof HTMLElement && dialog.contains(document.activeElement) ? document.activeElement : undefined;
                // Keep the same form and cards while switching presentation. A close
                // event from the mode switch must not dismiss the reopened panel.
                if (wasOpen) dialog.close();
                if (!wasOpen) { openedVersion = version; status = ""; }
                if (beside) dialog.show(); else dialog.showModal();
                void tick().then(() => {
                    if (!open || !dialog?.open) return;
                    if (focused?.isConnected) focused.focus({ preventScroll: true });
                    else if (!wasOpen) field?.focus();
                });
            }
        } else if (!open && dialog.open) dialog.close();
    });
    $effect(() => { if (open && selectionStored) { status = "선택한 글을 조각으로 보관했습니다. 본문은 그대로 있습니다."; resetSearch(); } });
    const entries = $derived(open ? fragments.entries : []);
    $effect(() => {
        if (!open) return;
        const ids = new Set(entries.map((entry) => entry.fragment.id));
        untrack(() => {
            for (const id of Object.keys(edits)) if (!ids.has(id)) delete edits[id];
        });
    });
    const matches = $derived(queryThoughtFragments(entries, query, filter));
    const visibleIds = $derived(new Set(matches.map((entry) => entry.fragment.id)));
    const unusedCount = $derived(entries.filter((entry) => !entry.uses.length).length);
    const reviewCount = $derived(entries.filter(thoughtFragmentNeedsReview).length);
    function resetSearch() { query = ""; filter = "all"; }
    function current() { return open && openedVersion === workspace.documentReplacementVersion; }
    function add() {
        if (current() && fragments.add(draft)) { draft = ""; resetSearch(); status = "조각을 보관했습니다."; field?.focus(); }
    }
    function update(id: string, text: string, expected: string) {
        if (!current() || !fragments.update(id, text, expected)) return false;
        status = "조각을 수정했습니다.";
        void tick().then(() => { if (current() && !visibleIds.has(id)) searchField?.focus({ preventScroll: true }); });
        return true;
    }
    function remove(id: string) {
        if (current() && fragments.remove(id)) { delete edits[id]; status = "조각을 삭제했습니다. 본문에 넣었던 글은 그대로 있습니다."; field?.focus(); }
    }
    function insert(id: string, kind: "prose" | "code") { if (current() && fragments.insert(id, kind)) onInserted(); }
    function navigate(id: string) { if (current()) onNavigate(id); }
</script>

<dialog class="fragments-dialog" class:is-docked={docked} bind:this={dialog} aria-labelledby="thought-fragments-title" aria-modal={docked ? "false" : "true"} oncancel={onClose} onclose={() => { if (!dialog?.open) onClose(); }} onkeydown={(event) => { event.stopPropagation(); if (docked && event.key === "Escape" && !event.isComposing) { event.preventDefault(); onClose(); } }}>
    {#if open}
        <div class="fragments-content">
            <header><div><h2 id="thought-fragments-title">생각 조각</h2><p>정리하기 전 문장, 코드, 자료 주소를 일단 담아 두세요.</p></div><button class="ui-btn ui-btn--outline" type="button" aria-label="생각 조각 닫기" onclick={onClose}>닫기</button></header>
            {#if dockAvailable}<button class="ui-btn ui-btn--outline dock-toggle" type="button" aria-label={docked ? "생각 조각 크게 열기" : "생각 조각 본문 곁에 두기"} aria-pressed={docked} onclick={onToggleDock}>{docked ? "크게 열기" : "본문 곁에 두기"}</button>{/if}
            <form onsubmit={(event) => { event.preventDefault(); add(); }}>
                <label for="thought-fragment-input">새 생각 조각</label>
                <textarea id="thought-fragment-input" class="ui-input" bind:this={field} bind:value={draft} rows="4" maxlength={maxThoughtFragmentLength}></textarea>
                <div class="fragments-actions"><p>{entries.length} / {maxThoughtFragments}개 · 초안에만 보관</p><button class="ui-btn ui-btn--primary" type="submit" disabled={!draft.trim() || entries.length >= maxThoughtFragments}>조각 보관</button></div>
            </form>
            <p class="fragments-hint">본문에 넣을 때 글과 코드를 고를 수 있습니다. 선택한 내용을 지우지 않고 그 뒤에 새 블록으로 넣습니다. 넣은 자리는 조각을 새로 넣은 구간만 표시합니다.</p>
            {#if fragments.error}<p class="fragments-error" role="alert">{fragments.error}</p>{/if}
            {#if status}<p class="fragments-hint" role="status" aria-label="생각 조각 작업 결과">{status}</p>{/if}
            {#if entries.length}
                <div class="fragment-filters">
                    <label for="thought-fragment-search">생각 조각 검색</label>
                    <input id="thought-fragment-search" class="ui-input" type="search" maxlength="256" placeholder="보관한 내용과 넣은 구간에서 찾기" bind:this={searchField} bind:value={query} />
                    <label for="thought-fragment-filter">생각 조각 보기</label>
                    <select id="thought-fragment-filter" class="ui-input" bind:value={filter}>
                        <option value="all">전체 ({entries.length})</option>
                        <option value="unused">아직 넣지 않음 ({unusedCount})</option>
                        <option value="review">다시 확인 ({reviewCount})</option>
                    </select>
                    <div class="fragments-actions"><p role="status" aria-label="생각 조각 검색 결과">{entries.length}개 중 {matches.length}개 표시</p>{#if query || filter !== "all"}<button class="ui-btn ui-btn--outline" type="button" onclick={() => { resetSearch(); searchField?.focus(); }}>검색 조건 지우기</button>{/if}</div>
                </div>
            {/if}
            {#if !entries.length}<p class="fragments-hint">아직 보관한 조각이 없습니다.</p>{/if}
            {#if entries.length && !matches.length}<p class="fragments-hint">조건에 맞는 조각이 없습니다. 검색어나 보기 조건을 바꿔 보세요.</p>{/if}
            <div class="fragments-list">
                {#each entries as entry, index (entry.fragment.id)}<div class="fragment-slot" hidden={!visibleIds.has(entry.fragment.id)}><ThoughtFragmentCard {entry} {index} bind:editState={edits[entry.fragment.id]} visible={visibleIds.has(entry.fragment.id)} onUpdate={update} onRemove={remove} onInsert={insert} onNavigate={navigate} /></div>{/each}
            </div>
        </div>
    {/if}
</dialog>

<style>
    .fragments-dialog { width: min(760px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); padding: 0; border: 1px solid var(--line); border-radius: var(--radius-lg); background: var(--surface); color: var(--text); }
    .fragments-dialog::backdrop { background: rgb(0 0 0 / 45%); }
    .fragments-dialog.is-docked { position: static; flex: 0 0 clamp(320px, 26vw, 380px); width: clamp(320px, 26vw, 380px); min-width: 0; min-height: 0; max-height: none; margin: 0; border: 0; border-left: 1px solid var(--line); border-radius: 0; overflow-y: auto; overscroll-behavior: contain; }
    .is-docked .fragments-content { padding: 18px; }
    .dock-toggle { justify-self: start; }
    .fragments-content { display: grid; gap: 14px; min-width: 0; padding: 20px; }
    header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    h2 { margin: 0; font-size: 1.1rem; }
    header p, .fragments-hint { margin: 6px 0 0; color: var(--muted); font-size: 0.8rem; line-height: 1.65; }
    form { display: grid; gap: 8px; min-width: 0; }
    label { font-size: 0.85rem; }
    textarea { width: 100%; height: auto; min-height: 7rem; resize: vertical; }
    .fragments-actions { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
    .fragments-actions p { margin: 0; color: var(--muted); font-size: 0.76rem; }
    .fragments-list { display: grid; gap: 12px; min-width: 0; }
    .fragment-filters { display: grid; gap: 8px; min-width: 0; }
    .fragment-filters .ui-input, .fragment-slot { min-width: 0; }
    .fragments-error { margin: 0; color: var(--danger); font-size: 0.8rem; }
    button:focus-visible, textarea:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
    @media (max-width: 600px) { .fragments-content { padding: 14px; } button { min-height: 44px; } }
</style>
