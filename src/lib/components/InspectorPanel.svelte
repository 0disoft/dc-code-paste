<script lang="ts">
    import { getContext } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import { isComposingKeyEvent } from "#lib/editor/keyboard-shortcuts.ts";
    import BlockActionsSection from "./BlockActionsSection.svelte";
    import SummaryAppearanceSection from "./SummaryAppearanceSection.svelte";
    import CodeBlockSection from "./CodeBlockSection.svelte";
    import CalloutSection from "./CalloutSection.svelte";
    import InlineFormatSection from "./InlineFormatSection.svelte";
    import SelectionTextSection from "./SelectionTextSection.svelte";
    import ArticleSettingsSection from "./ArticleSettingsSection.svelte";
    import Megaphone from "@lucide/svelte/icons/megaphone";
    import Type from "@lucide/svelte/icons/type";
    import Check from "@lucide/svelte/icons/check";

    type Props = {
        open?: boolean;
        compact?: boolean;
        onBlockAction?: () => void;
    };

    let { open = true, compact = false, onBlockAction }: Props = $props();

    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);

    $effect(() => {
        if (workspace.isLinkPanelOpen || (workspace.activeToolPanel === "code" && workspace.selectedBlockInfo?.type === "codeBlock")) tab = "selection";
    });

    let tab = $state<"selection" | "article">("selection");

    const descriptions: Record<string, string> = {
        summaryBox: "핵심 내용을 요약해 강조하는 블록입니다.",
        paragraph: "본문 문단입니다. 글자 서식과 블록 도구를 쓸 수 있습니다.",
        heading: "제목 블록입니다.",
        bulletList: "글머리 목록입니다. 항목을 추가하거나 번호 목록으로 바꿀 수 있습니다.",
        orderedList: "번호 목록입니다. 항목을 추가하거나 글머리 목록으로 바꿀 수 있습니다.",
        sectionHeading: "섹션 제목 블록입니다.",
        blockquote: "인용문 블록입니다. 인용 스타일을 고를 수 있습니다.",
        codeBlock: "코드블록입니다. 언어, 파일명, 줄 강조와 테마를 정합니다.",
        linkBox: "링크박스 블록입니다. 주소와 라벨을 바꿀 수 있습니다.",
        heroBlock: "글 머리 블록입니다. 라벨과 제목을 바꿀 수 있습니다.",
        tutorialBlock: "단계별 안내 블록입니다.",
        comparisonBlock: "좌우 비교 블록입니다.",
        referenceList: "참고 자료 목록 블록입니다.",
        ctaButton: "버튼 블록입니다. 링크 주소와 라벨을 바꿀 수 있습니다.",
        ctaGroup: "버튼을 묶은 블록입니다. 정렬 방식을 고를 수 있습니다.",
    };

    const blockInfo = $derived(workspace.selectedBlockInfo);
    const blockType = $derived(blockInfo?.type ?? "");
    const blockDescription = $derived(
        descriptions[blockType] ?? "이 블록에서 바꿀 수 있는 설정을 모았습니다.",
    );
    const calloutSelected = $derived(
        workspace.isCalloutActive(),
    );
    const labelTarget = $derived(workspace.blockLabelTarget);
    const ctaGroupSelected = $derived(workspace.isActive("ctaGroup"));

    function handleLabelKeydown(event: KeyboardEvent) {
        if (isComposingKeyEvent(event)) return;
        workspace.applyBlockLabelOnEnter(event);
    }
</script>

<aside id="inspector-rail" class="rail rail-right" data-open={open} inert={compact && !open} aria-label="블록 설정">
    <div class="rail-head">
        <div class="ui-segmented ui-segmented--fill" role="tablist" aria-label="설정 범위">
            <button
                id="selection-tab"
                class:is-active={tab === "selection"}
                type="button"
                role="tab"
                aria-selected={tab === "selection"}
                aria-controls="selection-tabpanel"
                onclick={() => (tab = "selection")}
            >
                선택한 블록
            </button>
            <button
                id="article-tab"
                class:is-active={tab === "article"}
                type="button"
                role="tab"
                aria-selected={tab === "article"}
                aria-controls="article-tabpanel"
                onclick={() => (tab = "article")}
            >
                전체 글
            </button>
        </div>
    </div>

    {#if tab === "selection"}
        <div
            id="selection-tabpanel"
            class="rail-scroll"
            role="tabpanel"
            aria-labelledby="selection-tab"
        >
            {#if blockInfo === null}
                <div class="ui-card">
                    <strong>선택한 블록 없음</strong>
                    <span>
                        글에서 블록을 누르면 그 블록의 설정이 여기에 나타납니다. 요약 블록은 테마,
                        정렬, 내부 여백을 바로 바꿀 수 있습니다.
                    </span>
                </div>
            {:else}
                <div class="inspector-head">
                    <h2 class="inspector-title">{blockInfo.label}</h2>
                    <p class="ui-section-note">{blockDescription}</p>
                </div>

                <BlockActionsSection onAction={onBlockAction} />

                {#if blockInfo.type === "summaryBox"}
                    <SummaryAppearanceSection />
                {/if}

                {#if blockInfo.type === "codeBlock"}
                    <CodeBlockSection />
                {/if}

                {#if calloutSelected}
                    <CalloutSection />
                {/if}

                {#if ctaGroupSelected}
                    <section class="ui-section" aria-label="버튼묶음">
                        <span class="ui-section-title">
                            <Megaphone size={15} aria-hidden="true" /> 버튼묶음
                        </span>
                        <label class="ui-field">
                            <span class="ui-label">정렬</span>
                            <select
                                class="ui-select"
                                bind:value={workspace.ctaGroupLayout}
                                aria-label="버튼묶음 정렬"
                                onchange={workspace.updateActiveCtaGroupLayout}
                            >
                                {#each workspace.ctaGroupLayoutOptions as item (item.value)}
                                    <option value={item.value}>{item.label}</option>
                                {/each}
                            </select>
                        </label>
                    </section>
                {/if}

                {#if labelTarget && blockInfo.type !== "summaryBox"}
                    <section class="ui-section" aria-label="블록 라벨">
                        <span class="ui-section-title">
                            <Type size={15} aria-hidden="true" /> 블록 라벨
                        </span>
                        <label class="ui-field">
                            <span class="ui-label">라벨</span>
                            <input
                                class="ui-input"
                                type="text"
                                bind:this={workspace.blockLabelInput}
                                bind:value={workspace.blockLabelDraft}
                                aria-label="블록 라벨"
                                placeholder={workspace.blockLabelPlaceholder()}
                                onkeydown={handleLabelKeydown}
                            />
                        </label>
                        <button
                            class="ui-btn ui-btn--outline"
                            type="button"
                            aria-label="라벨 적용"
                            onclick={workspace.applyBlockLabel}
                        >
                            <Check size={16} aria-hidden="true" />
                            <span>라벨 적용</span>
                        </button>
                    </section>
                {/if}

            {/if}

            <SelectionTextSection />

            {#if blockInfo && !["paragraph", "heading", "bulletList", "orderedList"].includes(blockInfo.type) && !workspace.isLinkPanelOpen}
                <details class="ui-disclosure">
                    <summary>글자 서식</summary>
                    <InlineFormatSection />
                </details>
            {:else}
                <InlineFormatSection />
            {/if}
        </div>
    {:else}
        <div
            id="article-tabpanel"
            class="rail-scroll"
            role="tabpanel"
            aria-labelledby="article-tab"
        >
            <ArticleSettingsSection />
        </div>
    {/if}
</aside>

<style>
    .inspector-head {
        display: grid;
        gap: 4px;
    }

    .inspector-title {
        margin: 0;
        color: var(--text);
        font-size: 1.25rem;
        font-weight: 700;
    }
</style>
