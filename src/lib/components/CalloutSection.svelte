<script lang="ts">
    import { getContext } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import StickyNote from "@lucide/svelte/icons/sticky-note";

    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);
</script>

<section class="ui-section" aria-label="콜아웃 색상">
    <span class="ui-section-title"><StickyNote size={15} aria-hidden="true" /> 콜아웃 색상</span>

    <div class="callout-color-swatches ui-swatch-row" aria-label="콜아웃 색상 프리셋">
        {#each workspace.calloutColorOptions as item (item.kind)}
            <button
                class="ui-swatch"
                class:is-active={workspace.activeCalloutKind === item.kind}
                type="button"
                aria-label={`${item.label} 콜아웃`}
                aria-pressed={workspace.activeCalloutKind === item.kind}
                title={`${item.label} 콜아웃 · 두 번 누르면 직접 고르기`}
                style={`--swatch:${workspace.calloutSwatchColor(item.kind, item.color)}`}
                onclick={() => workspace.applyCalloutPresetColor(item.kind, item.color)}
                ondblclick={() => workspace.openCalloutColorPicker(item.kind, item.color)}
            ></button>
        {/each}
    </div>

    <input
        bind:this={workspace.calloutColorInput}
        class="callout-color-input"
        type="color"
        bind:value={workspace.activeCalloutColor}
        aria-label="사용자 콜아웃 색상"
        tabindex="-1"
        oninput={workspace.updateCalloutPickerColor}
    />

    <p class="ui-hint">색을 두 번 누르면 직접 색을 고를 수 있습니다.</p>
</section>
