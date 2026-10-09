<script lang="ts">
    import { getContext } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import type { ReadingPassage } from "#lib/editor/reading-path.ts";
    import { readingIntentOptions, type ReadingIntent } from "#lib/editor/reading-intent-format.ts";

    let { intent, onNavigate }: { intent: ReadingIntent; onNavigate: (passage: ReadingPassage) => void } = $props();
    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);
    let query = $state("");
    const label = $derived(readingIntentOptions.find((item) => item.value === intent)!.label);
    const passages = $derived(workspace.readingPassages.filter((passage) => passage.intent === intent));
    const filtered = $derived(passages.filter((passage) => `${passage.heading} ${passage.text}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));
    const active = $derived(filtered.findIndex((passage) => passage.from === workspace.activeReadingPassage?.from && passage.to === workspace.activeReadingPassage?.to));
    function go(index: number) { const passage = filtered[index]; if (passage) onNavigate(passage); }
</script>

<section class="reading-path" aria-label={`${label} 읽기 경로`}>
    <div class="path-tools">
        <p class="ui-hint">표시한 구간을 원문 순서대로 읽고, 누르면 원문으로 이동합니다.</p>
        <input class="ui-input" type="search" aria-label="읽기 구간 검색" placeholder="본문이나 소제목으로 찾기" bind:value={query} />
        <div class="path-navigation">
            <span class="path-count" role="status">{query.trim() ? `${filtered.length}개 찾음 / ` : ""}총 {passages.length}개 구간</span>
            <button class="ui-btn ui-btn--outline" type="button" aria-label="읽기 경로: 이전 구간" disabled={active <= 0} onclick={() => go(active - 1)}>이전</button>
            <button class="ui-btn ui-btn--outline" type="button" aria-label="읽기 경로: 다음 구간" disabled={!filtered.length || active === filtered.length - 1} onclick={() => go(active + 1)}>다음</button>
        </div>
    </div>
    <nav aria-label={`${label} 표시한 구간`}>
        <ol class="path-list">
            {#each filtered as passage, index (`${passage.from}:${passage.to}:${passage.intent}`)}
                <li><button class="path-item" class:is-active={active === index} type="button" aria-current={active === index ? "location" : undefined} onclick={() => onNavigate(passage)}>
                    <span class="path-location">{index + 1}. {passage.heading || label}</span>
                    <span class="path-text">{passage.text}</span>
                </button></li>
            {/each}
        </ol>
    </nav>
    {#if !passages.length}<p class="path-empty" role="status">아직 표시한 구간이 없습니다. 글에서 문장을 선택하고 ‘{label}’ 의도를 표시하세요.</p>{:else if !filtered.length}<p class="path-empty" role="status">검색어와 일치하는 구간이 없습니다.</p>{/if}
</section>

<style>
    .reading-path { display: grid; gap: 8px; }
    .path-tools { position: sticky; top: 0; z-index: 1; display: grid; gap: 8px; padding-bottom: 8px; background: var(--rail); }
    .path-tools p { margin: 0; }
    .path-navigation { display: flex; align-items: center; gap: 6px; }
    .path-count { flex: 1; color: var(--muted); font-size: 0.75rem; }
    .path-list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
    .path-item { display: grid; gap: 6px; width: 100%; padding: 12px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); color: var(--text); text-align: left; cursor: pointer; }
    .path-item:hover, .path-item.is-active { border-color: var(--accent-line); background: var(--accent-soft); }
    .path-item:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .path-location { color: var(--accent-strong); font-size: 0.75rem; font-weight: 650; }
    .path-text { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 0.88rem; line-height: 1.75; }
    .path-empty { margin: 0; color: var(--muted); font-size: 0.8rem; line-height: 1.65; }
</style>
