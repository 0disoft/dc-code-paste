<script lang="ts">
    import { getContext } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import type { EmphasisPassage } from "#lib/editor/emphasis-review.ts";

    let { onNavigate }: { onNavigate: (passage: EmphasisPassage) => void } = $props();
    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);
    let query = $state("");
    const review = $derived(workspace.emphasisReview);
    const filtered = $derived(review.passages.filter((passage) => `${passage.heading} ${passage.text}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));
    const active = $derived(workspace.activeEmphasisPassage);
</script>

<section class="emphasis-review" id="emphasis-review" aria-label="강조 점검">
    <div class="review-head">
        <h2>강조한 구간만 읽어보기</h2>
        <p class="review-note">굵게 또는 ‘먼저 읽기’로 표시한 본문을 원문 순서대로 모았습니다. 문장과 서식은 그대로입니다.</p>
        <dl class="review-counts" aria-label="전체 본문 강조 현황">
            <div><dt>본문</dt><dd>{review.bodyCharacters.toLocaleString()}자</dd></div>
            <div><dt>강조</dt><dd>{review.emphasisCharacters.toLocaleString()}자</dd></div>
            <div><dt>강조 구간</dt><dd>{review.passages.length.toLocaleString()}개</dd></div>
        </dl>
        <p class="review-note">공백 포함 · 제목·코드·줄바꿈 제외 · 겹친 강조는 한 번만 계산</p>
    </div>
    <div class="review-search">
        <input class="ui-input" type="search" aria-label="강조 구간 검색" placeholder="내용이나 소제목으로 찾기" bind:value={query} />
        <span role="status">{query.trim() ? `${filtered.length}개 찾음 / 전체 ${review.passages.length}개` : `전체 ${review.passages.length}개 구간`}</span>
    </div>
    <ol class="review-passages" aria-label="강조한 본문 구간">
        {#each filtered as passage, index (`${passage.from}:${passage.to}`)}
            <li class:is-active={active?.from === passage.from && active?.to === passage.to}>
                <div class="passage-head">
                    <span class="passage-location">{index + 1}. {passage.heading || "본문"}</span>
                    <div class="passage-kinds" aria-label="강조 방식">
                        {#each passage.kinds as kind (kind)}<span>{kind === "bold" ? "굵게" : "먼저 읽기"}</span>{/each}
                    </div>
                </div>
                <p class="passage-text">{passage.text}</p>
                <button class="ui-btn ui-btn--outline" type="button" aria-label={`강조 구간 ${index + 1} 편집`} onclick={() => onNavigate(passage)}>이 구간 편집</button>
            </li>
        {/each}
    </ol>
    {#if !review.passages.length}
        <p class="review-empty" role="status">아직 강조한 본문이 없습니다. 글에서 문장을 선택해 굵게 하거나 ‘먼저 읽기’를 표시해보세요.</p>
    {:else if !filtered.length}
        <p class="review-empty" role="status">검색어와 일치하는 강조 구간이 없습니다.</p>
    {/if}
</section>

<style>
    .emphasis-review { max-width: 880px; margin-inline: auto; padding: 20px; min-width: 0; }
    .review-head h2 { margin: 0 0 8px; font-size: 1.05rem; }
    .review-note { margin: 0; color: var(--muted); font-size: 0.8rem; line-height: 1.65; }
    .review-counts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 16px 0 12px; padding: 14px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); }
    .review-counts dt { color: var(--muted); font-size: 0.75rem; }
    .review-counts dd { margin: 4px 0 0; color: var(--text); font-size: 1.1rem; font-weight: 650; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
    .review-search { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; flex-wrap: wrap; gap: 8px 16px; margin-top: 16px; padding-block: 12px; background: var(--bg); }
    .review-search input { flex: 1 1 240px; min-width: 0; }
    .review-search span { color: var(--muted); font-size: 0.78rem; }
    .review-passages { display: grid; gap: 12px; margin: 0; padding: 0; list-style: none; }
    .review-passages li { display: grid; gap: 12px; padding: 16px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); }
    .review-passages li.is-active { border-color: var(--accent); }
    .passage-head { display: flex; align-items: baseline; flex-wrap: wrap; justify-content: space-between; gap: 8px; }
    .passage-location { color: var(--accent-strong); font-size: 0.8rem; font-weight: 650; overflow-wrap: anywhere; }
    .passage-kinds { display: flex; flex-wrap: wrap; gap: 4px; }
    .passage-kinds span { border-radius: 4px; padding: 3px 6px; background: var(--accent-soft); color: var(--accent-strong); font-size: 0.72rem; }
    .passage-text { margin: 0; color: var(--text); white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.75; font-size: 0.93rem; }
    .review-passages button { justify-self: end; }
    .review-empty { margin: 16px 0; color: var(--muted); font-size: 0.85rem; line-height: 1.65; }
    @media (max-width: 600px) {
        .emphasis-review { padding: 12px; }
        .review-counts { gap: 8px; padding: 12px; }
        .review-passages li { padding: 12px; }
        .review-passages button { width: 100%; min-height: 44px; }
    }
</style>
