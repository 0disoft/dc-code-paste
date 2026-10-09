<script lang="ts">
    import { tick } from "svelte";
    import type { DcExportOptions } from "#lib/dc/export-document.ts";
    import type { ReadingExperimentUnit } from "#lib/editor/reading-experiment.ts";
    import type { ReadingNoteEntry } from "#lib/editor/reading-notes.ts";
    import { maxReadingNoteLength } from "#lib/editor/reading-notes-format.ts";
    import ReadingFragmentOrigins from "./ReadingFragmentOrigins.svelte";
    import type { ReadingFragmentOrigin } from "#lib/editor/reading-fragment-origins.ts";

    type Props = {
        active?: boolean;
        unit: ReadingExperimentUnit;
        options: DcExportOptions;
        render: (unit: ReadingExperimentUnit, options: DcExportOptions) => Promise<string>;
        notes: ReadingNoteEntry[];
        error: string;
        onSave: (unit: ReadingExperimentUnit, text: string) => boolean;
        onClearError: () => void;
        fragmentOrigins: ReadingFragmentOrigin[];
        onFragmentNavigate: (id: string) => void;
    };

    let { active = true, unit, options, render, notes, error, onSave, onClearError, fragmentOrigins, onFragmentNavigate }: Props = $props();

    let html = $state("");
    let busy = $state(true);
    let failed = $state(false);
    let open = $state(false);
    let draft = $state("");
    let status = $state("");
    // Pin the unit the reader opened the form on so a live document change cannot
    // silently retarget an in-progress note.
    let pinned = $state.raw<ReadingExperimentUnit | undefined>(undefined);
    let field = $state<HTMLTextAreaElement>();
    let noteButton = $state<HTMLButtonElement>();
    let revision = 0;
    const fieldId = $derived(`reading-note-${unit.index}`);

    $effect(() => {
        if (!active) return;
        const target = unit;
        const exportOptions = options;
        const current = ++revision;
        busy = true;
        failed = false;
        render(target, exportOptions)
            .then((result) => {
                if (current !== revision) return;
                html = result;
            })
            .catch(() => {
                if (current !== revision) return;
                failed = true;
            })
            .finally(() => {
                if (current === revision) busy = false;
            });
        return () => {
            revision += 1;
        };
    });

    function passageText(target: ReadingExperimentUnit) {
        return target.text.replace(/\s+/g, " ").trim();
    }

    function startNote() {
        if (open) {
            field?.focus();
            return;
        }
        pinned = unit;
        draft = "";
        status = "";
        onClearError();
        open = true;
        void tick().then(() => field?.focus());
    }

    function cancelNote() {
        open = false;
        draft = "";
        status = "";
        noteButton?.focus({ preventScroll: true });
    }

    function submitNote() {
        const target = pinned;
        if (!target || !draft.trim()) return;
        if (!onSave(target, draft)) return;
        open = false;
        draft = "";
        status = "읽기 메모를 저장했습니다.";
        noteButton?.focus({ preventScroll: true });
    }

    function handleEscape(event: KeyboardEvent) {
        if (event.key !== "Escape" || event.isComposing) return;
        event.preventDefault();
        event.stopPropagation();
        cancelNote();
    }
</script>

<article class="reading-unit" data-unit-code={unit.code} data-reading-unit-index={unit.index} aria-label={`읽기 구간 ${unit.index + 1}`} aria-busy={busy} tabindex="-1">
    {#if busy && !html}
        <p class="unit-notice" role="status">구간을 준비하는 중</p>
    {:else if failed}
        <p class="unit-notice is-error" role="alert">이 구간을 표시하지 못했습니다.</p>
    {:else}
        <!-- Export HTML is app-generated and sanitized before it reaches this component. -->
        <div class="unit-document">{@html html}</div>
    {/if}
    {#if !busy && !failed && fragmentOrigins.length}<ReadingFragmentOrigins entries={fragmentOrigins} unitNumber={unit.index + 1} onNavigate={onFragmentNavigate} />{/if}
    {#if unit.canNote}
        <div class="unit-notes">
            {#if notes.length}
                <span class="unit-note-count" role="status">멈춘 자리 {notes.length}</span>
            {/if}
            <button
                class="ui-btn ui-btn--outline"
                type="button"
                aria-label={`읽기 구간 ${unit.index + 1} 메모`}
                aria-expanded={open}
                aria-controls={open ? fieldId : undefined}
                bind:this={noteButton}
                onclick={startNote}>여기서 멈춘 이유</button
            >
        </div>
        {#if open}
            <div class="note-form">
                <p class="note-passage">{passageText(pinned ?? unit)}</p>
                <label class="note-label" for={fieldId}>여기서 멈춘 이유</label>
                <textarea
                    id={fieldId}
                    class="ui-input"
                    aria-label="읽기 메모"
                    maxlength={maxReadingNoteLength}
                    rows="3"
                    bind:value={draft}
                    bind:this={field}
                    onkeydown={handleEscape}
                ></textarea>
                {#if error}<p class="note-error" role="alert">{error}</p>{/if}
                <div class="note-actions">
                    <button
                        class="ui-btn ui-btn--primary"
                        type="button"
                        disabled={!draft.trim()}
                        onclick={submitNote}>읽기 메모 저장</button
                    >
                    <button class="ui-btn ui-btn--outline" type="button" onclick={cancelNote}
                        >메모 작성 취소</button
                    >
                </div>
            </div>
        {/if}
        {#if status}<p class="note-status" role="status">{status}</p>{/if}
    {/if}
</article>

<style>
    .reading-unit {
        min-width: 0;
        max-width: 100%;
    }
    .reading-unit:focus-visible {
        outline: 2px solid var(--focus);
        outline-offset: 2px;
    }
    .unit-document {
        min-width: 0;
        max-width: 100%;
        overflow-wrap: anywhere;
    }
    .unit-notice {
        margin: 0 0 10px;
        padding-inline: 18px;
        color: var(--muted);
        font-size: 0.82rem;
    }
    .unit-notice.is-error {
        color: var(--danger);
    }
    .unit-notes {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        padding: 0 18px 10px;
    }
    .unit-note-count {
        color: var(--muted);
        font-size: 0.76rem;
    }
    .note-form {
        display: grid;
        gap: 8px;
        margin: 0 18px 14px;
        padding: 12px;
        border: 1px solid var(--line);
        border-radius: var(--radius);
        background: var(--panel-2);
    }
    .note-passage {
        margin: 0;
        max-height: 140px;
        overflow-y: auto;
        padding: 8px 10px;
        border-left: 3px solid var(--accent-line);
        background: var(--surface);
        color: var(--text);
        font-size: 0.85rem;
        line-height: 1.7;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
    }
    .note-label {
        color: var(--muted);
        font-size: 0.78rem;
        font-weight: 600;
    }
    .note-form textarea {
        width: 100%;
        min-height: 72px;
        resize: vertical;
    }
    .note-error {
        margin: 0;
        color: var(--danger);
        font-size: 0.78rem;
        line-height: 1.6;
    }
    .note-status {
        margin: 0;
        padding: 0 18px 10px;
        color: var(--ok);
        font-size: 0.78rem;
    }
    .note-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }
    .unit-notes button:focus-visible,
    .note-form textarea:focus-visible,
    .note-actions button:focus-visible {
        outline: 2px solid var(--focus);
        outline-offset: 2px;
    }
    @media (max-width: 600px) {
        .unit-notes button,
        .note-actions button {
            min-height: 44px;
        }
    }
</style>
