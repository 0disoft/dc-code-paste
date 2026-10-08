<script lang="ts">
    import { getContext } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import type { JSONContent } from "@tiptap/core";
    import Undo2 from "@lucide/svelte/icons/undo-2";
    import Redo2 from "@lucide/svelte/icons/redo-2";
    import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
    import LayoutTemplate from "@lucide/svelte/icons/layout-template";
    import Check from "@lucide/svelte/icons/check";
    import Loader2 from "@lucide/svelte/icons/loader-circle";
    import Clipboard from "@lucide/svelte/icons/clipboard";
    import FileText from "@lucide/svelte/icons/file-text";
    import Sparkles from "@lucide/svelte/icons/sparkles";
    import Save from "@lucide/svelte/icons/save";
    import Code2 from "@lucide/svelte/icons/code-xml";
    import WandSparkles from "@lucide/svelte/icons/wand-sparkles";
    import Eye from "@lucide/svelte/icons/eye";
    import Type from "@lucide/svelte/icons/type";
    import PanelLeft from "@lucide/svelte/icons/panel-left";
    import PanelRight from "@lucide/svelte/icons/panel-right";
    import SquareArrowOutUpRight from "@lucide/svelte/icons/square-arrow-out-up-right";
    import MobileEditingBar from "./MobileEditingBar.svelte";
    import OverflowMenu from "./OverflowMenu.svelte";

    type WorkspaceView = "editor" | "preview";

    type Props = {
        view: WorkspaceView;
        onSelectView: (view: WorkspaceView) => void;
        onShowHtmlSource: () => void;
        leftRailOpen: boolean;
        rightRailOpen: boolean;
        onToggleLeftRail: () => void;
        onToggleRightRail: () => void;
    };

    let {
        view,
        onSelectView,
        onShowHtmlSource,
        leftRailOpen,
        rightRailOpen,
        onToggleLeftRail,
        onToggleRightRail,
    }: Props = $props();

    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);

    const savedAtLabel = $derived(
        workspace.draftLastSavedAt && !Number.isNaN(Date.parse(workspace.draftLastSavedAt))
            ? new Date(workspace.draftLastSavedAt).toLocaleTimeString("ko-KR", {
                  hour: "2-digit",
                  minute: "2-digit",
              })
            : "",
    );

    const draftStatusLabel = $derived(
        workspace.draftSaveState === "dirty"
            ? "저장 대기 중"
            : workspace.draftSaveState === "saving"
              ? "저장 중"
              : workspace.draftSaveState === "saved"
                ? `이 브라우저에 저장됨${savedAtLabel ? ` · ${savedAtLabel}` : ""}`
                : workspace.draftSaveState === "error"
                  ? "저장 실패 · 이 탭의 내용을 복사해 보관하세요"
                  : workspace.draftSaveState === "conflict"
                    ? "다른 탭에서 초안이 변경됐습니다 · 자동 저장 중지"
                    : "저장 준비 중",
    );

    const draftStatusTone = $derived(
        workspace.draftSaveState === "saved"
            ? "is-saved"
            : workspace.draftSaveState === "error" || workspace.draftSaveState === "conflict"
              ? "is-error"
              : workspace.draftSaveState === "dirty" || workspace.draftSaveState === "saving"
                ? "is-warning"
                : "",
    );

    const showSavedCheck = $derived(
        workspace.draftSaveState === "saved" || workspace.draftSaveState === "saving",
    );

    const characterCount = $derived(
        documentText(workspace.documentJson).length.toLocaleString(),
    );

    const documentTitle = $derived.by(() => {
        const text = firstTitleText(workspace.documentJson);
        if (!text) return "제목 없는 글";
        return text.length > 64 ? `${text.slice(0, 64)}…` : text;
    });

    function inlineText(node: JSONContent): string {
        return (node.content ?? [])
            .map((child) => (typeof child.text === "string" ? child.text : ""))
            .join("")
            .trim();
    }

    function documentText(node: JSONContent): string {
        return node.text ?? (node.content ?? []).map(documentText).join("");
    }

    function firstTitleText(node: JSONContent | undefined): string {
        if (!node) return "";
        function find(current: JSONContent, type: string): string {
            if (current.type === type) return inlineText(current);
            for (const child of current.content ?? []) {
                const text = find(child, type);
                if (text) return text;
            }
            return "";
        }
        return find(node, "heading") || find(node, "paragraph");
    }

</script>

<header class="topbar" aria-label="글 편집 도구">
    <span class="topbar-brand">
        <Clipboard size={16} aria-hidden="true" />
        <span class="brand-full">dc-code-paste</span>
        <span class="brand-short">dc-paste</span>
    </span>
    <span class="topbar-divider" aria-hidden="true"></span>
    <p class="topbar-title" title={documentTitle}>
        <span class="topbar-title-text">{documentTitle}</span>
        <span class="topbar-title-meta">{characterCount}자</span>
    </p>

    <button
        class="ui-btn ui-btn--chrome ui-btn--icon rail-toggle"
        type="button"
        aria-label="블록 삽입 패널"
        aria-pressed={leftRailOpen}
        onclick={onToggleLeftRail}
    >
        <PanelLeft size={18} />
    </button>
    <button
        class="ui-btn ui-btn--chrome ui-btn--icon rail-toggle"
        type="button"
        aria-label="블록 설정 패널"
        aria-pressed={rightRailOpen}
        onclick={onToggleRightRail}
    >
        <PanelRight size={18} />
    </button>

    <div class="topbar-actions">
        <button
            class="ui-btn ui-btn--chrome ui-btn--icon is-quiet topbar-undo"
            type="button"
            title="실행 취소"
            aria-label="실행 취소"
            disabled={!workspace.canUndo()}
            onclick={() =>
                workspace.runEditorCommand((current) => current.chain().focus().undo().run())}
        >
            <Undo2 size={17} />
        </button>
        <button
            class="ui-btn ui-btn--chrome ui-btn--icon is-quiet topbar-undo"
            type="button"
            title="다시 실행"
            aria-label="다시 실행"
            disabled={!workspace.canRedo()}
            onclick={() =>
                workspace.runEditorCommand((current) => current.chain().focus().redo().run())}
        >
            <Redo2 size={17} />
        </button>

        <span class="topbar-status {draftStatusTone}" role="status" title={draftStatusLabel}>
            {#if showSavedCheck}
                {#if workspace.draftSaveState === "saving"}
                    <span class="spin-icon"><Loader2 size={14} /></span>
                {:else}
                    <Check size={14} aria-hidden="true" />
                {/if}
            {/if}
            <span>{workspace.draftSaveState === "error" ? "저장 실패" : workspace.draftSaveState === "conflict" ? "저장 충돌" : draftStatusLabel}</span>
        </span>

        <button
            class="ui-btn ui-btn--chrome topbar-preview"
            class:is-active={view === "preview"}
            type="button"
            aria-label={view === "editor" ? "미리보기" : "글쓰기"}
            aria-pressed={view === "preview"}
            onclick={() => onSelectView(view === "editor" ? "preview" : "editor")}
        >
            {#if view === "editor"}<Eye size={17} aria-hidden="true" />{:else}<Type size={17} aria-hidden="true" />{/if}
            <span>{view === "editor" ? "미리보기" : "글쓰기"}</span>
        </button>

        <OverflowMenu label="더보기 메뉴" menuLabel="도구 메뉴">
            <button
                class="ui-menu-item"
                class:is-active={workspace.isMarkdownPanelOpen}
                type="button"
                role="menuitem"
                aria-label="Markdown"
                aria-expanded={workspace.isMarkdownPanelOpen}
                aria-controls="markdown-panel"
                onclick={workspace.toggleMarkdownPanel}
            >
                <FileText size={16} aria-hidden="true" />
                <span>마크다운 불러오기</span>
            </button>
            <button
                class="ui-menu-item"
                class:is-active={workspace.isLlmPanelOpen ||
                    workspace.llmGenerationState === "loading"}
                type="button"
                role="menuitem"
                aria-label="AI 작성"
                aria-expanded={workspace.isLlmPanelOpen}
                aria-controls="llm-panel"
                onclick={workspace.toggleLlmPanel}
            >
                {#if workspace.llmGenerationState === "loading"}
                    <span class="spin-icon"><Loader2 size={16} /></span>
                {:else}
                    <Sparkles size={16} aria-hidden="true" />
                {/if}
                <span>AI로 초안 만들기</span>
            </button>
            <button
                class="ui-menu-item"
                class:is-active={workspace.isStoragePanelOpen}
                type="button"
                role="menuitem"
                aria-label="저장함"
                aria-expanded={workspace.isStoragePanelOpen}
                aria-controls="storage-panel"
                onclick={workspace.toggleStoragePanel}
            >
                <Save size={16} aria-hidden="true" />
                <span>저장함</span>
                <small>{workspace.presets.length}개</small>
            </button>

            <span class="ui-menu-sep" aria-hidden="true"></span>

            <button
                class="ui-menu-item"
                type="button"
                role="menuitem"
                aria-label="HTML 원문 보기"
                onclick={onShowHtmlSource}
            >
                <Code2 size={16} aria-hidden="true" />
                <span>HTML 원문 보기</span>
            </button>
            <button
                class="ui-menu-item"
                type="button"
                role="menuitem"
                aria-label="LLM 가이드 복사"
                disabled={workspace.isCopying}
                onclick={workspace.copyLlmAuthoringGuide}
            >
                {#if workspace.llmPromptCopyState === "copied"}
                    <Check size={16} aria-hidden="true" />
                {:else}
                    <WandSparkles size={16} aria-hidden="true" />
                {/if}
                <span>{workspace.llmPromptCopyLabel}</span>
            </button>

            <span class="ui-menu-sep" aria-hidden="true"></span>

            <button
                class="ui-menu-item"
                type="button"
                role="menuitem"
                aria-label="예시 템플릿"
                onclick={workspace.applyExampleTemplate}
            >
                <LayoutTemplate size={16} aria-hidden="true" />
                <span>예시 템플릿</span>
            </button>
            <button
                class="ui-menu-item"
                type="button"
                role="menuitem"
                aria-label="초기화"
                onclick={workspace.resetDraft}
            >
                <RotateCcw size={16} aria-hidden="true" />
                <span>초기화</span>
            </button>

            <span class="ui-menu-sep" aria-hidden="true"></span>

            <a
                class="ui-menu-item"
                role="menuitem"
                href="https://github.com/0disoft/dc-code-paste"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub 저장소 새 탭으로 열기"
            >
                <SquareArrowOutUpRight size={16} aria-hidden="true" />
                <span>GitHub 저장소</span>
            </a>
        </OverflowMenu>

        <button
            class="ui-btn ui-btn--primary"
            type="button"
            title={workspace.copyLabel}
            aria-label={workspace.copyLabel}
            onclick={workspace.copyPreview}
            data-copy-trigger="preview"
            disabled={workspace.isCopyDisabled}
        >
            {#if workspace.copyState === "copied"}
                <Check size={17} aria-hidden="true" />
            {:else if workspace.isCopying || workspace.isRendering}
                <span class="spin-icon"><Loader2 size={17} /></span>
            {:else}
                <Clipboard size={17} aria-hidden="true" />
            {/if}
            <span>{workspace.copyLabel}</span>
        </button>
    </div>
</header>

<MobileEditingBar status={draftStatusLabel} />

{#if workspace.draftSaveState === "error" || workspace.draftSaveState === "conflict"}
    <div class="save-warning" role="alert">
        <span>{draftStatusLabel}</span>
        {#if workspace.draftSaveState === "error"}
            <button class="ui-btn ui-btn--outline" type="button" onclick={workspace.retryDraftSave}>다시 저장</button>
        {:else}
            <button class="ui-btn ui-btn--outline" type="button" onclick={workspace.loadOtherTabDraft}>다른 탭 초안 불러오기</button>
            <button class="ui-btn ui-btn--outline" type="button" onclick={workspace.overwriteOtherTabDraft}>이 탭 내용으로 저장</button>
        {/if}
    </div>
{/if}
