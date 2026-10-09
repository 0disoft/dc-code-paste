<script lang="ts">
    let { value, onEdit }: { value: string; onEdit: () => void } = $props();
</script>

{#if value}
    <details class="purpose-summary" aria-label="이 글의 목적">
        <summary>이 글의 목적</summary>
        <p>{value}</p>
        <button class="ui-btn ui-btn--outline" type="button" onclick={onEdit}>목적 수정</button>
    </details>
{/if}

<style>
    .purpose-summary {
        padding: 10px 14px;
        margin-bottom: 12px;
        border: 1px solid var(--line);
        border-radius: var(--radius);
        background: var(--surface);
        color: var(--muted);
        font-size: 0.8rem;
    }
    summary {
        cursor: pointer;
    }
    p {
        margin: 10px 0;
        line-height: 1.7;
        color: var(--text);
        overflow-wrap: anywhere;
    }
    summary:focus-visible, button:focus-visible {
        outline: 2px solid var(--focus);
        outline-offset: 2px;
    }
    @media (max-width: 600px) {
        button {
            min-height: 44px;
        }
    }
</style>
