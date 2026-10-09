<script lang="ts">
    import type {
        RelationAnchor,
        RelationState,
        SentenceRelationEntry,
    } from "#lib/editor/sentence-relations.ts";
    import { sentenceRelationKinds } from "#lib/editor/sentence-relations-format.ts";

    type SidePart = SentenceRelationEntry["claim"]["parts"][number];
    let panel = $state<HTMLElement>();

    let {
        entry,
        onNavigate,
        onClose,
    }: {
        entry: SentenceRelationEntry;
        onNavigate: (anchor: RelationAnchor) => void;
        onClose: () => void;
    } = $props();

    const kind = $derived(
        sentenceRelationKinds.find((item) => item.value === entry.relation.kind)?.label ?? "관계",
    );
    const sides = $derived([
        { label: "처음 선택한 구간", endpoint: entry.claim },
        { label: `${kind} 구간`, endpoint: entry.related },
    ]);

    const stateMessages: Record<RelationState, string> = {
        linked: "연결한 두 구간을 그대로 함께 보여줍니다.",
        changed: "연결한 구간의 문장 또는 순서가 바뀌었습니다. 연결 당시 원문과 비교하세요.",
        missing: "연결한 구간 일부가 원문에서 사라졌습니다. 연결 당시 원문과 비교하세요.",
        duplicated: "같은 표시가 여러 곳에 있어 어느 구간인지 가릴 수 없습니다.",
    };

    function partState(part: SidePart): RelationState {
        if (!part.matches.length) return "missing";
        if (part.matches.length > 1) return "duplicated";
        return part.matches[0].text === part.reference.text ? "linked" : "changed";
    }

    function partReason(part: SidePart): string {
        return part.matches.length ? "표시가 여러 곳에 있음" : "구간 없음";
    }

    function navigate(part: SidePart): void {
        if (part.matches.length === 1) onNavigate(part.matches[0]);
    }

    function handleEscape(event: KeyboardEvent) {
        if (event.key !== "Escape" || event.isComposing || !panel?.contains(document.activeElement)) return;
        event.preventDefault();
        event.stopPropagation();
        onClose();
    }
</script>

<svelte:window onkeydown={handleEscape} />

<section
    class="relation-review"
    id="sentence-relation-review"
    aria-label="연결 구간 나란히 보기"
    tabindex="-1"
    data-relation-state={entry.state}
    bind:this={panel}
>
    <div class="review-head">
        <h2>{kind} 함께 읽기</h2>
        <button
            class="ui-btn ui-btn--outline review-close"
            type="button"
            aria-label="연결 구간 비교 닫기"
            onclick={onClose}>닫기</button
        >
    </div>
    <p class="review-note">
        원문으로 이동해 고칠 수 있습니다.
    </p>
    {#if entry.state !== "linked"}
        <p class="review-status" role="status">{stateMessages[entry.state]}</p>
    {/if}
    <div class="review-sides">
        {#each sides as side (side.label)}
            <section class="review-side" aria-label={side.label} data-side-state={side.endpoint.state}>
                <h3>{side.label}</h3>
                <div class="side-texts">
                    {#each side.endpoint.parts as part, partIndex (part.reference.id)}
                        {@const state = partState(part)}
                        <div class="side-part" data-part-state={state}>
                            <p class="part-text"
                                >{part.matches.length === 1
                                    ? part.matches[0].text
                                    : part.reference.text}</p
                            >
                            {#if state === "missing" || state === "duplicated"}
                                <p class="part-snapshot">연결 당시 원문 · {partReason(part)}</p>
                            {:else if state === "changed"}
                                <details class="part-original">
                                    <summary>연결 당시 원문 보기</summary>
                                    <p class="part-original-text">{part.reference.text}</p>
                                </details>
                            {/if}
                            <button
                                class="ui-btn ui-btn--outline"
                                type="button"
                                disabled={part.matches.length !== 1}
                                aria-label={`${side.label} ${partIndex + 1} 비교에서 이동`}
                                onclick={() => navigate(part)}><span class="move-full">원문으로 이동</span><span class="move-short">이동</span>{side.endpoint.parts.length > 1
                                    ? ` · ${partIndex + 1}`
                                    : ""}</button
                            >
                        </div>
                    {/each}
                </div>
            </section>
        {/each}
    </div>
</section>

<style>
    .relation-review {
        flex: 0 0 auto;
        display: grid;
        align-content: start;
        gap: 10px;
        min-width: 0;
        max-height: min(44dvh, 420px);
        overflow-y: auto;
        overscroll-behavior: contain;
        margin: 12px 16px 0;
        padding: 12px;
        border: 1px solid var(--line);
        border-radius: var(--radius-lg);
        background: var(--surface);
        box-shadow: var(--shadow-pop);
        color: var(--text);
        outline: none;
    }
    .relation-review[data-relation-state="changed"],
    .relation-review[data-relation-state="missing"],
    .relation-review[data-relation-state="duplicated"] {
        border-color: var(--accent-line);
    }
    .relation-review:focus-visible,
    .relation-review button:focus-visible,
    .relation-review summary:focus-visible {
        outline: 2px solid var(--focus);
        outline-offset: 2px;
    }
    .review-head {
        position: sticky;
        top: -12px;
        z-index: 1;
        background: var(--surface);
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: space-between;
    }
    .review-head h2 {
        flex: 1 1 auto;
        min-width: 0;
        margin: 0;
        color: var(--text);
        font-size: 0.95rem;
        overflow-wrap: anywhere;
    }
    .review-close {
        flex: 0 0 auto;
    }
    .review-note,
    .review-status {
        margin: 0;
        font-size: 0.78rem;
        line-height: 1.65;
    }
    .review-note {
        color: var(--muted);
    }
    .review-status {
        color: var(--accent-strong);
    }
    .review-sides {
        display: grid;
        gap: 12px;
        grid-template-columns: minmax(0, 1fr);
    }
    .review-side {
        display: grid;
        align-content: start;
        gap: 8px;
        min-width: 0;
        padding: 10px;
        border: 1px solid var(--line);
        border-radius: var(--radius);
        background: var(--panel-2);
    }
    .review-side[data-side-state="missing"],
    .review-side[data-side-state="duplicated"] {
        border-color: var(--accent-line);
    }
    .review-side h3 {
        margin: 0;
        color: var(--muted);
        font-size: 0.75rem;
        font-weight: 500;
        overflow-wrap: anywhere;
    }
    .side-texts {
        display: grid;
        align-content: start;
        gap: 10px;
        min-width: 0;
        max-height: min(32dvh, 300px);
        overflow-y: auto;
        overscroll-behavior: contain;
    }
    .side-part {
        display: grid;
        gap: 6px;
        min-width: 0;
        padding: 8px;
        border: 1px solid var(--line);
        border-radius: var(--radius-sm);
        background: var(--surface);
    }
    .side-part[data-part-state="changed"] {
        border-color: var(--accent-line);
    }
    .part-text {
        margin: 0;
        color: var(--text);
        font-size: 0.85rem;
        line-height: 1.7;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
    }
    .part-snapshot,
    .part-original-text {
        margin: 0;
        color: var(--muted);
        font-size: 0.78rem;
        line-height: 1.65;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
    }
    .part-original summary {
        display: flex;
        align-items: center;
        min-height: 32px;
        color: var(--muted);
        font-size: 0.76rem;
        cursor: pointer;
    }
    .part-original-text {
        padding-top: 6px;
        border-top: 1px solid var(--line);
    }
    .side-part button {
        width: 100%;
    }
    .move-short { display: none; }
    @media (min-width: 600px) {
        .review-sides {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
    }
    @media (max-width: 600px) {
        .relation-review {
            margin-inline: 8px;
        }
        .side-texts {
            max-height: 24dvh;
        }
        .relation-review button {
            min-height: 44px;
        }
        .side-part { grid-template-columns: minmax(0, 1fr) auto; align-items: start; }
        .side-part button { grid-column: 2; grid-row: 1; width: auto; padding-inline: 8px; }
        .part-snapshot, .part-original { grid-column: 1 / -1; }
        .move-full { display: none; }
        .move-short { display: inline; }
    }
</style>
