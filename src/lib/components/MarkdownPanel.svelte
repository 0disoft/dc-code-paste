<script lang="ts">
    import { FileText, Trash2, X } from "lucide-svelte";

    let {
        markdownDraft = $bindable(""),
        markdownImportState,
        markdownImportStateLabel,
        onimport,
        onclear,
        onclose,
        oninput,
    }: {
        markdownDraft?: string;
        markdownImportState: "idle" | "imported" | "error";
        markdownImportStateLabel: string;
        onimport: () => void;
        onclear: () => void;
        onclose: () => void;
        oninput: () => void;
    } = $props();
</script>

<section class="markdown-panel" aria-label="Markdown import">
    <textarea
        class="markdown-input"
        bind:value={markdownDraft}
        aria-label="Markdown 원문"
        spellcheck="false"
        placeholder={`# 제목\n\n본문과 [링크](https://example.com)\n\n\`\`\`cpp\nint main() {}\n\`\`\``}
        oninput={oninput}
    ></textarea>
    <div class="markdown-actions">
        <button
            class="markdown-import-button"
            type="button"
            aria-label="Markdown 적용하기"
            onclick={onimport}
        >
            <FileText size={16} />
            <span>적용하기</span>
        </button>
        <button
            class="markdown-clear-button"
            type="button"
            aria-label="Markdown 비우기"
            onclick={onclear}
        >
            <Trash2 size={15} />
            <span>비우기</span>
        </button>
        <button
            class="markdown-clear-button"
            type="button"
            aria-label="Markdown 닫기"
            onclick={onclose}
        >
            <X size={15} />
            <span>닫기</span>
        </button>
        <span
            class:error={markdownImportState === "error"}
            class="markdown-status">{markdownImportStateLabel}</span
        >
    </div>
</section>

<style>
    .markdown-panel {
        display: grid;
        gap: 10px;
        margin-bottom: 0;
        padding: 10px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: color-mix(in oklch, var(--panel) 88%, transparent);
    }

    .markdown-input {
        width: 100%;
        min-height: 220px;
        resize: vertical;
        border: 1px solid var(--line);
        border-radius: 7px;
        background: oklch(15.78% 0.014 257.58);
        color: oklch(92.14% 0.017 247.64);
        padding: 12px;
        font-family:
            Cascadia Mono,
            D2Coding,
            나눔고딕코딩,
            Noto Sans Mono CJK,
            JetBrains Mono,
            Fira Code,
            Hack,
            Source Code Pro,
            IBM Plex Mono,
            Roboto Mono,
            Consolas,
            Menlo,
            Monaco,
            monospace;
        font-size: 13px;
        line-height: 1.6;
        outline: none;
    }

    .markdown-input:focus {
        border-color: var(--accent);
    }

    .markdown-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
    }

    .markdown-import-button,
    .markdown-clear-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        height: 34px;
        border: 1px solid var(--line);
        border-radius: 7px;
        background: var(--panel-2);
        color: var(--text);
        font-weight: 850;
        cursor: pointer;
        white-space: nowrap;
    }

    .markdown-import-button {
        border-color: color-mix(in oklch, var(--accent) 66%, var(--line));
        background: color-mix(in oklch, var(--accent) 18%, var(--panel-2));
        color: var(--accent);
    }

    .markdown-clear-button:hover {
        color: var(--danger);
    }

    .markdown-import-button:disabled {
        cursor: not-allowed;
        opacity: 0.48;
    }

    .markdown-status {
        color: var(--muted);
        font-size: 12px;
        font-weight: 850;
        white-space: nowrap;
    }

    .markdown-status.error {
        color: var(--danger);
    }
</style>
