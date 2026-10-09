<script lang="ts">
    import type { ReadingFragmentOrigin } from "#lib/editor/reading-fragment-origins.ts";
    let { entries, unitNumber, onNavigate }: { entries: ReadingFragmentOrigin[]; unitNumber: number; onNavigate: (id: string) => void } = $props();
    const labels = { linked: "넣을 당시와 같음", changed: "넣은 뒤 구간이 바뀜", duplicated: "같은 표시가 여러 곳에 있음" };
</script>

<details class="reading-fragment-origins" aria-label={`읽기 구간 ${unitNumber} 생각 조각`}>
    <summary>생각 조각에서 온 구간 · {entries.length}</summary>
    <p class="origin-hint">지금 읽는 구간에 넣었던 내용입니다.</p>
    <ol class="origin-list">
        {#each entries as entry (entry.id)}
            <li class="origin-entry" data-origin-state={entry.state}>
                <strong>조각 {entry.fragmentNumber} · 넣은 자리 {entry.useNumber} · 구간 {entry.partNumber}</strong>
                <p class="origin-hint">{entry.kind === "code" ? "코드" : "글"} · {labels[entry.state]}</p>
                {#if entry.sourceChanged}<p class="origin-hint">보관한 조각도 수정된 상태입니다.</p>{/if}
                {#if entry.originalText !== undefined}
                    {#if entry.originalText}<pre class="origin-text" class:is-code={entry.kind === "code"}>{entry.originalText}</pre>{:else}<p class="origin-hint">넣을 당시 비어 있던 구간입니다.</p>{/if}
                {:else}
                    <p class="origin-hint">당시 내용은 글을 전부 펼친 뒤 볼 수 있습니다.</p>
                {/if}
                <button class="ui-btn ui-btn--outline" type="button" disabled={!entry.canNavigate} aria-label={`읽기 구간 ${unitNumber} 조각 ${entry.fragmentNumber} 넣은 자리 ${entry.useNumber} 구간 ${entry.partNumber} 본문으로 이동`} onclick={() => onNavigate(entry.id)}>본문으로 이동</button>
            </li>
        {/each}
    </ol>
</details>

<style>
    .reading-fragment-origins { margin: 0 18px 12px; padding: 10px 12px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel-2); min-width: 0; }
    summary { color: var(--muted); font-size: 0.78rem; cursor: pointer; }
    .origin-hint { margin: 6px 0 0; color: var(--muted); font-size: 0.78rem; line-height: 1.65; }
    .origin-list { list-style: none; padding: 0; margin: 10px 0 0; display: grid; gap: 12px; min-width: 0; }
    .origin-entry { display: grid; gap: 8px; min-width: 0; font-size: 0.82rem; }
    .origin-text { margin: 0; max-height: 200px; overflow: auto; padding: 8px 10px; border-left: 3px solid var(--accent-line); background: var(--surface); white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; line-height: 1.7; }
    .origin-text.is-code { font-family: ui-monospace, Consolas, monospace; }
    button { justify-self: start; }
    button:focus-visible, summary:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
    @media (max-width: 600px) { button { min-height: 44px; } }
</style>
