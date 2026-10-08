<script lang="ts">
    import { getContext } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import Download from "@lucide/svelte/icons/download";
    import Upload from "@lucide/svelte/icons/upload";
    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);
    let input: HTMLInputElement;
    let busy = $state(false);
    let message = $state("");
    let failed = $state(false);
    function download() {
        const result = workspace.exportDraftFile();
        message = result.message;
        failed = result.error;
    }
    async function upload(event: Event) {
        const target = event.currentTarget as HTMLInputElement;
        const file = target.files?.[0];
        if (!file || busy) return;
        busy = true;
        message = "파일을 읽는 중입니다.";
        failed = false;
        try {
            const result = await workspace.importDraftFile(file);
            message = result.message;
            failed = result.error;
        } finally { busy = false; target.value = ""; }
    }
</script>

<section class="ui-section" aria-label="초안 파일">
    <span class="ui-section-title">초안 파일</span>
    <p class="ui-hint">글과 서식을 JSON 파일로 보관합니다. 다른 브라우저에서도 다시 불러올 수 있습니다.</p>
    <div class="ui-inline-group">
        <button class="ui-btn ui-btn--outline" type="button" aria-label="초안 파일 저장"
            disabled={busy || workspace.editorMountState !== "ready"} onclick={download}>
            <Download size={15} aria-hidden="true" /> 파일 저장
        </button>
        <button class="ui-btn ui-btn--outline" type="button" aria-label="초안 파일 불러오기"
            disabled={busy || workspace.editorMountState !== "ready"} onclick={() => input.click()}>
            <Upload size={15} aria-hidden="true" /> 불러오기
        </button>
    </div>
    <input hidden bind:this={input} type="file" accept=".json,application/json"
        aria-label="초안 JSON 파일" tabindex="-1" onchange={upload} />
    {#if message}<p class="ui-hint" class:is-error={failed} role={failed ? "alert" : "status"}>{message}</p>{/if}
</section>
