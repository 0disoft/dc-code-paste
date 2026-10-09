<script lang="ts">
    import { onDestroy, untrack } from "svelte";
    import { copyDcHtml } from "#lib/dc/clipboard.ts";
    import type { CopiedOutput } from "#lib/editor/copied-output.ts";
    import {
        compareRoundtrip,
        roundtripPlainSnapshot,
        type RoundtripBlock,
        type RoundtripChange,
        type RoundtripComparison,
        type RoundtripSnapshot,
    } from "#lib/editor/roundtrip-comparison.ts";
    import {
        maxRoundtripHtmlChars,
        roundtripHtmlSnapshot,
        roundtripOriginalFragment,
    } from "#lib/editor/roundtrip-html.ts";

    let { output }: { output: CopiedOutput } = $props();

    // Pasted HTML is remembered only to compare. It is never rendered as markup.
    let rawHtml = $state("");
    let text = $state("");
    let result = $state<RoundtripComparison>();
    let compareError = $state("");
    let pasteError = $state("");
    let feedback = $state("");
    let copyError = $state("");
    let recoveryHtml = $state("");
    let copying = $state(false);
    let recoveryBox = $state<HTMLTextAreaElement>();
    let savedPassagesOpen = $state(false);
    let recoveryQuery = $state("");
    let recoveryCount = $state(20);
    const savedPassages = $derived(result?.before.blocks.filter((block) => block.text.toLocaleLowerCase().includes(recoveryQuery.trim().toLocaleLowerCase())) ?? []);

    let previousHtml = "";
    let previousCopiedAt = "";
    let generation = 0;
    let attempt = 0;

    const canCompare = $derived(!pasteError && (text.trim().length > 0 || rawHtml.trim().length > 0));
    const richInput = $derived(rawHtml.trim().length > 0);

    const kindLabels: Record<RoundtripChange["kind"], string> = {
        changed: "내용이 바뀐 구간",
        missing: "돌아오지 않은 구간",
        added: "새로 생긴 구간",
        structure: "문단·공백 구분이 바뀐 구간",
    };
    const kindNotes: Record<RoundtripChange["kind"], string> = {
        changed: "글자가 달라졌습니다.",
        missing: "복사 당시에는 있었지만 돌아온 내용에는 없습니다.",
        added: "복사 당시에는 없던 내용입니다.",
        structure: "문단 구분이나 공백이 달라졌습니다.",
    };

    /** Show what the reader would see when the clipboard carried no plain text. */
    function deriveText(html: string) {
        if (!html.trim()) return "";
        try {
            return roundtripHtmlSnapshot(html)
                .blocks.map((block) => block.text)
                .join("\n");
        } catch {
            return "";
        }
    }

    function styleCount(snapshot: RoundtripSnapshot) {
        return snapshot.styles ? snapshot.styles.split("\n").filter(Boolean).length : 0;
    }

    function flagText(flag: boolean | null) {
        return flag === null ? "확인할 수 없음" : flag ? "바뀜" : "그대로";
    }

    function clearFeedback() {
        feedback = "";
        copyError = "";
        recoveryHtml = "";
    }

    function clearAll() {
        text = "";
        rawHtml = "";
        result = undefined;
        compareError = "";
        pasteError = "";
        clearFeedback();
    }

    // A new copied output replaces the baseline. Keep pasted text while it is unchanged.
    $effect(() => {
        const html = output.html;
        const copiedAt = output.copiedAt;
        untrack(() => {
            if (html === previousHtml && copiedAt === previousCopiedAt) return;
            previousHtml = html;
            previousCopiedAt = copiedAt;
            generation++;
            clearAll();
        });
    });
    onDestroy(() => { generation++; attempt++; });

    function invalidateResult() {
        generation++;
        result = undefined;
        compareError = "";
        clearFeedback();
        savedPassagesOpen = false;
        recoveryQuery = "";
        recoveryCount = 20;
    }

    function handlePaste(event: ClipboardEvent) {
        const data = event.clipboardData;
        if (!data) return;
        event.preventDefault();
        invalidateResult();
        const html = data.getData("text/html");
        const plain = data.getData("text/plain");
        if (html.length > maxRoundtripHtmlChars || plain.length > 200_000) {
            pasteError =
                "붙여넣은 내용이 너무 큽니다. 본문은 20만 자, HTML은 150만 자 이하로 가져와 주세요.";
            return;
        }
        pasteError = "";
        rawHtml = html;
        text = plain.length > 0 ? plain : deriveText(html);
    }

    // Typing invalidates the remembered HTML, so the comparison falls back to text.
    function handleTextInput(event: Event) {
        invalidateResult();
        text = (event.currentTarget as HTMLTextAreaElement).value;
        rawHtml = "";
        pasteError = "";
    }

    function handleHtmlPaste(event: ClipboardEvent) {
        const data = event.clipboardData;
        if (!data) return;
        const incoming = data.getData("text/html") || data.getData("text/plain");
        if (!incoming) return;
        event.preventDefault();
        invalidateResult();
        const target = event.currentTarget as HTMLTextAreaElement;
        const start = target.selectionStart ?? target.value.length;
        const end = target.selectionEnd ?? start;
        const next = target.value.length - (end - start) + incoming.length;
        if (next > maxRoundtripHtmlChars) {
            pasteError = "HTML 원문이 너무 큽니다. 150만 자 이하로 붙여넣어 주세요.";
            return;
        }
        rawHtml = target.value.slice(0, start) + incoming + target.value.slice(end);
        pasteError = "";
        text = deriveText(rawHtml);
    }

    function handleHtmlInput(event: Event) {
        invalidateResult();
        rawHtml = (event.currentTarget as HTMLTextAreaElement).value;
        pasteError = "";
        text = deriveText(rawHtml);
    }

    function compare() {
        generation++;
        result = undefined;
        compareError = "";
        clearFeedback();
        if (!canCompare) return;
        try {
            const before = roundtripHtmlSnapshot(output.html);
            const after = rawHtml.trim()
                ? roundtripHtmlSnapshot(rawHtml)
                : roundtripPlainSnapshot(text);
            result = compareRoundtrip(before, after);
        } catch (error) {
            compareError =
                error instanceof Error ? error.message : "붙여넣은 내용을 비교하지 못했습니다.";
        }
    }

    async function copyPassage(block: RoundtripBlock) {
        const gen = generation;
        const id = ++attempt;
        copying = true;
        copyError = "";
        recoveryHtml = "";
        let fragment: { html: string; plainText: string } | undefined;
        try {
            fragment = roundtripOriginalFragment(output.html, block);
            await copyDcHtml(fragment.html, fragment.plainText);
            if (id !== attempt || gen !== generation) return;
            feedback = "선택한 구간을 다시 복사했습니다.";
        } catch (error) {
            if (id !== attempt || gen !== generation) return;
            feedback = "";
            copyError = fragment ? "선택한 구간을 복사하지 못했습니다." : error instanceof Error ? error.message : "구간을 다시 복사하지 못했습니다.";
            recoveryHtml = fragment?.html ?? "";
        } finally {
            if (id === attempt) copying = false;
        }
    }

    function selectRecovery() {
        recoveryBox?.focus();
        recoveryBox?.select();
    }
</script>

<section class="roundtrip" aria-label="붙여넣은 결과 되돌아보기">
    <header class="rt-head">
        <h3 class="rt-title">붙여넣은 결과 비교</h3>
        <p class="rt-note">디씨 편집기에 붙여넣은 글을 다시 복사해 가져오세요. 복사 당시의 글과 구간별로 비교합니다.</p>
    </header>
    <div class="rt-field">
        <span class="ui-label">붙여넣은 결과</span>
        <textarea class="ui-input rt-paste" aria-label="붙여넣은 결과" aria-describedby="rt-paste-hint" spellcheck="false" placeholder="디씨 편집기에서 복사한 글을 여기에 붙여넣어 주세요" value={text} onpaste={handlePaste} oninput={handleTextInput}></textarea>
        <p class="ui-hint" id="rt-paste-hint">Ctrl+V로 붙여넣으세요. 서식 정보가 함께 넘어오면 링크와 목록도 비교합니다.</p>
    </div>
    <details class="ui-disclosure">
        <summary>HTML 원문을 직접 붙여넣기 (선택)</summary>
        <div class="rt-field">
            <p class="ui-hint">일반 붙여넣기로 서식이 넘어오지 않을 때만 씁니다. 비워두면 글자만 견줘요.</p>
            <textarea class="ui-input rt-html" aria-label="붙여넣은 HTML 원문" spellcheck="false" maxlength={maxRoundtripHtmlChars} placeholder="디씨 HTML 모드에서 복사한 원문" value={rawHtml} onpaste={handleHtmlPaste} oninput={handleHtmlInput}></textarea>
        </div>
    </details>
    <div class="rt-actions">
        <button class="ui-btn ui-btn--primary" type="button" disabled={!canCompare || copying} onclick={compare}>붙여넣기 결과 비교</button>
        <span class="rt-mode">{richInput ? "서식 있는 내용으로 견줘요." : "글자만 견줘요."}</span>
    </div>
    {#if pasteError}<p class="rt-error" role="alert">{pasteError}</p>{/if}
    {#if compareError}<p class="rt-error" role="alert">{compareError}</p>{/if}
    {#if feedback}<p class="rt-feedback" role="status">{feedback}</p>{/if}
    {#if copyError}
        <p class="rt-error" role="alert">{copyError}</p>
        {#if recoveryHtml}
            <div class="rt-recovery">
                <div class="rt-recovery-head">
                    <span class="ui-label">구간 복구 HTML 원문</span>
                    <button class="ui-btn ui-btn--outline" type="button" onclick={selectRecovery}>원문 전체 선택</button>
                </div>
                <textarea class="ui-input rt-html" bind:this={recoveryBox} aria-label="구간 복구 HTML 원문" readonly spellcheck="false" value={recoveryHtml}></textarea>
                <p class="ui-hint">디씨 HTML 모드에서 복구할 구간을 선택한 뒤 이 원문으로 바꿔 주세요.</p>
            </div>
        {/if}
    {/if}
    {#if result}
        <section class="rt-result" aria-label="붙여넣기 비교 결과">
            <p class="rt-mode-note">{result.after.mode === "html" ? "서식 있는 내용을 가져왔습니다. 붙여넣기 뒤 직접 수정한 내용도 차이로 표시합니다." : "일반 텍스트만 가져왔습니다. 링크·목록·서식 정보는 확인할 수 없습니다."}</p>
            {#if result.coarse}<p class="rt-mode-note">내용이 많아 문단을 통째로 견줬습니다. 줄이 정확히 맞지 않을 수 있으니 각 구간을 스크롤해 끝까지 확인하세요.</p>{/if}
            {#if result.changes.length === 0}<p class="rt-same" role="status">텍스트 차이가 없습니다.</p>{/if}
            <div class="rt-badges">
                <span class="rt-badge" class:is-changed={result.linksChanged === true} class:is-unknown={result.linksChanged === null}>링크 {flagText(result.linksChanged)}</span>
                <span class="rt-badge" class:is-changed={result.listsChanged === true} class:is-unknown={result.listsChanged === null}>목록 {flagText(result.listsChanged)}</span>
                <span class="rt-badge" class:is-changed={result.stylesChanged === true} class:is-unknown={result.stylesChanged === null}>인라인 스타일 {flagText(result.stylesChanged)}</span>
            </div>
            {#each result.changes as change, ci (ci)}
                <article class="rt-change">
                    <div class="rt-change-head">
                        <h4 class="rt-change-title">{kindLabels[change.kind]}</h4>
                        <p class="rt-change-note">{kindNotes[change.kind]}</p>
                    </div>
                    <div class="rt-change-grid">
                        <section class="rt-side" aria-label="복사 당시">
                            <span class="rt-side-label">복사 당시</span>
                            {#each change.before as block, bi (`b${block.index}`)}
                                <div class="rt-block">
                                    <p class="rt-text" class:is-code={block.code}>{block.text}</p>
                                    <button class="ui-btn ui-btn--outline rt-recover" type="button" disabled={copying} aria-label={`복사 당시 구간 ${block.index + 1} 다시 복사`} onclick={() => copyPassage(block)}>이 구간 다시 복사{change.before.length > 1 ? ` ${bi + 1}` : ""}</button>
                                </div>
                            {/each}
                            {#if !change.before.length}<p class="rt-change-note">복사 당시에는 없던 구간입니다.</p>{/if}
                        </section>
                        <section class="rt-side" aria-label="돌아온 내용">
                            <span class="rt-side-label">돌아온 내용</span>
                            {#each change.after as block (`a${block.index}`)}
                                <div class="rt-block"><p class="rt-text" class:is-code={block.code}>{block.text}</p></div>
                            {/each}
                            {#if !change.after.length}<p class="rt-change-note">돌아온 내용에 없습니다.</p>{/if}
                        </section>
                    </div>
                </article>
            {/each}
            {#if result.linksChanged}
                <section class="rt-flag" aria-label="링크 변화">
                    <h4 class="rt-flag-title">링크</h4>
                    <div class="rt-flag-grid">
                        <div class="rt-flag-side">
                            <span class="rt-side-label">복사 당시</span>
                            {#each result.before.links as link, li (li)}
                                <p class="rt-link"><span class="rt-link-label">{link.label || "이름 없음"}</span><span class="rt-link-href">{link.href}</span></p>
                            {:else}<p class="rt-change-note">링크가 없습니다.</p>{/each}
                        </div>
                        <div class="rt-flag-side">
                            <span class="rt-side-label">돌아온 내용</span>
                            {#each result.after.links as link, li (li)}
                                <p class="rt-link"><span class="rt-link-label">{link.label || "이름 없음"}</span><span class="rt-link-href">{link.href}</span></p>
                            {:else}<p class="rt-change-note">링크가 없습니다.</p>{/each}
                        </div>
                    </div>
                </section>
            {/if}
            {#if result.listsChanged}
                <section class="rt-flag" aria-label="목록 변화">
                    <h4 class="rt-flag-title">목록</h4>
                    <div class="rt-flag-grid">
                        <div class="rt-flag-side">
                            <span class="rt-side-label">복사 당시</span>
                            {#each result.before.lists as list, li (li)}
                                <div class="rt-list">
                                    <span class="rt-list-kind">{list.ordered ? "번호 목록" : "점 목록"}</span>
                                    {#each list.items as item, ii (`${li}-${ii}`)}<p class="rt-text">{list.markers[ii] ?? "•"} {item || "(빈 항목)"}</p>{/each}
                                </div>
                            {:else}<p class="rt-change-note">목록이 없습니다.</p>{/each}
                        </div>
                        <div class="rt-flag-side">
                            <span class="rt-side-label">돌아온 내용</span>
                            {#each result.after.lists as list, li (li)}
                                <div class="rt-list">
                                    <span class="rt-list-kind">{list.ordered ? "번호 목록" : "점 목록"}</span>
                                    {#each list.items as item, ii (`${li}-${ii}`)}<p class="rt-text">{list.markers[ii] ?? "•"} {item || "(빈 항목)"}</p>{/each}
                                </div>
                            {:else}<p class="rt-change-note">목록이 없습니다.</p>{/each}
                        </div>
                    </div>
                </section>
            {/if}
            {#if result.stylesChanged}
                <section class="rt-flag" aria-label="인라인 스타일 변화">
                    <h4 class="rt-flag-title">인라인 스타일</h4>
                    <p class="rt-change-note">글에 포함된 서식 정보가 달라졌습니다. 색·크기·여백은 디씨 화면에서도 확인해 주세요.</p>
                    <div class="rt-style-counts"><span>복사 당시 {styleCount(result.before)}개</span><span>돌아온 내용 {styleCount(result.after)}개</span></div>
                </section>
            {/if}
            {#if result.linksChanged || result.listsChanged || result.stylesChanged}
                <details class="ui-disclosure" bind:open={savedPassagesOpen}>
                    <summary>복사 당시 구간 선택</summary>
                    {#if savedPassagesOpen}
                        <div class="rt-saved-passages">
                            <p class="ui-hint">복구할 구간을 골라 다시 복사하고, 디씨 편집기에서 해당 위치에 붙여넣으세요.</p>
                            <input class="ui-input" type="search" aria-label="복구할 구간 찾기" placeholder="문장으로 찾기" bind:value={recoveryQuery} oninput={() => recoveryCount = 20} />
                            {#each savedPassages.slice(0, recoveryCount) as block (block.index)}
                                <div class="rt-block"><p class="rt-text" class:is-code={block.code}>{block.text}</p><button class="ui-btn ui-btn--outline" type="button" disabled={copying} aria-label={`보관한 구간 ${block.index + 1} 복사`} onclick={() => copyPassage(block)}>이 구간 다시 복사</button></div>
                            {/each}
                            {#if !savedPassages.length}<p class="ui-hint">일치하는 구간이 없습니다.</p>{/if}
                            {#if savedPassages.length > recoveryCount}<button class="ui-btn ui-btn--outline" type="button" onclick={() => recoveryCount += 20}>구간 더 보기 · {savedPassages.length - recoveryCount}개 남음</button>{/if}
                        </div>
                    {/if}
                </details>
            {/if}
        </section>
    {/if}
</section>

<style>
    .roundtrip { display: grid; gap: 16px; min-width: 0; }
    .rt-saved-passages { display: grid; gap: 12px; padding-top: 12px; min-width: 0; }
    .rt-head { display: grid; gap: 6px; }
    .rt-title { margin: 0; font-size: 1rem; }
    .rt-note { margin: 0; color: var(--muted); font-size: 0.8rem; line-height: 1.65; }
    .rt-field { display: grid; gap: 6px; min-width: 0; }
    .rt-paste { height: auto; min-height: 140px; padding: 10px 12px; font-size: 0.85rem; line-height: 1.6; resize: vertical; }
    .rt-html { height: auto; min-height: 110px; font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; font-size: 0.75rem; line-height: 1.5; resize: vertical; }
    .rt-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
    .rt-mode { color: var(--muted); font-size: 0.78rem; }
    .rt-error { margin: 0; color: var(--danger, #b91c1c); font-size: 0.82rem; line-height: 1.6; }
    .rt-feedback { margin: 0; color: var(--accent-strong); font-size: 0.82rem; font-weight: 600; }
    .rt-recovery { display: grid; gap: 8px; padding: 12px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel-2); }
    .rt-recovery-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
    .rt-result { display: grid; gap: 14px; min-width: 0; }
    .rt-mode-note { margin: 0; color: var(--muted); font-size: 0.8rem; line-height: 1.65; }
    .rt-badges { display: flex; flex-wrap: wrap; gap: 6px; }
    .rt-badge { padding: 3px 8px; border: 1px solid var(--line); border-radius: 999px; background: var(--panel-2); color: var(--muted); font-size: 0.74rem; font-weight: 600; }
    .rt-badge.is-changed { border-color: var(--accent-line); background: var(--accent-soft); color: var(--accent-strong); }
    .rt-badge.is-unknown { border-style: dashed; color: var(--muted); }
    .rt-same { margin: 0; padding: 12px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); color: var(--text); font-size: 0.88rem; font-weight: 600; }
    .rt-change { display: grid; gap: 10px; min-width: 0; padding: 14px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); }
    .rt-change-head { display: grid; gap: 4px; }
    .rt-change-title { margin: 0; font-size: 0.88rem; }
    .rt-change-note { margin: 0; color: var(--muted); font-size: 0.76rem; line-height: 1.55; }
    .rt-change-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .rt-side { display: grid; gap: 8px; align-content: start; min-width: 0; }
    .rt-side-label { color: var(--muted); font-size: 0.72rem; font-weight: 650; }
    .rt-block { display: grid; gap: 6px; min-width: 0; }
    .rt-text { width: 100%; max-height: 220px; margin: 0; overflow: auto; padding: 8px 10px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--panel-2); color: var(--text); font-size: 0.84rem; line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
    .rt-text.is-code { font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; }
    .rt-flag { display: grid; gap: 8px; min-width: 0; }
    .rt-flag-title { margin: 0; font-size: 0.84rem; }
    .rt-flag-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .rt-flag-side { display: grid; gap: 6px; align-content: start; min-width: 0; }
    .rt-link { display: grid; gap: 2px; max-height: 140px; margin: 0; overflow: auto; padding: 8px 10px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--panel-2); font-size: 0.8rem; }
    .rt-link-label { color: var(--text); font-weight: 600; overflow-wrap: anywhere; }
    .rt-link-href { color: var(--muted); font-size: 0.74rem; overflow-wrap: anywhere; }
    .rt-list { display: grid; gap: 6px; min-width: 0; }
    .rt-list-kind { color: var(--muted); font-size: 0.72rem; font-weight: 650; }
    .rt-style-counts { display: flex; flex-wrap: wrap; gap: 12px; color: var(--muted); font-size: 0.78rem; }
    @media (max-width: 640px) {
        .rt-change-grid, .rt-flag-grid { grid-template-columns: minmax(0, 1fr); }
        .rt-recover { width: 100%; min-height: 40px; }
        .roundtrip { gap: 12px; }
    }
</style>
