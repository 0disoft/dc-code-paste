<script lang="ts">
    import { getContext } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import { isComposingKeyEvent } from "#lib/editor/keyboard-shortcuts.ts";
    import Heading1 from "@lucide/svelte/icons/heading-1";
    import Pilcrow from "@lucide/svelte/icons/pilcrow";
    import Bold from "@lucide/svelte/icons/bold";
    import Italic from "@lucide/svelte/icons/italic";
    import List from "@lucide/svelte/icons/list";
    import ListOrdered from "@lucide/svelte/icons/list-ordered";
    import Quote from "@lucide/svelte/icons/quote";
    import TypeOutline from "@lucide/svelte/icons/type-outline";
    import Link2 from "@lucide/svelte/icons/link-2";
    import LinkIcon from "@lucide/svelte/icons/link";
    import Code2 from "@lucide/svelte/icons/code-xml";
    import Check from "@lucide/svelte/icons/check";
    import Unlink from "@lucide/svelte/icons/unlink";

    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);

    const codeBlockActive = $derived(workspace.isActive("codeBlock"));
    const headingLevels = [1, 2, 3, 4, 5, 6] as const;
    const headingLevel = $derived(
        headingLevels.find((level) => workspace.isActive("heading", { level })) ?? 1,
    );

    function setHeadingLevel(event: Event) {
        const value = (event.currentTarget as HTMLSelectElement).value;
        const level = headingLevels.find((item) => String(item) === value);
        if (level) workspace.runEditorCommand((current) => current.chain().focus().setHeading({ level }).run());
    }
    const linkSectionVisible = $derived(
        workspace.isLinkPanelOpen || workspace.isActive("link"),
    );

    function handleLinkKeydown(event: KeyboardEvent) {
        if (isComposingKeyEvent(event)) return;
        if (event.key === "Enter") {
            event.preventDefault();
            workspace.setLink();
            return;
        }
        if (event.key === "Escape") {
            workspace.isLinkPanelOpen = false;
            workspace.linkError = false;
        }
    }
</script>

<section class="ui-section" aria-label="글자 서식">
    <span class="ui-section-title">글자 서식</span>

    <div class="format-grid" role="group" aria-label="블록과 글자 서식">
        <button
            class="ui-btn ui-btn--outline ui-btn--icon"
            class:is-active={workspace.isActive("heading")}
            type="button"
            title="제목"
            aria-label="제목"
            aria-pressed={workspace.isActive("heading")}
            onclick={() =>
                workspace.runEditorCommand((current) =>
                    current.chain().focus().toggleHeading({ level: headingLevel }).run(),
                )}
        >
            <Heading1 size={17} />
        </button>
        <button
            class="ui-btn ui-btn--outline ui-btn--icon"
            class:is-active={workspace.isActive("paragraph")}
            type="button"
            title="문단"
            aria-label="문단"
            aria-pressed={workspace.isActive("paragraph")}
            onclick={() =>
                workspace.runEditorCommand((current) =>
                    current.chain().focus().setParagraph().run(),
                )}
        >
            <Pilcrow size={17} />
        </button>
        <button
            class="ui-btn ui-btn--outline ui-btn--icon"
            class:is-active={workspace.isActive("bold")}
            type="button"
            title="굵게"
            aria-label="굵게"
            aria-pressed={workspace.isActive("bold")}
            onclick={() =>
                workspace.runEditorCommand((current) =>
                    current.chain().focus().toggleBold().run(),
                )}
        >
            <Bold size={17} />
        </button>
        <button
            class="ui-btn ui-btn--outline ui-btn--icon"
            class:is-active={workspace.isActive("italic")}
            type="button"
            title="기울임"
            aria-label="기울임"
            aria-pressed={workspace.isActive("italic")}
            onclick={() =>
                workspace.runEditorCommand((current) =>
                    current.chain().focus().toggleItalic().run(),
                )}
        >
            <Italic size={17} />
        </button>
        <button
            class="ui-btn ui-btn--outline ui-btn--icon"
            class:is-active={workspace.isActive("bulletList")}
            type="button"
            title="목록"
            aria-label="목록"
            aria-pressed={workspace.isActive("bulletList")}
            onclick={() =>
                workspace.runEditorCommand((current) =>
                    current.chain().focus().toggleBulletList().run(),
                )}
        >
            <List size={17} />
        </button>
        <button
            class="ui-btn ui-btn--outline ui-btn--icon"
            class:is-active={workspace.isActive("orderedList")}
            type="button"
            title="번호 목록"
            aria-label="번호 목록"
            aria-pressed={workspace.isActive("orderedList")}
            onclick={() => workspace.runEditorCommand((current) => current.chain().focus().toggleOrderedList().run())}
        >
            <ListOrdered size={17} />
        </button>
        <button
            class="ui-btn ui-btn--outline ui-btn--icon"
            class:is-active={workspace.isActive("blockquote")}
            type="button"
            title="인용"
            aria-label="인용"
            aria-pressed={workspace.isActive("blockquote")}
            onclick={workspace.applyQuote}
        >
            <Quote size={17} />
        </button>
        <button
            class="ui-btn ui-btn--outline ui-btn--icon"
            class:is-active={workspace.isActive("sectionHeading")}
            type="button"
            title="섹션"
            aria-label="섹션"
            aria-pressed={workspace.isActive("sectionHeading")}
            onclick={workspace.applySectionHeading}
        >
            <TypeOutline size={17} />
        </button>
        <button
            class="ui-btn ui-btn--outline ui-btn--icon"
            class:is-active={workspace.isActive("linkBox")}
            type="button"
            title="링크박스"
            aria-label="링크박스"
            aria-pressed={workspace.isActive("linkBox")}
            onclick={workspace.applyLinkBox}
        >
            <LinkIcon size={17} />
        </button>
        <button
            class="ui-btn ui-btn--outline ui-btn--icon"
            class:is-active={workspace.isActive("link") || workspace.isLinkPanelOpen}
            type="button"
            title="링크"
            aria-label="링크"
            data-link-panel-toggle
            aria-pressed={workspace.isActive("link") || workspace.isLinkPanelOpen}
            onclick={workspace.toggleLinkPanel}
        >
            <Link2 size={17} />
        </button>
        <button
            class="ui-btn ui-btn--outline ui-btn--icon"
            class:is-active={codeBlockActive}
            type="button"
            title={codeBlockActive ? "코드블록 해제" : "코드블록 적용"}
            aria-label={codeBlockActive ? "코드블록 해제" : "코드블록 적용"}
            aria-pressed={codeBlockActive}
            onclick={workspace.applyCodeBlock}
        >
            <Code2 size={17} />
        </button>
    </div>

    {#if workspace.isActive("heading")}
        <label class="ui-field">
            <span class="ui-label">제목 단계</span>
            <select class="ui-select" aria-label="제목 단계" value={headingLevel} onchange={setHeadingLevel}>
                {#each headingLevels as level (level)}
                    <option value={level}>H{level}{level === 1 ? " · 큰 제목" : level === 2 ? " · 제목" : level === 3 ? " · 소제목" : ""}</option>
                {/each}
            </select>
        </label>
    {/if}

    <label class="ui-field">
        <span class="ui-label">인용 스타일</span>
        <select
            class="ui-select"
            bind:value={workspace.quoteStyle}
            aria-label="인용 스타일"
            onchange={workspace.updateActiveQuoteStyle}
        >
            {#each workspace.quoteStyleOptions as item (item.value)}
                <option value={item.value}>{item.label}</option>
            {/each}
        </select>
    </label>

    {#if linkSectionVisible}
        <div class="link-editor" role="group" aria-label="링크 편집">
            <label class="ui-field">
                <span class="ui-label"><Link2 size={14} aria-hidden="true" /> 링크 주소</span>
                <input
                    class="ui-input"
                    class:is-error={workspace.linkError}
                    type="url"
                    bind:this={workspace.linkInput}
                    bind:value={workspace.linkDraft}
                    aria-label="링크 주소"
                    aria-invalid={workspace.linkError}
                    aria-describedby={workspace.linkError ? "link-address-error" : undefined}
                    placeholder="https://example.com"
                    oninput={() => (workspace.linkError = false)}
                    onkeydown={handleLinkKeydown}
                />
            </label>
            {#if workspace.linkError}
                <p id="link-address-error" class="ui-hint is-error" role="alert">주소를 확인해 주세요. 웹 주소나 이메일 링크(mailto:)를 입력할 수 있습니다.</p>
            {/if}
            <div class="ui-inline-group">
                <button
                    class="ui-btn ui-btn--primary"
                    type="button"
                    title="적용"
                    aria-label="적용"
                    onclick={workspace.setLink}
                >
                    <Check size={16} aria-hidden="true" />
                    <span>적용</span>
                </button>
                <button
                    class="ui-btn ui-btn--outline"
                    type="button"
                    title="해제"
                    aria-label="해제"
                    onclick={workspace.unsetLink}
                >
                    <Unlink size={16} aria-hidden="true" />
                    <span>해제</span>
                </button>
            </div>
        </div>
    {/if}
</section>

<style>
    .format-grid {
        display: grid;
        gap: 4px;
        grid-template-columns: repeat(5, minmax(0, 1fr));
    }

    .format-grid .ui-btn {
        width: 100%;
        height: 34px;
        padding: 0;
    }

    .link-editor {
        display: grid;
        gap: 8px;
        padding-top: 4px;
    }
</style>
