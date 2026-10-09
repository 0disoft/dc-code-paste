<script lang="ts">
    import { getContext } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import Paintbrush from "@lucide/svelte/icons/paintbrush";
    import { proseFontOptions } from "#lib/editor/text-fonts.ts";
    import { readingLayoutOptions } from "#lib/editor/reading-layout.ts";

    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);
</script>

<section class="ui-section" aria-label="문서">
    <span class="ui-section-title"><Paintbrush size={15} aria-hidden="true" /> 문서</span>

    <label class="ui-field">
        <span class="ui-label">읽기 배치</span>
        <select class="ui-select" bind:value={workspace.readingLayout} aria-label="읽기 배치">
            {#each readingLayoutOptions as item (item.value)}
                <option value={item.value}>{item.label}</option>
            {/each}
        </select>
    </label>
    <p class="ui-hint">미리보기의 ‘배치 비교’에서 두 간격을 함께 볼 수 있습니다.</p>

    <label class="ui-field">
        <span class="ui-label">글 배경</span>
        <select
            class="ui-select"
            bind:value={workspace.documentTheme}
            aria-label="복사될 글 배경"
            title="DC 야간모드와 별개로 복사될 글의 배경을 고릅니다"
        >
            {#each workspace.documentThemes as item (item.value)}
                <option value={item.value}>{item.label}</option>
            {/each}
        </select>
    </label>

    <label class="ui-field">
        <span class="ui-label">본문 글꼴</span>
        <select class="ui-select" bind:value={workspace.bodyFontFamily} aria-label="본문 글꼴">
            {#if !proseFontOptions.some((item) => item.value === workspace.bodyFontFamily)}
                <option value={workspace.bodyFontFamily}>가져온 글꼴 · {workspace.bodyFontFamily.split(",")[0]}</option>
            {/if}
            {#each proseFontOptions as item (item.value)}
                <option value={item.value}>{item.label}</option>
            {/each}
        </select>
    </label>

    <label class="ui-field">
        <span class="ui-label">본문 글자 크기</span>
        <select class="ui-select" bind:value={workspace.bodyFontSize} aria-label="본문 글자 크기">
            {#each workspace.bodySizes as item (item)}
                <option value={item}>{item}</option>
            {/each}
        </select>
    </label>
    <p class="ui-hint">기기에 없는 글꼴은 대체 글꼴로 표시됩니다.</p>
</section>
