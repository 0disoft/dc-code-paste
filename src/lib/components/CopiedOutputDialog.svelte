<script lang="ts">
    import { getContext, tick } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import { downloadReadableHtml } from "#lib/dc/html-file.ts";
    import X from "@lucide/svelte/icons/x";
    import RoundtripComparison from "./RoundtripComparison.svelte";

    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);
    let dialog = $state<HTMLDialogElement>();
    let openedDocumentVersion = 0;
    let fileError = $state("");
    let source = $state<HTMLTextAreaElement>();
    let showSource = $state(false);
    let view = $state<"current" | "returned">("current");
    let returnedOpened = $state(false);
    const output = $derived(workspace.lastCopiedOutput);
    const changes = $derived(workspace.isCopiedOutputOpen ? workspace.copiedOutputChanges : undefined);
    const changeLabel = $derived(changes?.content && changes.appearance ? "내용과 글 설정이 바뀌었습니다." : changes?.content ? "내용이 바뀌었습니다." : changes?.appearance ? "글 설정이 바뀌었습니다." : "현재 글이 복사 당시와 같습니다.");
    const copiedAt = $derived(output ? new Date(output.copiedAt).toLocaleString("ko-KR") : "");

    // Storage can contain arbitrary markup. Render each preview in an isolated frame.
    function previewDocument(html: string) {
        return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"></head><body style="margin:0">${html}</body></html>`;
    }

    $effect(() => {
        if (!dialog) return;
        if (workspace.isCopiedOutputOpen && output && !dialog.open) {
            openedDocumentVersion = workspace.documentReplacementVersion;
            fileError = "";
            showSource = false;
            view = "current";
            returnedOpened = false;
            dialog.showModal();
        } else if ((!workspace.isCopiedOutputOpen || !output) && dialog.open) dialog.close();
    });

    $effect(() => { if (workspace.savedOutputCopyState === "error") showSource = true; });

    function close() { workspace.isCopiedOutputOpen = false; }
    function selectView(next: "current" | "returned") { view = next; if (next === "returned") returnedOpened = true; }
    function tabKey(event: KeyboardEvent) {
        if (event.isComposing || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === "Home" ? "current" : event.key === "End" ? "returned" : view === "current" ? "returned" : "current";
        selectView(next);
        document.getElementById(`copied-output-${next}-tab`)?.focus();
    }
    async function restoreFocus() {
        close();
        await tick();
        if (workspace.documentReplacementVersion === openedDocumentVersion)
            document.querySelector<HTMLButtonElement>('[aria-label="더보기 메뉴"]')?.focus({ preventScroll: true });
    }
    function download() {
        if (!output) return;
        try { downloadReadableHtml(output.html); fileError = ""; }
        catch { fileError = "파일을 저장하지 못했습니다. HTML 원문을 선택해 복사해 주세요."; showSource = true; }
    }
</script>

<dialog class="output-dialog" bind:this={dialog} aria-labelledby="copied-output-title" oncancel={close} onclose={restoreFocus} onkeydown={(event) => event.stopPropagation()}>
    {#if output && workspace.isCopiedOutputOpen}
        <div class="output-content">
            <header>
                <div><h2 id="copied-output-title">마지막 복사 결과</h2><p>{copiedAt} · {output.channel === "preview" ? "서식 있는 글" : "HTML 원문"}</p></div>
                <button class="ui-btn ui-btn--icon ui-btn--outline" type="button" aria-label="복사 결과 닫기" onclick={close}><X size={18} aria-hidden="true" /></button>
            </header>
            <p class="change-note" role="status">{changeLabel}</p>
            {#if !workspace.copiedOutputPersisted}<p class="ui-hint" role="status">브라우저에 보관하지 못해 이번 결과는 이 탭에서만 볼 수 있습니다. 탭을 닫기 전에 파일로 저장해 주세요.</p>{/if}
            <div class="output-actions">
                <button class="ui-btn ui-btn--primary" type="button" disabled={workspace.isCopying} onclick={workspace.copySavedOutput}>{workspace.activeCopyChannel === "saved" ? "복사 중" : workspace.savedOutputCopyState === "copied" ? "다시 복사됨" : output.channel === "source" ? "같은 HTML 원문 다시 복사" : "같은 결과 다시 복사"}</button>
                <button class="ui-btn ui-btn--outline" type="button" onclick={download}>HTML 파일 저장</button>
                <button class="ui-btn ui-btn--outline" type="button" disabled={workspace.isCopying || workspace.editorMountState !== "ready" || (!changes?.content && !changes?.appearance)} onclick={workspace.restoreCopiedOutput}>복사 당시 글 복원</button>
                <button class="ui-btn ui-btn--outline" type="button" disabled={workspace.isCopying} onclick={workspace.forgetCopiedOutput}>복사 기록 지우기</button>
            </div>
            {#if workspace.savedOutputCopyState === "error"}<p class="ui-hint" role="alert">자동 복사가 막혔습니다. 아래 HTML 원문을 디씨 HTML 모드에 붙여넣거나 파일로 저장해 주세요.</p>{/if}
            {#if workspace.copiedOutputError || fileError}<p class="ui-hint" role="alert">{workspace.copiedOutputError || fileError}</p>{/if}
            <div class="ui-segmented ui-segmented--fill" role="tablist" aria-label="복사 결과 비교 방식">
                <button id="copied-output-current-tab" class:is-active={view === "current"} type="button" role="tab" aria-selected={view === "current"} aria-controls="copied-output-current-panel" tabindex={view === "current" ? 0 : -1} onclick={() => selectView("current")} onkeydown={tabKey}>현재 글과 비교</button>
                <button id="copied-output-returned-tab" class:is-active={view === "returned"} type="button" role="tab" aria-selected={view === "returned"} aria-controls="copied-output-returned-panel" tabindex={view === "returned" ? 0 : -1} onclick={() => selectView("returned")} onkeydown={tabKey}>붙여넣은 결과와 비교</button>
            </div>
            <div id="copied-output-current-panel" role="tabpanel" aria-labelledby="copied-output-current-tab" hidden={view !== "current"}>
            <div class="output-comparison">
                <section aria-label="복사 당시 결과"><h3>복사 당시</h3><iframe title="복사 당시 글 미리보기" sandbox="" srcdoc={previewDocument(output.html)}></iframe></section>
                <section aria-label="현재 글 결과"><h3>현재 글</h3>{#if workspace.isRendering}<p role="status">현재 글을 만드는 중입니다.</p>{:else if workspace.previewError}<p role="alert">{workspace.previewError}</p>{:else}<iframe title="현재 글 미리보기" sandbox="" srcdoc={previewDocument(workspace.html)}></iframe>{/if}</section>
            </div>
            <details bind:open={showSource}><summary>복사 당시 HTML 원문</summary><div class="source-tools"><button class="ui-btn ui-btn--outline" type="button" onclick={() => { source?.focus(); source?.select(); }}>원문 전체 선택</button><p class="ui-hint">HTML 원문은 디씨 HTML 모드에 붙여넣습니다.</p></div><textarea bind:this={source} aria-label="복사 당시 HTML 원문" readonly spellcheck="false" value={output.html}></textarea></details>
            </div>
            <div id="copied-output-returned-panel" role="tabpanel" aria-labelledby="copied-output-returned-tab" hidden={view !== "returned"}>
                {#if returnedOpened}<RoundtripComparison {output} />{/if}
            </div>
        </div>
    {/if}
</dialog>

<style>
    .output-dialog { width: min(1100px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); padding: 0; border: 1px solid var(--line); border-radius: var(--radius-lg); background: var(--surface); color: var(--text); }
    .output-dialog::backdrop { background: rgb(0 0 0 / 45%); }
    .output-content { display: grid; gap: 16px; padding: 20px; min-width: 0; }
    header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    h2 { margin: 0; font-size: 1.2rem; }
    header p { margin: 6px 0 0; font-size: 0.8rem; color: var(--muted); }
    .change-note { margin: 0; font-size: 0.9rem; }
    .output-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .output-comparison { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .output-comparison section { min-width: 0; }
    h3 { margin: 0 0 8px; font-size: 0.85rem; }
    iframe { display: block; width: 100%; height: 48dvh; border: 1px solid var(--line); background: white; border-radius: 8px; }
    summary { cursor: pointer; font-size: 0.85rem; }
    .source-tools { margin-top: 12px; }
    textarea { width: 100%; min-height: 150px; margin-top: 8px; padding: 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel-2); color: var(--text); font-family: monospace; font-size: 0.75rem; resize: vertical; }
    @media (max-width: 640px) { .output-content { padding: 14px; } .output-comparison { grid-template-columns: minmax(0, 1fr); } iframe { height: 32dvh; } }
</style>
