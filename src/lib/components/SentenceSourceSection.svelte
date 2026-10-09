<script lang="ts">
    import { getContext } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import { maxSourceLabelLength, maxSourceExcerptLength, normalizeSentenceSource, sentenceSourceLabel } from "#lib/editor/sentence-source-format.ts";
    import { reuseDocumentSource } from "#lib/editor/document-sources.ts";

    let { onApplied }: { onApplied?: () => void } = $props();
    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);
    const selection = $derived(workspace.sentenceSourceSelection);
    const sources = $derived(workspace.documentSources);
    const target = $derived(JSON.stringify([selection.from, selection.to, selection.source, selection.mixed, workspace.documentReplacementVersion]));
    const sentence = $derived(workspace.editor?.state.doc.textBetween(selection.from, selection.to, " ").slice(0, 200) ?? "");
    let href = $state("");
    let label = $state("");
    let excerpt = $state("");
    let error = $state("");
    let reusableHref = $state("");

    $effect(() => {
        void target;
        href = selection.source?.href ?? "";
        label = selection.source?.label ?? "";
        excerpt = selection.source?.excerpt ?? "";
        error = "";
        reusableHref = "";
    });

    function reuse(selectedHref: string) {
        const entry = sources.find((item) => item.href === selectedHref);
        if (!entry) return;
        const draft = reuseDocumentSource({ href, label, excerpt }, entry);
        href = draft.href;
        label = draft.label;
        excerpt = draft.excerpt;
        error = "";
    }

    function apply(event: SubmitEvent) {
        event.preventDefault();
        if (!selection.canApply) return;
        const source = normalizeSentenceSource({ href, label, excerpt });
        if (!source) { error = "http 또는 https 자료 주소를 입력해 주세요."; return; }
        error = "";
        workspace.setSentenceSource(source);
        onApplied?.();
    }

    function remove() {
        if (!workspace.setSentenceSource(null)) return;
        onApplied?.();
    }
</script>

<section class="ui-section" aria-label="문장 출처">
    <span class="ui-section-title">문장 출처</span>
    {#if selection.canApply}
        <p class="source-sentence" aria-label="출처를 연결할 문장">{sentence}</p>
        {#if selection.mixed}<p class="ui-hint">선택 영역의 출처가 서로 다릅니다. 적용하면 같은 출처로 연결합니다.</p>{/if}
        {#if selection.source}
            <a class="source-open" href={selection.source.href} target="_blank" rel="noopener noreferrer">자료 열기 · {sentenceSourceLabel(selection.source)}</a>
        {/if}
    {:else}
        <p class="ui-hint">문장을 선택해 출처를 연결하세요. 연결한 문장을 누르면 자료를 수정할 수 있습니다.</p>
    {/if}
    {#if selection.canApply}
    <form class="source-form" onsubmit={apply}>
        {#if sources.length}
            <label class="ui-field">
                <span class="ui-label">이 글의 자료에서 선택</span>
                <select class="ui-select" aria-label="이 글의 자료에서 선택" bind:value={reusableHref} onchange={(event) => reuse(event.currentTarget.value)}>
                    <option value="">자료를 선택하세요</option>
                    {#each sources as source (source.href)}
                        <option value={source.href}>{sentenceSourceLabel({ href: source.href, label: source.label, excerpt: "" })}</option>
                    {/each}
                </select>
            </label>
            <p class="ui-hint">주소와 이름만 가져옵니다. 근거 원문은 문장마다 입력하세요.</p>
        {/if}
        <label class="ui-field">
            <span class="ui-label">자료 주소</span>
            <input id="sentence-source-href" class="ui-input" type="text" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://…" maxlength="4096" bind:value={href} disabled={!selection.canApply} aria-invalid={!!error} aria-describedby={error ? "sentence-source-error" : undefined} oninput={() => error = ""} />
        </label>
        <label class="ui-field">
            <span class="ui-label">자료 이름 <span class="source-optional">선택</span></span>
            <input class="ui-input" type="text" maxlength={maxSourceLabelLength} bind:value={label} disabled={!selection.canApply} placeholder="비워두면 사이트 이름을 표시합니다" />
        </label>
        <label class="ui-field">
            <span class="ui-label">근거 원문 <span class="source-optional">선택</span></span>
            <textarea class="ui-input source-excerpt" rows="4" maxlength={maxSourceExcerptLength} bind:value={excerpt} disabled={!selection.canApply} placeholder="이 문장을 뒷받침하는 부분을 붙여넣으세요"></textarea>
        </label>
        {#if error}<p id="sentence-source-error" class="source-error" role="alert">{error}</p>{/if}
        <div class="source-actions">
            <button class="ui-btn ui-btn--outline" type="submit" disabled={!selection.canApply}>출처 {selection.source ? "수정" : "연결"}</button>
            <button class="ui-btn ui-btn--outline" type="button" disabled={!selection.hasSource} onclick={remove}>출처 해제</button>
        </div>
    </form>
    <p class="ui-hint">복사할 때 문장 뒤에 출처 링크를 표시합니다. 근거 원문은 이 편집기에서 문장을 눌러 확인합니다.</p>
    {/if}
</section>

<style>
    .source-form { display: grid; gap: 12px; }
    .source-sentence { margin: 0; padding: 10px 12px; border-left: 2px solid var(--accent); background: var(--panel-2); font-size: 0.8rem; line-height: 1.6; overflow-wrap: anywhere; max-height: 100px; overflow: auto; }
    .source-optional { color: var(--muted); font-size: 0.7rem; font-weight: 400; }
    .source-excerpt { resize: vertical; min-height: 90px; line-height: 1.6; }
    .source-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .source-open { color: var(--accent); font-size: 0.8rem; overflow-wrap: anywhere; }
    .source-error { margin: 0; color: var(--danger, #b91c1c); font-size: 0.8rem; }
</style>
