<script lang="ts">
    import { getContext } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import { readingLayoutOptions } from "#lib/editor/reading-layout.ts";
    import { proseFontOptions } from "#lib/editor/text-fonts.ts";

    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);
    const appearance = $derived(workspace.rememberedWritingAppearance);
    const summary = $derived(appearance ? [
        readingLayoutOptions.find((item) => item.value === appearance.readingLayout)?.label,
        workspace.documentThemes.find((item) => item.value === appearance.documentTheme)?.label,
        proseFontOptions.find((item) => item.value === appearance.bodyFontFamily)?.label ?? appearance.bodyFontFamily.split(",")[0],
        appearance.bodyFontSize,
    ].join(" · ") : "기억한 설정 없음");
    const feedback = $derived(workspace.writingDefaultsStatus === "saved" ? "새 글 기본값으로 기억했습니다." : workspace.writingDefaultsStatus === "cleared" ? "기억한 기본값을 지웠습니다." : workspace.writingDefaultsStatus === "error" ? "기본값을 저장하지 못했습니다." : "");
</script>

<section class="ui-section" aria-label="새 글 기본값">
    <span class="ui-section-title">새 글 기본값</span>
    <p class="defaults-summary" aria-label="기억한 글 설정">{summary}</p>
    <div class="defaults-actions">
        <button class="ui-btn ui-btn--outline" type="button" aria-label="현재 설정을 새 글 기본값으로 기억" disabled={workspace.editorMountState !== "ready" || workspace.areWritingDefaultsCurrent} onclick={workspace.rememberCurrentWritingAppearance}>현재 설정 기억</button>
        <button class="ui-btn ui-btn--outline" type="button" disabled={!appearance} onclick={workspace.forgetWritingAppearance}>기억한 기본값 지우기</button>
    </div>
    {#if feedback}<p class="ui-hint" class:is-error={workspace.writingDefaultsStatus === "error"} role={workspace.writingDefaultsStatus === "error" ? "alert" : "status"}>{feedback}</p>{/if}
    <p class="ui-hint">배치·배경·본문 글꼴·크기를 이 브라우저에 기억합니다. 새 글과 템플릿에 적용하며, 불러온 글의 설정은 유지합니다.</p>
</section>

<style>
    .defaults-summary { margin: 0; padding: 10px 12px; background: var(--panel-2); border-radius: var(--radius); color: var(--muted); font-size: 0.78rem; line-height: 1.6; overflow-wrap: anywhere; }
    .defaults-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .is-error { color: var(--danger, #b91c1c); }
</style>
