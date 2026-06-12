<script lang="ts">
    import {
        AlertTriangle,
        Bold,
        BookOpen,
        Check,
        Clipboard,
        Code2,
        FileText,
        Heading1,
        Highlighter,
        History,
        Italic,
        Link2,
        LinkIcon,
        List,
        Loader2,
        Paintbrush,
        Quote,
        Rows3,
        RotateCcw,
        Save,
        SeparatorHorizontal,
        Sparkles,
        Type,
        Undo2,
        Unlink,
        Redo2,
        Trash2,
    } from "lucide-svelte";
    import { onMount } from "svelte";
    import type { Editor, JSONContent } from "@tiptap/core";
    import { copyDcHtml, copyPlainText } from "$lib/dc/clipboard";
    import { defaultProseFontFamily } from "$lib/dc/font-stacks";
    import { sanitizeReadableTextColor } from "$lib/dc/sanitize-style";
    import {
        exportDocumentToDcHtml,
        type DcDocumentTheme,
        type DcExportOptions,
        type DcExportStructure,
    } from "$lib/dc/export-document";
    import { sampleDocument } from "$lib/editor/sample-document";
    import {
        defaultLanguage,
        defaultTheme,
        isSupportedLanguage,
        supportedLanguages,
        supportedThemes,
        type DcLanguageId,
        type DcThemeId,
    } from "$lib/highlighter/catalog";
    import {
        calloutNodeNameByKind,
        isCalloutNodeName,
        type CalloutKind,
    } from "$lib/editor/callout";
    import {
        selectedInlineRangeToCalloutCommand,
        selectedInlineRangeToCodeBlockCommand,
        selectedInlineRangeToCtaButtonCommand,
        selectedInlineRangeToSectionHeadingCommand,
        selectedInlineRangeToLinkBoxCommand,
    } from "$lib/editor/selection-commands";
    import {
        appendDraftHistorySnapshot,
        clearDraftSnapshot,
        createDraftHistorySnapshot,
        createDraftSnapshot,
        deleteDraftHistorySnapshot,
        maxDraftHistoryCount,
        readDraftHistorySnapshots,
        readDraftSnapshot,
        writeDraftSnapshot,
        type DraftHistorySnapshot,
        type DraftPreferences,
    } from "$lib/editor/draft-storage";
    import {
        createDefaultCtaGroup,
        ctaGroupLayoutOptions,
        normalizeCtaGroupLayout,
        type CtaGroupLayout,
    } from "$lib/editor/cta-group";
    import {
        createDefaultReferenceList,
        createReferenceListFromText,
    } from "$lib/editor/reference-list";
    import { normalizeEditableLinkHref } from "$lib/editor/link";
    import { llmAuthoringPrompt } from "$lib/editor/llm-authoring-prompt";
    import { parseMarkdownToDocument } from "$lib/editor/markdown-import";
    import {
        normalizeQuoteStyle,
        quoteStyleOptions,
        type QuoteStyle,
    } from "$lib/editor/quote-style";
    import {
        createDefaultHeroBlock,
        createHeroBlockFromText,
    } from "$lib/editor/hero-block";
    import {
        createDefaultSummaryBox,
        createSummaryBoxFromText,
    } from "$lib/editor/summary-box";
    import {
        createDefaultTutorialBlock,
        createTutorialBlockFromText,
    } from "$lib/editor/tutorial-block";
    import {
        createComparisonBlockFromText,
        createDefaultComparisonBlock,
    } from "$lib/editor/comparison-block";
    import { normalizeCodeFilename } from "$lib/highlighter/code-block-metadata";
    import { normalizeHighlightLines } from "$lib/highlighter/highlight-lines";
    import {
        createPresetSnapshot,
        deletePresetSnapshot,
        readPresetSnapshots,
        writePresetSnapshots,
        type PresetSnapshot,
    } from "$lib/editor/preset-storage";

    const bodyFontFamily = defaultProseFontFamily;
    const selectionFontFamily = defaultProseFontFamily;
    const bodySizes = ["14px", "15px", "16px", "17px", "18px"];
    const codeSizes = ["13px", "14px", "15px", "16px"];
    const exportStructures: { label: string; value: DcExportStructure }[] = [
        { label: "DC 테이블", value: "dcTable" },
        { label: "기본", value: "modern" },
    ];
    const draftHistoryAutoIntervalMs = 30_000;
    const documentThemes: { label: string; value: DcDocumentTheme }[] = [
        { label: "강의 라이트", value: "lightLecture" },
        { label: "다크 에디토리얼", value: "darkEditorial" },
    ];
    const editorThemeColorSafety = {
        lightLecture: {
            background: "oklch(97.12% 0.012 97.41)",
            fallback: "oklch(21.18% 0.012 255.31)",
        },
        darkEditorial: {
            background: "oklch(7.2% 0.012 94.1)",
            fallback: "oklch(94.12% 0.012 93.37)",
        },
    } satisfies Record<
        DcDocumentTheme,
        { background: string; fallback: string }
    >;
    const swatches = [
        "oklch(23.39% 0.012 255.51)",
        "oklch(56.77% 0.154 252.96)",
        "oklch(50.61% 0.142 146.57)",
        "oklch(57.8% 0.18 31.88)",
        "oklch(47.55% 0.145 302.98)",
    ];

    let editorHost = $state<HTMLDivElement>();
    let editor = $state<Editor>();
    let documentJson = $state<JSONContent>(structuredClone(sampleDocument));
    let language = $state<DcLanguageId>(defaultLanguage);
    let theme = $state<DcThemeId>(defaultTheme);
    let bodyFontSize = $state("15px");
    let selectionFontSize = $state("15px");
    let quoteStyle = $state<QuoteStyle>("literary");
    let ctaGroupLayout = $state<CtaGroupLayout>("horizontal");
    let codeFontSize = $state("14px");
    let codeLineHighlights = $state("");
    let codeFilename = $state("");
    let showLineNumbers = $state(false);
    let documentTheme = $state<DcDocumentTheme>("lightLecture");
    let exportStructure = $state<DcExportStructure>("dcTable");
    let html = $state("");
    let isRendering = $state(false);
    let previewMode = $state<"rendered" | "source">("rendered");
    let copyState = $state<"idle" | "copied" | "error">("idle");
    let sourceCopyState = $state<"idle" | "copied" | "error">("idle");
    let isLinkPanelOpen = $state(false);
    let linkDraft = $state("");
    let linkError = $state(false);
    let isMarkdownPanelOpen = $state(false);
    let markdownDraft = $state("");
    let markdownImportState = $state<"idle" | "imported" | "error">("idle");
    let llmPromptCopyState = $state<"idle" | "copied" | "error">("idle");
    let presetName = $state("");
    let presets = $state<PresetSnapshot[]>([]);
    let presetState = $state<"idle" | "saved" | "error">("idle");
    let draftHistory = $state<DraftHistorySnapshot[]>([]);
    let draftHistoryState = $state<"idle" | "saved" | "error">("idle");
    let editorSignal = $state(0);
    let canPersistDraft = $state(false);
    let lastDraftHistoryFingerprint = "";
    let lastDraftHistorySavedAt = 0;
    let renderTurn = 0;

    const htmlSize = $derived(
        `${Math.max(1, Math.ceil(html.length / 1024))}KB`,
    );
    const copyLabel = $derived(copyState === "copied" ? "복사됨" : "디씨 복사");
    const sourceCopyLabel = $derived(
        sourceCopyState === "copied" ? "복사됨" : "원문 복사",
    );
    const exportStructureLabel = $derived(
        exportStructures.find((item) => item.value === exportStructure)
            ?.label ?? "DC 테이블",
    );
    const documentThemeLabel = $derived(
        documentThemes.find((item) => item.value === documentTheme)?.label ??
            "강의 라이트",
    );
    const presetStateLabel = $derived(
        presetState === "saved"
            ? "저장됨"
            : presetState === "error"
              ? "저장 실패"
              : `${presets.length}개`,
    );
    const draftHistoryStateLabel = $derived(
        draftHistoryState === "saved"
            ? "저장됨"
            : draftHistoryState === "error"
              ? "저장 실패"
              : `${draftHistory.length}/${maxDraftHistoryCount}`,
    );
    const markdownImportStateLabel = $derived(
        markdownImportState === "imported"
            ? "가져옴"
            : markdownImportState === "error"
              ? "비어 있음"
              : "대기",
    );
    const llmPromptCopyLabel = $derived(
        llmPromptCopyState === "copied"
            ? "복사됨"
            : llmPromptCopyState === "error"
              ? "복사 실패"
              : "LLM 가이드",
    );

    function draftStorage() {
        return typeof window === "undefined" ? undefined : window.localStorage;
    }

    function defaultDraftPreferences(): DraftPreferences {
        return {
            language: defaultLanguage,
            theme: defaultTheme,
            bodyFontFamily,
            bodyFontSize: "15px",
            selectionFontFamily,
            selectionFontSize: "15px",
            codeFontSize: "14px",
            showLineNumbers: false,
            documentTheme: "lightLecture",
            structure: "dcTable",
        };
    }

    function currentDraftPreferences(): DraftPreferences {
        return {
            language,
            theme,
            bodyFontFamily,
            bodyFontSize,
            selectionFontFamily,
            selectionFontSize,
            codeFontSize,
            showLineNumbers,
            documentTheme,
            structure: exportStructure,
        };
    }

    function isKnownBodySize(value: string) {
        return bodySizes.includes(value);
    }

    function isKnownCodeSize(value: string) {
        return codeSizes.includes(value);
    }

    function applyDraftPreferences(preferences: DraftPreferences) {
        language = preferences.language;
        theme = preferences.theme;
        bodyFontSize = isKnownBodySize(preferences.bodyFontSize)
            ? preferences.bodyFontSize
            : "15px";
        selectionFontSize = isKnownBodySize(preferences.selectionFontSize)
            ? preferences.selectionFontSize
            : "15px";
        codeFontSize = isKnownCodeSize(preferences.codeFontSize)
            ? preferences.codeFontSize
            : "14px";
        showLineNumbers = preferences.showLineNumbers;
        documentTheme = preferences.documentTheme;
        exportStructure = preferences.structure;
    }

    function firstCodeBlockLanguage(
        value: JSONContent,
    ): DcLanguageId | undefined {
        if (
            value.type === "codeBlock" &&
            typeof value.attrs?.language === "string" &&
            isSupportedLanguage(value.attrs.language)
        ) {
            return value.attrs.language;
        }

        for (const child of value.content ?? []) {
            const found = firstCodeBlockLanguage(child);
            if (found) {
                return found;
            }
        }

        return undefined;
    }

    function presetDateLabel(value: string) {
        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return new Intl.DateTimeFormat("ko-KR", {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        }).format(date);
    }

    function countDocumentText(value: JSONContent): number {
        const ownTextLength =
            typeof value.text === "string" ? value.text.length : 0;
        const childTextLength =
            value.content?.reduce(
                (total, child) => total + countDocumentText(child),
                0,
            ) ?? 0;

        return ownTextLength + childTextLength;
    }

    function languageLabel(value: DcLanguageId) {
        return (
            supportedLanguages.find((item) => item.id === value)?.label ?? value
        );
    }

    function draftHistoryFingerprint(
        document: JSONContent,
        preferences: DraftPreferences,
    ) {
        return JSON.stringify({ document, preferences });
    }

    function currentDraftHistoryFingerprint() {
        return draftHistoryFingerprint(documentJson, currentDraftPreferences());
    }

    function draftHistorySummary(snapshot: DraftHistorySnapshot) {
        const themeLabel =
            snapshot.preferences.documentTheme === "darkEditorial"
                ? "다크"
                : "라이트";
        const textLength = countDocumentText(
            snapshot.document,
        ).toLocaleString();

        return `${themeLabel} · ${languageLabel(snapshot.preferences.language)} · ${textLength}자`;
    }

    function refreshPresetSnapshots() {
        const storage = draftStorage();
        presets = storage ? readPresetSnapshots(storage) : [];
    }

    function refreshDraftHistorySnapshots() {
        const storage = draftStorage();
        draftHistory = storage ? readDraftHistorySnapshots(storage) : [];
    }

    function setDraftHistorySavedState() {
        draftHistoryState = "saved";
        window.setTimeout(() => {
            draftHistoryState = "idle";
        }, 1300);
    }

    function saveDraftHistorySnapshot(options: { automatic: boolean }) {
        const storage = draftStorage();

        if (!storage) {
            draftHistoryState = "error";
            return false;
        }

        const preferences = currentDraftPreferences();
        const fingerprint = draftHistoryFingerprint(documentJson, preferences);

        if (fingerprint === lastDraftHistoryFingerprint) {
            return false;
        }

        const snapshot = createDraftHistorySnapshot(documentJson, preferences);
        const nextHistory = appendDraftHistorySnapshot(storage, snapshot);

        if (nextHistory[0]?.id !== snapshot.id) {
            draftHistoryState = "error";
            return false;
        }

        draftHistory = nextHistory;
        lastDraftHistoryFingerprint = fingerprint;
        lastDraftHistorySavedAt = Date.now();

        if (!options.automatic) {
            setDraftHistorySavedState();
        }

        return true;
    }

    function maybeSaveAutomaticDraftHistory() {
        const now = Date.now();

        if (now - lastDraftHistorySavedAt < draftHistoryAutoIntervalMs) {
            return;
        }

        void saveDraftHistorySnapshot({ automatic: true });
    }

    function restoreDraftHistorySnapshot(snapshot: DraftHistorySnapshot) {
        applyDraftPreferences(snapshot.preferences);
        documentJson = structuredClone(snapshot.document);
        editor?.commands.setContent(documentJson);

        if (editor) {
            refreshEditorState(editor);
        }

        lastDraftHistoryFingerprint = draftHistoryFingerprint(
            snapshot.document,
            snapshot.preferences,
        );
        lastDraftHistorySavedAt = Date.now();
        draftHistoryState = "idle";
    }

    function deleteDraftHistory(id: string) {
        const storage = draftStorage();

        if (!storage) {
            draftHistoryState = "error";
            return;
        }

        draftHistory = deleteDraftHistorySnapshot(storage, id);
    }

    function importMarkdownDraft() {
        if (!markdownDraft.trim()) {
            markdownImportState = "error";
            return;
        }

        saveDraftHistorySnapshot({ automatic: true });

        const nextDocument = parseMarkdownToDocument(markdownDraft, {
            defaultLanguage: language,
        });
        const importedLanguage = firstCodeBlockLanguage(nextDocument);

        if (importedLanguage) {
            language = importedLanguage;
        }

        documentJson = nextDocument;
        editor?.commands.setContent(documentJson);

        if (editor) {
            refreshEditorState(editor);
        }

        markdownImportState = "imported";
        isMarkdownPanelOpen = false;
        window.setTimeout(() => {
            markdownImportState = "idle";
        }, 1300);
    }

    function clearMarkdownDraft() {
        markdownDraft = "";
        markdownImportState = "idle";
    }

    function saveCurrentPreset() {
        const storage = draftStorage();

        if (!storage) {
            presetState = "error";
            return;
        }

        const preset = createPresetSnapshot(
            presetName,
            documentJson,
            currentDraftPreferences(),
        );
        const nextPresets = [preset, ...readPresetSnapshots(storage)].slice(
            0,
            30,
        );

        if (!writePresetSnapshots(storage, nextPresets)) {
            presetState = "error";
            return;
        }

        presets = nextPresets;
        presetName = "";
        presetState = "saved";
        window.setTimeout(() => {
            presetState = "idle";
        }, 1300);
    }

    function applyPreset(preset: PresetSnapshot) {
        applyDraftPreferences(preset.preferences);
        documentJson = structuredClone(preset.document);
        editor?.commands.setContent(documentJson);

        if (editor) {
            refreshEditorState(editor);
        }

        presetState = "idle";
    }

    function deletePreset(id: string) {
        const storage = draftStorage();

        if (!storage) {
            presetState = "error";
            return;
        }

        presets = deletePresetSnapshot(storage, id);
    }

    function exportOptions(): DcExportOptions {
        return {
            theme,
            bodyFontFamily,
            bodyFontSize,
            codeFontSize,
            showLineNumbers,
            documentTheme,
            structure: exportStructure,
        };
    }

    async function renderPreview(
        nextDocument: JSONContent,
        options: DcExportOptions,
    ) {
        const turn = ++renderTurn;
        isRendering = true;

        try {
            const nextHtml = await exportDocumentToDcHtml(
                nextDocument,
                options,
            );

            if (turn === renderTurn) {
                html = nextHtml;
            }
        } finally {
            if (turn === renderTurn) {
                isRendering = false;
            }
        }
    }

    function refreshEditorState(nextEditor: Editor) {
        documentJson = nextEditor.getJSON();
        editorSignal += 1;
    }

    function isActive(name: string, attributes?: Record<string, unknown>) {
        void editorSignal;
        return editor?.isActive(name, attributes) ?? false;
    }

    function canUndo() {
        void editorSignal;
        return editor?.can().undo() ?? false;
    }

    function canRedo() {
        void editorSignal;
        return editor?.can().redo() ?? false;
    }

    function runEditorCommand(command: (current: Editor) => boolean) {
        if (!editor) {
            return;
        }

        command(editor);
        refreshEditorState(editor);
    }

    function applyCodeBlock() {
        const highlightLines = normalizeHighlightLines(codeLineHighlights);
        const filename = normalizeCodeFilename(codeFilename);
        codeLineHighlights = highlightLines;
        codeFilename = filename;

        runEditorCommand((current) => {
            if (current.isActive("codeBlock")) {
                return current
                    .chain()
                    .focus()
                    .toggleCodeBlock({ language })
                    .run();
            }

            if (
                current
                    .chain()
                    .focus()
                    .command(
                        selectedInlineRangeToCodeBlockCommand(
                            language,
                            highlightLines,
                            filename,
                        ),
                    )
                    .run()
            ) {
                return true;
            }

            return current
                .chain()
                .focus()
                .setCodeBlock({ language })
                .updateAttributes("codeBlock", { highlightLines, filename })
                .run();
        });
    }

    function applyCodeFilename() {
        const filename = normalizeCodeFilename(codeFilename);
        codeFilename = filename;
        runEditorCommand((current) =>
            current
                .chain()
                .focus()
                .updateAttributes("codeBlock", { filename })
                .run(),
        );
    }

    function applyCodeLineHighlights() {
        const highlightLines = normalizeHighlightLines(codeLineHighlights);
        codeLineHighlights = highlightLines;
        runEditorCommand((current) =>
            current
                .chain()
                .focus()
                .updateAttributes("codeBlock", { highlightLines })
                .run(),
        );
    }

    function retargetActiveCallout(current: Editor, kind: CalloutKind) {
        const targetType = current.schema.nodes[calloutNodeNameByKind[kind]];

        if (!targetType) {
            return false;
        }

        const selectionFrom = current.state.selection.$from;

        for (let depth = selectionFrom.depth; depth > 0; depth -= 1) {
            const node = selectionFrom.node(depth);

            if (isCalloutNodeName(node.type.name)) {
                current.commands.focus();
                current.view.dispatch(
                    current.state.tr
                        .setNodeMarkup(selectionFrom.before(depth), targetType)
                        .scrollIntoView(),
                );
                return true;
            }
        }

        return false;
    }

    function applyCallout(kind: CalloutKind) {
        runEditorCommand((current) => {
            if (retargetActiveCallout(current, kind)) {
                return true;
            }

            if (
                current
                    .chain()
                    .focus()
                    .command(selectedInlineRangeToCalloutCommand(kind))
                    .run()
            ) {
                return true;
            }

            return current
                .chain()
                .focus()
                .wrapIn(calloutNodeNameByKind[kind])
                .run();
        });
    }

    function selectedText() {
        if (!editor || editor.state.selection.empty) {
            return "";
        }

        const { from, to } = editor.state.selection;
        return editor.state.doc.textBetween(from, to, "\n").trim();
    }

    function retargetActiveLinkBox(current: Editor, href: string) {
        const linkBoxType = current.schema.nodes.linkBox;

        if (!linkBoxType) {
            return false;
        }

        const selectionFrom = current.state.selection.$from;

        for (let depth = selectionFrom.depth; depth > 0; depth -= 1) {
            const node = selectionFrom.node(depth);

            if (node.type.name === "linkBox") {
                current.commands.focus();
                current.view.dispatch(
                    current.state.tr
                        .setNodeMarkup(
                            selectionFrom.before(depth),
                            linkBoxType,
                            { href },
                        )
                        .scrollIntoView(),
                );
                return true;
            }
        }

        return false;
    }

    function applyLinkBox() {
        const href =
            normalizeEditableLinkHref(linkDraft) ??
            normalizeEditableLinkHref(selectedText());

        if (!href) {
            isLinkPanelOpen = true;
            linkError = true;
            return;
        }

        linkError = false;
        linkDraft = href;
        runEditorCommand((current) => {
            if (retargetActiveLinkBox(current, href)) {
                return true;
            }

            if (
                current
                    .chain()
                    .focus()
                    .command(selectedInlineRangeToLinkBoxCommand(href))
                    .run()
            ) {
                return true;
            }

            return current
                .chain()
                .focus()
                .insertContent({
                    type: "linkBox",
                    attrs: { href },
                    content: [
                        {
                            type: "paragraph",
                            content: [{ type: "text", text: href }],
                        },
                    ],
                })
                .run();
        });
    }

    function applySectionHeading() {
        runEditorCommand((current) => {
            if (
                current
                    .chain()
                    .focus()
                    .command(selectedInlineRangeToSectionHeadingCommand())
                    .run()
            ) {
                return true;
            }

            return current
                .chain()
                .focus()
                .insertContent({
                    type: "sectionHeading",
                    content: [{ type: "text", text: "새 섹션" }],
                })
                .run();
        });
    }

    function applyQuote() {
        const nextQuoteStyle = normalizeQuoteStyle(quoteStyle);
        quoteStyle = nextQuoteStyle;

        runEditorCommand((current) => {
            if (current.isActive("blockquote")) {
                return current
                    .chain()
                    .focus()
                    .updateAttributes("blockquote", {
                        quoteStyle: nextQuoteStyle,
                    })
                    .run();
            }

            return current
                .chain()
                .focus()
                .toggleBlockquote()
                .updateAttributes("blockquote", { quoteStyle: nextQuoteStyle })
                .run();
        });
    }

    function updateActiveQuoteStyle() {
        const nextQuoteStyle = normalizeQuoteStyle(quoteStyle);
        quoteStyle = nextQuoteStyle;

        runEditorCommand((current) => {
            if (!current.isActive("blockquote")) {
                return true;
            }

            return current
                .chain()
                .focus()
                .updateAttributes("blockquote", { quoteStyle: nextQuoteStyle })
                .run();
        });
    }

    function retargetActiveCtaButton(current: Editor, href: string) {
        const ctaButtonType = current.schema.nodes.ctaButton;

        if (!ctaButtonType) {
            return false;
        }

        const selectionFrom = current.state.selection.$from;

        for (let depth = selectionFrom.depth; depth > 0; depth -= 1) {
            const node = selectionFrom.node(depth);

            if (node.type.name === "ctaButton") {
                current.commands.focus();
                current.view.dispatch(
                    current.state.tr
                        .setNodeMarkup(
                            selectionFrom.before(depth),
                            ctaButtonType,
                            { href },
                        )
                        .scrollIntoView(),
                );
                return true;
            }
        }

        return false;
    }

    function applyCtaButton() {
        const selection = selectedText();
        const href =
            normalizeEditableLinkHref(linkDraft) ??
            normalizeEditableLinkHref(selection);

        if (!href) {
            isLinkPanelOpen = true;
            linkError = true;
            return;
        }

        const fallbackLabel = normalizeEditableLinkHref(selection)
            ? "바로가기"
            : selection || "바로가기";

        linkError = false;
        linkDraft = href;
        runEditorCommand((current) => {
            if (retargetActiveCtaButton(current, href)) {
                return true;
            }

            if (
                current
                    .chain()
                    .focus()
                    .command(
                        selectedInlineRangeToCtaButtonCommand(
                            href,
                            fallbackLabel,
                        ),
                    )
                    .run()
            ) {
                return true;
            }

            return current
                .chain()
                .focus()
                .insertContent({
                    type: "ctaButton",
                    attrs: { href },
                    content: [{ type: "text", text: fallbackLabel }],
                })
                .run();
        });
    }

    function applyCtaGroup() {
        const layout = normalizeCtaGroupLayout(ctaGroupLayout);
        ctaGroupLayout = layout;

        runEditorCommand((current) => {
            if (current.isActive("ctaGroup")) {
                return current
                    .chain()
                    .focus()
                    .updateAttributes("ctaGroup", { layout })
                    .run();
            }

            return current
                .chain()
                .focus()
                .insertContent(createDefaultCtaGroup(layout))
                .run();
        });
    }

    function updateActiveCtaGroupLayout() {
        const layout = normalizeCtaGroupLayout(ctaGroupLayout);
        ctaGroupLayout = layout;

        runEditorCommand((current) => {
            if (!current.isActive("ctaGroup")) {
                return true;
            }

            return current
                .chain()
                .focus()
                .updateAttributes("ctaGroup", { layout })
                .run();
        });
    }

    function applyReferenceList() {
        const referenceList =
            createReferenceListFromText(selectedText()) ??
            createDefaultReferenceList();

        runEditorCommand((current) =>
            current.chain().focus().insertContent(referenceList).run(),
        );
    }

    function applySummaryBox() {
        const summaryBox =
            createSummaryBoxFromText(selectedText()) ??
            createDefaultSummaryBox();

        runEditorCommand((current) =>
            current.chain().focus().insertContent(summaryBox).run(),
        );
    }

    function applyHeroBlock() {
        const heroBlock =
            createHeroBlockFromText(selectedText()) ?? createDefaultHeroBlock();

        runEditorCommand((current) =>
            current.chain().focus().insertContent(heroBlock).run(),
        );
    }

    function applyTutorialBlock() {
        const tutorialBlock =
            createTutorialBlockFromText(selectedText()) ??
            createDefaultTutorialBlock();

        runEditorCommand((current) =>
            current.chain().focus().insertContent(tutorialBlock).run(),
        );
    }

    function applyComparisonBlock() {
        const comparisonBlock =
            createComparisonBlockFromText(selectedText()) ??
            createDefaultComparisonBlock();

        runEditorCommand((current) =>
            current.chain().focus().insertContent(comparisonBlock).run(),
        );
    }

    function setLink() {
        if (!editor) {
            return;
        }

        const href = normalizeEditableLinkHref(linkDraft);
        if (!href) {
            linkError = true;
            return;
        }

        linkError = false;
        linkDraft = href;
        runEditorCommand((current) =>
            current
                .chain()
                .focus()
                .extendMarkRange("link")
                .setLink({ href })
                .run(),
        );
    }

    function unsetLink() {
        linkError = false;
        linkDraft = "";
        runEditorCommand((current) =>
            current.chain().focus().extendMarkRange("link").unsetLink().run(),
        );
    }

    function toggleLinkPanel() {
        if (!editor) {
            return;
        }

        const existing = editor.getAttributes("link").href;
        linkDraft = typeof existing === "string" ? existing : linkDraft;
        linkError = false;
        isLinkPanelOpen = !isLinkPanelOpen;
    }

    function setTextColor(color: string) {
        const safety = editorThemeColorSafety[documentTheme];
        const readableColor = sanitizeReadableTextColor(
            color,
            safety.background,
            safety.fallback,
        );

        runEditorCommand((current) =>
            current.chain().focus().setColor(readableColor).run(),
        );
    }

    function setFontSize(value: string) {
        runEditorCommand((current) =>
            current.chain().focus().setFontSize(value).run(),
        );
    }

    function resetDraft() {
        const storage = draftStorage();
        if (storage) {
            clearDraftSnapshot(storage);
        }

        applyDraftPreferences(defaultDraftPreferences());
        documentJson = structuredClone(sampleDocument);
        editor?.commands.setContent(documentJson);
        if (editor) {
            refreshEditorState(editor);
        }
        isLinkPanelOpen = false;
        linkDraft = "";
        linkError = false;
        lastDraftHistoryFingerprint = currentDraftHistoryFingerprint();
        lastDraftHistorySavedAt = Date.now();
    }

    async function copyPreview() {
        copyState = "idle";

        try {
            await copyDcHtml(html, editor?.getText() ?? "");
            copyState = "copied";
            window.setTimeout(() => {
                copyState = "idle";
            }, 1300);
        } catch {
            copyState = "error";
        }
    }

    async function copySourceHtml() {
        sourceCopyState = "idle";

        try {
            await copyPlainText(html);
            sourceCopyState = "copied";
            window.setTimeout(() => {
                sourceCopyState = "idle";
            }, 1300);
        } catch {
            sourceCopyState = "error";
        }
    }

    async function copyLlmAuthoringGuide() {
        llmPromptCopyState = "idle";

        try {
            await copyPlainText(llmAuthoringPrompt);
            llmPromptCopyState = "copied";
            window.setTimeout(() => {
                llmPromptCopyState = "idle";
            }, 1300);
        } catch {
            llmPromptCopyState = "error";
        }
    }

    onMount(() => {
        let disposed = false;
        let mountedEditor: Editor | undefined;
        const savedDraft = readDraftSnapshot(window.localStorage);
        refreshPresetSnapshots();
        refreshDraftHistorySnapshots();

        if (savedDraft) {
            documentJson = savedDraft.document;
            applyDraftPreferences(savedDraft.preferences);
        }

        lastDraftHistoryFingerprint = draftHistory[0]
            ? draftHistoryFingerprint(
                  draftHistory[0].document,
                  draftHistory[0].preferences,
              )
            : "";
        lastDraftHistorySavedAt = Date.now();

        async function mountEditor() {
            const [{ Editor }, { createEditorExtensions }] = await Promise.all([
                import("@tiptap/core"),
                import("$lib/editor/extensions"),
            ]);

            if (disposed || !editorHost) {
                return;
            }

            mountedEditor = new Editor({
                element: editorHost,
                extensions: createEditorExtensions(),
                content: documentJson,
                editorProps: {
                    attributes: {
                        class: "article-editor",
                        spellcheck: "false",
                    },
                },
                onCreate: ({ editor: current }) => {
                    editor = current;
                    refreshEditorState(current);
                    canPersistDraft = true;
                },
                onUpdate: ({ editor: current }) => {
                    refreshEditorState(current);
                },
                onSelectionUpdate: ({ editor: current }) => {
                    editorSignal += 1;
                    const attrs = current.getAttributes("codeBlock");
                    if (
                        typeof attrs.language === "string" &&
                        isSupportedLanguage(attrs.language)
                    ) {
                        language = attrs.language;
                    }
                    codeLineHighlights = normalizeHighlightLines(
                        attrs.highlightLines,
                    );
                    codeFilename = normalizeCodeFilename(attrs.filename);
                    const blockquoteAttrs = current.getAttributes("blockquote");
                    quoteStyle = normalizeQuoteStyle(
                        blockquoteAttrs.quoteStyle,
                    );
                    const linkAttrs = current.getAttributes("link");
                    if (typeof linkAttrs.href === "string") {
                        linkDraft = linkAttrs.href;
                    }
                    const linkBoxAttrs = current.getAttributes("linkBox");
                    if (typeof linkBoxAttrs.href === "string") {
                        linkDraft = linkBoxAttrs.href;
                    }
                    const ctaButtonAttrs = current.getAttributes("ctaButton");
                    if (typeof ctaButtonAttrs.href === "string") {
                        linkDraft = ctaButtonAttrs.href;
                    }
                    const ctaGroupAttrs = current.getAttributes("ctaGroup");
                    ctaGroupLayout = normalizeCtaGroupLayout(
                        ctaGroupAttrs.layout,
                    );
                    const textStyleAttrs = current.getAttributes("textStyle");
                    if (typeof textStyleAttrs.fontSize === "string") {
                        selectionFontSize = textStyleAttrs.fontSize;
                    }
                },
            });
        }

        void mountEditor();

        return () => {
            disposed = true;
            mountedEditor?.destroy();
        };
    });

    $effect(() => {
        void renderPreview(documentJson, exportOptions());
    });

    $effect(() => {
        if (!canPersistDraft) {
            return;
        }

        const storage = draftStorage();
        if (!storage) {
            return;
        }

        writeDraftSnapshot(
            storage,
            createDraftSnapshot(documentJson, currentDraftPreferences()),
        );
        maybeSaveAutomaticDraftHistory();
    });
</script>

<main class="workspace">
    <header class="topbar">
        <div>
            <p class="eyebrow">dc-code-paste</p>
            <h1>디씨 글 디자인</h1>
        </div>

        <button
            class="copy-button"
            type="button"
            onclick={copyPreview}
            disabled={!html || isRendering}
        >
            {#if copyState === "copied"}
                <Check size={18} />
            {:else if isRendering}
                <span class="spin-icon"><Loader2 size={18} /></span>
            {:else}
                <Clipboard size={18} />
            {/if}
            <span>{copyLabel}</span>
        </button>
    </header>

    <section class="toolbar" aria-label="글 편집 도구">
        <div class="tool-group command-group">
            <button
                type="button"
                title="실행 취소"
                aria-label="실행 취소"
                disabled={!canUndo()}
                onclick={() =>
                    runEditorCommand((current) =>
                        current.chain().focus().undo().run(),
                    )}
            >
                <Undo2 size={17} />
            </button>
            <button
                type="button"
                title="다시 실행"
                aria-label="다시 실행"
                disabled={!canRedo()}
                onclick={() =>
                    runEditorCommand((current) =>
                        current.chain().focus().redo().run(),
                    )}
            >
                <Redo2 size={17} />
            </button>
            <button
                type="button"
                title="초기화"
                aria-label="초기화"
                onclick={resetDraft}
            >
                <RotateCcw size={17} />
                <span>초기화</span>
            </button>
            <button
                class:active={isMarkdownPanelOpen}
                type="button"
                title="Markdown"
                aria-label="Markdown"
                onclick={() => {
                    isMarkdownPanelOpen = !isMarkdownPanelOpen;
                    markdownImportState = "idle";
                }}
            >
                <FileText size={17} />
                <span>Markdown</span>
            </button>
            <button
                class:active={llmPromptCopyState === "copied"}
                type="button"
                title="LLM 가이드 복사"
                aria-label="LLM 가이드 복사"
                onclick={copyLlmAuthoringGuide}
            >
                {#if llmPromptCopyState === "copied"}
                    <Check size={17} />
                {:else}
                    <Sparkles size={17} />
                {/if}
                <span>{llmPromptCopyLabel}</span>
            </button>
        </div>

        <div class="tool-group inline-group">
            <button
                class:active={isActive("heading", { level: 1 })}
                type="button"
                title="제목"
                aria-label="제목"
                onclick={() =>
                    runEditorCommand((current) =>
                        current
                            .chain()
                            .focus()
                            .toggleHeading({ level: 1 })
                            .run(),
                    )}
            >
                <Heading1 size={17} />
            </button>
            <button
                class:active={isActive("paragraph")}
                type="button"
                title="문단"
                aria-label="문단"
                onclick={() =>
                    runEditorCommand((current) =>
                        current.chain().focus().setParagraph().run(),
                    )}
            >
                <Rows3 size={17} />
            </button>
            <button
                class:active={isActive("bold")}
                type="button"
                title="굵게"
                aria-label="굵게"
                onclick={() =>
                    runEditorCommand((current) =>
                        current.chain().focus().toggleBold().run(),
                    )}
            >
                <Bold size={17} />
            </button>
            <button
                class:active={isActive("italic")}
                type="button"
                title="기울임"
                aria-label="기울임"
                onclick={() =>
                    runEditorCommand((current) =>
                        current.chain().focus().toggleItalic().run(),
                    )}
            >
                <Italic size={17} />
            </button>
            <button
                class:active={isActive("link") || isLinkPanelOpen}
                type="button"
                title="링크"
                aria-label="링크"
                onclick={toggleLinkPanel}
            >
                <Link2 size={17} />
            </button>
            <button
                class:active={isActive("linkBox")}
                type="button"
                title="링크박스"
                aria-label="링크박스"
                onclick={applyLinkBox}
            >
                <LinkIcon size={17} />
                <span>링크박스</span>
            </button>
        </div>

        {#if isLinkPanelOpen}
            <div class="tool-group link-tool">
                <label>
                    <span><Link2 size={15} /> URL</span>
                    <input
                        class:error={linkError}
                        type="url"
                        bind:value={linkDraft}
                        aria-label="링크 주소"
                        placeholder="https://example.com"
                        oninput={() => (linkError = false)}
                        onkeydown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                setLink();
                            }

                            if (event.key === "Escape") {
                                isLinkPanelOpen = false;
                                linkError = false;
                            }
                        }}
                    />
                </label>
                <button
                    type="button"
                    title="적용"
                    aria-label="적용"
                    onclick={setLink}
                >
                    <Check size={17} />
                </button>
                <button
                    type="button"
                    title="해제"
                    aria-label="해제"
                    onclick={unsetLink}
                >
                    <Unlink size={17} />
                </button>
            </div>
        {/if}

        <div class="tool-group block-insert-group">
            <button
                class:active={isActive("bulletList")}
                type="button"
                title="목록"
                aria-label="목록"
                onclick={() =>
                    runEditorCommand((current) =>
                        current.chain().focus().toggleBulletList().run(),
                    )}
            >
                <List size={17} />
            </button>
            <button
                class:active={isActive("blockquote")}
                type="button"
                title="인용"
                aria-label="인용"
                onclick={applyQuote}
            >
                <Quote size={17} />
            </button>
            <label>
                <span><Quote size={15} /> 인용</span>
                <select
                    bind:value={quoteStyle}
                    aria-label="인용 스타일"
                    onchange={updateActiveQuoteStyle}
                >
                    {#each quoteStyleOptions as item}
                        <option value={item.value}>{item.label}</option>
                    {/each}
                </select>
            </label>
            <button
                class:active={isActive("sectionHeading")}
                type="button"
                title="섹션"
                aria-label="섹션"
                onclick={applySectionHeading}
            >
                <Rows3 size={17} />
                <span>섹션</span>
            </button>
            <button
                class:active={isActive("heroBlock")}
                type="button"
                title="히어로"
                aria-label="히어로"
                onclick={applyHeroBlock}
            >
                <Heading1 size={17} />
                <span>히어로</span>
            </button>
            <button
                class:active={isActive("summaryBox")}
                type="button"
                title="요약"
                aria-label="요약"
                onclick={applySummaryBox}
            >
                <FileText size={17} />
                <span>요약</span>
            </button>
            <button
                class:active={isActive("tutorialBlock")}
                type="button"
                title="튜토리얼"
                aria-label="튜토리얼"
                onclick={applyTutorialBlock}
            >
                <Rows3 size={17} />
                <span>튜토리얼</span>
            </button>
            <button
                class:active={isActive("comparisonBlock")}
                type="button"
                title="비교"
                aria-label="비교"
                onclick={applyComparisonBlock}
            >
                <Rows3 size={17} />
                <span>비교</span>
            </button>
            <button
                type="button"
                title="구분선"
                aria-label="구분선"
                onclick={() =>
                    runEditorCommand((current) =>
                        current.chain().focus().setHorizontalRule().run(),
                    )}
            >
                <SeparatorHorizontal size={17} />
            </button>
            <button
                class:active={isActive("tipBox")}
                type="button"
                onclick={() => applyCallout("tip")}
            >
                <Sparkles size={17} />
                <span>팁</span>
            </button>
            <button
                class:active={isActive("warningBox")}
                type="button"
                onclick={() => applyCallout("warning")}
            >
                <AlertTriangle size={17} />
                <span>주의</span>
            </button>
            <button
                class:active={isActive("referenceBox")}
                type="button"
                onclick={() => applyCallout("reference")}
            >
                <BookOpen size={17} />
                <span>참고</span>
            </button>
            <button
                class:active={isActive("emphasisBox")}
                type="button"
                onclick={() => applyCallout("emphasis")}
            >
                <Highlighter size={17} />
                <span>강조</span>
            </button>
            <button
                class:active={isActive("successBox")}
                type="button"
                onclick={() => applyCallout("success")}
            >
                <Check size={17} />
                <span>성공</span>
            </button>
            <button
                class:active={isActive("failureBox")}
                type="button"
                onclick={() => applyCallout("failure")}
            >
                <AlertTriangle size={17} />
                <span>실패</span>
            </button>
            <button
                class:active={isActive("experimentBox")}
                type="button"
                onclick={() => applyCallout("experiment")}
            >
                <Sparkles size={17} />
                <span>실험</span>
            </button>
            <button
                class:active={isActive("conclusionBox")}
                type="button"
                onclick={() => applyCallout("conclusion")}
            >
                <BookOpen size={17} />
                <span>결론</span>
            </button>
            <button
                class:active={isActive("rebuttalBox")}
                type="button"
                onclick={() => applyCallout("rebuttal")}
            >
                <Highlighter size={17} />
                <span>반박</span>
            </button>
            <button
                class:active={isActive("ctaButton")}
                type="button"
                title="CTA"
                aria-label="CTA"
                onclick={applyCtaButton}
            >
                <LinkIcon size={17} />
                <span>CTA</span>
            </button>
            <button
                class:active={isActive("ctaGroup")}
                type="button"
                title="버튼묶음"
                aria-label="버튼묶음"
                onclick={applyCtaGroup}
            >
                <Rows3 size={17} />
                <span>버튼묶음</span>
            </button>
            <button
                class:active={isActive("referenceList")}
                type="button"
                title="자료목록"
                aria-label="자료목록"
                onclick={applyReferenceList}
            >
                <BookOpen size={17} />
                <span>자료목록</span>
            </button>
            <label>
                <span><Rows3 size={15} /> 버튼</span>
                <select
                    bind:value={ctaGroupLayout}
                    aria-label="버튼묶음 정렬"
                    onchange={updateActiveCtaGroupLayout}
                >
                    {#each ctaGroupLayoutOptions as item}
                        <option value={item.value}>{item.label}</option>
                    {/each}
                </select>
            </label>
        </div>

        <div class="tool-group tool-group-wide code-settings-group">
            <button
                class:active={isActive("codeBlock")}
                type="button"
                onclick={applyCodeBlock}
            >
                <Code2 size={17} />
                <span>코드</span>
            </button>
            <label>
                <span><Rows3 size={15} /> 복붙</span>
                <select bind:value={exportStructure} aria-label="복붙 구조">
                    {#each exportStructures as item}
                        <option value={item.value}>{item.label}</option>
                    {/each}
                </select>
            </label>
            <label>
                <span><Paintbrush size={15} /> 문서</span>
                <select bind:value={documentTheme} aria-label="문서 테마">
                    {#each documentThemes as item}
                        <option value={item.value}>{item.label}</option>
                    {/each}
                </select>
            </label>
            <label>
                <span><Code2 size={15} /> 언어</span>
                <select
                    bind:value={language}
                    aria-label="코드 언어"
                    onchange={() =>
                        runEditorCommand((current) =>
                            current
                                .chain()
                                .focus()
                                .updateAttributes("codeBlock", { language })
                                .run(),
                        )}
                >
                    {#each supportedLanguages as item}
                        <option value={item.id}>{item.label}</option>
                    {/each}
                </select>
            </label>
            <label>
                <span><FileText size={15} /> 파일명</span>
                <input
                    class="code-filename-input"
                    type="text"
                    bind:value={codeFilename}
                    aria-label="코드 파일명"
                    placeholder="main.cpp"
                    onblur={applyCodeFilename}
                    onkeydown={(event) => {
                        if (event.key === "Enter") {
                            applyCodeFilename();
                        }
                    }}
                />
            </label>
            <label>
                <span><Highlighter size={15} /> 강조줄</span>
                <input
                    class="line-highlight-input"
                    type="text"
                    bind:value={codeLineHighlights}
                    aria-label="코드 강조 줄"
                    placeholder="2,4-6"
                    onblur={applyCodeLineHighlights}
                    onkeydown={(event) => {
                        if (event.key === "Enter") {
                            applyCodeLineHighlights();
                        }
                    }}
                />
            </label>
            <label>
                <span><Paintbrush size={15} /> 테마</span>
                <select bind:value={theme} aria-label="코드 테마">
                    {#each supportedThemes as item}
                        <option value={item.id}>{item.label}</option>
                    {/each}
                </select>
            </label>
        </div>

        <div class="tool-group tool-group-wide typography-group">
            <label>
                <span>본문</span>
                <select bind:value={bodyFontSize} aria-label="기본 크기">
                    {#each bodySizes as item}
                        <option value={item}>{item}</option>
                    {/each}
                </select>
            </label>
            <label>
                <span>크기</span>
                <select
                    bind:value={selectionFontSize}
                    aria-label="선택 크기"
                    onchange={() => setFontSize(selectionFontSize)}
                >
                    {#each bodySizes as item}
                        <option value={item}>{item}</option>
                    {/each}
                </select>
            </label>
            <label>
                <span>코드</span>
                <select bind:value={codeFontSize} aria-label="코드 크기">
                    {#each codeSizes as item}
                        <option value={item}>{item}</option>
                    {/each}
                </select>
            </label>
            <label class="switch">
                <input type="checkbox" bind:checked={showLineNumbers} />
                <span>줄번호</span>
            </label>
            <div class="swatches" aria-label="글자색">
                {#each swatches as color}
                    <button
                        class="swatch"
                        type="button"
                        title="글자색"
                        aria-label="글자색"
                        style={`--swatch:${color}`}
                        onclick={() => setTextColor(color)}
                    ></button>
                {/each}
            </div>
        </div>
    </section>

    {#if isMarkdownPanelOpen}
        <section class="markdown-panel" aria-label="Markdown import">
            <textarea
                class="markdown-input"
                bind:value={markdownDraft}
                aria-label="Markdown 원문"
                spellcheck="false"
                placeholder={`# 제목\n\n본문과 [링크](https://example.com)\n\n\`\`\`cpp\nint main() {}\n\`\`\``}
                oninput={() => (markdownImportState = "idle")}
            ></textarea>
            <div class="markdown-actions">
                <button
                    class="markdown-import-button"
                    type="button"
                    aria-label="Markdown 가져오기"
                    onclick={importMarkdownDraft}
                >
                    <FileText size={16} />
                    <span>가져오기</span>
                </button>
                <button
                    class="markdown-clear-button"
                    type="button"
                    aria-label="Markdown 비우기"
                    onclick={clearMarkdownDraft}
                >
                    <Trash2 size={15} />
                    <span>비우기</span>
                </button>
                <span
                    class:error={markdownImportState === "error"}
                    class="markdown-status">{markdownImportStateLabel}</span
                >
            </div>
        </section>
    {/if}

    <section class="preset-panel" aria-label="프리셋">
        <div class="preset-save">
            <label>
                <span><Save size={15} /> 프리셋</span>
                <input
                    type="text"
                    bind:value={presetName}
                    aria-label="프리셋 이름"
                    maxlength="60"
                    placeholder="강의글 구조"
                    oninput={() => (presetState = "idle")}
                    onkeydown={(event) => {
                        if (event.key === "Enter") {
                            event.preventDefault();
                            saveCurrentPreset();
                        }
                    }}
                />
            </label>
            <button
                class="preset-save-button"
                type="button"
                aria-label="프리셋 저장"
                onclick={saveCurrentPreset}
            >
                <Save size={16} />
                <span>저장</span>
            </button>
            <span class:error={presetState === "error"} class="preset-count"
                >{presetStateLabel}</span
            >
        </div>

        <div class="preset-list" aria-label="저장된 프리셋">
            {#if presets.length === 0}
                <span class="preset-empty">프리셋 없음</span>
            {:else}
                {#each presets as preset (preset.id)}
                    <div class="preset-item">
                        <button
                            type="button"
                            class="preset-apply"
                            onclick={() => applyPreset(preset)}
                        >
                            <span>{preset.name}</span>
                            <small
                                >{preset.preferences.documentTheme ===
                                "darkEditorial"
                                    ? "다크"
                                    : "라이트"} · {presetDateLabel(
                                    preset.updatedAt,
                                )}</small
                            >
                        </button>
                        <button
                            type="button"
                            class="preset-delete"
                            aria-label={`${preset.name} 삭제`}
                            title="삭제"
                            onclick={() => deletePreset(preset.id)}
                        >
                            <Trash2 size={15} />
                        </button>
                    </div>
                {/each}
            {/if}
        </div>
    </section>

    <section class="draft-history-panel" aria-label="초안 히스토리">
        <div class="draft-history-save">
            <div class="draft-history-title">
                <History size={15} />
                <span>초안 히스토리</span>
            </div>
            <button
                class="draft-history-save-button"
                type="button"
                aria-label="초안 스냅샷 저장"
                onclick={() => saveDraftHistorySnapshot({ automatic: false })}
            >
                <Save size={16} />
                <span>스냅샷</span>
            </button>
            <span
                class:error={draftHistoryState === "error"}
                class="draft-history-count"
                aria-label="초안 히스토리 개수">{draftHistoryStateLabel}</span
            >
        </div>

        <div class="draft-history-list" aria-label="저장된 초안">
            {#if draftHistory.length === 0}
                <span class="draft-history-empty">초안 없음</span>
            {:else}
                {#each draftHistory as snapshot (snapshot.id)}
                    <div class="draft-history-item">
                        <button
                            type="button"
                            class="draft-history-apply"
                            onclick={() =>
                                restoreDraftHistorySnapshot(snapshot)}
                        >
                            <span
                                >초안 {presetDateLabel(
                                    snapshot.updatedAt,
                                )}</span
                            >
                            <small>{draftHistorySummary(snapshot)}</small>
                        </button>
                        <button
                            type="button"
                            class="draft-history-delete"
                            aria-label={`초안 ${presetDateLabel(snapshot.updatedAt)} 삭제`}
                            title="삭제"
                            onclick={() => deleteDraftHistory(snapshot.id)}
                        >
                            <Trash2 size={15} />
                        </button>
                    </div>
                {/each}
            {/if}
        </div>
    </section>

    <section class="workbench">
        <div class="editor-panel">
            <div class="panel-head">
                <div class="panel-title">
                    <Type size={18} />
                    <span>글쓰기</span>
                </div>
                <span class="counter"
                    >{editor?.getText().length.toLocaleString() ?? 0}자</span
                >
            </div>
            <div
                class="editor-surface"
                class:editor-surface-dark={documentTheme === "darkEditorial"}
                bind:this={editorHost}
            ></div>
        </div>

        <aside class="preview-panel" aria-live="polite">
            <div class="panel-head">
                <div class="panel-title">
                    {#if isRendering}
                        <span class="spin-icon"><Loader2 size={18} /></span>
                    {:else}
                        <Check size={18} />
                    {/if}
                    <span>미리보기</span>
                </div>
                <div class="preview-tools">
                    <span class="status-pill" aria-label="현재 복붙 구조"
                        >{exportStructureLabel}</span
                    >
                    <span class="status-pill" aria-label="현재 문서 테마"
                        >{documentThemeLabel}</span
                    >
                    <div class="mode-switch" aria-label="미리보기 형식">
                        <button
                            class:active={previewMode === "rendered"}
                            type="button"
                            aria-pressed={previewMode === "rendered"}
                            onclick={() => (previewMode = "rendered")}
                        >
                            미리보기
                        </button>
                        <button
                            class:active={previewMode === "source"}
                            type="button"
                            aria-pressed={previewMode === "source"}
                            onclick={() => (previewMode = "source")}
                        >
                            HTML
                        </button>
                    </div>
                    {#if previewMode === "source"}
                        <button
                            class="source-copy-button"
                            type="button"
                            onclick={copySourceHtml}
                            disabled={!html || isRendering}
                        >
                            {#if sourceCopyState === "copied"}
                                <Check size={15} />
                            {:else}
                                <Clipboard size={15} />
                            {/if}
                            <span>{sourceCopyLabel}</span>
                        </button>
                    {/if}
                    <span class="counter">HTML {htmlSize}</span>
                </div>
            </div>

            {#if previewMode === "rendered"}
                <div
                    class="preview-surface"
                    class:preview-surface-dark={documentTheme ===
                        "darkEditorial"}
                >
                    {#if html}
                        {@html html}
                    {:else}
                        <div class="empty">...</div>
                    {/if}
                </div>
            {:else}
                <textarea
                    class="html-source"
                    readonly
                    spellcheck="false"
                    aria-label="복사용 HTML 원문"
                    value={html}
                ></textarea>
            {/if}
        </aside>
    </section>

    {#if copyState === "error"}
        <p class="copy-error">복사가 막혔어. 브라우저 권한을 확인해줘.</p>
    {/if}

    {#if sourceCopyState === "error"}
        <p class="copy-error">
            원문 복사가 막혔어. HTML 원문을 직접 선택해서 복사해줘.
        </p>
    {/if}
</main>

<style>
    .workspace {
        width: min(1560px, calc(100vw - 28px));
        min-height: 100vh;
        margin: 0 auto;
        padding: 22px 0 34px;
    }

    .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        margin-bottom: 16px;
    }

    .eyebrow {
        margin: 0 0 4px;
        color: var(--accent);
        font-size: 13px;
        font-weight: 800;
        text-transform: uppercase;
    }

    h1 {
        margin: 0;
        font-size: clamp(30px, 4vw, 52px);
        line-height: 0.98;
        letter-spacing: 0;
    }

    .copy-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 9px;
        min-width: 136px;
        height: 46px;
        border: 1px solid color-mix(in oklch, var(--accent) 72%, oklch(0% 0 0));
        border-radius: 8px;
        background: var(--accent);
        color: oklch(22.89% 0.055 118.8);
        font-weight: 900;
        cursor: pointer;
    }

    .copy-button:disabled {
        cursor: wait;
        opacity: 0.72;
    }

    .toolbar {
        position: sticky;
        top: 8px;
        z-index: 20;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 9px 10px;
        align-items: stretch;
        max-height: calc(100vh - 16px);
        margin-bottom: 12px;
        overflow: auto;
        overscroll-behavior: contain;
        padding: 10px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: color-mix(in oklch, var(--panel) 98%, oklch(0% 0 0 / 0));
        box-shadow: 0 18px 44px oklch(0% 0 0 / 0.18);
        scrollbar-gutter: stable;
    }

    .tool-group {
        display: flex;
        align-items: center;
        gap: 7px;
        min-width: 0;
        min-height: 44px;
        padding: 6px 10px;
        border: 1px solid color-mix(in oklch, var(--line) 78%, transparent);
        border-radius: 8px;
        background: color-mix(in oklch, var(--panel-2) 46%, transparent);
    }

    .tool-group:last-child {
        border-right: 1px solid
            color-mix(in oklch, var(--line) 78%, transparent);
    }

    .tool-group-wide {
        flex-wrap: wrap;
    }

    .command-group {
        grid-column: 1;
        width: max-content;
    }

    .inline-group {
        grid-column: 2;
        flex-wrap: nowrap;
        justify-content: flex-start;
        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-gutter: stable;
    }

    .link-tool,
    .block-insert-group,
    .code-settings-group,
    .typography-group {
        grid-column: 1 / -1;
    }

    .block-insert-group {
        flex-wrap: nowrap;
        overflow-x: auto;
        overflow-y: hidden;
        padding-bottom: 8px;
        scrollbar-gutter: stable;
    }

    .block-insert-group > * {
        flex: 0 0 auto;
    }

    .toolbar button,
    .toolbar label,
    .switch {
        height: 36px;
        flex: 0 0 auto;
        white-space: nowrap;
    }

    .toolbar button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-width: 36px;
        padding: 0 10px;
        border: 1px solid var(--line);
        border-radius: 7px;
        background: var(--panel-2);
        color: var(--text);
        font-weight: 800;
        cursor: pointer;
    }

    .toolbar :global(svg) {
        flex: 0 0 auto;
    }

    .toolbar button span,
    .toolbar label span,
    .switch span {
        white-space: nowrap;
    }

    .toolbar button.active {
        border-color: var(--accent);
        background: color-mix(in oklch, var(--accent) 22%, var(--panel-2));
        color: var(--accent);
    }

    .toolbar button:disabled {
        cursor: not-allowed;
        opacity: 0.42;
    }

    label {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        color: var(--muted);
        font-size: 13px;
        font-weight: 800;
    }

    label span {
        display: inline-flex;
        align-items: center;
        gap: 5px;
    }

    select {
        height: 36px;
        min-width: 104px;
        border: 1px solid var(--line);
        border-radius: 7px;
        background: var(--panel-2);
        padding: 0 9px;
    }

    input[type="url"] {
        width: min(320px, 48vw);
        height: 36px;
        border: 1px solid var(--line);
        border-radius: 7px;
        background: var(--panel-2);
        color: var(--text);
        padding: 0 10px;
    }

    input[type="url"]:focus {
        border-color: var(--accent);
        outline: none;
    }

    input[type="url"].error {
        border-color: var(--danger);
        background: color-mix(in oklch, var(--danger) 12%, var(--panel-2));
    }

    input[type="text"] {
        width: min(260px, 44vw);
        height: 36px;
        border: 1px solid var(--line);
        border-radius: 7px;
        background: var(--panel-2);
        color: var(--text);
        padding: 0 10px;
    }

    input[type="text"]:focus {
        border-color: var(--accent);
        outline: none;
    }

    .code-filename-input,
    .line-highlight-input {
        width: 170px;
    }

    .link-tool {
        flex-wrap: wrap;
    }

    .switch {
        padding: 0 10px;
        border: 1px solid var(--line);
        border-radius: 7px;
        background: var(--panel-2);
    }

    input[type="checkbox"] {
        width: 16px;
        height: 16px;
        accent-color: var(--accent);
    }

    .swatches {
        display: inline-flex;
        gap: 5px;
    }

    .toolbar .swatch {
        min-width: 24px;
        width: 24px;
        height: 24px;
        border-radius: 999px;
        background: var(--swatch);
    }

    .markdown-panel {
        display: grid;
        gap: 10px;
        margin-bottom: 12px;
        padding: 10px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: color-mix(in oklch, var(--panel) 88%, transparent);
    }

    .markdown-input {
        width: 100%;
        min-height: 220px;
        resize: vertical;
        border: 1px solid var(--line);
        border-radius: 7px;
        background: oklch(15.78% 0.014 257.58);
        color: oklch(92.14% 0.017 247.64);
        padding: 12px;
        font-family:
            Cascadia Mono,
            Cascadia Code,
            Cascadia Mono PL,
            Cascadia Code PL,
            D2Coding,
            D2Coding ligature,
            D2CodingLigature,
            나눔고딕코딩,
            NanumGothicCoding,
            Nanum Gothic Coding,
            Noto Sans Mono CJK KR,
            Noto Sans Mono CJK,
            Noto Sans Mono,
            Source Han Mono K,
            Source Han Mono KR,
            Sarasa Mono K,
            Sarasa Gothic K,
            JetBrains Mono,
            Fira Code,
            Fira Mono,
            Hack,
            Source Code Pro,
            IBM Plex Mono,
            Roboto Mono,
            Iosevka,
            Iosevka Fixed,
            Monaspace Neon,
            Monaspace Argon,
            DejaVu Sans Mono,
            Liberation Mono,
            Ubuntu Mono,
            Bitstream Vera Sans Mono,
            Consolas,
            SFMono-Regular,
            Menlo,
            Monaco,
            Lucida Console,
            Courier New,
            monospace;
        font-size: 13px;
        line-height: 1.6;
        outline: none;
    }

    .markdown-input:focus {
        border-color: var(--accent);
    }

    .markdown-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
    }

    .markdown-import-button,
    .markdown-clear-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        height: 34px;
        border: 1px solid var(--line);
        border-radius: 7px;
        background: var(--panel-2);
        color: var(--text);
        font-weight: 850;
        cursor: pointer;
        white-space: nowrap;
    }

    .markdown-import-button {
        border-color: color-mix(in oklch, var(--accent) 66%, var(--line));
        background: color-mix(in oklch, var(--accent) 18%, var(--panel-2));
        color: var(--accent);
    }

    .markdown-clear-button:hover {
        color: var(--danger);
    }

    .markdown-status {
        color: var(--muted);
        font-size: 12px;
        font-weight: 850;
        white-space: nowrap;
    }

    .markdown-status.error {
        color: var(--danger);
    }

    .preset-panel,
    .draft-history-panel {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
        margin-bottom: 12px;
        padding: 10px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: color-mix(in oklch, var(--panel) 88%, transparent);
    }

    .preset-save,
    .draft-history-save {
        display: flex;
        flex: 0 1 auto;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        min-width: 0;
    }

    .draft-history-title {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: var(--muted);
        font-size: 13px;
        font-weight: 850;
        white-space: nowrap;
    }

    .preset-save-button,
    .draft-history-save-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        height: 34px;
        border: 1px solid color-mix(in oklch, var(--accent) 66%, var(--line));
        border-radius: 7px;
        background: color-mix(in oklch, var(--accent) 18%, var(--panel-2));
        color: var(--accent);
        font-weight: 850;
        cursor: pointer;
        white-space: nowrap;
    }

    .preset-count,
    .draft-history-count {
        color: var(--muted);
        font-size: 12px;
        font-weight: 850;
        white-space: nowrap;
    }

    .preset-count.error,
    .draft-history-count.error {
        color: var(--danger);
    }

    .preset-list,
    .draft-history-list {
        display: flex;
        flex: 1 1 360px;
        gap: 8px;
        min-width: 0;
        overflow-x: auto;
        padding-bottom: 1px;
        scrollbar-gutter: stable;
    }

    .preset-empty,
    .draft-history-empty {
        display: inline-flex;
        align-items: center;
        min-height: 34px;
        color: var(--muted);
        font-size: 13px;
        font-weight: 800;
    }

    .preset-item,
    .draft-history-item {
        display: inline-flex;
        align-items: stretch;
        flex: 0 0 auto;
        max-width: 250px;
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 7px;
        background: var(--panel-2);
    }

    .preset-apply,
    .draft-history-apply {
        display: grid;
        gap: 2px;
        min-width: 150px;
        max-width: 210px;
        border: 0;
        border-right: 1px solid var(--line);
        background: transparent;
        color: var(--text);
        padding: 7px 10px;
        text-align: left;
        cursor: pointer;
    }

    .preset-apply span,
    .preset-apply small,
    .draft-history-apply span,
    .draft-history-apply small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .preset-apply span,
    .draft-history-apply span {
        font-size: 13px;
        font-weight: 900;
    }

    .preset-apply small,
    .draft-history-apply small {
        color: var(--muted);
        font-size: 11px;
        font-weight: 750;
    }

    .preset-delete,
    .draft-history-delete {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        border: 0;
        background: transparent;
        color: var(--muted);
        cursor: pointer;
    }

    .preset-delete:hover,
    .draft-history-delete:hover {
        color: var(--danger);
    }

    .workbench {
        display: grid;
        grid-template-columns: minmax(0, 1.08fr) minmax(420px, 0.92fr);
        gap: 12px;
        align-items: stretch;
    }

    .editor-panel,
    .preview-panel {
        min-width: 0;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: color-mix(in oklch, var(--panel) 90%, transparent);
        box-shadow: 0 20px 70px oklch(0% 0 0 / 0.16);
    }

    .panel-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        min-height: 48px;
        padding: 0 14px;
        border-bottom: 1px solid var(--line);
    }

    .panel-title {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-weight: 850;
    }

    .counter {
        color: var(--muted);
        font-size: 13px;
        font-weight: 700;
    }

    .status-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 28px;
        padding: 0 9px;
        border: 1px solid color-mix(in oklch, var(--accent-2) 46%, var(--line));
        border-radius: 999px;
        background: color-mix(in oklch, var(--accent-2) 13%, var(--panel-2));
        color: color-mix(in oklch, var(--accent-2) 70%, var(--text));
        font-size: 12px;
        font-weight: 850;
        white-space: nowrap;
    }

    .preview-tools {
        display: inline-flex;
        align-items: center;
        justify-content: flex-end;
        gap: 10px;
        min-width: 0;
    }

    .mode-switch {
        display: inline-grid;
        grid-template-columns: repeat(2, minmax(74px, 1fr));
        height: 32px;
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 7px;
        background: var(--panel-2);
    }

    .mode-switch button {
        border: 0;
        border-right: 1px solid var(--line);
        background: transparent;
        color: var(--muted);
        font-size: 13px;
        font-weight: 850;
        cursor: pointer;
    }

    .mode-switch button:last-child {
        border-right: 0;
    }

    .mode-switch button.active {
        background: color-mix(in oklch, var(--accent) 18%, transparent);
        color: var(--accent);
    }

    .source-copy-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        height: 32px;
        border: 1px solid var(--line);
        border-radius: 7px;
        background: var(--panel-2);
        color: var(--text);
        font-size: 13px;
        font-weight: 850;
        cursor: pointer;
        white-space: nowrap;
    }

    .source-copy-button:disabled {
        cursor: wait;
        opacity: 0.66;
    }

    .editor-surface {
        min-height: 680px;
        padding: 18px;
        background: oklch(97.12% 0.012 97.41);
        color: oklch(21.18% 0.012 255.31);
    }

    .editor-surface-dark {
        background: oklch(7.2% 0.012 94.1);
        color: oklch(94.12% 0.012 93.37);
    }

    .editor-surface :global(.article-editor) {
        min-height: 640px;
        outline: none;
        font-family:
            Pretendard,
            Noto Sans KR,
            Noto Sans CJK KR,
            SUIT,
            Wanted Sans,
            Spoqa Han Sans Neo,
            Spoqa Han Sans,
            Source Han Sans K,
            Source Han Sans KR,
            본고딕,
            Nanum Gothic,
            NanumGothic,
            NanumSquare,
            NanumSquare Neo,
            NanumBarunGothic,
            나눔고딕,
            나눔스퀘어,
            나눔바른고딕,
            IBM Plex Sans KR,
            Gmarket Sans,
            Arial Unicode MS,
            Apple SD Gothic Neo,
            AppleGothic,
            Segoe UI,
            Malgun Gothic,
            맑은 고딕,
            Noto Sans,
            Arial,
            Helvetica Neue,
            Helvetica,
            sans-serif;
        font-size: 15px;
        line-height: 1.7;
    }

    .editor-surface :global(.article-editor > *:first-child) {
        margin-top: 0;
    }

    .editor-surface :global(.article-editor h1) {
        margin: 0 0 14px;
        color: oklch(24.19% 0.019 255.77);
        font-size: 28px;
        line-height: 1.22;
    }

    .editor-surface-dark :global(.article-editor h1) {
        color: oklch(98.32% 0.006 93.08);
    }

    .editor-surface :global(.article-editor p) {
        margin: 0 0 14px;
    }

    .editor-surface-dark :global(.article-editor a) {
        color: oklch(83.57% 0.141 84.66);
    }

    .editor-surface :global(.article-editor pre) {
        margin: 0 0 16px;
        overflow: auto;
        border-radius: 7px;
        background: oklch(18.22% 0.017 258.21);
        color: oklch(90.2% 0.018 258.33);
        padding: 14px 16px;
        line-height: 1.4;
        font-family:
            Cascadia Mono,
            Cascadia Code,
            Cascadia Mono PL,
            Cascadia Code PL,
            D2Coding,
            D2Coding ligature,
            D2CodingLigature,
            나눔고딕코딩,
            NanumGothicCoding,
            Nanum Gothic Coding,
            Noto Sans Mono CJK KR,
            Noto Sans Mono CJK,
            Noto Sans Mono,
            Source Han Mono K,
            Source Han Mono KR,
            Sarasa Mono K,
            Sarasa Gothic K,
            JetBrains Mono,
            Fira Code,
            Fira Mono,
            Hack,
            Source Code Pro,
            IBM Plex Mono,
            Roboto Mono,
            Iosevka,
            Iosevka Fixed,
            Monaspace Neon,
            Monaspace Argon,
            DejaVu Sans Mono,
            Liberation Mono,
            Ubuntu Mono,
            Bitstream Vera Sans Mono,
            Consolas,
            SFMono-Regular,
            Menlo,
            Monaco,
            Lucida Console,
            Courier New,
            monospace;
    }

    .editor-surface :global(.article-editor pre code) {
        font-family: inherit;
    }

    .editor-surface :global(.article-editor :not(pre) > code) {
        border-radius: 4px;
        background: oklch(94.93% 0.016 255.07);
        color: oklch(34.86% 0.087 278.64);
        font-family:
            Cascadia Mono,
            Cascadia Code,
            Cascadia Mono PL,
            Cascadia Code PL,
            D2Coding,
            D2Coding ligature,
            D2CodingLigature,
            나눔고딕코딩,
            NanumGothicCoding,
            Nanum Gothic Coding,
            Noto Sans Mono CJK KR,
            Noto Sans Mono CJK,
            Noto Sans Mono,
            Source Han Mono K,
            Source Han Mono KR,
            Sarasa Mono K,
            Sarasa Gothic K,
            JetBrains Mono,
            Fira Code,
            Fira Mono,
            Hack,
            Source Code Pro,
            IBM Plex Mono,
            Roboto Mono,
            Iosevka,
            Iosevka Fixed,
            Monaspace Neon,
            Monaspace Argon,
            DejaVu Sans Mono,
            Liberation Mono,
            Ubuntu Mono,
            Bitstream Vera Sans Mono,
            Consolas,
            SFMono-Regular,
            Menlo,
            Monaco,
            Lucida Console,
            Courier New,
            monospace;
        padding: 1px 4px;
    }

    .editor-surface-dark :global(.article-editor :not(pre) > code) {
        background: oklch(18.92% 0.02 83.18);
        color: oklch(96.51% 0.015 91.73);
    }

    .editor-surface :global(.article-editor blockquote) {
        position: relative;
        margin: 0 0 18px;
        padding: 13px 16px 13px 48px;
        border-left: 3px solid oklch(61.2% 0.049 77.83);
        border-top: 1px solid oklch(61.2% 0.049 77.83);
        border-bottom: 1px solid oklch(61.2% 0.049 77.83);
        color: oklch(37.24% 0.026 77.36);
        font-style: italic;
    }

    .editor-surface
        :global(.article-editor blockquote[data-quote-style="academic"]) {
        padding: 12px 16px;
        border-left: 4px solid oklch(61.2% 0.049 77.83);
        border-top: 1px solid oklch(83.11% 0.026 78.4);
        border-bottom: 1px solid oklch(83.11% 0.026 78.4);
        color: oklch(37.24% 0.026 77.36);
        font-style: normal;
    }

    .editor-surface
        :global(
            .article-editor blockquote[data-quote-style="academic"]::before
        ) {
        position: static;
        display: block;
        margin: 0 0 7px;
        color: oklch(43.22% 0.022 255.32);
        content: "QUOTE";
        font-size: 12px;
        font-weight: 900;
        line-height: 1.2;
    }

    .editor-surface
        :global(.article-editor blockquote[data-quote-style="pull"]) {
        margin: 20px 0;
        padding: 18px 20px;
        border: 0;
        border-top: 1px solid oklch(86.22% 0.014 255.48);
        border-bottom: 1px solid oklch(86.22% 0.014 255.48);
        color: oklch(24.19% 0.019 255.77);
        font-size: 21px;
        font-style: normal;
        font-weight: 900;
        line-height: 1.48;
        text-align: center;
    }

    .editor-surface
        :global(.article-editor blockquote[data-quote-style="pull"]::before) {
        display: none;
    }

    .editor-surface
        :global(.article-editor blockquote[data-quote-style="bigQuote"]) {
        padding: 18px 18px 16px;
        border: 1px solid oklch(61.2% 0.049 77.83);
        border-left: 4px solid oklch(61.2% 0.049 77.83);
        background: oklch(98.38% 0.01 97.33);
    }

    .editor-surface
        :global(
            .article-editor blockquote[data-quote-style="bigQuote"]::before
        ) {
        position: static;
        display: block;
        margin: 0 0 4px;
        font-size: 56px;
        line-height: 0.82;
    }

    .editor-surface-dark
        :global(.article-editor blockquote[data-quote-style="academic"]) {
        border-left-color: oklch(84.08% 0.11 84.51);
        border-top-color: oklch(35.04% 0.033 84.06);
        border-bottom-color: oklch(35.04% 0.033 84.06);
        color: oklch(87.91% 0.018 86.38);
    }

    .editor-surface-dark
        :global(
            .article-editor blockquote[data-quote-style="academic"]::before
        ) {
        color: oklch(71.26% 0.021 84.88);
    }

    .editor-surface-dark
        :global(.article-editor blockquote[data-quote-style="pull"]) {
        border-top-color: oklch(34.91% 0.033 83.29);
        border-bottom-color: oklch(34.91% 0.033 83.29);
        color: oklch(98.32% 0.006 93.08);
    }

    .editor-surface-dark
        :global(.article-editor blockquote[data-quote-style="bigQuote"]) {
        border-color: oklch(84.08% 0.11 84.51);
        border-left-color: oklch(84.08% 0.11 84.51);
        background: oklch(9.76% 0.011 94.84);
    }

    .editor-surface :global(.article-editor blockquote::before) {
        position: absolute;
        top: 10px;
        left: 16px;
        color: oklch(74.61% 0.063 77.91);
        content: "“";
        font-size: 34px;
        font-style: normal;
        font-weight: 900;
        line-height: 1;
    }

    .editor-surface :global(.article-editor blockquote p) {
        margin: 0 0 8px;
        color: inherit;
    }

    .editor-surface :global(.article-editor blockquote > *:last-child) {
        margin-bottom: 0;
    }

    .editor-surface :global(.dc-section-heading) {
        margin: 24px 0 14px;
        padding: 4px 0 4px 14px;
        border-left: 4px solid oklch(61.2% 0.049 77.83);
        color: oklch(25.72% 0.021 255.63);
        font-size: 20px;
        font-weight: 900;
        line-height: 1.35;
    }

    .editor-surface-dark :global(.dc-section-heading) {
        border-left-color: oklch(88.91% 0.091 87.72);
        color: oklch(97.22% 0.008 92.87);
    }

    .editor-surface :global(.article-editor .dc-cta-button) {
        display: inline-block;
        margin: 0 10px 16px 0;
        padding: 11px 22px;
        border: 1px solid oklch(70.74% 0.08 82.27);
        background: oklch(93.5% 0.044 88.16);
        color: oklch(26.32% 0.03 80.84);
        font-weight: 900;
        line-height: 1.2;
        text-decoration: none;
    }

    .editor-surface-dark :global(.article-editor .dc-cta-button) {
        border-color: oklch(96.28% 0.022 90.84);
        background: oklch(91.44% 0.064 90.52);
        color: oklch(13.77% 0.018 87.82);
    }

    .editor-surface :global(.article-editor .dc-cta-group) {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        margin: 0 0 16px;
    }

    .editor-surface
        :global(.article-editor .dc-cta-group[data-layout="vertical"]) {
        align-items: flex-start;
        flex-direction: column;
    }

    .editor-surface :global(.article-editor .dc-cta-group .dc-cta-button) {
        margin: 0;
    }

    .editor-surface :global(.dc-reference-list) {
        margin: 0 0 16px;
        padding: 0;
        overflow: hidden;
        border: 1px solid oklch(78.06% 0.088 247.23);
        border-left: 4px solid oklch(56.77% 0.154 252.96);
        border-radius: 7px;
        background: oklch(97.5% 0.025 247.64);
        color: oklch(28.43% 0.052 249.88);
        list-style: none;
    }

    .editor-surface :global(.dc-reference-item) {
        display: grid;
        grid-template-columns: 34px minmax(0, 1fr);
        gap: 10px;
        margin: 0;
        padding: 11px 14px 11px 12px;
        border-bottom: 1px solid oklch(88.91% 0.035 247.16);
        line-height: 1.62;
    }

    .editor-surface :global(.dc-reference-item:last-child) {
        border-bottom: 0;
    }

    .editor-surface :global(.dc-reference-item::before) {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 26px;
        height: 18px;
        border-radius: 999px;
        background: oklch(56.77% 0.154 252.96);
        color: oklch(99.21% 0.006 247.8);
        content: counter(list-item, decimal-leading-zero);
        font-size: 11px;
        font-weight: 900;
        line-height: 1;
    }

    .editor-surface-dark :global(.dc-reference-list) {
        border-color: oklch(34.06% 0.044 236.72);
        border-left-color: oklch(74.22% 0.14 232.34);
        background: oklch(9.8% 0.014 94.7);
        color: oklch(91.87% 0.029 233.82);
    }

    .editor-surface-dark :global(.dc-reference-item) {
        border-bottom-color: oklch(24.21% 0.025 236.68);
    }

    .editor-surface-dark :global(.dc-reference-item::before) {
        background: oklch(74.22% 0.14 232.34);
        color: oklch(8.61% 0.019 237.62);
    }

    .editor-surface :global(.dc-summary-box) {
        margin: 0 0 18px;
        padding: 14px 16px;
        border: 1px solid oklch(84.22% 0.041 88.36);
        border-top: 4px solid oklch(61.2% 0.049 77.83);
        border-radius: 7px;
        background: oklch(97.68% 0.02 91.92);
        color: oklch(25.72% 0.021 255.63);
    }

    .editor-surface :global(.dc-summary-box::before) {
        display: block;
        margin: 0 0 9px;
        color: oklch(36.42% 0.042 78.12);
        content: "핵심 요약";
        font-size: 12px;
        font-weight: 900;
        line-height: 1.2;
    }

    .editor-surface :global(.dc-summary-list) {
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .editor-surface :global(.dc-summary-item) {
        display: grid;
        grid-template-columns: 22px minmax(0, 1fr);
        gap: 0;
        margin: 0 0 7px;
        line-height: 1.62;
        list-style: none;
    }

    .editor-surface :global(.dc-summary-item:last-child) {
        margin-bottom: 0;
    }

    .editor-surface :global(.dc-summary-item::before) {
        width: 8px;
        height: 8px;
        margin-top: 8px;
        border-radius: 999px;
        background: oklch(61.2% 0.049 77.83);
        content: "";
    }

    .editor-surface-dark :global(.dc-summary-box) {
        border-color: oklch(36.21% 0.032 84.68);
        border-top-color: oklch(84.08% 0.11 84.51);
        background: oklch(10.18% 0.015 94.76);
        color: oklch(94.12% 0.012 93.37);
    }

    .editor-surface-dark :global(.dc-summary-box::before) {
        color: oklch(88.91% 0.091 87.72);
    }

    .editor-surface-dark :global(.dc-summary-item::before) {
        background: oklch(84.08% 0.11 84.51);
    }

    .editor-surface :global(.dc-hero-block) {
        margin: 0 0 22px;
        padding: 22px 24px;
        border: 1px solid oklch(84.22% 0.041 88.36);
        border-top: 4px solid oklch(61.2% 0.049 77.83);
        background: oklch(97.68% 0.02 91.92);
        color: oklch(24.19% 0.019 255.77);
    }

    .editor-surface :global(.dc-hero-rule) {
        display: none;
    }

    .editor-surface :global(.dc-hero-label) {
        display: block;
        margin: 0 0 16px;
        color: oklch(45.61% 0.026 79.44);
        font-size: 12px;
        font-weight: 900;
        line-height: 1.2;
    }

    .editor-surface :global(.dc-hero-body h1) {
        margin: 0 0 12px;
        color: oklch(24.19% 0.019 255.77);
        font-size: 30px;
        font-weight: 900;
        line-height: 1.22;
    }

    .editor-surface :global(.dc-hero-body p) {
        margin: 0;
        color: oklch(43.22% 0.022 255.32);
        font-size: 17px;
        font-weight: 700;
        line-height: 1.62;
    }

    .editor-surface-dark :global(.dc-hero-block) {
        border-color: oklch(28.12% 0.03 83.2);
        border-top-color: oklch(84.08% 0.11 84.51);
        background: oklch(6.62% 0.012 94.34);
        color: oklch(98.32% 0.006 93.08);
    }

    .editor-surface-dark :global(.dc-hero-label) {
        color: oklch(84.08% 0.11 84.51);
    }

    .editor-surface-dark :global(.dc-hero-body h1) {
        color: oklch(98.32% 0.006 93.08);
    }

    .editor-surface-dark :global(.dc-hero-body p) {
        color: oklch(78.72% 0.023 86.9);
    }

    .editor-surface :global(.dc-tutorial-block) {
        counter-reset: dc-tutorial-step;
        display: grid;
        gap: 12px;
        margin: 0 0 18px;
    }

    .editor-surface :global(.dc-tutorial-step) {
        counter-increment: dc-tutorial-step;
        padding: 14px 16px;
        border: 1px solid oklch(85.31% 0.027 84.92);
        border-left: 4px solid oklch(61.2% 0.049 77.83);
        border-radius: 7px;
        background: oklch(99.1% 0.009 93.08);
        color: oklch(31.82% 0.02 255.28);
    }

    .editor-surface :global(.dc-tutorial-head) {
        display: grid;
        grid-template-columns: 42px minmax(0, 1fr);
        gap: 0;
        align-items: center;
        margin: 0 0 8px;
    }

    .editor-surface :global(.dc-tutorial-number::before) {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 30px;
        min-height: 22px;
        border-radius: 999px;
        background: oklch(61.2% 0.049 77.83);
        color: oklch(99.1% 0.006 93.08);
        content: counter(dc-tutorial-step, decimal-leading-zero);
        font-size: 12px;
        font-weight: 900;
        line-height: 1.1;
    }

    .editor-surface :global(.dc-tutorial-title) {
        color: oklch(25.72% 0.021 255.63);
        font-size: 18px;
        font-weight: 900;
        line-height: 1.32;
    }

    .editor-surface :global(.dc-tutorial-body) {
        padding-left: 42px;
    }

    .editor-surface :global(.dc-tutorial-body > *:last-child) {
        margin-bottom: 0;
    }

    .editor-surface-dark :global(.dc-tutorial-step) {
        border-color: oklch(34.91% 0.033 83.29);
        border-left-color: oklch(84.08% 0.11 84.51);
        background: oklch(12.04% 0.017 94.12);
        color: oklch(88.62% 0.016 91.83);
    }

    .editor-surface-dark :global(.dc-tutorial-number::before) {
        background: oklch(84.08% 0.11 84.51);
        color: oklch(10.18% 0.015 94.76);
    }

    .editor-surface-dark :global(.dc-tutorial-title) {
        color: oklch(97.22% 0.008 92.87);
    }

    .editor-surface :global(.dc-comparison-block) {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin: 0 0 18px;
    }

    .editor-surface :global(.dc-comparison-column) {
        min-width: 0;
        padding: 13px 15px;
        border: 1px solid oklch(85.31% 0.027 84.92);
        border-left: 4px solid oklch(62.42% 0.178 24.04);
        border-radius: 7px;
        background: oklch(97.18% 0.032 24.18);
        color: oklch(31.82% 0.02 255.28);
    }

    .editor-surface :global(.dc-comparison-column[data-side="right"]) {
        border-left-color: oklch(66.42% 0.152 154.12);
        background: oklch(96.78% 0.033 154.76);
    }

    .editor-surface :global(.dc-comparison-title) {
        display: block;
        margin: 0 0 8px;
        color: oklch(34.1% 0.098 24.62);
        font-size: 12px;
        font-weight: 900;
        line-height: 1.2;
    }

    .editor-surface
        :global(.dc-comparison-column[data-side="right"] .dc-comparison-title) {
        color: oklch(29.24% 0.08 154.12);
    }

    .editor-surface :global(.dc-comparison-body > *:last-child) {
        margin-bottom: 0;
    }

    .editor-surface-dark :global(.dc-comparison-column) {
        border-color: oklch(31.22% 0.028 84.54);
        border-left-color: oklch(75.02% 0.17 24.82);
        background: oklch(13.02% 0.026 24.58);
        color: oklch(91.88% 0.016 91.83);
    }

    .editor-surface-dark :global(.dc-comparison-column[data-side="right"]) {
        border-left-color: oklch(76.71% 0.151 154.54);
        background: oklch(12.42% 0.022 154.8);
    }

    .editor-surface-dark :global(.dc-comparison-title) {
        color: oklch(93.14% 0.03 24.92);
    }

    .editor-surface-dark
        :global(.dc-comparison-column[data-side="right"] .dc-comparison-title) {
        color: oklch(92.34% 0.029 154.17);
    }

    .editor-surface :global(.dc-callout) {
        margin: 0 0 16px;
        padding: 12px 14px;
        border-radius: 7px;
    }

    .editor-surface :global(.dc-callout-tip) {
        border-left: 4px solid oklch(70.89% 0.156 142.5);
        background: oklch(96.48% 0.047 142.49);
        color: oklch(30.18% 0.073 145.31);
    }

    .editor-surface-dark :global(.dc-callout-tip) {
        border-left-color: oklch(76.13% 0.153 142.04);
        background: oklch(11.88% 0.018 142.78);
        color: oklch(91.89% 0.026 143.2);
    }

    .editor-surface :global(.dc-callout-warning) {
        border-left: 4px solid oklch(73.08% 0.151 60.74);
        background: oklch(96.87% 0.048 75.17);
        color: oklch(34.21% 0.082 52.58);
    }

    .editor-surface-dark :global(.dc-callout-warning) {
        border-left-color: oklch(78.46% 0.145 69.41);
        background: oklch(12.26% 0.018 58.76);
        color: oklch(92.96% 0.03 76.33);
    }

    .editor-surface :global(.dc-callout-reference) {
        border-left: 4px solid oklch(68.74% 0.127 246.28);
        background: oklch(96.27% 0.036 247.39);
        color: oklch(32.26% 0.07 249.42);
    }

    .editor-surface-dark :global(.dc-callout-reference) {
        border-left-color: oklch(72.52% 0.142 232.16);
        background: oklch(11.62% 0.021 245.9);
        color: oklch(91.87% 0.029 233.82);
    }

    .editor-surface :global(.dc-callout-emphasis) {
        border-left: 4px solid oklch(64.73% 0.162 303.08);
        background: oklch(96.21% 0.036 302.35);
        color: oklch(33.84% 0.091 303.69);
    }

    .editor-surface-dark :global(.dc-callout-emphasis) {
        border-left-color: oklch(73.79% 0.151 303.45);
        background: oklch(12.04% 0.022 302.17);
        color: oklch(93.04% 0.029 303.2);
    }

    .editor-surface :global(.dc-callout-success) {
        border-left: 4px solid oklch(66.42% 0.152 154.12);
        background: oklch(96.12% 0.041 152.76);
        color: oklch(29.24% 0.08 154.12);
    }

    .editor-surface-dark :global(.dc-callout-success) {
        border-left-color: oklch(76.71% 0.151 154.54);
        background: oklch(11.76% 0.02 154.8);
        color: oklch(92.34% 0.029 154.17);
    }

    .editor-surface :global(.dc-callout-failure) {
        border-left: 4px solid oklch(62.42% 0.178 24.04);
        background: oklch(96.23% 0.039 24.18);
        color: oklch(34.1% 0.098 24.62);
    }

    .editor-surface-dark :global(.dc-callout-failure) {
        border-left-color: oklch(75.02% 0.17 24.82);
        background: oklch(12.02% 0.021 24.58);
        color: oklch(93.14% 0.03 24.92);
    }

    .editor-surface :global(.dc-callout-experiment) {
        border-left: 4px solid oklch(62.11% 0.15 263.9);
        background: oklch(96.2% 0.032 264.42);
        color: oklch(31.56% 0.081 264.1);
    }

    .editor-surface-dark :global(.dc-callout-experiment) {
        border-left-color: oklch(73.44% 0.145 264.2);
        background: oklch(11.48% 0.022 264.32);
        color: oklch(92.52% 0.031 264.14);
    }

    .editor-surface :global(.dc-callout-conclusion) {
        border-left: 4px solid oklch(72.44% 0.119 91.73);
        background: oklch(96.87% 0.042 94.2);
        color: oklch(34.5% 0.065 88.3);
    }

    .editor-surface-dark :global(.dc-callout-conclusion) {
        border-left-color: oklch(80.18% 0.126 91.43);
        background: oklch(12.18% 0.018 91.22);
        color: oklch(93.56% 0.027 91.42);
    }

    .editor-surface :global(.dc-callout-rebuttal) {
        border-left: 4px solid oklch(64.8% 0.157 330.2);
        background: oklch(96.1% 0.038 330.12);
        color: oklch(34.4% 0.096 329.55);
    }

    .editor-surface-dark :global(.dc-callout-rebuttal) {
        border-left-color: oklch(75.91% 0.154 330.36);
        background: oklch(12.11% 0.023 330.24);
        color: oklch(93.11% 0.031 330.24);
    }

    .editor-surface :global(.dc-link-box) {
        margin: 0 0 16px;
        padding: 12px 14px;
        border: 1px solid oklch(78.06% 0.088 247.23);
        border-left: 4px solid oklch(56.77% 0.154 252.96);
        border-radius: 7px;
        background: oklch(97.5% 0.025 247.64);
        color: oklch(28.43% 0.052 249.88);
    }

    .editor-surface-dark :global(.dc-link-box) {
        border-color: oklch(34.06% 0.044 236.72);
        border-left-color: oklch(74.22% 0.14 232.34);
        background: oklch(10.35% 0.015 93.61);
        color: oklch(90.9% 0.024 237.46);
    }

    .preview-surface {
        min-height: 680px;
        padding: 18px;
        overflow: auto;
        background: oklch(98.38% 0.01 97.33);
    }

    .preview-surface-dark {
        background: oklch(7.2% 0.012 94.1);
    }

    .html-source {
        display: block;
        width: 100%;
        min-height: 680px;
        resize: vertical;
        border: 0;
        border-radius: 0 0 8px 8px;
        background: oklch(17.93% 0.016 257.1);
        color: oklch(91.18% 0.019 247.75);
        padding: 18px;
        font-family:
            Cascadia Mono,
            Cascadia Code,
            Cascadia Mono PL,
            Cascadia Code PL,
            D2Coding,
            D2Coding ligature,
            D2CodingLigature,
            나눔고딕코딩,
            NanumGothicCoding,
            Nanum Gothic Coding,
            Noto Sans Mono CJK KR,
            Noto Sans Mono CJK,
            Noto Sans Mono,
            Source Han Mono K,
            Source Han Mono KR,
            Sarasa Mono K,
            Sarasa Gothic K,
            JetBrains Mono,
            Fira Code,
            Fira Mono,
            Hack,
            Source Code Pro,
            IBM Plex Mono,
            Roboto Mono,
            Iosevka,
            Iosevka Fixed,
            Monaspace Neon,
            Monaspace Argon,
            DejaVu Sans Mono,
            Liberation Mono,
            Ubuntu Mono,
            Bitstream Vera Sans Mono,
            Consolas,
            SFMono-Regular,
            Menlo,
            Monaco,
            Lucida Console,
            Courier New,
            monospace;
        font-size: 13px;
        line-height: 1.6;
        outline: none;
        white-space: pre;
    }

    .preview-surface :global(pre) {
        max-width: 100%;
    }

    .empty {
        color: oklch(51.52% 0.02 87.11);
        font-family:
            Cascadia Mono,
            Cascadia Code,
            Cascadia Mono PL,
            Cascadia Code PL,
            D2Coding,
            D2Coding ligature,
            D2CodingLigature,
            나눔고딕코딩,
            NanumGothicCoding,
            Nanum Gothic Coding,
            Noto Sans Mono CJK KR,
            Noto Sans Mono CJK,
            Noto Sans Mono,
            Source Han Mono K,
            Source Han Mono KR,
            Sarasa Mono K,
            Sarasa Gothic K,
            JetBrains Mono,
            Fira Code,
            Fira Mono,
            Hack,
            Source Code Pro,
            IBM Plex Mono,
            Roboto Mono,
            Iosevka,
            Iosevka Fixed,
            Monaspace Neon,
            Monaspace Argon,
            DejaVu Sans Mono,
            Liberation Mono,
            Ubuntu Mono,
            Bitstream Vera Sans Mono,
            Consolas,
            SFMono-Regular,
            Menlo,
            Monaco,
            Lucida Console,
            Courier New,
            monospace;
    }

    .copy-error {
        margin: 14px 0 0;
        color: var(--danger);
        font-weight: 800;
    }

    .spin-icon {
        display: inline-flex;
        animation: spin 0.85s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    @media (max-width: 1120px) {
        .workbench {
            grid-template-columns: 1fr;
        }

        .editor-surface :global(.dc-comparison-block) {
            grid-template-columns: 1fr;
        }

        .preview-panel {
            min-width: 0;
        }
    }

    @media (max-width: 720px) {
        .workspace {
            width: min(100vw - 18px, 720px);
            padding-top: 16px;
        }

        .topbar {
            align-items: flex-start;
            flex-direction: column;
        }

        .copy-button {
            width: 100%;
        }

        .toolbar {
            grid-template-columns: minmax(0, 1fr);
        }

        .command-group,
        .inline-group,
        .link-tool,
        .block-insert-group,
        .code-settings-group,
        .typography-group {
            grid-column: 1;
            width: 100%;
        }

        .tool-group {
            width: 100%;
            border-right: 1px solid
                color-mix(in oklch, var(--line) 78%, transparent);
        }

        .tool-group:last-child {
            padding-bottom: 6px;
        }

        .preset-save,
        .draft-history-save {
            width: 100%;
        }

        .preset-list,
        .draft-history-list {
            flex-basis: 100%;
        }

        .editor-surface,
        .preview-surface,
        .html-source {
            min-height: 460px;
        }

        .panel-head {
            align-items: flex-start;
            flex-direction: column;
            padding: 11px 14px;
        }

        .preview-tools {
            width: 100%;
            flex-wrap: wrap;
            justify-content: space-between;
        }

        .editor-surface :global(.article-editor) {
            min-height: 420px;
        }
    }
</style>
