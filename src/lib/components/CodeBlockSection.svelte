<script lang="ts">
    import { getContext } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import { isComposingKeyEvent } from "#lib/editor/keyboard-shortcuts.ts";
    import Code2 from "@lucide/svelte/icons/code-xml";
    import FileText from "@lucide/svelte/icons/file-text";
    import SlidersHorizontal from "@lucide/svelte/icons/sliders-horizontal";
    import ChevronDown from "@lucide/svelte/icons/chevron-down";
    import Highlighter from "@lucide/svelte/icons/highlighter";
    import Paintbrush from "@lucide/svelte/icons/paintbrush";

    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);

    const highlightRangesInvalid = $derived(
        workspace.codeLineHighlightsInvalid ||
            workspace.codeAdditionLinesInvalid ||
            workspace.codeDeletionLinesInvalid,
    );

    function applyLanguage() {
        workspace.runEditorCommand((current) =>
            current
                .chain()
                .focus()
                .updateAttributes("codeBlock", { language: workspace.language })
                .run(),
        );
    }

    function applyOnEnter(event: KeyboardEvent, apply: () => void) {
        if (event.key !== "Enter" || isComposingKeyEvent(event)) return;
        event.preventDefault();
        apply();
    }
</script>

<section class="ui-section" aria-label="코드블록">
    <span class="ui-section-title"><Code2 size={15} aria-hidden="true" /> 코드블록</span>

    <label class="ui-field">
        <span class="ui-label"><Code2 size={14} aria-hidden="true" /> 언어</span>
        <select
            class="ui-select"
            bind:value={workspace.language}
            aria-label="코드 언어"
            onchange={applyLanguage}
        >
            {#each workspace.supportedLanguageGroups as group (group.label)}
                <optgroup label={group.label}>
                    {#each group.languages as item (item.id)}
                        <option value={item.id}>{item.label}</option>
                    {/each}
                </optgroup>
            {/each}
        </select>
    </label>

    <label class="ui-field">
        <span class="ui-label"><FileText size={14} aria-hidden="true" /> 파일명</span>
        <input
            class="ui-input"
            type="text"
            bind:this={workspace.codeFilenameInput}
            bind:value={workspace.codeFilename}
            aria-label="코드 파일명"
            placeholder="main.cpp"
            onblur={() => workspace.applyCodeFilename(false)}
            onkeydown={(event) => applyOnEnter(event, workspace.applyCodeFilename)}
        />
    </label>

    <details class="ui-disclosure">
        <summary>
            <SlidersHorizontal size={16} aria-hidden="true" />
            <span>세부 설정</span>
            <ChevronDown class="ui-disclosure-chevron" size={15} aria-hidden="true" />
        </summary>

        <label class="ui-field">
            <span class="ui-label"><Highlighter size={14} aria-hidden="true" /> 강조줄</span>
            <input
                class="ui-input"
                class:is-error={workspace.codeLineHighlightsInvalid}
                type="text"
                bind:value={workspace.codeLineHighlights}
                aria-label="코드 강조 줄"
                aria-invalid={workspace.codeLineHighlightsInvalid}
                aria-describedby={highlightRangesInvalid ? "code-line-range-help" : undefined}
                placeholder="2,4-6"
                onblur={() => workspace.applyCodeLineHighlights(false)}
                onkeydown={(event) => applyOnEnter(event, workspace.applyCodeLineHighlights)}
            />
        </label>

        <label class="ui-field">
            <span class="ui-label">추가줄</span>
            <input
                class="ui-input"
                class:is-error={workspace.codeAdditionLinesInvalid}
                type="text"
                bind:value={workspace.codeAdditionLines}
                aria-label="코드 추가 줄"
                aria-invalid={workspace.codeAdditionLinesInvalid}
                aria-describedby={highlightRangesInvalid ? "code-line-range-help" : undefined}
                placeholder="2,4-6"
                onblur={() => workspace.applyCodeAdditionLines(false)}
                onkeydown={(event) => applyOnEnter(event, workspace.applyCodeAdditionLines)}
            />
        </label>

        <label class="ui-field">
            <span class="ui-label">삭제줄</span>
            <input
                class="ui-input"
                class:is-error={workspace.codeDeletionLinesInvalid}
                type="text"
                bind:value={workspace.codeDeletionLines}
                aria-label="코드 삭제 줄"
                aria-invalid={workspace.codeDeletionLinesInvalid}
                aria-describedby={highlightRangesInvalid ? "code-line-range-help" : undefined}
                placeholder="2,4-6"
                onblur={() => workspace.applyCodeDeletionLines(false)}
                onkeydown={(event) => applyOnEnter(event, workspace.applyCodeDeletionLines)}
            />
        </label>

        {#if highlightRangesInvalid}
            <span id="code-line-range-help" class="ui-hint is-error">{workspace.lineRangeHelp}</span>
        {/if}

        <label class="ui-field">
            <span class="ui-label"><Paintbrush size={14} aria-hidden="true" /> 테마</span>
            <select class="ui-select" bind:value={workspace.theme} aria-label="코드 테마">
                {#each workspace.supportedThemes as item (item.id)}
                    <option value={item.id}>{item.label}</option>
                {/each}
            </select>
        </label>

        <label class="ui-field">
            <span class="ui-label">코드 글자</span>
            <select class="ui-select" bind:value={workspace.codeFontSize} aria-label="코드 글자 크기">
                {#each workspace.codeSizes as item (item)}
                    <option value={item}>{item}</option>
                {/each}
            </select>
        </label>

        <label class="ui-check">
            <input type="checkbox" bind:checked={workspace.showLineNumbers} />
            <span>줄번호</span>
        </label>
    </details>
</section>
