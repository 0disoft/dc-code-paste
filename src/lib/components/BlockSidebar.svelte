<script lang="ts">
    import { getContext, type Component } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import type { PaletteBlockKind } from "#lib/editor/block-inspector.ts";
    import type { ReadingPassage } from "#lib/editor/reading-path.ts";
    import Heading1 from "@lucide/svelte/icons/heading-1";
    import Pilcrow from "@lucide/svelte/icons/pilcrow";
    import Rows3 from "@lucide/svelte/icons/rows-3";
    import Quote from "@lucide/svelte/icons/quote";
    import Code2 from "@lucide/svelte/icons/code-xml";
    import Link2 from "@lucide/svelte/icons/link-2";
    import Grip from "@lucide/svelte/icons/grip";
    import ChevronDown from "@lucide/svelte/icons/chevron-down";
    import StickyNote from "@lucide/svelte/icons/sticky-note";
    import ListOrdered from "@lucide/svelte/icons/list-ordered";
    import GitCompare from "@lucide/svelte/icons/git-compare";
    import BookOpen from "@lucide/svelte/icons/book-open";
    import MousePointerClick from "@lucide/svelte/icons/mouse-pointer-click";
    import Megaphone from "@lucide/svelte/icons/megaphone";
    import SeparatorHorizontal from "@lucide/svelte/icons/separator-horizontal";
    import TypeOutline from "@lucide/svelte/icons/type-outline";
    import Layers from "@lucide/svelte/icons/layers";
    import TemplateTab from "./TemplateTab.svelte";
    import DocumentOutline from "./DocumentOutline.svelte";

    type PaletteRow = {
        key: string;
        label: string;
        description: string;
        icon: Component;
        kind?: PaletteBlockKind;
        action?: () => void;
    };

    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);

    type Props = {
        open?: boolean;
        compact?: boolean;
        onInsert?: (kind?: PaletteBlockKind) => void;
        onNavigate: (index: number) => void;
        onPassageNavigate: (passage: ReadingPassage) => void;
    };

    let { open = true, compact = false, onInsert, onNavigate, onPassageNavigate }: Props = $props();

    let tab = $state<"blocks" | "templates" | "outline">("blocks");
    let query = $state("");
    let moreOpen = $state(false);
    let draggingKind = $state<string | null>(null);

    const primaryRows: PaletteRow[] = [
        { key: "heading", label: "제목", description: "큰 제목, 소제목 추가", icon: Heading1, kind: "heading" },
        { key: "paragraph", label: "문단", description: "일반 글, 단락 작성", icon: Pilcrow, kind: "paragraph" },
        { key: "summary", label: "요약", description: "핵심 내용 정리", icon: Rows3, kind: "summary" },
        { key: "quote", label: "인용", description: "인용문, 강조 문구", icon: Quote, kind: "quote" },
        { key: "code", label: "코드", description: "코드 블록 삽입", icon: Code2, kind: "code" },
        { key: "link", label: "링크", description: "링크 삽입", icon: Link2, kind: "link" },
    ];

    const extraRows: PaletteRow[] = [
        { key: "hero", label: "글 머리", description: "글 머리 요약", icon: Layers, kind: "hero" },
        { key: "callout", label: "강조 상자", description: "팁과 주의 강조 박스", icon: StickyNote, kind: "callout" },
        { key: "tutorial", label: "튜토리얼", description: "단계별 안내", icon: ListOrdered, kind: "tutorial" },
        { key: "comparison", label: "비교", description: "좌우 비교 정리", icon: GitCompare, kind: "comparison" },
        { key: "references", label: "자료목록", description: "참고 자료 정리", icon: BookOpen, kind: "references" },
        { key: "cta", label: "링크 버튼", description: "행동 유도 버튼", icon: MousePointerClick, kind: "cta" },
        { key: "ctaGroup", label: "버튼 묶음", description: "버튼 여러 개 묶기", icon: Megaphone, kind: "ctaGroup" },
        { key: "divider", label: "구분선", description: "가로 구분선", icon: SeparatorHorizontal, kind: "divider" },
    ];

    const sectionRow: PaletteRow = {
        key: "section",
        label: "섹션",
        description: "소제목 구분 머리",
        icon: TypeOutline,
        action: () => workspace.applySectionHeading(),
    };

    function startDrag(event: DragEvent, kind: PaletteBlockKind) {
        if (!event.dataTransfer) return;
        event.dataTransfer.setData("application/x-dc-block", kind);
        event.dataTransfer.effectAllowed = "copy";
        draggingKind = kind;
    }

    function matches(row: PaletteRow) {
        return `${row.label} ${row.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
    }

    function trigger(row: PaletteRow) {
        if (row.action) {
            row.action();
            onInsert?.();
            return;
        }
        if (row.kind) {
            workspace.insertPaletteBlock(row.kind);
            onInsert?.(row.kind);
        }
    }
</script>

<aside class="rail rail-left" data-open={open} inert={compact && !open} id="block-rail" aria-label="블록 삽입">
    <div class="rail-head">
        <div class="ui-segmented ui-segmented--fill" role="tablist" aria-label="삽입 패널">
            <button
                id="blocks-tab"
                class:is-active={tab === "blocks"}
                type="button"
                role="tab"
                aria-selected={tab === "blocks"}
                aria-controls="blocks-tabpanel"
                onclick={() => (tab = "blocks")}
            >
                블록
            </button>
            <button
                id="templates-tab"
                class:is-active={tab === "templates"}
                type="button"
                role="tab"
                aria-selected={tab === "templates"}
                aria-controls="templates-tabpanel"
                onclick={() => (tab = "templates")}
            >
                템플릿
            </button>
            <button id="outline-tab" class:is-active={tab === "outline"} type="button" role="tab" aria-selected={tab === "outline"} aria-controls="outline-tabpanel" onclick={() => (tab = "outline")}>
                글 구성
            </button>
        </div>
    </div>

    {#if tab === "blocks"}
        <div id="blocks-tabpanel" class="rail-scroll" role="tabpanel" aria-labelledby="blocks-tab">
            <input class="ui-input" type="search" aria-label="삽입 블록 검색" placeholder="블록 찾기" bind:value={query} />
            <ul class="palette-list">
                {#each primaryRows.filter(matches) as row (row.key)}
                    {@const Icon = row.icon}
                    <li>
                        <button
                            class="palette-row"
                            class:is-dragging={draggingKind === row.kind}
                            type="button"
                            draggable={Boolean(row.kind)}
                            aria-label={`${row.label} 삽입`}
                            title={`${row.label} · 끌어서 놓거나 눌러서 추가`}
                            ondragstart={(event) =>
                                row.kind ? startDrag(event, row.kind) : undefined}
                            ondragend={() => (draggingKind = null)}
                            onclick={() => trigger(row)}
                        >
                            <span class="palette-icon"><Icon size={22} /></span>
                            <span class="palette-text">
                                <span class="palette-title">{row.label}</span>
                                <span class="palette-desc">{row.description}</span>
                            </span>
                        </button>
                    </li>
                {/each}
            </ul>

            <div class="palette-more">
                {#if !query.trim()}
                <button
                    class="palette-more-toggle"
                    type="button"
                    aria-label="더 많은 블록"
                    aria-expanded={moreOpen}
                    aria-controls="more-blocks"
                    onclick={() => (moreOpen = !moreOpen)}
                >
                    <Grip size={16} aria-hidden="true" />
                    <span>더 많은 블록</span>
                    <ChevronDown class="palette-more-chevron" size={15} aria-hidden="true" />
                </button>
                {/if}
                {#if moreOpen || query.trim()}
                    <ul id="more-blocks" class="palette-list palette-list-extra">
                        {#each [...extraRows, sectionRow].filter(matches) as row (row.key)}
                            {@const Icon = row.icon}
                            <li>
                                <button
                                    class="palette-row"
                                    class:is-dragging={draggingKind === row.kind}
                                    type="button"
                                    draggable={Boolean(row.kind)}
                                    aria-label={`${row.label} 삽입`}
                                    title={`${row.label} · ${row.description}`}
                                    ondragstart={(event) =>
                                        row.kind ? startDrag(event, row.kind) : undefined}
                                    ondragend={() => (draggingKind = null)}
                                    onclick={() => trigger(row)}
                                >
                                    <span class="palette-icon"><Icon size={22} /></span>
                                    <span class="palette-text">
                                        <span class="palette-title">{row.label}</span>
                                        <span class="palette-desc">{row.description}</span>
                                    </span>
                                </button>
                            </li>
                        {/each}
                    </ul>
                {/if}
            </div>
            {#if query.trim() && ![...primaryRows, ...extraRows, sectionRow].some(matches)}
                <p class="palette-empty" role="status">일치하는 블록이 없습니다.</p>
            {/if}
        </div>
    {:else if tab === "templates"}
        <div
            id="templates-tabpanel"
            class="rail-scroll"
            role="tabpanel"
            aria-labelledby="templates-tab"
        >
            <TemplateTab />
        </div>
    {:else}
        <div id="outline-tabpanel" class="rail-scroll" role="tabpanel" aria-labelledby="outline-tab">
            <DocumentOutline {onNavigate} {onPassageNavigate} />
        </div>
    {/if}
</aside>

<style>
    .palette-empty { color: var(--muted); font-size: 0.85rem; }
    .palette-list {
        display: grid;
        gap: 2px;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .palette-list-extra {
        margin-top: 2px;
        padding-top: 8px;
        border-top: 1px dashed var(--line-strong);
    }

    .palette-row {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        min-height: 76px;
        padding: 12px 8px;
        border: 1px solid transparent;
        border-radius: 10px;
        background: transparent;
        text-align: left;
        cursor: grab;
        transition:
            background-color 0.14s ease,
            border-color 0.14s ease;
    }

    .palette-row:hover {
        border-color: var(--line);
        background: var(--surface);
    }

    .palette-row.is-dragging {
        opacity: 0.55;
    }

    .palette-row:active {
        cursor: grabbing;
    }

    .palette-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        width: 30px;
        height: 30px;
        border-radius: 9px;
        background: transparent;
        color: var(--text);
    }

    .palette-row:hover .palette-icon {
        background: var(--accent-soft);
        color: var(--accent-strong);
    }

    .palette-text {
        display: grid;
        gap: 1px;
        min-width: 0;
    }

    .palette-title {
        color: var(--text);
        font-size: 1rem;
        font-weight: 650;
        line-height: 1.3;
    }

    .palette-desc {
        color: var(--muted);
        font-size: 0.85rem;
        line-height: 1.35;
    }

    .palette-more {
        display: grid;
        gap: 2px;
        margin-top: 6px;
        padding-top: 8px;
        border-top: 1px solid var(--line);
    }

    .palette-more-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        min-height: 34px;
        padding: 0 8px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: var(--muted);
        font-size: 0.76rem;
        font-weight: 600;
        text-align: left;
        cursor: pointer;
    }

    .palette-more-toggle:hover {
        background: var(--panel-2);
        color: var(--text);
    }

    :global(.palette-more-chevron) {
        margin-left: auto;
        transition: transform 0.16s ease;
    }

    .palette-more-toggle[aria-expanded="true"] :global(.palette-more-chevron) {
        transform: rotate(180deg);
    }

    @media (prefers-reduced-motion: reduce) {
        :global(.palette-more-chevron),
        .palette-row {
            transition: none;
        }
    }
</style>
