<script lang="ts">
    import { getContext, tick } from "svelte";
    import { WORKSPACE_CONTEXT_KEY } from "#lib/state/workspace-context.ts";
    import type { WorkspaceState } from "#lib/state/workspace.svelte.ts";
    import type { DcExportOptions } from "#lib/dc/export-document.ts";
    import type { ReadingExperimentUnit } from "#lib/editor/reading-experiment.ts";
    import type { ReadingNoteEntry } from "#lib/editor/reading-notes.ts";
    import type { RelationAnchor, RelationState } from "#lib/editor/sentence-relations.ts";
    import { readingIntentOptions } from "#lib/editor/reading-intent-format.ts";
    import ReadingExperimentBlock from "./ReadingExperimentBlock.svelte";
    import ReadingFrontier from "./ReadingFrontier.svelte";
    import { readingRelationFrontier } from "#lib/editor/reading-frontier.ts";

    type Props = {
        hidden?: boolean;
        onExit: () => void;
        onNavigate: (anchor: RelationAnchor, noteId: string) => void;
    };

    let { hidden = false, onExit, onNavigate }: Props = $props();

    const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);
    const experiment = workspace.readingExperiment;

    let width = $state<"fit" | "desktop" | "mobile">("fit");
    let progressive = $state(false);
    let revealed = $state(1);
    let recapOpen = $state(false);
    let frontierOpen = $state(false);
    let scroller = $state<HTMLElement>();
    let recapButton = $state<HTMLButtonElement>();
    let navigationRevision = 0;

    const widths = [
        { value: "fit", label: "맞춤", width: "100%" },
        { value: "desktop", label: "PC", width: "760px" },
        { value: "mobile", label: "모바일", width: "390px" },
    ] as const;
    const selectedWidth = $derived(widths.find((item) => item.value === width)!);

    /*
     * The reader reuses the export pipeline, so every unit keeps the same marks, code and
     * document styles people copy out. Units, notes and options follow the live document.
     */
    const units = $derived(experiment.units);
    const notes = $derived(experiment.notes);
    const options = $derived(experiment.exportOptions);
    const visibleUnits = $derived(progressive ? units.slice(0, revealed) : units);
    const lastVisibleUnit = $derived(visibleUnits.at(-1));
    const frontier = $derived(readingRelationFrontier(workspace.sentenceRelations, lastVisibleUnit ? lastVisibleUnit.position + lastVisibleUnit.node.nodeSize : 0));
    const intendedUnits = $derived(units.filter((unit) => unit.intentions.length > 0));
    const notesByUnit = $derived(groupNotesByUnit(units, notes));
    const error = $derived(experiment.error);

    const stateMessages: Record<RelationState, string> = {
        linked: "멈춘 자리가 그대로 있습니다.",
        changed: "멈춘 자리의 문장이 바뀌었습니다. 연결 당시 원문을 확인하세요.",
        missing: "멈춘 자리 일부가 사라졌습니다. 연결 당시 원문을 확인하세요.",
        duplicated: "같은 표시가 여러 곳에 있습니다. 어느 자리인지 가릴 수 없습니다.",
    };

    // Stable callbacks so blocks re-render only when their unit or export options change.
    const renderUnit = (unit: ReadingExperimentUnit, exportOptions: DcExportOptions) =>
        experiment.render(unit, exportOptions);
    const saveNote = (unit: ReadingExperimentUnit, text: string) => experiment.addNote(unit, text);

    function groupNotesByUnit(unitList: ReadingExperimentUnit[], catalog: ReadingNoteEntry[]) {
        const grouped = new Map<number, ReadingNoteEntry[]>();
        for (const entry of catalog) {
            const owner = unitList.find((unit) =>
                entry.parts.some((part) =>
                    part.matches.some(
                        (match) =>
                            match.from >= unit.position &&
                            match.to <= unit.position + unit.node.nodeSize,
                    ),
                ),
            );
            if (!owner) continue;
            grouped.set(owner.index, [...(grouped.get(owner.index) ?? []), entry]);
        }
        return grouped;
    }

    function intentLabel(value: string) {
        return readingIntentOptions.find((item) => item.value === value)?.label ?? value;
    }

    async function focusUnit(index: number | undefined, revision: number) {
        await tick();
        if (hidden || !progressive || revision !== navigationRevision || !scroller || index === undefined) return;
        const target = scroller.querySelector<HTMLElement>(`[data-reading-unit-index="${index}"]`);
        if (!target) return;
        target.focus({ preventScroll: true });
        const inset = Number.parseFloat(getComputedStyle(scroller).paddingTop) || 0;
        scroller.scrollTop += target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - inset;
    }

    async function startProgressive() {
        progressive = true;
        revealed = Math.min(1, units.length);
        recapOpen = false;
        frontierOpen = false;
        await focusUnit(units[0]?.index, ++navigationRevision);
    }

    async function revealNext() {
        if (!progressive || hidden || revealed >= units.length) return;
        const next = units[revealed];
        revealed += 1;
        await focusUnit(next.index, ++navigationRevision);
    }

    function showAll() {
        navigationRevision += 1;
        progressive = false;
        frontierOpen = false;
    }

    async function toggleFrontier() {
        frontierOpen = !frontierOpen;
        if (!frontierOpen) return;
        await tick();
        if (hidden || !progressive || !frontierOpen || !scroller) return;
        scroller.scrollTop = 0;
        document.getElementById("reading-frontier-view")?.focus({ preventScroll: true });
    }

    function remainingUnits(position: number) {
        const index = units.findIndex((unit) => unit.position + unit.node.nodeSize >= position);
        return index < 0 ? 0 : Math.max(0, index + 1 - revealed);
    }

    async function revealThrough(position: number) {
        if (hidden || !progressive) return;
        const index = units.findIndex((unit) => unit.position + unit.node.nodeSize >= position);
        if (index < 0) return;
        revealed = Math.max(revealed, index + 1);
        await focusUnit(units[index].index, ++navigationRevision);
    }

    async function revisitAnchor(anchor: RelationAnchor) {
        const unit = visibleUnits.find((item) => anchor.from >= item.position && anchor.to <= item.position + item.node.nodeSize);
        if (unit) await focusUnit(unit.index, ++navigationRevision);
    }

    async function removeNote(id: string) {
        // Keep the reader where it was while the recap list reflows.
        const top = scroller?.scrollTop ?? 0;
        if (!experiment.removeNote(id)) return;
        await tick();
        recapButton?.focus({ preventScroll: true });
        if (scroller?.isConnected) scroller.scrollTop = top;
    }
</script>

<div
    class="canvas-view reading-experiment"
    id="reading-experiment-view"
    hidden={hidden}
    role="region"
    aria-label="처음부터 읽어보기"
    tabindex="-1"
>
    <div class="reading-head">
        <div class="ui-segmented" role="group" aria-label="읽어보기 폭">
            {#each widths as item (item.value)}
                <button
                    type="button"
                    class:is-active={width === item.value}
                    aria-pressed={width === item.value}
                    title={item.value === "fit" ? "작업 영역에 맞춤" : `${item.label} · ${item.width}`}
                    onclick={() => (width = item.value)}>{item.label}</button
                >
            {/each}
        </div>
        <div class="reading-progress">
            {#if progressive}
                <span role="status">{Math.min(revealed, units.length)} / {units.length} 구간</span>
                <button
                    class="ui-btn ui-btn--outline"
                    type="button"
                    aria-label="다음 구간 펼치기"
                    disabled={revealed >= units.length}
                    onclick={revealNext}><span class="reading-label-wide">다음 구간 펼치기</span><span class="reading-label-compact" aria-hidden="true">다음</span></button
                >
                <button class="ui-btn ui-btn--outline" type="button" aria-label="처음부터 다시 읽기" disabled={!units.length} onclick={startProgressive}
                    ><span class="reading-label-wide">처음부터 다시 읽기</span><span class="reading-label-compact" aria-hidden="true">처음부터</span></button
                >
                <button class="ui-btn ui-btn--outline" type="button" aria-label="전부 펼치기" onclick={showAll}
                    ><span class="reading-label-wide">전부 펼치기</span><span class="reading-label-compact" aria-hidden="true">전부</span></button
                >
            {:else}
                <button class="ui-btn ui-btn--outline" type="button" disabled={!units.length} onclick={startProgressive}
                    >차례로 펼치기</button
                >
            {/if}
        </div>
        <div class="reading-notes">
            {#if progressive}
                <button class="ui-btn ui-btn--outline" type="button" aria-label="여기까지 나온 연결" aria-expanded={frontierOpen} aria-controls={frontierOpen ? "reading-frontier-view" : undefined} onclick={toggleFrontier}><span class="reading-label-wide">여기까지 나온 연결</span><span class="reading-label-compact" aria-hidden="true">연결</span></button>
            {/if}
            <button
                class="ui-btn ui-btn--outline"
                type="button"
                aria-label="멈춘 자리 모아보기"
                aria-expanded={recapOpen}
                aria-controls="reading-note-recap"
                bind:this={recapButton}
                onclick={() => (recapOpen = !recapOpen)}><span class="reading-label-wide">멈춘 자리 모아보기</span><span class="reading-label-compact" aria-hidden="true">멈춘 자리</span></button
            >
            <button
                class="ui-btn ui-btn--primary"
                type="button"
                aria-label="읽어보기 끝내기"
                onclick={onExit}><span class="reading-label-wide">읽어보기 끝내기</span><span class="reading-label-compact" aria-hidden="true">끝내기</span></button
            >
        </div>
    </div>

    <div class="canvas-scroll reading-scroll" bind:this={scroller}>
        <div class="reading-column" style:width={selectedWidth.width}>
            {#if progressive && frontierOpen}<ReadingFrontier entries={frontier} onNavigate={revisitAnchor} onReveal={revealThrough} remaining={remainingUnits} />{/if}
            {#if recapOpen}
                <section class="note-recap" id="reading-note-recap" aria-label="멈춘 자리 모아보기">
                    <p class="recap-note">
                        읽는 동안에는 메모 본문을 접어둡니다. 펼치면 그때 적은 문장과 지금의
                        자리를 함께 볼 수 있습니다.
                    </p>
                    {#if !notes.length && !intendedUnits.length}
                        <p class="recap-empty" role="status">
                            아직 멈춘 자리가 없습니다. 읽다가 멈춘 구간에서 ‘여기서 멈춘 이유’를
                            눌러보세요.
                        </p>
                    {/if}
                    <ol class="recap-list" aria-label="멈춘 자리 목록">
                        {#each notes as entry, noteIndex (entry.note.id)}
                            <li class="recap-item" data-note-state={entry.state}>
                                <div class="recap-head">
                                    <strong>멈춘 자리 {noteIndex + 1}</strong>
                                    <span>{entry.state === "linked" ? "그대로 있음" : "다시 확인"}</span>
                                </div>
                                {#if entry.state !== "linked"}
                                    <p class="recap-status" role="status">{stateMessages[entry.state]}</p>
                                {/if}
                                <details class="recap-body">
                                    <summary>메모 본문 보기</summary>
                                    <p class="recap-text">{entry.note.text}</p>
                                </details>
                                {#each entry.parts as part, partIndex (part.reference.id)}
                                    <div class="recap-part">
                                        <p class="recap-passage"
                                            >{part.matches.length === 1
                                                ? part.matches[0].text
                                                : part.reference.text}</p
                                        >
                                        {#if part.matches.length !== 1}
                                            <span class="recap-snapshot"
                                                >연결 당시 원문 · {part.matches.length
                                                    ? "표시가 여러 곳에 있음"
                                                    : "구간 없음"}</span
                                            >
                                        {/if}
                                        <button
                                            class="ui-btn ui-btn--outline"
                                            type="button"
                                            disabled={part.matches.length !== 1}
                                            aria-label={`읽기 메모 ${noteIndex + 1} 구간 ${partIndex + 1} 원문으로 이동`}
                                            onclick={() => onNavigate(part.matches[0], entry.note.id)}
                                            >원문으로 이동</button
                                        >
                                    </div>
                                {/each}
                                <button
                                    class="ui-btn ui-btn--outline recap-remove"
                                    type="button"
                                    aria-label={`읽기 메모 ${noteIndex + 1} 삭제`}
                                    onclick={() => removeNote(entry.note.id)}>메모 삭제</button
                                >
                            </li>
                        {/each}
                    </ol>
                    {#if intendedUnits.length}
                        <section class="recap-intentions" aria-label="작성자가 표시한 읽기 위치">
                            <h3>작성자가 표시한 읽는 의도</h3>
                            <ul>
                                {#each intendedUnits as unit (unit.index)}
                                    <li>
                                        <p class="recap-passage">{unit.text.trim()}</p>
                                        <div class="intent-labels">
                                            {#each unit.intentions as intent (intent)}
                                                <span>{intentLabel(intent)}</span>
                                            {/each}
                                        </div>
                                    </li>
                                {/each}
                            </ul>
                        </section>
                    {/if}
                </section>
            {/if}

            <div class="reading-document">
                {#each visibleUnits as unit (unit.index)}
                    <ReadingExperimentBlock
                        active={!hidden}
                        {unit}
                        {options}
                        render={renderUnit}
                        notes={notesByUnit.get(unit.index) ?? []}
                        {error}
                        onSave={saveNote}
                        onClearError={experiment.clearError}
                    />
                {/each}
                {#if !units.length}
                    <p class="reading-empty" role="status">아직 읽을 본문이 없습니다.</p>
                {/if}
                {#if progressive && revealed < units.length}
                    <div class="reading-continuation">
                        <p class="reading-hint" role="status">여기까지 펼쳤습니다.</p>
                        <button class="ui-btn ui-btn--primary" type="button" onclick={revealNext}>이어서 다음 구간 펼치기</button>
                    </div>
                {:else if progressive && units.length}
                    <p class="reading-hint" role="status">마지막 구간까지 펼쳤습니다.</p>
                {/if}
            </div>
        </div>
    </div>
</div>

<style>
    .reading-experiment {
        min-width: 0;
    }
    .reading-head {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px 12px;
        padding: 10px 16px;
        border-bottom: 1px solid var(--line);
        background: var(--surface);
    }
    .reading-progress {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
    }
    .reading-progress span {
        color: var(--muted);
        font-size: 0.78rem;
        font-variant-numeric: tabular-nums;
    }
    .reading-notes {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        margin-inline-start: auto;
    }
    .reading-label-compact {
        display: none;
    }
    .reading-scroll {
        padding: 16px;
    }
    .reading-column {
        min-width: 0;
        max-width: 100%;
        margin: 0 auto;
    }
    .reading-document {
        display: grid;
        gap: 4px;
        min-width: 0;
        max-width: 100%;
    }
    .reading-empty,
    .reading-hint {
        margin: 8px 0;
        color: var(--muted);
        font-size: 0.82rem;
        line-height: 1.65;
    }
    .reading-continuation {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px 12px;
        padding: 8px 0;
    }
    .note-recap {
        display: grid;
        gap: 12px;
        margin-bottom: 16px;
        padding: 14px;
        border: 1px solid var(--line);
        border-radius: var(--radius);
        background: var(--surface);
    }
    .recap-note,
    .recap-empty {
        margin: 0;
        color: var(--muted);
        font-size: 0.78rem;
        line-height: 1.65;
    }
    .recap-list {
        display: grid;
        gap: 10px;
        margin: 0;
        padding: 0;
        list-style: none;
    }
    .recap-item {
        display: grid;
        gap: 8px;
        min-width: 0;
        padding: 12px;
        border: 1px solid var(--line);
        border-radius: var(--radius-sm);
        background: var(--panel-2);
    }
    .recap-item[data-note-state="changed"],
    .recap-item[data-note-state="missing"],
    .recap-item[data-note-state="duplicated"] {
        border-color: var(--accent-line);
    }
    .recap-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
    }
    .recap-head strong {
        color: var(--text);
        font-size: 0.84rem;
    }
    .recap-head span {
        color: var(--muted);
        font-size: 0.72rem;
    }
    .recap-status {
        margin: 0;
        color: var(--accent-strong);
        font-size: 0.78rem;
        line-height: 1.6;
    }
    .recap-body summary {
        display: flex;
        align-items: center;
        min-height: 32px;
        color: var(--muted);
        font-size: 0.76rem;
        cursor: pointer;
    }
    .recap-text {
        margin: 0;
        padding-top: 6px;
        border-top: 1px solid var(--line);
        color: var(--text);
        font-size: 0.85rem;
        line-height: 1.7;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
    }
    .recap-part {
        display: grid;
        gap: 6px;
        min-width: 0;
        padding: 8px;
        border: 1px solid var(--line);
        border-radius: var(--radius-sm);
        background: var(--surface);
    }
    .recap-passage {
        margin: 0;
        color: var(--text);
        font-size: 0.85rem;
        line-height: 1.7;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
    }
    .recap-snapshot {
        color: var(--muted);
        font-size: 0.72rem;
    }
    .recap-part button,
    .recap-remove {
        width: 100%;
    }
    .recap-remove {
        color: var(--muted);
    }
    .recap-intentions {
        display: grid;
        gap: 8px;
    }
    .recap-intentions h3 {
        margin: 0;
        color: var(--text);
        font-size: 0.84rem;
    }
    .recap-intentions ul {
        display: grid;
        gap: 8px;
        margin: 0;
        padding: 0;
        list-style: none;
    }
    .recap-intentions li {
        display: grid;
        gap: 6px;
        padding: 10px;
        border: 1px solid var(--line);
        border-radius: var(--radius-sm);
        background: var(--panel-2);
    }
    .intent-labels {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }
    .intent-labels span {
        padding: 3px 6px;
        border-radius: 4px;
        background: var(--accent-soft);
        color: var(--accent-strong);
        font-size: 0.72rem;
    }
    .reading-head button:focus-visible,
    .reading-scroll button:focus-visible,
    .reading-scroll summary:focus-visible {
        outline: 2px solid var(--focus);
        outline-offset: 2px;
    }
    @media (max-width: 600px) {
        .reading-label-wide {
            display: none;
        }
        .reading-label-compact {
            display: inline;
        }
        .reading-head {
            padding: 8px 12px;
        }
        .reading-scroll {
            padding: 8px;
        }
        .reading-head button,
        .reading-continuation button,
        .note-recap button {
            min-height: 44px;
        }
    }
</style>
