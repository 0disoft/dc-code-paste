<script lang="ts">
    import { getContext, tick } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import { maxWritingPurposeLength } from "#lib/editor/writing-purpose.ts";

    let { open, onClose }: { open: boolean; onClose: () => void } = $props();
    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);
    let dialog = $state<HTMLDialogElement>();
    let field = $state<HTMLTextAreaElement>();
    let draft = $state("");
    let error = $state("");
    let conflict = $state(false);
    let baseline = "";
    let openedVersion = 0;

    function loadCurrent() {
        baseline = workspace.writingPurpose.value;
        draft = baseline;
        openedVersion = workspace.documentReplacementVersion;
        error = "";
        conflict = false;
    }

    $effect(() => {
        if (!dialog) return;
        if (open && !dialog.open) {
            loadCurrent();
            dialog.showModal();
            void tick().then(() => { if (open && dialog?.open) field?.focus(); });
        } else if (!open && dialog.open) dialog.close();
    });

    function save() {
        if (workspace.documentReplacementVersion !== openedVersion) {
            error = "열려 있는 글이 바뀌었습니다. 현재 목적을 불러온 뒤 다시 적어 주세요.";
            conflict = true;
            return;
        }
        const result = workspace.writingPurpose.save(draft, baseline);
        if ("error" in result) {
            error = result.error;
            conflict = "conflict" in result && result.conflict === true;
            return;
        }
        onClose();
    }
</script>

<dialog class="purpose-dialog" bind:this={dialog} aria-labelledby="writing-purpose-title" oncancel={onClose} onclose={onClose} onkeydown={(event) => event.stopPropagation()}>
    {#if open}
        <form onsubmit={(event) => { event.preventDefault(); save(); }}>
            <h2 id="writing-purpose-title">이 글의 목적</h2>
            <label for="writing-purpose-input">이 글을 건네고 나면 무엇이 남았으면 하나요?</label>
            <textarea id="writing-purpose-input" class="ui-input" bind:this={field} bind:value={draft} maxlength={maxWritingPurposeLength} rows="3" placeholder="예: 읽고 나면 설치 방법을 스스로 따라 할 수 있었으면."></textarea>
            <p class="purpose-hint">비워두어도 됩니다. 목적은 초안에만 저장됩니다.</p>
            {#if error}<p class="purpose-error" role="alert">{error}</p>{/if}
            {#if conflict}<button class="ui-btn ui-btn--outline" type="button" onclick={loadCurrent}>현재 목적 불러오기</button>{/if}
            <div class="purpose-actions">
                <button class="ui-btn ui-btn--outline" type="button" onclick={onClose}>취소</button>
                <button class="ui-btn ui-btn--primary" type="submit" disabled={workspace.editorMountState !== "ready"}>목적 저장</button>
            </div>
        </form>
    {/if}
</dialog>

<style>
    .purpose-dialog {
        width: min(520px, calc(100vw - 32px));
        max-height: calc(100dvh - 32px);
        padding: 20px;
        border: 1px solid var(--line);
        border-radius: var(--radius-lg);
        background: var(--surface);
        color: var(--text);
    }
    .purpose-dialog::backdrop {
        background: rgb(0 0 0 / 45%);
    }
    form {
        display: grid;
        gap: 12px;
        min-width: 0;
    }
    h2 {
        margin: 0;
        font-size: 1.1rem;
    }
    label {
        font-size: 0.9rem;
        line-height: 1.6;
    }
    textarea {
        width: 100%;
        resize: vertical;
    }
    .purpose-hint, .purpose-error {
        margin: 0;
        font-size: 0.8rem;
        line-height: 1.6;
        color: var(--muted);
    }
    .purpose-error {
        color: var(--danger);
    }
    .purpose-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
    }
    button:focus-visible, textarea:focus-visible {
        outline: 2px solid var(--focus);
        outline-offset: 2px;
    }
    @media (max-width: 600px) {
        .purpose-dialog {
            padding: 16px;
        }
        button {
            min-height: 44px;
        }
    }
</style>
