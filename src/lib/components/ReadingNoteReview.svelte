<script lang="ts">
    import type { ReadingNoteEntry } from "#lib/editor/reading-notes.ts";
    import type { RelationAnchor, RelationState } from "#lib/editor/sentence-relations.ts";

    let { entry, onNavigate, onClose, onRead }: {
        entry: ReadingNoteEntry;
        onNavigate: (anchor: RelationAnchor) => void;
        onClose: () => void;
        onRead: () => void;
    } = $props();

    const messages: Record<RelationState, string> = {
        linked: "메모를 남긴 문장이 그대로 있습니다.",
        changed: "메모를 남긴 문장이 바뀌었습니다. 당시 원문과 비교할 수 있습니다.",
        missing: "메모를 남긴 구간 일부가 사라졌습니다. 당시 원문을 보관하고 있습니다.",
        duplicated: "같은 표시가 여러 곳에 있습니다. 원문 이동은 구간이 하나일 때 가능합니다.",
    };
</script>

<section class="note-review" aria-label="고칠 때 참고할 읽기 메모" data-note-state={entry.state}>
    <div class="note-head">
        <h2>여기서 멈춘 이유</h2>
        <div class="note-actions">
            <button class="ui-btn ui-btn--outline" type="button" onclick={onRead}>계속 읽어보기</button>
            <button class="ui-btn ui-btn--outline" type="button" aria-label="편집 중 읽기 메모 닫기" onclick={onClose}>닫기</button>
        </div>
    </div>
    <p class="note-text">{entry.note.text}</p>
    <details class="note-passages">
        <summary>메모를 남긴 구간 보기</summary>
        <p class="note-state" role="status">{messages[entry.state]}</p>
        {#each entry.parts as part (part.reference.id)}
            <div class="note-part">
                <p>{part.matches.length === 1 ? part.matches[0].text : part.reference.text}</p>
                {#if part.matches.length === 1 && part.matches[0].text !== part.reference.text}
                    <details>
                        <summary>메모 당시 원문 보기</summary>
                        <p>{part.reference.text}</p>
                    </details>
                {:else if part.matches.length !== 1}
                    <span class="note-state">메모 당시 원문</span>
                {/if}
                <button class="ui-btn ui-btn--outline" type="button" disabled={part.matches.length !== 1} onclick={() => onNavigate(part.matches[0])}>메모 구간으로 이동</button>
            </div>
        {/each}
    </details>
</section>

<style>
    .note-review {
        flex-shrink: 0;
        display: grid;
        gap: 8px;
        max-height: min(32vh, 280px);
        overflow-y: auto;
        padding: 12px 16px;
        border-bottom: 1px solid var(--line);
        background: var(--panel-2);
        font-size: 0.82rem;
    }
    .note-head, .note-actions {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
    }
    .note-head {
        justify-content: space-between;
    }
    h2 {
        margin: 0;
        font-size: 0.85rem;
    }
    p {
        margin: 0;
        line-height: 1.7;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
    }
    .note-text {
        color: var(--text);
    }
    .note-state, summary {
        color: var(--muted);
        font-size: 0.76rem;
    }
    summary {
        cursor: pointer;
        padding-block: 4px;
    }
    .note-part {
        display: grid;
        gap: 8px;
        padding: 8px 0;
        border-top: 1px solid var(--line);
    }
    button:focus-visible, summary:focus-visible {
        outline: 2px solid var(--focus);
        outline-offset: 2px;
    }
    @media (max-width: 600px) {
        button {
            min-height: 44px;
        }
    }
</style>
