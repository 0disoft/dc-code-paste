<script lang="ts">
    import { getContext } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import { isComposingKeyEvent } from "#lib/editor/keyboard-shortcuts.ts";
    import type { PresetSnapshot } from "#lib/editor/preset-storage.ts";
    import LayoutTemplate from "@lucide/svelte/icons/layout-template";
    import Save from "@lucide/svelte/icons/save";
    import Pencil from "@lucide/svelte/icons/pencil";
    import Trash2 from "@lucide/svelte/icons/trash";
    import History from "@lucide/svelte/icons/rotate-ccw-clock";

    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);

    function focusRenameInput(node: HTMLInputElement) {
        node.focus();
        node.select();
    }

    function handleRenameKeydown(event: KeyboardEvent, save: () => void) {
        if (isComposingKeyEvent(event)) return;
        if (event.key === "Enter") {
            event.preventDefault();
            save();
            return;
        }
        if (event.key === "Escape") {
            event.preventDefault();
            workspace.cancelRename();
        }
    }

    function handlePresetNameKeydown(event: KeyboardEvent) {
        if (isComposingKeyEvent(event)) return;
        if (event.key === "Enter") {
            event.preventDefault();
            workspace.saveCurrentPreset();
        }
    }

    function applyPreset(preset: PresetSnapshot) {
        workspace.applyPreset(preset);
    }
</script>

<section class="ui-section" aria-label="예시 템플릿">
    <span class="ui-section-title"><LayoutTemplate size={15} aria-hidden="true" /> 템플릿</span>
    <button
        class="ui-btn ui-btn--outline template-button"
        type="button"
        aria-label="예시 템플릿"
        onclick={workspace.applyExampleTemplate}
    >
        <LayoutTemplate size={16} aria-hidden="true" />
        <span>예시 템플릿</span>
    </button>
    <p class="ui-hint">코드블록과 서식이 들어간 예시 글을 문서 전체에 적용합니다.</p>
</section>

<section class="ui-section" aria-label="프리셋">
    <span class="ui-section-title"><Save size={15} aria-hidden="true" /> 프리셋</span>
    <label class="ui-field">
        <span class="ui-label">이름</span>
        <input
            class="ui-input"
            type="text"
            bind:value={workspace.presetName}
            maxlength="60"
            aria-label="프리셋 이름"
            placeholder="강의글 구조"
            oninput={workspace.clearPresetState}
            onkeydown={handlePresetNameKeydown}
        />
    </label>
    <div class="ui-inline-group">
        <button
            class="ui-btn ui-btn--primary"
            type="button"
            aria-label="프리셋 저장"
            onclick={workspace.saveCurrentPreset}
        >
            <Save size={16} aria-hidden="true" />
            <span>저장</span>
        </button>
        <span class:is-error={workspace.presetState === "error"} class="template-count">
            {workspace.presetStateLabel}
        </span>
    </div>

    <ul class="template-list" aria-label="저장된 프리셋">
        {#if workspace.presets.length === 0}
            <li class="template-empty">프리셋 없음</li>
        {:else}
            {#each workspace.presets as preset (preset.id)}
                <li class="template-item">
                    {#if workspace.isRenaming("preset", preset.id)}
                        <input
                            class="ui-input template-rename-input"
                            type="text"
                            bind:value={workspace.renameDraft}
                            maxlength="60"
                            aria-label="프리셋 제목 변경"
                            use:focusRenameInput
                            onblur={() => workspace.savePresetRename(preset.id)}
                            onkeydown={(event) =>
                                handleRenameKeydown(event, () =>
                                    workspace.savePresetRename(preset.id),
                                )}
                        />
                    {:else}
                        <button
                            class="template-apply"
                            type="button"
                            title="프리셋 적용"
                            onclick={() => applyPreset(preset)}
                        >
                            <span>{preset.name}</span>
                            <small>
                                {preset.preferences.documentTheme === "darkEditorial"
                                    ? "어두운 글"
                                    : preset.preferences.documentTheme === "cleanEditorial"
                                      ? "깔끔한 글"
                                      : "밝은 글"} · {workspace.presetDateLabel(preset.updatedAt)}
                            </small>
                        </button>
                    {/if}
                    <button
                        class="template-icon-button"
                        type="button"
                        aria-label={`${preset.name} 이름 변경`}
                        title="이름 변경"
                        onclick={(event) => workspace.beginPresetRename(preset, event)}
                    >
                        <Pencil size={15} />
                    </button>
                    <button
                        class="template-icon-button is-danger"
                        type="button"
                        aria-label={`${preset.name} 삭제`}
                        title="삭제"
                        onclick={() => workspace.deletePreset(preset.id)}
                    >
                        <Trash2 size={15} />
                    </button>
                </li>
            {/each}
        {/if}
    </ul>
</section>

<section class="ui-section" aria-label="초안">
    <span class="ui-section-title"><History size={15} aria-hidden="true" /> 초안</span>
    <button
        class="ui-btn ui-btn--outline template-button"
        type="button"
        aria-label="저장함 열기"
        onclick={() => (workspace.isStoragePanelOpen = true)}
    >
        <History size={16} aria-hidden="true" />
        <span>저장함 열기</span>
    </button>
    <p class="ui-hint">자동 저장된 초안 스냅샷은 저장함에서 불러오거나 이름을 바꿀 수 있습니다.</p>
</section>

<style>
    .template-button {
        width: 100%;
        justify-content: flex-start;
    }

    .template-list {
        display: grid;
        gap: 6px;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .template-empty {
        color: var(--muted);
        font-size: 0.76rem;
    }

    .template-item {
        display: flex;
        align-items: stretch;
        min-width: 0;
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: var(--radius);
        background: var(--surface);
    }

    .template-apply {
        display: grid;
        gap: 2px;
        flex: 1 1 auto;
        min-width: 0;
        padding: 8px 10px;
        border: 0;
        border-right: 1px solid var(--line);
        background: transparent;
        text-align: left;
        cursor: pointer;
    }

    .template-apply:hover {
        background: var(--accent-soft);
    }

    .template-apply span,
    .template-apply small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .template-apply span {
        color: var(--text);
        font-size: 0.8rem;
        font-weight: 650;
    }

    .template-apply small {
        color: var(--muted);
        font-size: 0.7rem;
    }

    .template-rename-input {
        flex: 1 1 auto;
        border: 0;
        border-right: 1px solid var(--line);
        border-radius: 0;
        outline: 2px solid var(--accent);
        outline-offset: -2px;
    }

    .template-icon-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        width: 32px;
        border: 0;
        background: transparent;
        color: var(--muted);
        cursor: pointer;
    }

    .template-icon-button:hover {
        color: var(--accent-strong);
    }

    .template-icon-button.is-danger:hover {
        color: var(--danger);
    }

    .template-count {
        color: var(--muted);
        font-size: 0.74rem;
        font-weight: 600;
    }

    .template-count.is-error {
        color: var(--danger);
    }
</style>
