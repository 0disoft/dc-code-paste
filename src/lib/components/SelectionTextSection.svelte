<script lang="ts">
    import { getContext } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import Type from "@lucide/svelte/icons/type";

    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);
</script>

<section class="ui-section" aria-label="선택 영역">
    <span class="ui-section-title"><Type size={15} aria-hidden="true" /> 선택 영역</span>

    <label class="ui-field">
        <span class="ui-label">선택 글자</span>
        <select
            class="ui-select"
            bind:value={workspace.selectionFontSize}
            aria-label="선택 글자 크기"
            onchange={() => workspace.setFontSize(workspace.selectionFontSize)}
        >
            {#each workspace.bodySizes as item (item)}
                <option value={item}>{item}</option>
            {/each}
        </select>
    </label>

    <div class="ui-field">
        <span class="ui-label">글자색</span>
        <div class="ui-swatch-row" role="group" aria-label="글자색">
            {#each workspace.swatches as swatch (swatch.color)}
                <button
                    class="ui-swatch is-round"
                    type="button"
                    title={`${swatch.label} 글자색`}
                    aria-label={`${swatch.label} 글자색`}
                    style={`--swatch:${swatch.color}`}
                    onclick={() => workspace.setTextColor(swatch.color)}
                ></button>
            {/each}
        </div>
    </div>

    <p class="ui-hint">글자 크기와 색은 지금 선택한 글자에만 적용됩니다.</p>
</section>
