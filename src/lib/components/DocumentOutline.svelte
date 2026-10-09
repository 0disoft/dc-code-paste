<script lang="ts">
    import { getContext } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import { readingIntentOptions, type ReadingIntent } from "#lib/editor/reading-intent-format.ts";
    import type { ReadingPassage } from "#lib/editor/reading-path.ts";
    import ReadingPath from "./ReadingPath.svelte";

    let { onNavigate, onPassageNavigate }: { onNavigate: (index: number) => void; onPassageNavigate: (passage: ReadingPassage) => void } = $props();
    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);
    let query = $state("");
    let route = $state<"all" | ReadingIntent>("all");
    const entries = $derived(workspace.documentOutline);
    const filtered = $derived(entries.filter((entry) => `${entry.label} ${entry.text}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));
</script>

<label class="ui-field path-selector"><span class="ui-label">읽기 경로</span><select class="ui-select" aria-label="읽기 경로" bind:value={route}><option value="all">전체 글</option>{#each readingIntentOptions as item (item.value)}<option value={item.value}>{item.label}</option>{/each}</select></label>
{#if route !== "all"}
    <ReadingPath intent={route} onNavigate={onPassageNavigate} />
{:else}
<div class="outline-search">
    <input class="ui-input" type="search" aria-label="글 구성 검색" placeholder="내용이나 블록 이름으로 찾기" bind:value={query} />
    <p class="outline-count" role="status">{query.trim() ? `${filtered.length}개 찾음 / ` : ""}총 {entries.length}개 블록</p>
</div>
<nav aria-label="글 구성">
    <ol class="outline-list">
        {#each filtered as entry (entry.index)}
            <li>
                <button type="button" class="outline-item" class:is-active={workspace.activeOutlineIndex === entry.index} aria-current={workspace.activeOutlineIndex === entry.index ? "location" : undefined} onclick={() => onNavigate(entry.index)}>
                    <span class="outline-label">{entry.index + 1}. {entry.label}</span>
                    <span class="outline-text">{entry.text}</span>
                </button>
            </li>
        {/each}
    </ol>
</nav>
{#if filtered.length === 0}<p class="outline-count">일치하는 블록이 없습니다.</p>{/if}
{/if}

<style>
    .path-selector { margin-bottom: 12px; }
    .outline-search { position: sticky; top: 0; z-index: 1; display: grid; gap: 8px; padding-bottom: 8px; background: var(--rail); }
    .outline-count { margin: 0; color: var(--muted); font-size: 0.78rem; }
    .outline-list { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
    .outline-item { display: grid; gap: 5px; width: 100%; min-height: 56px; padding: 10px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); text-align: left; cursor: pointer; }
    .outline-item:hover, .outline-item.is-active { border-color: var(--accent-line); background: var(--accent-soft); }
    .outline-label { color: var(--accent-strong); font-size: 0.75rem; font-weight: 650; }
    .outline-text { overflow: hidden; color: var(--text); font-size: 0.85rem; line-height: 1.5; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow-wrap: anywhere; }
</style>
