<script lang="ts">
    import type { ReadingFrontierEntry } from "#lib/editor/reading-frontier.ts";
    import type { RelationAnchor } from "#lib/editor/sentence-relations.ts";

    let { entries, onNavigate, onReveal, remaining }: {
        entries: ReadingFrontierEntry[];
        onNavigate: (anchor: RelationAnchor) => void;
        onReveal: (position: number) => void;
        remaining: (position: number) => number;
    } = $props();
</script>

<section class="frontier" id="reading-frontier-view" aria-label="여기까지 나온 연결" tabindex="-1">
    <h2>여기까지 나온 연결</h2>
    <p class="frontier-note">작성자가 연결한 구간을 지금까지 펼친 순서에 맞춰 보여줍니다.</p>
    {#if !entries.length}
        <p class="frontier-empty" role="status">여기까지 펼친 문장에 연결이 없습니다.</p>
    {/if}
    <ol class="frontier-list">
        {#each entries as entry (entry.id)}
            <li class="frontier-entry" data-frontier-state={entry.state} aria-label={`${entry.label} 연결`}>
                <div class="frontier-head">
                    <strong>{entry.label}</strong>
                    <span>{entry.related.later ? "연결 구간이 뒤에 있음" : entry.related.shown.length ? "연결 구간이 나왔음" : "연결 위치 다시 확인"}</span>
                </div>
                {#if entry.state !== "linked"}
                    <p class="frontier-note">연결한 구간이 변경되었거나 위치를 다시 확인해야 합니다.</p>
                {/if}
                <div class="frontier-sides">
                    {#each [{ label: "처음 연결한 문장", endpoint: entry.claim }, { label: `${entry.label} 구간`, endpoint: entry.related }] as side (side.label)}
                        <div class="frontier-side">
                            <h3>{side.label}</h3>
                            {#each side.endpoint.shown as anchor (anchor.id)}
                                <div class="frontier-passage">
                                    <p>{anchor.text}</p>
                                    <button class="ui-btn ui-btn--outline" type="button" aria-label={`${side.label} 다시 보기`} onclick={() => onNavigate(anchor)}>이 구간 다시 보기</button>
                                </div>
                            {/each}
                            {#if side.endpoint.later}<p class="frontier-note">아직 펼치지 않은 구간 {side.endpoint.later}개</p>{/if}
                            {#if side.endpoint.missing}<p class="frontier-note">사라진 구간 {side.endpoint.missing}개</p>{/if}
                            {#if side.endpoint.duplicated}<p class="frontier-note">표시가 여러 곳에 있는 구간 {side.endpoint.duplicated}개</p>{/if}
                        </div>
                    {/each}
                </div>
                {#if entry.nextPosition !== undefined}
                    <div class="frontier-next">
                        <span>{remaining(entry.nextPosition)}구간 뒤에 연결 구간이 있습니다.</span>
                        <button class="ui-btn ui-btn--outline" type="button" onclick={() => onReveal(entry.nextPosition!)}>연결 구간까지 펼치기</button>
                    </div>
                {/if}
            </li>
        {/each}
    </ol>
</section>

<style>
    .frontier {
        display: grid;
        gap: 10px;
        min-width: 0;
        padding: 14px;
        margin-bottom: 16px;
        border: 1px solid var(--line);
        border-radius: var(--radius);
        background: var(--surface);
    }
    h2, h3, p {
        margin: 0;
    }
    h2 {
        font-size: 0.88rem;
    }
    h3 {
        font-size: 0.76rem;
        color: var(--muted);
    }
    .frontier-note, .frontier-empty {
        color: var(--muted);
        font-size: 0.78rem;
        line-height: 1.65;
    }
    .frontier-list {
        display: grid;
        gap: 12px;
        padding: 0;
        margin: 0;
        list-style: none;
    }
    .frontier-entry {
        display: grid;
        gap: 10px;
        min-width: 0;
        overflow-wrap: anywhere;
        padding: 12px;
        border: 1px solid var(--line);
        border-radius: var(--radius-sm);
        background: var(--panel-2);
    }
    .frontier-head, .frontier-next {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 8px;
        font-size: 0.8rem;
    }
    .frontier-head span, .frontier-next span {
        color: var(--muted);
        font-size: 0.74rem;
    }
    .frontier-sides {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
    }
    .frontier-side, .frontier-passage {
        display: grid;
        align-content: start;
        gap: 8px;
        min-width: 0;
    }
    .frontier-passage p {
        font-size: 0.84rem;
        line-height: 1.7;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
    }
    .frontier:focus-visible, button:focus-visible {
        outline: 2px solid var(--focus);
        outline-offset: 2px;
    }
    @media (max-width: 600px) {
        .frontier-sides {
            grid-template-columns: minmax(0, 1fr);
        }
        button {
            min-height: 44px;
        }
    }
</style>
