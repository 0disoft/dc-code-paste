<script lang="ts">
    import { getContext } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import { downloadReadableHtml } from "#lib/dc/html-file.ts";
    import Download from "@lucide/svelte/icons/download";
    import RefreshCw from "@lucide/svelte/icons/refresh-cw";
    import X from "@lucide/svelte/icons/x";

    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);
    let dialog: HTMLDialogElement;
    let source = $state<HTMLTextAreaElement>();
    let fileError = $state("");
    const previewFailed = $derived(workspace.copyState === "error" || workspace.copyState === "render-error");
    const failed = $derived(previewFailed || workspace.sourceCopyState === "error");
    const renderFailed = $derived(workspace.copyState === "render-error");
    const html = $derived(previewFailed ? workspace.manualCopyHtml : workspace.html);

    $effect(() => {
        if (failed && !dialog.open) {
            fileError = "";
            dialog.showModal();
        } else if (!failed && dialog.open) dialog.close();
    });

    function selectSource() {
        source?.focus();
        source?.select();
    }

    function saveFile() {
        try { downloadReadableHtml(html); fileError = ""; }
        catch { fileError = "파일을 저장하지 못했습니다. 원문을 선택해 복사해 주세요."; }
    }

    function retry() {
        const preview = previewFailed;
        workspace.dismissCopyErrors();
        if (preview) void workspace.copyPreview();
        else void workspace.copySourceHtml();
    }
</script>

<dialog class="copy-recovery" bind:this={dialog} aria-labelledby="copy-recovery-title" aria-describedby="copy-recovery-description" oncancel={() => workspace.dismissCopyErrors()} onkeydown={(event) => event.stopPropagation()}>
    <div class="recovery-content">
        <header>
            <h2 id="copy-recovery-title">{renderFailed ? "글을 변환하지 못했습니다" : "자동 복사가 막혔습니다"}</h2>
            <button class="ui-btn ui-btn--icon ui-btn--outline" type="button" aria-label="복사 도움 닫기" onclick={workspace.dismissCopyErrors}><X size={18} aria-hidden="true" /></button>
        </header>
        <p id="copy-recovery-description">{renderFailed ? "글은 편집기에 남아 있습니다. 다시 시도하거나 편집 화면으로 돌아갈 수 있습니다." : "원문을 선택해 직접 복사하거나, 글의 서식을 담은 HTML 파일로 저장할 수 있습니다."}</p>
        {#if !renderFailed && html}
            <textarea class="html-source" bind:this={source} readonly spellcheck="false" aria-label="수동 복사용 HTML 원문" value={html}></textarea>
            <p class="ui-hint">원문은 디씨 글쓰기의 HTML 모드에 붙여넣으세요. HTML 파일은 브라우저로 열어 글을 확인할 수 있습니다.</p>
        {/if}
        <div class="recovery-actions">
            {#if !renderFailed && html}
                <button class="ui-btn ui-btn--primary" type="button" onclick={selectSource}>원문 전체 선택</button>
                <button class="ui-btn ui-btn--outline" type="button" onclick={saveFile}><Download size={15} aria-hidden="true" /> HTML 파일 저장</button>
            {/if}
            <button class="ui-btn ui-btn--outline" type="button" onclick={retry}><RefreshCw size={15} aria-hidden="true" /> 다시 복사</button>
        </div>
        {#if fileError}<p role="alert" class="file-error">{fileError}</p>{/if}
    </div>
</dialog>

<style>
    .copy-recovery { width: min(760px, calc(100vw - 24px)); max-height: calc(100dvh - 24px); margin: auto; padding: 20px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); color: var(--text); box-shadow: var(--shadow-pop); }
    .copy-recovery::backdrop { background: oklch(22% 0.01 265 / 0.45); }
    .recovery-content { display: flex; flex-direction: column; gap: 14px; min-height: 0; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    h2 { margin: 0; font-size: 1.1rem; }
    p { margin: 0; font-size: 0.85rem; line-height: 1.6; }
    .html-source { min-height: 0; height: min(300px, 35dvh); resize: none; border-radius: var(--radius); }
    .html-source:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
    .recovery-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .file-error { color: var(--danger); }
</style>
