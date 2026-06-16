<script lang="ts">
    import { History, Save, Trash2, X } from "lucide-svelte";
    import type { DraftHistorySnapshot } from "$lib/editor/draft-storage";
    import type { PresetSnapshot } from "$lib/editor/preset-storage";

    type RenameTarget =
        | { kind: "preset"; id: string }
        | { kind: "draft"; id: string };

    type Props = {
        presetName: string;
        presetState: "idle" | "saved" | "error";
        presetStateLabel: string;
        presets: PresetSnapshot[];
        draftHistory: DraftHistorySnapshot[];
        draftHistoryState: "idle" | "saved" | "error";
        draftHistoryStateLabel: string;
        renameTarget: RenameTarget | null;
        renameDraft: string;
        onClose: () => void;
        onPresetNameInput: () => void;
        onSavePreset: () => void;
        onApplyPreset: (preset: PresetSnapshot, event: MouseEvent) => void;
        onBeginPresetRename: (preset: PresetSnapshot, event: MouseEvent) => void;
        onSavePresetRename: (id: string) => void;
        onDeletePreset: (id: string) => void;
        onSaveDraftHistory: () => void;
        onRestoreDraftHistory: (snapshot: DraftHistorySnapshot, event: MouseEvent) => void;
        onBeginDraftHistoryRename: (snapshot: DraftHistorySnapshot, event: MouseEvent) => void;
        onSaveDraftHistoryRename: (id: string) => void;
        onDeleteDraftHistory: (id: string) => void;
        onCancelRename: () => void;
        presetDateLabel: (value: string) => string;
        draftHistoryName: (snapshot: DraftHistorySnapshot) => string;
        draftHistorySummary: (snapshot: DraftHistorySnapshot) => string;
    };

    let {
        presetName = $bindable(""),
        presetState,
        presetStateLabel,
        presets,
        draftHistory,
        draftHistoryState,
        draftHistoryStateLabel,
        renameTarget,
        renameDraft = $bindable(""),
        onClose,
        onPresetNameInput,
        onSavePreset,
        onApplyPreset,
        onBeginPresetRename,
        onSavePresetRename,
        onDeletePreset,
        onSaveDraftHistory,
        onRestoreDraftHistory,
        onBeginDraftHistoryRename,
        onSaveDraftHistoryRename,
        onDeleteDraftHistory,
        onCancelRename,
        presetDateLabel,
        draftHistoryName,
        draftHistorySummary,
    }: Props = $props();

    function isRenaming(kind: RenameTarget["kind"], id: string) {
        return renameTarget?.kind === kind && renameTarget.id === id;
    }

    function focusRenameInput(node: HTMLInputElement) {
        node.focus();
        node.select();
    }

    function handleRenameKeydown(event: KeyboardEvent, save: () => void) {
        if (event.key === "Enter") {
            event.preventDefault();
            save();
            return;
        }

        if (event.key === "Escape") {
            event.preventDefault();
            onCancelRename();
        }
    }

    function handlePresetNameKeydown(event: KeyboardEvent) {
        if (event.key === "Enter") {
            event.preventDefault();
            onSavePreset();
        }
    }
</script>

<div id="storage-panel" class="storage-panel">
    <button
        class="panel-close-button storage-panel-close"
        type="button"
        title="저장함 닫기"
        aria-label="닫기"
        onclick={onClose}
    >
        <X size={16} />
    </button>
    <section class="preset-panel" aria-label="프리셋">
        <div class="preset-save">
            <label>
                <span><Save size={15} /> 프리셋</span>
                <input
                    type="text"
                    bind:value={presetName}
                    aria-label="프리셋 이름"
                    maxlength="60"
                    placeholder="강의글 구조"
                    oninput={onPresetNameInput}
                    onkeydown={handlePresetNameKeydown}
                />
            </label>
            <button
                class="preset-save-button"
                type="button"
                aria-label="프리셋 저장"
                onclick={onSavePreset}
            >
                <Save size={16} />
                <span>저장</span>
            </button>
            <span class:error={presetState === "error"} class="preset-count">{presetStateLabel}</span>
        </div>

        <div class="preset-list" aria-label="저장된 프리셋">
            {#if presets.length === 0}
                <span class="preset-empty">프리셋 없음</span>
            {:else}
                {#each presets as preset (preset.id)}
                    <div class="preset-item">
                        {#if isRenaming("preset", preset.id)}
                            <input
                                class="preset-rename-input"
                                type="text"
                                bind:value={renameDraft}
                                maxlength="60"
                                aria-label="프리셋 제목 변경"
                                use:focusRenameInput
                                onblur={() => onSavePresetRename(preset.id)}
                                onkeydown={(event) =>
                                    handleRenameKeydown(event, () => onSavePresetRename(preset.id))}
                            />
                        {:else}
                            <button
                                type="button"
                                class="preset-apply"
                                title="더블클릭해서 제목 변경"
                                onclick={(event) => onApplyPreset(preset, event)}
                                ondblclick={(event) => onBeginPresetRename(preset, event)}
                            >
                                <span>{preset.name}</span>
                                <small>
                                    {preset.preferences.documentTheme === "darkEditorial"
                                        ? "어두운 글"
                                        : "밝은 글"} · {presetDateLabel(preset.updatedAt)}
                                </small>
                            </button>
                        {/if}
                        <button
                            type="button"
                            class="preset-delete"
                            aria-label={`${preset.name} 삭제`}
                            title="삭제"
                            onclick={() => onDeletePreset(preset.id)}
                        >
                            <Trash2 size={15} />
                        </button>
                    </div>
                {/each}
            {/if}
        </div>
    </section>

    <section class="draft-history-panel" aria-label="초안 히스토리">
        <div class="draft-history-save">
            <div class="draft-history-title">
                <History size={15} />
                <span>초안 히스토리</span>
            </div>
            <button
                class="draft-history-save-button"
                type="button"
                aria-label="초안 스냅샷 저장"
                onclick={onSaveDraftHistory}
            >
                <Save size={16} />
                <span>스냅샷</span>
            </button>
            <span
                class:error={draftHistoryState === "error"}
                class="draft-history-count"
                aria-label="초안 히스토리 개수"
            >
                {draftHistoryStateLabel}
            </span>
        </div>

        <div class="draft-history-list" aria-label="저장된 초안">
            {#if draftHistory.length === 0}
                <span class="draft-history-empty">초안 없음</span>
            {:else}
                {#each draftHistory as snapshot (snapshot.id)}
                    <div class="draft-history-item">
                        {#if isRenaming("draft", snapshot.id)}
                            <input
                                class="preset-rename-input"
                                type="text"
                                bind:value={renameDraft}
                                maxlength="60"
                                aria-label="초안 제목 변경"
                                use:focusRenameInput
                                onblur={() => onSaveDraftHistoryRename(snapshot.id)}
                                onkeydown={(event) =>
                                    handleRenameKeydown(event, () =>
                                        onSaveDraftHistoryRename(snapshot.id),
                                    )}
                            />
                        {:else}
                            <button
                                type="button"
                                class="draft-history-apply"
                                title="더블클릭해서 제목 변경"
                                onclick={(event) => onRestoreDraftHistory(snapshot, event)}
                                ondblclick={(event) => onBeginDraftHistoryRename(snapshot, event)}
                            >
                                <span>{draftHistoryName(snapshot)}</span>
                                <small>{draftHistorySummary(snapshot)}</small>
                            </button>
                        {/if}
                        <button
                            type="button"
                            class="draft-history-delete"
                            aria-label={`${draftHistoryName(snapshot)} 삭제`}
                            title="삭제"
                            onclick={() => onDeleteDraftHistory(snapshot.id)}
                        >
                            <Trash2 size={15} />
                        </button>
                    </div>
                {/each}
            {/if}
        </div>
    </section>
</div>

<style>
    .panel-close-button {
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

    .storage-panel {
        grid-column: 1 / -1;
        position: relative;
        display: grid;
        gap: 5px;
        margin: 0;
        padding-right: 38px;
    }

    .storage-panel-close {
        position: absolute;
        top: 9px;
        right: 9px;
        z-index: 1;
        width: 32px;
        min-width: 32px;
        height: 32px;
        padding: 0;
        color: var(--muted);
    }

    .storage-panel-close:hover {
        color: var(--danger);
    }

    .preset-panel,
    .draft-history-panel {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
        margin: 0;
        padding: 10px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: color-mix(in oklch, var(--panel) 88%, transparent);
    }

    .preset-save,
    .draft-history-save {
        display: flex;
        flex: 0 1 auto;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        min-width: 0;
    }

    .draft-history-title {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: var(--muted);
        font-size: 13px;
        font-weight: 850;
        white-space: nowrap;
    }

    .preset-save-button,
    .draft-history-save-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        height: 34px;
        border: 1px solid color-mix(in oklch, var(--accent) 66%, var(--line));
        border-radius: 7px;
        background: color-mix(in oklch, var(--accent) 18%, var(--panel-2));
        color: var(--accent);
        font-weight: 850;
        cursor: pointer;
        white-space: nowrap;
    }

    .preset-count,
    .draft-history-count {
        color: var(--muted);
        font-size: 12px;
        font-weight: 850;
        white-space: nowrap;
    }

    .preset-count.error,
    .draft-history-count.error {
        color: var(--danger);
    }

    .preset-list,
    .draft-history-list {
        display: flex;
        flex: 1 1 360px;
        gap: 8px;
        min-width: 0;
        overflow-x: auto;
        padding-bottom: 1px;
        scrollbar-gutter: stable;
    }

    .preset-empty,
    .draft-history-empty {
        display: inline-flex;
        align-items: center;
        min-height: 34px;
        color: var(--muted);
        font-size: 13px;
        font-weight: 800;
    }

    .preset-item,
    .draft-history-item {
        display: inline-flex;
        align-items: stretch;
        flex: 0 0 auto;
        max-width: 250px;
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 7px;
        background: var(--panel-2);
    }

    .preset-apply,
    .draft-history-apply {
        display: grid;
        gap: 2px;
        min-width: 150px;
        max-width: 210px;
        border: 0;
        border-right: 1px solid var(--line);
        background: transparent;
        color: var(--text);
        padding: 7px 10px;
        text-align: left;
        cursor: pointer;
    }

    .preset-rename-input {
        min-width: 150px;
        max-width: 210px;
        border: 0;
        border-right: 1px solid var(--line);
        outline: 2px solid var(--accent);
        outline-offset: -2px;
        background: color-mix(in oklch, var(--panel) 88%, var(--accent) 12%);
        color: var(--text);
        padding: 7px 10px;
        font-size: 13px;
        font-weight: 900;
    }

    .preset-apply span,
    .preset-apply small,
    .draft-history-apply span,
    .draft-history-apply small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .preset-apply span,
    .draft-history-apply span {
        font-size: 13px;
        font-weight: 900;
    }

    .preset-apply small,
    .draft-history-apply small {
        color: var(--muted);
        font-size: 11px;
        font-weight: 750;
    }

    .preset-delete,
    .draft-history-delete {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        border: 0;
        background: transparent;
        color: var(--muted);
        cursor: pointer;
    }

    .preset-delete:hover,
    .draft-history-delete:hover {
        color: var(--danger);
    }

    @media (max-width: 900px) {
        .preset-save,
        .draft-history-save {
            width: 100%;
        }

        .preset-list,
        .draft-history-list {
            flex-basis: 100%;
        }
    }
</style>
