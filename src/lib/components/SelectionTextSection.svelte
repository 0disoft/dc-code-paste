<script lang="ts">
    import { getContext } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import Type from "@lucide/svelte/icons/type";
    import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
    import { proseFontOptions } from "#lib/editor/text-fonts.ts";

    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);
    const style = $derived(workspace.selectionTextStyle);
</script>

<section class="ui-section" aria-label="선택 영역">
    <span class="ui-section-title"><Type size={15} aria-hidden="true" /> 선택 영역</span>

    <label class="ui-field">
        <span class="ui-label">글꼴</span>
        <select
            class="ui-select"
            value={style.fontFamilyMixed ? "mixed" : style.fontFamily}
            aria-label="선택 글꼴"
            onchange={(event) => workspace.setFontFamily(event.currentTarget.value)}
        >
            <option value="">본문 따름</option>
            {#if style.fontFamilyMixed}<option value="mixed" disabled>여러 글꼴</option>{/if}
            {#if style.fontFamily && !proseFontOptions.some((item) => item.value === style.fontFamily)}
                <option value={style.fontFamily}>가져온 글꼴 · {style.fontFamily.split(",")[0]}</option>
            {/if}
            {#each proseFontOptions as item (item.value)}
                <option value={item.value}>{item.label}</option>
            {/each}
        </select>
    </label>

    <label class="ui-field">
        <span class="ui-label">글자 크기</span>
        <select
            class="ui-select"
            value={style.fontSizeMixed ? "mixed" : style.fontSize}
            aria-label="선택 글자 크기"
            onchange={(event) => workspace.setFontSize(event.currentTarget.value)}
        >
            <option value="">본문 따름</option>
            {#if style.fontSizeMixed}<option value="mixed" disabled>여러 크기</option>{/if}
            {#if style.fontSize && !workspace.bodySizes.includes(style.fontSize)}<option value={style.fontSize}>{style.fontSize} (가져온 서식)</option>{/if}
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
                    aria-pressed={!style.colorMixed && style.color.toLowerCase() === swatch.color.toLowerCase()}
                    style={`--swatch:${swatch.color}`}
                    onclick={() => workspace.setTextColor(swatch.color)}
                ></button>
            {/each}
        </div>
    </div>

    <button class="ui-btn ui-btn--outline" type="button" aria-label="글자 꾸밈 초기화" disabled={!style.hasOverrides} onclick={workspace.resetSelectionTextStyle}>
        <RotateCcw size={14} aria-hidden="true" /> 글자 꾸밈 초기화
    </button>
    <p class="ui-hint">{style.empty ? "앞으로 입력할 글자에 적용됩니다." : "선택한 글자에 적용됩니다."} 초기화하면 글꼴·크기·색을 본문에 맞추고, 굵게·기울임·링크는 유지합니다.</p>
</section>
