<script lang="ts">
    import { getContext, onDestroy } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import { createDcExportSession } from "#lib/dc/export-document.ts";
    import { readingLayoutOptions, type ReadingLayout } from "#lib/editor/reading-layout.ts";

    let { width = "100%", onapply }: { width?: string; onapply: () => void } = $props();
    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);
    const session = createDcExportSession();
    let candidates = $state<Partial<Record<ReadingLayout, string>>>({});
    let busy = $state(true);
    let error = $state(false);
    let retry = $state(0);
    let revision = 0;

    $effect(() => {
        void retry;
        const document = $state.snapshot(workspace.documentJson);
        const options = workspace.exportOptions();
        const current = ++revision;
        busy = true;
        error = false;
        const timer = setTimeout(async () => {
            try {
                const html = await Promise.all(readingLayoutOptions.map((item) =>
                    session.exportDocument(document, { ...options, readingLayout: item.value }),
                ));
                if (current !== revision) return;
                candidates = { balanced: html[0], airy: html[1] };
            } catch {
                if (current !== revision) return;
                error = true;
            } finally {
                if (current === revision) busy = false;
            }
        }, 120);
        return () => { clearTimeout(timer); revision++; };
    });
    onDestroy(() => session.dispose());

    function apply(value: ReadingLayout) {
        if (busy || error) return;
        workspace.readingLayout = value;
        onapply();
    }
</script>

<section id="reading-layout-comparison" class="layout-comparison" aria-label="읽기 배치 비교" aria-busy={busy}>
    <p class="comparison-note">같은 원문의 줄 간격과 문단 여백을 비교해보세요. 선택한 배치는 편집과 복사에 함께 적용됩니다.</p>
    {#if error}
        <div class="comparison-error" role="alert">
            <span>배치를 불러오지 못했습니다.</span>
            <button class="ui-btn ui-btn--outline" type="button" onclick={() => retry++}>다시 시도</button>
        </div>
    {/if}
    <div class="comparison-grid">
        {#each readingLayoutOptions as item (item.value)}
            <section class="candidate" class:is-selected={workspace.readingLayout === item.value} aria-label={`${item.label} 배치`}>
                <div class="candidate-head">
                    <div><strong>{item.label}</strong><p>{item.description}</p></div>
                    <button class="ui-btn ui-btn--outline" type="button" disabled={busy || error || workspace.readingLayout === item.value} onclick={() => apply(item.value)} aria-label={`${item.label} 적용`}>
                        {workspace.readingLayout === item.value ? "현재 배치" : "이 배치 적용"}
                    </button>
                </div>
                <!-- Scroll regions need keyboard focus for arrow-key scrolling. -->
                <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
                <div class="candidate-scroll" tabindex="0" role="region" aria-label={`${item.label} 글 미리보기`}>
                    {#if busy}
                        <p class="candidate-notice" role="status">배치 만드는 중</p>
                    {:else if !error}
                        <div class="candidate-document" style:width={width}>
                            {#if candidates[item.value]}{@html candidates[item.value]}{:else}<p class="candidate-notice">글을 입력하면 배치를 비교할 수 있습니다.</p>{/if}
                        </div>
                    {/if}
                </div>
            </section>
        {/each}
    </div>
</section>

<style>
    .layout-comparison { container-type: inline-size; padding: 16px; min-width: 0; }
    .comparison-note { margin: 0 0 16px; color: var(--muted); font-size: 0.82rem; line-height: 1.6; }
    .comparison-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .candidate { min-width: 0; border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }
    .candidate.is-selected { border-color: var(--accent); }
    .candidate-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding: 14px; background: var(--surface); }
    .candidate-head strong { font-size: 0.88rem; }
    .candidate-head p { margin: 5px 0 0; color: var(--muted); font-size: 0.75rem; }
    .candidate-scroll { max-height: 560px; min-height: 180px; overflow: auto; background: var(--panel-2); }
    .candidate-scroll:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
    .candidate-document { min-width: 0; margin: 0 auto; }
    .candidate-notice { padding: 20px; color: var(--muted); font-size: 0.82rem; }
    .comparison-error { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    @container (max-width: 720px) { .comparison-grid { grid-template-columns: minmax(0, 1fr); } }
</style>
