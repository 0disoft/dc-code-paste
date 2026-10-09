<script lang="ts">
    import { getContext } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import { sentenceSourceLabel } from "#lib/editor/sentence-source-format.ts";

    let { onNavigate }: { onNavigate?: (href: string, from: number, to: number) => void } = $props();
    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);
    const sources = $derived(workspace.documentSources);
    let reviewOnly = $state(false);
    const reviewCount = $derived(sources.reduce((count, source) => count + source.mentions.filter((mention) => mention.review !== "unchanged").length, 0));
    const visibleSources = $derived(reviewOnly ? sources.filter((source) => source.mentions.some((mention) => mention.review !== "unchanged")) : sources);

    function navigate(href: string, from: number, to: number) {
        if (onNavigate) onNavigate(href, from, to);
        else workspace.navigateSentenceSource(href, from, to);
    }
</script>

<section class="ui-section" aria-label="이 글의 자료">
    <span class="ui-section-title">이 글의 자료 <span class="source-count">{sources.length}개</span></span>
    {#if !sources.length}
        <p class="ui-hint">문장에 연결한 출처와 참고 자료 목록을 모아 보여줍니다.</p>
    {:else}
        <label class="review-filter"><input type="checkbox" bind:checked={reviewOnly} aria-label="다시 확인할 구간만 보기" /><span>다시 확인할 구간만 보기 · {reviewCount}곳</span></label>
        <ul class="source-list">
            {#each visibleSources as source (source.href)}
                <li class="source-card">
                    <a class="source-link" href={source.href} target="_blank" rel="noopener noreferrer">{sentenceSourceLabel({ href: source.href, label: source.label, excerpt: "" })}</a>
                    <p class="source-url">{source.href}</p>
                    <p class="ui-hint">연결 {source.mentions.length}곳 · 참고 자료 {source.referenceCount}개</p>
                    {#if source.mentions.length}
                        <details class="source-mentions">
                            <summary>연결한 문장 보기</summary>
                            <ul class="mention-list">
                                {#each source.mentions.filter((mention) => !reviewOnly || mention.review !== "unchanged") as mention (mention.from)}
                                    <li>
                                        <button class="mention-button" type="button" aria-label={`연결 ${source.mentions.indexOf(mention) + 1}로 이동: ${mention.text}`} aria-describedby={mention.review !== "unchanged" ? `source-review-${mention.from}` : undefined} onclick={() => navigate(source.href, mention.from, mention.to)}>{mention.text}</button>
                                        {#if mention.review !== "unchanged"}<p class="mention-review" id={`source-review-${mention.from}`}>{mention.review === "changed" ? "연결 구간 수정됨 · 근거와 다시 비교하세요." : "비교할 구간 기록 없음"}</p>{/if}
                                        {#if mention.excerpt}<p class="mention-excerpt">{mention.excerpt}</p>{/if}
                                    </li>
                                {/each}
                            </ul>
                        </details>
                    {/if}
                </li>
            {/each}
        </ul>
        {#if reviewOnly && !visibleSources.length}<p class="ui-hint" role="status">다시 확인할 구간이 없습니다.</p>{/if}
    {/if}
</section>

<style>
    .source-count { color: var(--muted); font-size: 0.75rem; font-weight: 400; }
    .review-filter { display: flex; align-items: center; gap: 8px; font-size: 0.78rem; color: var(--muted); cursor: pointer; }
    .review-filter input { accent-color: var(--accent); }
    .source-list, .mention-list { margin: 0; padding: 0; list-style: none; }
    .source-list { display: grid; gap: 10px; }
    .source-card { padding: 12px; border: 1px solid var(--line); border-radius: var(--radius); min-width: 0; }
    .source-link { color: var(--accent); font-size: 0.85rem; font-weight: 600; overflow-wrap: anywhere; }
    .source-url { margin: 4px 0 6px; color: var(--muted); font-size: 0.7rem; overflow-wrap: anywhere; }
    .source-mentions { margin-top: 8px; font-size: 0.78rem; }
    .source-mentions summary { cursor: pointer; color: var(--muted); }
    .mention-list { display: grid; gap: 12px; margin-top: 10px; }
    .mention-button { display: block; width: 100%; text-align: left; font: inherit; line-height: 1.6; border: 0; border-left: 2px solid var(--accent); padding: 8px 10px; border-radius: 2px; background: var(--panel-2); color: var(--text); cursor: pointer; overflow-wrap: anywhere; }
    .mention-button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .mention-excerpt { margin: 6px 0 0; padding: 0 10px; font-size: 0.74rem; color: var(--muted); line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; max-height: 150px; overflow: auto; }
    .mention-review { margin: 6px 0 0; font-size: 0.74rem; color: var(--accent-strong); line-height: 1.6; }
</style>
