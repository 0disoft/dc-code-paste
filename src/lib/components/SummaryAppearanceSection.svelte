<script lang="ts">
    import { getContext } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import {
        blockTones,
        summaryToneColors,
        type BlockAppearance,
    } from "#lib/editor/block-appearance.ts";
    import AlignLeft from "@lucide/svelte/icons/align-left";
    import AlignCenter from "@lucide/svelte/icons/align-center";
    import AlignRight from "@lucide/svelte/icons/align-right";

    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);

    const toneLabels: Record<BlockAppearance["tone"], string> = {
        blue: "파랑",
        green: "초록",
        amber: "노랑",
        rose: "분홍",
        violet: "보라",
    };

    const alignments: { value: BlockAppearance["alignment"]; label: string; icon: typeof AlignLeft }[] =
        [
            { value: "left", label: "왼쪽 정렬", icon: AlignLeft },
            { value: "center", label: "가운데 정렬", icon: AlignCenter },
            { value: "right", label: "오른쪽 정렬", icon: AlignRight },
        ];

    const spacings: { value: BlockAppearance["spacing"]; label: string }[] = [
        { value: "compact", label: "작게" },
        { value: "normal", label: "보통" },
        { value: "spacious", label: "크게" },
    ];

    const appearance = $derived(workspace.selectedBlockInfo);
    const activeTone = $derived(
        appearance?.hasCustomTone
            ? appearance.tone
            : workspace.documentTheme === "cleanEditorial"
              ? "blue"
              : null,
    );
    const activeAlignment = $derived(appearance?.alignment ?? "left");
    const activeSpacing = $derived(appearance?.spacing ?? "normal");
</script>

<section class="ui-section summary-settings" aria-label="요약 블록">

    <label class="ui-field">
        <span class="ui-label">제목</span>
        <input
            class="ui-input"
            type="text"
            bind:this={workspace.blockLabelInput}
            bind:value={workspace.blockLabelDraft}
            aria-label="요약 블록 제목"
            placeholder={workspace.blockLabelPlaceholder()}
            onkeydown={workspace.applyBlockLabelOnEnter}
            onblur={workspace.applyBlockLabel}
        />
    </label>
    <div class="ui-field">
        <span class="ui-label">테마</span>
        <div class="ui-swatch-row" role="group" aria-label="요약 테마">
            {#each blockTones as tone (tone)}
                <button
                    class="ui-swatch"
                    class:is-active={activeTone === tone}
                    type="button"
                    aria-label={`${toneLabels[tone]} 테마`}
                    aria-pressed={activeTone === tone}
                    title={`${toneLabels[tone]} 테마`}
                    style={`--swatch:${summaryToneColors[tone].background};` +
                        `border-color:${summaryToneColors[tone].border};`}
                    onclick={() => workspace.setSelectedBlockAppearance({ tone })}
                ></button>
            {/each}
        </div>
        {#if activeTone === null}<p class="ui-hint">전체 글의 테마를 사용 중입니다.</p>{/if}
    </div>

    <div class="ui-field">
        <span class="ui-label">정렬</span>
        <div class="ui-segmented ui-segmented--fill" role="group" aria-label="요약 정렬">
            {#each alignments as option (option.value)}
                {@const Icon = option.icon}
                <button
                    class:is-active={activeAlignment === option.value}
                    type="button"
                    aria-label={option.label}
                    aria-pressed={activeAlignment === option.value}
                    title={option.label}
                    onclick={() =>
                        workspace.setSelectedBlockAppearance({ alignment: option.value })}
                >
                    <Icon size={16} />
                </button>
            {/each}
        </div>
    </div>

    <div class="ui-field">
        <span class="ui-label">내부 여백</span>
        <div class="ui-segmented ui-segmented--fill" role="group" aria-label="요약 내부 여백">
            {#each spacings as option (option.value)}
                <button
                    class:is-active={activeSpacing === option.value}
                    type="button"
                    aria-pressed={activeSpacing === option.value}
                    onclick={() => workspace.setSelectedBlockAppearance({ spacing: option.value })}
                >
                    {option.label}
                </button>
            {/each}
        </div>
    </div>
</section>
