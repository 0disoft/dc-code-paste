<script lang="ts">
    import {
        Bold,
        BookOpen,
        Check,
        Clipboard,
        Code2,
        FileText,
        Github,
        Heading1,
        Highlighter,
        History,
        Italic,
        LayoutTemplate,
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
        X,
    } from "lucide-svelte";
    import { onDestroy, onMount } from "svelte";
    import type { Editor, JSONContent } from "@tiptap/core";
    import type { Node as ProseMirrorNode, ResolvedPos } from "@tiptap/pm/model";
    import type { EditorView } from "@tiptap/pm/view";
    import { copyDcHtml, copyPlainText } from "$lib/dc/clipboard";
    import { defaultProseFontFamily } from "$lib/dc/font-stacks";
    import { sanitizeReadableTextColor } from "$lib/dc/sanitize-style";
    import {
        exportDocumentToDcHtml,
        type DcDocumentTheme,
        type DcExportOptions,
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
        calloutKindFromNodeName,
        calloutNodeNameByKind,
        defaultCalloutLabel,
        isCalloutNodeName,
        calloutNodeNames,
        type CalloutKind,
    } from "$lib/editor/callout";
    import {
        defaultCalloutToneColor,
        defaultCalloutToneColors,
        normalizeCalloutToneColor,
    } from "$lib/editor/callout-palette";
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
        renameDraftHistorySnapshot,
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
        defaultSummaryBoxLabel,
    } from "$lib/editor/summary-box";
    import {
        createDefaultTutorialBlock,
        createTutorialStep,
        createTutorialBlockFromText,
        normalizeTutorialStepNumber,
    } from "$lib/editor/tutorial-block";
    import {
        createComparisonBlockFromText,
        createDefaultComparisonBlock,
    } from "$lib/editor/comparison-block";
    import { normalizeCodeFilename } from "$lib/highlighter/code-block-metadata";
    import {
        maxHighlightLineNumber,
        normalizeHighlightLines,
    } from "$lib/highlighter/highlight-lines";
    import {
        createPresetSnapshot,
        deletePresetSnapshot,
        readPresetSnapshots,
        renamePresetSnapshot,
        writePresetSnapshots,
        type PresetSnapshot,
    } from "$lib/editor/preset-storage";

    const bodyFontFamily = defaultProseFontFamily;
    const selectionFontFamily = defaultProseFontFamily;
    const defaultBodyFontSize = "17px";
    const defaultCodeFontSize = "15px";
    const bodySizes = ["14px", "15px", "16px", "17px", "18px", "19px", "20px"];
    const codeSizes = ["12px", "13px", "14px", "15px", "16px", "17px", "18px"];
    const emptyDocument: JSONContent = {
        type: "doc",
        content: [{ type: "paragraph" }],
    };
    const draftHistoryAutoIntervalMs = 30_000;
    const previewRenderDebounceMs = 90;
    const draftPersistDebounceMs = 450;
    const documentThemes: { label: string; value: DcDocumentTheme }[] = [
        { label: "밝은 글", value: "lightLecture" },
        { label: "어두운 글", value: "darkEditorial" },
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
        { label: "짙은 회색", color: "oklch(23.39% 0.012 255.51)" },
        { label: "파랑", color: "oklch(56.77% 0.154 252.96)" },
        { label: "초록", color: "oklch(50.61% 0.142 146.57)" },
        { label: "주황", color: "oklch(57.8% 0.18 31.88)" },
        { label: "보라", color: "oklch(47.55% 0.145 302.98)" },
    ];
    const calloutColorOptions: {
        label: string;
        kind: CalloutKind;
        color: string;
    }[] = [
        { label: "초록", kind: "tip", color: defaultCalloutToneColors.tip },
        { label: "노랑", kind: "warning", color: defaultCalloutToneColors.warning },
        { label: "파랑", kind: "reference", color: defaultCalloutToneColors.reference },
        { label: "보라", kind: "emphasis", color: defaultCalloutToneColors.emphasis },
        { label: "빨강", kind: "failure", color: defaultCalloutToneColors.failure },
        { label: "분홍", kind: "rebuttal", color: defaultCalloutToneColors.rebuttal },
    ];
    type ToolPanelId = "blocks" | "code" | "style";
    type EditableBlockLabelTarget = {
        type: string;
        pos: number;
        fallback: string;
        attrName: "label" | "number";
    };
    type TutorialBlockTarget = {
        pos: number;
    };
    type RenameTarget =
        | { kind: "preset"; id: string }
        | { kind: "draft"; id: string };
    type CodeLineMarker = "highlightLines" | "additionLines" | "deletionLines";
    type CodeLineContextMenu = {
        x: number;
        y: number;
        line: number;
        pos: number;
    };
    const codeLineMarkers: CodeLineMarker[] = [
        "highlightLines",
        "additionLines",
        "deletionLines",
    ];

    let editorHost = $state<HTMLDivElement>();
    let editor = $state<Editor>();
    let documentJson = $state<JSONContent>(structuredClone(sampleDocument));
    let language = $state<DcLanguageId>(defaultLanguage);
    let theme = $state<DcThemeId>(defaultTheme);
    let bodyFontSize = $state(defaultBodyFontSize);
    let selectionFontSize = $state(defaultBodyFontSize);
    let quoteStyle = $state<QuoteStyle>("literary");
    let ctaGroupLayout = $state<CtaGroupLayout>("horizontal");
    let activeCalloutKind = $state<CalloutKind>("tip");
    let activeCalloutColor = $state(defaultCalloutToneColor("tip"));
    let codeFontSize = $state(defaultCodeFontSize);
    let codeLineHighlights = $state("");
    let codeAdditionLines = $state("");
    let codeDeletionLines = $state("");
    let codeFilename = $state("");
    let showLineNumbers = $state(false);
    let documentTheme = $state<DcDocumentTheme>("lightLecture");
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
    let isStoragePanelOpen = $state(false);
    let activeToolPanel = $state<ToolPanelId | null>(null);
    let blockLabelDraft = $state("");
    let blockLabelTarget = $state<EditableBlockLabelTarget | null>(null);
    let tutorialBlockTarget = $state<TutorialBlockTarget | null>(null);
    let presetName = $state("");
    let presets = $state<PresetSnapshot[]>([]);
    let presetState = $state<"idle" | "saved" | "error">("idle");
    let draftHistory = $state<DraftHistorySnapshot[]>([]);
    let draftHistoryState = $state<"idle" | "saved" | "error">("idle");
    let renameTarget = $state<RenameTarget | null>(null);
    let renameDraft = $state("");
    let calloutColorInput = $state<HTMLInputElement>();
    let codeLineContextMenu = $state<CodeLineContextMenu | null>(null);
    let codeLineContextMenuElement = $state<HTMLDivElement>();
    let editorSignal = $state(0);
    let canPersistDraft = $state(false);
    let lastDraftHistoryFingerprint = "";
    let lastDraftHistorySavedAt = 0;
    let cardApplyTimer: ReturnType<typeof setTimeout> | undefined;
    let previewRenderTimer: ReturnType<typeof setTimeout> | undefined;
    let draftPersistTimer: ReturnType<typeof setTimeout> | undefined;
    let renderTurn = 0;

    const htmlSize = $derived(
        `${Math.max(1, Math.ceil(html.length / 1024))}KB`,
    );
    const copyLabel = $derived(copyState === "copied" ? "복사됨" : "디씨 복사");
    const sourceCopyLabel = $derived(
        sourceCopyState === "copied" ? "복사됨" : "원문 복사",
    );
    const documentThemeLabel = $derived(
        documentThemes.find((item) => item.value === documentTheme)?.label ??
            "밝은 글",
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
            ? "적용됨"
            : markdownImportState === "error"
              ? "비어 있음"
              : "대기",
    );
    const lineRangeHelp = `1-${maxHighlightLineNumber.toLocaleString()} 사이 숫자와 쉼표, 범위만 입력`;
    const codeLineHighlightsInvalid = $derived(
        isLineRangeInputInvalid(codeLineHighlights),
    );
    const codeAdditionLinesInvalid = $derived(
        isLineRangeInputInvalid(codeAdditionLines),
    );
    const codeDeletionLinesInvalid = $derived(
        isLineRangeInputInvalid(codeDeletionLines),
    );
    const llmPromptCopyLabel = $derived(
        llmPromptCopyState === "copied"
            ? "복사됨"
            : llmPromptCopyState === "error"
              ? "복사 실패"
              : "LLM 가이드",
    );

    $effect(() => {
        if (typeof window !== "undefined" && codeLineContextMenu) {
            window.requestAnimationFrame(() =>
                codeLineContextMenuElement?.focus(),
            );
        }
    });

    function draftStorage() {
        return typeof window === "undefined" ? undefined : window.localStorage;
    }

    function defaultDraftPreferences(): DraftPreferences {
        return {
            language: defaultLanguage,
            theme: defaultTheme,
            bodyFontFamily,
            bodyFontSize: defaultBodyFontSize,
            selectionFontFamily,
            selectionFontSize: defaultBodyFontSize,
            codeFontSize: defaultCodeFontSize,
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
            structure: "dcTable",
        };
    }

    function cloneSerializableValue<T>(value: T): T {
        return JSON.parse(JSON.stringify($state.snapshot(value))) as T;
    }

    function cloneDocumentContent(document: JSONContent): JSONContent {
        return cloneSerializableValue(document);
    }

    function cloneDraftPreferences(
        preferences: DraftPreferences,
    ): DraftPreferences {
        return cloneSerializableValue(preferences);
    }

    function replaceEditorDocument(document: JSONContent) {
        const nextDocument = cloneDocumentContent(document);
        documentJson = nextDocument;
        editor?.commands.setContent(nextDocument);

        if (editor) {
            refreshEditorState(editor);
        }
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
            : defaultBodyFontSize;
        selectionFontSize = isKnownBodySize(preferences.selectionFontSize)
            ? preferences.selectionFontSize
            : defaultBodyFontSize;
        codeFontSize = isKnownCodeSize(preferences.codeFontSize)
            ? preferences.codeFontSize
            : defaultCodeFontSize;
        showLineNumbers = preferences.showLineNumbers;
        documentTheme = preferences.documentTheme;
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
        return draftHistoryFingerprint(
            cloneDocumentContent(documentJson),
            currentDraftPreferences(),
        );
    }

    function draftHistorySummary(snapshot: DraftHistorySnapshot) {
        const themeLabel =
            snapshot.preferences.documentTheme === "darkEditorial"
                ? "어두운 글"
                : "밝은 글";
        const textLength = countDocumentText(
            snapshot.document,
        ).toLocaleString();

        return `${themeLabel} · ${languageLabel(snapshot.preferences.language)} · ${textLength}자`;
    }

    function defaultDraftHistoryName(snapshot: DraftHistorySnapshot) {
        return `초안 ${presetDateLabel(snapshot.updatedAt)}`;
    }

    function draftHistoryName(snapshot: DraftHistorySnapshot) {
        return snapshot.name ?? defaultDraftHistoryName(snapshot);
    }

    function isRenaming(kind: RenameTarget["kind"], id: string) {
        return renameTarget?.kind === kind && renameTarget.id === id;
    }

    function focusRenameInput(node: HTMLInputElement) {
        node.focus();
        node.select();
    }

    function clearPendingCardApply() {
        if (cardApplyTimer) {
            clearTimeout(cardApplyTimer);
            cardApplyTimer = undefined;
        }
    }

    function clearScheduledPreviewRender() {
        if (previewRenderTimer) {
            clearTimeout(previewRenderTimer);
            previewRenderTimer = undefined;
        }
    }

    function clearScheduledDraftPersist() {
        if (draftPersistTimer) {
            clearTimeout(draftPersistTimer);
            draftPersistTimer = undefined;
        }
    }

    function isLineRangeInputInvalid(value: string) {
        const trimmed = value.trim();

        if (!trimmed) {
            return false;
        }

        return trimmed.split(",").some((part) => {
            const match = /^\s*(\d+)(?:\s*-\s*(\d+))?\s*$/.exec(part);

            if (!match) {
                return true;
            }

            const start = Number.parseInt(match[1] ?? "", 10);
            const end = match[2] ? Number.parseInt(match[2], 10) : start;

            return (
                !Number.isSafeInteger(start) ||
                !Number.isSafeInteger(end) ||
                start < 1 ||
                end < 1 ||
                start > maxHighlightLineNumber ||
                end > maxHighlightLineNumber
            );
        });
    }

    function closeTransientPanels() {
        closeCodeLineContextMenu();
        cancelRename();
        isLinkPanelOpen = false;
        isMarkdownPanelOpen = false;
        isStoragePanelOpen = false;
        activeToolPanel = null;
        markdownImportState = "idle";
    }

    function toggleMarkdownPanel() {
        isMarkdownPanelOpen = !isMarkdownPanelOpen;
        markdownImportState = "idle";

        if (isMarkdownPanelOpen) {
            isStoragePanelOpen = false;
        }
    }

    function toggleStoragePanel() {
        isStoragePanelOpen = !isStoragePanelOpen;

        if (isStoragePanelOpen) {
            isMarkdownPanelOpen = false;
            markdownImportState = "idle";
        }
    }

    function scheduleCardApply(callback: () => void, event: MouseEvent) {
        if (event.detail > 1) {
            clearPendingCardApply();
            return;
        }

        clearPendingCardApply();
        callback();
    }

    function beginPresetRename(preset: PresetSnapshot, event: MouseEvent) {
        event.preventDefault();
        clearPendingCardApply();
        renameTarget = { kind: "preset", id: preset.id };
        renameDraft = preset.name;
    }

    function beginDraftHistoryRename(
        snapshot: DraftHistorySnapshot,
        event: MouseEvent,
    ) {
        event.preventDefault();
        clearPendingCardApply();
        renameTarget = { kind: "draft", id: snapshot.id };
        renameDraft = draftHistoryName(snapshot);
    }

    function cancelRename() {
        renameTarget = null;
        renameDraft = "";
    }

    function handleRenameKeydown(
        event: KeyboardEvent,
        save: () => void,
    ) {
        if (event.key === "Enter") {
            event.preventDefault();
            save();
            return;
        }

        if (event.key === "Escape") {
            event.preventDefault();
            cancelRename();
        }
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
        const currentDocument = cloneDocumentContent(documentJson);
        const fingerprint = draftHistoryFingerprint(
            currentDocument,
            preferences,
        );

        if (options.automatic && fingerprint === lastDraftHistoryFingerprint) {
            return false;
        }

        const snapshot = createDraftHistorySnapshot(
            currentDocument,
            preferences,
        );
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
        const preferences = cloneDraftPreferences(snapshot.preferences);
        const nextDocument = cloneDocumentContent(snapshot.document);
        applyDraftPreferences(preferences);
        replaceEditorDocument(nextDocument);

        lastDraftHistoryFingerprint = draftHistoryFingerprint(
            nextDocument,
            preferences,
        );
        lastDraftHistorySavedAt = Date.now();
        draftHistoryState = "idle";
    }

    function saveDraftHistoryRename(id: string) {
        if (!isRenaming("draft", id)) {
            return;
        }

        const storage = draftStorage();

        if (!storage) {
            draftHistoryState = "error";
            return;
        }

        draftHistory = renameDraftHistorySnapshot(storage, id, renameDraft);
        cancelRename();
    }

    function deleteDraftHistory(id: string) {
        const storage = draftStorage();

        if (!storage) {
            draftHistoryState = "error";
            return;
        }

        if (isRenaming("draft", id)) {
            cancelRename();
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

        replaceEditorDocument(nextDocument);

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
            cloneDocumentContent(documentJson),
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
        applyDraftPreferences(cloneDraftPreferences(preset.preferences));
        replaceEditorDocument(preset.document);

        presetState = "idle";
    }

    function savePresetRename(id: string) {
        if (!isRenaming("preset", id)) {
            return;
        }

        const storage = draftStorage();

        if (!storage) {
            presetState = "error";
            return;
        }

        presets = renamePresetSnapshot(storage, id, renameDraft);
        cancelRename();
    }

    function deletePreset(id: string) {
        const storage = draftStorage();

        if (!storage) {
            presetState = "error";
            return;
        }

        if (isRenaming("preset", id)) {
            cancelRename();
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
            structure: "dcTable",
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

    function schedulePreviewRender(
        nextDocument: JSONContent,
        options: DcExportOptions,
    ) {
        clearScheduledPreviewRender();
        previewRenderTimer = setTimeout(() => {
            previewRenderTimer = undefined;
            void renderPreview(nextDocument, options);
        }, previewRenderDebounceMs);
    }

    function persistCurrentDraftSnapshot(
        nextDocument: JSONContent,
        preferences: DraftPreferences,
    ) {
        const storage = draftStorage();
        if (!storage) {
            return;
        }

        writeDraftSnapshot(
            storage,
            createDraftSnapshot(
                cloneDocumentContent(nextDocument),
                cloneDraftPreferences(preferences),
            ),
        );
        maybeSaveAutomaticDraftHistory();
    }

    function scheduleDraftPersist(
        nextDocument: JSONContent,
        preferences: DraftPreferences,
    ) {
        clearScheduledDraftPersist();
        draftPersistTimer = setTimeout(() => {
            draftPersistTimer = undefined;
            persistCurrentDraftSnapshot(nextDocument, preferences);
        }, draftPersistDebounceMs);
    }

    function normalizeBlockLabel(value: unknown) {
        return typeof value === "string"
            ? value.trim().replace(/\s+/g, " ").slice(0, 40)
            : "";
    }

    function normalizeEditableBlockValue(
        value: unknown,
        target: Pick<EditableBlockLabelTarget, "attrName" | "fallback">,
    ) {
        return target.attrName === "number"
            ? normalizeTutorialStepNumber(value, Number(target.fallback))
            : normalizeBlockLabel(value);
    }

    function editableBlockLabelFallback(nodeName: string) {
        if (nodeName === "heroBlock") {
            return { attrName: "label" as const, fallback: "CODING GUIDE" };
        }

        if (nodeName === "summaryBox") {
            return { attrName: "label" as const, fallback: defaultSummaryBoxLabel };
        }

        if (nodeName === "tutorialStep") {
            return { attrName: "number" as const, fallback: "1" };
        }

        const calloutKind = calloutKindFromNodeName(nodeName);
        return calloutKind
            ? { attrName: "label" as const, fallback: defaultCalloutLabel(calloutKind) }
            : undefined;
    }

    function findEditableBlockLabelTargetFromResolvedPos(
        resolvedPos: ResolvedPos,
    ):
        | (EditableBlockLabelTarget & { label: string })
        | null {
        for (let depth = resolvedPos.depth; depth > 0; depth -= 1) {
            const node = resolvedPos.node(depth);
            const config = editableBlockLabelFallback(node.type.name);

            if (!config) {
                continue;
            }

            const fallback =
                node.type.name === "tutorialStep" && depth > 0
                    ? String(resolvedPos.index(depth - 1) + 1)
                    : config.fallback;
            const value =
                normalizeEditableBlockValue(node.attrs[config.attrName], {
                    attrName: config.attrName,
                    fallback,
                }) || normalizeEditableBlockValue(fallback, config);

            return {
                type: node.type.name,
                pos: resolvedPos.before(depth),
                fallback,
                attrName: config.attrName,
                label: value,
            };
        }

        return null;
    }

    function syncBlockLabelTarget(
        target: (EditableBlockLabelTarget & { label: string }) | null,
    ) {
        if (!target) {
            blockLabelTarget = null;
            blockLabelDraft = "";
            return;
        }

        blockLabelTarget = {
            type: target.type,
            pos: target.pos,
            fallback: target.fallback,
            attrName: target.attrName,
        };
        blockLabelDraft = target.label;
    }

    function findEditableBlockLabelTarget(current: Editor) {
        return findEditableBlockLabelTargetFromResolvedPos(
            current.state.selection.$from,
        );
    }

    function syncBlockLabelDraft(current: Editor) {
        syncBlockLabelTarget(findEditableBlockLabelTarget(current));
    }

    function syncBlockLabelDraftFromPosition(current: Editor, pos: number) {
        syncBlockLabelTarget(
            findEditableBlockLabelTargetFromResolvedPos(
                current.state.doc.resolve(pos),
            ),
        );
    }

    function findTutorialBlockTargetFromResolvedPos(
        resolvedPos: ResolvedPos,
    ): TutorialBlockTarget | null {
        for (let depth = resolvedPos.depth; depth > 0; depth -= 1) {
            const node = resolvedPos.node(depth);

            if (node.type.name === "tutorialBlock") {
                return { pos: resolvedPos.before(depth) };
            }
        }

        return null;
    }

    function syncTutorialBlockTarget(current: Editor) {
        tutorialBlockTarget = findTutorialBlockTargetFromResolvedPos(
            current.state.selection.$from,
        );
    }

    function syncTutorialBlockTargetFromPosition(current: Editor, pos: number) {
        tutorialBlockTarget = findTutorialBlockTargetFromResolvedPos(
            current.state.doc.resolve(pos),
        );
    }

    function selectedCalloutFromResolvedPos(resolvedPos: ResolvedPos) {
        for (let depth = resolvedPos.depth; depth > 0; depth -= 1) {
            const node = resolvedPos.node(depth);
            const kind = calloutKindFromNodeName(node.type.name);

            if (kind) {
                return {
                    kind,
                    color: normalizeCalloutToneColor(node.attrs.toneColor, kind),
                };
            }
        }

        return undefined;
    }

    function syncCalloutColorDraft(current: Editor) {
        const callout = selectedCalloutFromResolvedPos(
            current.state.selection.$from,
        );

        if (callout) {
            activeCalloutKind = callout.kind;
            activeCalloutColor = callout.color;
        }
    }

    function syncCalloutColorDraftFromPosition(current: Editor, pos: number) {
        const callout = selectedCalloutFromResolvedPos(
            current.state.doc.resolve(pos),
        );

        if (callout) {
            activeCalloutKind = callout.kind;
            activeCalloutColor = callout.color;
        }
    }

    function refreshEditorState(nextEditor: Editor) {
        documentJson = nextEditor.getJSON();
        syncBlockLabelDraft(nextEditor);
        syncTutorialBlockTarget(nextEditor);
        syncCalloutColorDraft(nextEditor);
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

    function isCalloutActive() {
        void editorSignal;
        return editor
            ? calloutNodeNames.some((nodeName) => editor?.isActive(nodeName))
            : false;
    }

    function runEditorCommand(command: (current: Editor) => boolean) {
        if (!editor) {
            return;
        }

        command(editor);
        refreshEditorState(editor);
    }

    function blockLabelPlaceholder() {
        void editorSignal;
        return blockLabelTarget?.fallback ?? "블록 선택";
    }

    function applyBlockLabel() {
        runEditorCommand((current) => {
            const selectionTarget = findEditableBlockLabelTarget(current);
            const target = blockLabelTarget ?? selectionTarget;

            if (!target) {
                return false;
            }

            const node = current.state.doc.nodeAt(target.pos);
            const fallback = node
                ? editableBlockLabelFallback(node.type.name)
                : undefined;

            if (!node || !fallback) {
                return false;
            }

            const label =
                normalizeEditableBlockValue(blockLabelDraft, target) ||
                normalizeEditableBlockValue(target.fallback, target);
            current.commands.focus();
            current.view.dispatch(
                current.state.tr
                    .setNodeMarkup(target.pos, undefined, {
                        ...node.attrs,
                        [target.attrName]: label,
                    })
                    .scrollIntoView(),
            );
            blockLabelDraft = label;
            return true;
        });
    }

    function applyBlockLabelOnEnter(event: KeyboardEvent) {
        if (event.key !== "Enter") {
            return;
        }

        event.preventDefault();
        applyBlockLabel();
    }

    function applyCodeBlock() {
        if (
            codeLineHighlightsInvalid ||
            codeAdditionLinesInvalid ||
            codeDeletionLinesInvalid
        ) {
            return;
        }

        const { highlightLines, additionLines, deletionLines } =
            normalizeCodeLineMarkers({
                highlightLines: codeLineHighlights,
                additionLines: codeAdditionLines,
                deletionLines: codeDeletionLines,
            });
        const filename = normalizeCodeFilename(codeFilename);
        syncCodeLineMarkerDrafts({
            highlightLines,
            additionLines,
            deletionLines,
        });
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
                            additionLines,
                            deletionLines,
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
                .updateAttributes("codeBlock", {
                    highlightLines,
                    filename,
                    additionLines,
                    deletionLines,
                })
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
        if (codeLineHighlightsInvalid) {
            return;
        }

        const markerAttrs = normalizeCodeLineMarkers(
            {
                highlightLines: codeLineHighlights,
                additionLines: codeAdditionLines,
                deletionLines: codeDeletionLines,
            },
            "highlightLines",
        );
        syncCodeLineMarkerDrafts(markerAttrs);
        runEditorCommand((current) =>
            current
                .chain()
                .focus()
                .updateAttributes("codeBlock", markerAttrs)
                .run(),
        );
    }

    function applyCodeAdditionLines() {
        if (codeAdditionLinesInvalid) {
            return;
        }

        const markerAttrs = normalizeCodeLineMarkers(
            {
                highlightLines: codeLineHighlights,
                additionLines: codeAdditionLines,
                deletionLines: codeDeletionLines,
            },
            "additionLines",
        );
        syncCodeLineMarkerDrafts(markerAttrs);
        runEditorCommand((current) =>
            current
                .chain()
                .focus()
                .updateAttributes("codeBlock", markerAttrs)
                .run(),
        );
    }

    function applyCodeDeletionLines() {
        if (codeDeletionLinesInvalid) {
            return;
        }

        const markerAttrs = normalizeCodeLineMarkers(
            {
                highlightLines: codeLineHighlights,
                additionLines: codeAdditionLines,
                deletionLines: codeDeletionLines,
            },
            "deletionLines",
        );
        syncCodeLineMarkerDrafts(markerAttrs);
        runEditorCommand((current) =>
            current
                .chain()
                .focus()
                .updateAttributes("codeBlock", markerAttrs)
                .run(),
        );
    }

    function syncCodeLineMarkerDrafts(attrs: Record<CodeLineMarker, string>) {
        codeLineHighlights = normalizeHighlightLines(attrs.highlightLines);
        codeAdditionLines = normalizeHighlightLines(attrs.additionLines);
        codeDeletionLines = normalizeHighlightLines(attrs.deletionLines);
    }

    function lineSetFromRange(value: unknown): Set<number> {
        const lines = new Set<number>();
        const normalized = normalizeHighlightLines(value);

        for (const token of normalized.split(",")) {
            if (!token) {
                continue;
            }

            const [startValue, endValue] = token.split("-").map(Number);
            const start = Number.isFinite(startValue) ? startValue : 0;
            const end = Number.isFinite(endValue) ? endValue : start;

            for (let line = start; line <= end; line += 1) {
                if (line > 0) {
                    lines.add(line);
                }
            }
        }

        return lines;
    }

    function compactLineSet(lines: Set<number>) {
        const sorted = [...lines].sort((a, b) => a - b);
        const ranges: string[] = [];
        let start = sorted[0];
        let previous = sorted[0];

        for (const line of sorted.slice(1)) {
            if (line === previous + 1) {
                previous = line;
                continue;
            }

            ranges.push(start === previous ? `${start}` : `${start}-${previous}`);
            start = line;
            previous = line;
        }

        if (start !== undefined && previous !== undefined) {
            ranges.push(start === previous ? `${start}` : `${start}-${previous}`);
        }

        return ranges.join(",");
    }

    function removeLines(target: Set<number>, lines: Set<number>) {
        for (const line of lines) {
            target.delete(line);
        }
    }

    function normalizeCodeLineMarkers(
        attrs: Record<CodeLineMarker, unknown>,
        winner?: CodeLineMarker,
    ): Record<CodeLineMarker, string> {
        const highlightLines = lineSetFromRange(attrs.highlightLines);
        const additionLines = lineSetFromRange(attrs.additionLines);
        const deletionLines = lineSetFromRange(attrs.deletionLines);

        if (winner === "highlightLines") {
            removeLines(additionLines, highlightLines);
            removeLines(deletionLines, highlightLines);
        } else if (winner === "additionLines") {
            removeLines(highlightLines, additionLines);
            removeLines(deletionLines, additionLines);
        } else if (winner === "deletionLines") {
            removeLines(highlightLines, deletionLines);
            removeLines(additionLines, deletionLines);
        } else {
            removeLines(additionLines, deletionLines);
            removeLines(highlightLines, deletionLines);
            removeLines(highlightLines, additionLines);
        }

        return {
            highlightLines: compactLineSet(highlightLines),
            additionLines: compactLineSet(additionLines),
            deletionLines: compactLineSet(deletionLines),
        };
    }

    function toggleLineInRange(value: unknown, line: number) {
        const lines = lineSetFromRange(value);

        if (lines.has(line)) {
            lines.delete(line);
        } else {
            lines.add(line);
        }

        return compactLineSet(lines);
    }

    function isLineInRange(value: unknown, line: number) {
        return lineSetFromRange(value).has(line);
    }

    function codeLineMarkerLabel(marker: CodeLineMarker) {
        if (marker === "additionLines") {
            return "추가줄";
        }

        if (marker === "deletionLines") {
            return "삭제줄";
        }

        return "강조줄";
    }

    function closestCodePre(target: EventTarget | null): HTMLElement | undefined {
        if (!(target instanceof Element)) {
            return undefined;
        }

        const pre = target.closest("pre.dc-editor-code");

        return pre instanceof HTMLElement ? pre : undefined;
    }

    function codeBlockAtPosition(view: EditorView, pos: number) {
        const resolved = view.state.doc.resolve(pos);

        for (let depth = resolved.depth; depth > 0; depth -= 1) {
            const node = resolved.node(depth);

            if (node.type.name === "codeBlock") {
                return {
                    node,
                    pos: resolved.before(depth),
                };
            }
        }

        return undefined;
    }

    function clickedCodeLine(pre: HTMLElement, lineCount: number, event: MouseEvent) {
        const code = pre.querySelector("code") ?? pre;
        const rect = code.getBoundingClientRect();
        const style = getComputedStyle(code);
        const fontSize = Number.parseFloat(style.fontSize);
        const parsedLineHeight = Number.parseFloat(style.lineHeight);
        const lineHeight = Number.isFinite(parsedLineHeight)
            ? parsedLineHeight
            : fontSize * 1.4;
        const y = event.clientY - rect.top + pre.scrollTop;
        const line = Math.floor(Math.max(0, y) / lineHeight) + 1;

        return Math.max(1, Math.min(lineCount, line));
    }

    function openCodeLineContextMenu(view: EditorView, event: MouseEvent) {
        const pre = closestCodePre(event.target);

        if (!pre) {
            codeLineContextMenu = null;
            return false;
        }

        const position = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
        });

        if (!position) {
            return false;
        }

        const codeBlock = codeBlockAtPosition(view, position.pos);

        if (!codeBlock) {
            return false;
        }

        event.preventDefault();
        const lineCount = Math.max(1, codeBlock.node.textContent.split("\n").length);
        codeLineContextMenu = {
            x: Math.min(event.clientX, Math.max(8, window.innerWidth - 184)),
            y: Math.min(event.clientY, Math.max(8, window.innerHeight - 160)),
            line: clickedCodeLine(pre, lineCount, event),
            pos: codeBlock.pos,
        };

        return true;
    }

    function closeCodeLineContextMenu() {
        codeLineContextMenu = null;
    }

    function codeLineContextMenuActive(marker: CodeLineMarker) {
        if (!editor || !codeLineContextMenu) {
            return false;
        }

        const node = editor.state.doc.nodeAt(codeLineContextMenu.pos);

        if (!node) {
            return false;
        }

        return isLineInRange(
            normalizeCodeLineMarkers({
                highlightLines: node.attrs.highlightLines,
                additionLines: node.attrs.additionLines,
                deletionLines: node.attrs.deletionLines,
            })[marker],
            codeLineContextMenu.line,
        );
    }

    function toggleCodeLineMarker(marker: CodeLineMarker) {
        if (!editor || !codeLineContextMenu) {
            return;
        }

        const node = editor.state.doc.nodeAt(codeLineContextMenu.pos);

        if (!node || node.type.name !== "codeBlock") {
            closeCodeLineContextMenu();
            return;
        }

        const nextMarkerAttrs = normalizeCodeLineMarkers(
            {
                highlightLines: node.attrs.highlightLines,
                additionLines: node.attrs.additionLines,
                deletionLines: node.attrs.deletionLines,
                [marker]: toggleLineInRange(
                    node.attrs[marker],
                    codeLineContextMenu.line,
                ),
            },
            marker,
        );

        editor.view.dispatch(
            editor.state.tr
                .setNodeMarkup(codeLineContextMenu.pos, undefined, {
                    ...node.attrs,
                    ...nextMarkerAttrs,
                })
                .scrollIntoView(),
        );

        syncCodeLineMarkerDrafts(nextMarkerAttrs);
        refreshEditorState(editor);
        closeCodeLineContextMenu();
    }

    function calloutLabelAfterToneChange(
        nodeTypeName: string,
        attrs: Record<string, unknown>,
        kind: CalloutKind,
    ) {
        const previousKind = calloutKindFromNodeName(nodeTypeName);
        const previousDefault = previousKind
            ? defaultCalloutLabel(previousKind)
            : "";
        const previousLabel = normalizeBlockLabel(attrs.label);

        return previousLabel && previousLabel !== previousDefault
            ? previousLabel
            : defaultCalloutLabel(kind);
    }

    function retargetCalloutAtPosition(
        current: Editor,
        pos: number,
        kind: CalloutKind,
        toneColor = activeCalloutColor,
    ) {
        const targetType = current.schema.nodes[calloutNodeNameByKind[kind]];
        const node = current.state.doc.nodeAt(pos);

        if (!targetType || !node || !isCalloutNodeName(node.type.name)) {
            return false;
        }

        const label = calloutLabelAfterToneChange(
            node.type.name,
            node.attrs,
            kind,
        );
        current.commands.focus();
        current.view.dispatch(
            current.state.tr
                .setNodeMarkup(pos, targetType, {
                    ...node.attrs,
                    label,
                    toneColor: normalizeCalloutToneColor(toneColor, kind),
                })
                .scrollIntoView(),
        );
        syncBlockLabelTarget({
            type: calloutNodeNameByKind[kind],
            pos,
            fallback: defaultCalloutLabel(kind),
            attrName: "label",
            label,
        });
        return true;
    }

    function retargetActiveCallout(
        current: Editor,
        kind: CalloutKind,
        toneColor = activeCalloutColor,
    ) {
        const selectionFrom = current.state.selection.$from;

        for (let depth = selectionFrom.depth; depth > 0; depth -= 1) {
            const node = selectionFrom.node(depth);

            if (isCalloutNodeName(node.type.name)) {
                return retargetCalloutAtPosition(
                    current,
                    selectionFrom.before(depth),
                    kind,
                    toneColor,
                );
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
                    .command(
                        selectedInlineRangeToCalloutCommand(
                            kind,
                            activeCalloutColor,
                        ),
                    )
                    .run()
            ) {
                return true;
            }

            return current
                .chain()
                .focus()
                .wrapIn(calloutNodeNameByKind[kind], {
                    label: defaultCalloutLabel(kind),
                    toneColor: normalizeCalloutToneColor(activeCalloutColor, kind),
                })
                .run();
        });
    }

    function applySelectedCallout() {
        applyCallout(activeCalloutKind);
    }

    function updateActiveCalloutColor(kind = activeCalloutKind) {
        activeCalloutKind = kind;
        activeCalloutColor = normalizeCalloutToneColor(activeCalloutColor, kind);

        if (!editor) {
            return;
        }

        const trackedTarget = blockLabelTarget;
        const didRetargetTrackedCallout =
            trackedTarget !== null &&
            retargetCalloutAtPosition(
                editor,
                trackedTarget.pos,
                kind,
                activeCalloutColor,
            );

        if (!didRetargetTrackedCallout) {
            retargetActiveCallout(editor, kind, activeCalloutColor);
        }

        refreshEditorState(editor);

        if (didRetargetTrackedCallout && trackedTarget) {
            const node = editor.state.doc.nodeAt(trackedTarget.pos);
            const label =
                normalizeBlockLabel(node?.attrs.label) ||
                defaultCalloutLabel(kind);

            syncBlockLabelTarget({
                type: calloutNodeNameByKind[kind],
                pos: trackedTarget.pos,
                fallback: defaultCalloutLabel(kind),
                attrName: "label",
                label,
            });
        }
    }

    function applyCalloutPresetColor(kind: CalloutKind, color: string) {
        activeCalloutColor = normalizeCalloutToneColor(color, kind);
        updateActiveCalloutColor(kind);
    }

    function calloutSwatchColor(kind: CalloutKind, color: string) {
        return activeCalloutKind === kind ? activeCalloutColor : color;
    }

    function updateCalloutPickerColor() {
        updateActiveCalloutColor(activeCalloutKind);
    }

    function openCalloutColorPicker(kind: CalloutKind, color: string) {
        activeCalloutColor = normalizeCalloutToneColor(color, kind);
        activeCalloutKind = kind;

        if (!calloutColorInput) {
            return;
        }

        if (typeof calloutColorInput.showPicker === "function") {
            calloutColorInput.showPicker();
            return;
        }

        calloutColorInput.click();
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
                            node.type,
                            { ...node.attrs, href },
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
                            node.type,
                            { ...node.attrs, href },
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
                    .command(selectedInlineRangeToCtaButtonCommand(href))
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

    function selectedTutorialBlock(current: Editor) {
        const selectionTarget = findTutorialBlockTargetFromResolvedPos(
            current.state.selection.$from,
        );

        for (const target of [selectionTarget, tutorialBlockTarget]) {
            if (!target) {
                continue;
            }

            const node = current.state.doc.nodeAt(target.pos);

            if (node?.type.name === "tutorialBlock") {
                return {
                    node,
                    pos: target.pos,
                };
            }
        }

        return null;
    }

    function nextTutorialStepNumber(node: ProseMirrorNode) {
        let maxNumber = 0;
        let stepCount = 0;

        node.forEach((child) => {
            if (child.type.name !== "tutorialStep") {
                return;
            }

            stepCount += 1;
            const normalized = normalizeTutorialStepNumber(child.attrs.number);
            const numeric = Number.parseInt(normalized, 10);

            if (Number.isFinite(numeric)) {
                maxNumber = Math.max(maxNumber, numeric);
            }
        });

        return normalizeTutorialStepNumber(maxNumber > 0 ? maxNumber + 1 : stepCount + 1);
    }

    function applyTutorialBlock() {
        const text = selectedText();

        if (!text.trim()) {
            runEditorCommand((current) => {
                const target = selectedTutorialBlock(current);

                if (!target) {
                    return current
                        .chain()
                        .focus()
                        .insertContent(createDefaultTutorialBlock())
                        .run();
                }

                const insertPos = target.pos + target.node.nodeSize - 1;
                return current
                    .chain()
                    .focus()
                    .insertContentAt(
                        insertPos,
                        createTutorialStep("새 단계", "", nextTutorialStepNumber(target.node)),
                    )
                    .run();
            });
            return;
        }

        const tutorialBlock = createTutorialBlockFromText(text);

        runEditorCommand((current) =>
            tutorialBlock
                ? current.chain().focus().insertContent(tutorialBlock).run()
                : false,
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
        if (
            !window.confirm(
                "현재 글을 모두 지우고 빈 문서로 초기화할까?",
            )
        ) {
            return;
        }

        const storage = draftStorage();
        if (storage) {
            clearDraftSnapshot(storage);
        }

        applyDraftPreferences(defaultDraftPreferences());
        replaceEditorDocument(emptyDocument);
        isLinkPanelOpen = false;
        linkDraft = "";
        linkError = false;
        lastDraftHistoryFingerprint = currentDraftHistoryFingerprint();
        lastDraftHistorySavedAt = Date.now();
    }

    function applyExampleTemplate() {
        if (
            !window.confirm(
                "현재 글을 예시 템플릿으로 바꿀까?",
            )
        ) {
            return;
        }

        applyDraftPreferences(defaultDraftPreferences());
        replaceEditorDocument(sampleDocument);
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

    function toggleToolPanel(panel: ToolPanelId) {
        activeToolPanel = activeToolPanel === panel ? null : panel;
    }

    onDestroy(() => {
        clearPendingCardApply();
        clearScheduledPreviewRender();
        clearScheduledDraftPersist();
    });

    onMount(() => {
        let disposed = false;
        let mountedEditor: Editor | undefined;
        const savedDraft = readDraftSnapshot(window.localStorage);
        const closeFloatingMenus = () => closeCodeLineContextMenu();
        const closePanelsOnOutsidePointer = (event: PointerEvent) => {
            const target = event.target;

            if (!(target instanceof Element)) {
                return;
            }

            if (
                target.closest(".toolbar-shell") ||
                target.closest(".code-line-context-menu") ||
                target.closest(".markdown-panel") ||
                target.closest(".storage-panel")
            ) {
                return;
            }

            if (
                isLinkPanelOpen ||
                isMarkdownPanelOpen ||
                isStoragePanelOpen ||
                activeToolPanel
            ) {
                closeTransientPanels();
            }
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                if (
                    codeLineContextMenu ||
                    isLinkPanelOpen ||
                    isMarkdownPanelOpen ||
                    isStoragePanelOpen ||
                    activeToolPanel ||
                    renameTarget
                ) {
                    event.preventDefault();
                    closeTransientPanels();
                }
            }
        };

        window.addEventListener("pointerdown", closePanelsOnOutsidePointer);
        window.addEventListener("resize", closeFloatingMenus);
        window.addEventListener("scroll", closeFloatingMenus, true);
        window.addEventListener("keydown", closeOnEscape);
        refreshPresetSnapshots();
        refreshDraftHistorySnapshots();

        if (savedDraft) {
            documentJson = cloneDocumentContent(savedDraft.document);
            applyDraftPreferences(cloneDraftPreferences(savedDraft.preferences));
        }

        lastDraftHistoryFingerprint = draftHistory[0]
            ? draftHistoryFingerprint(
                  cloneDocumentContent(draftHistory[0].document),
                  cloneDraftPreferences(draftHistory[0].preferences),
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
                    handleDOMEvents: {
                        contextmenu: (view, event) =>
                            event instanceof MouseEvent
                                ? openCodeLineContextMenu(view, event)
                                : false,
                    },
                    handleClick: (view, pos) => {
                        closeCodeLineContextMenu();
                        if (editor) {
                            syncBlockLabelDraftFromPosition(editor, pos);
                            syncTutorialBlockTargetFromPosition(editor, pos);
                            syncCalloutColorDraftFromPosition(editor, pos);
                        } else {
                            syncBlockLabelTarget(
                                findEditableBlockLabelTargetFromResolvedPos(
                                    view.state.doc.resolve(pos),
                                ),
                            );
                            tutorialBlockTarget =
                                findTutorialBlockTargetFromResolvedPos(
                                    view.state.doc.resolve(pos),
                                );
                            const callout = selectedCalloutFromResolvedPos(
                                view.state.doc.resolve(pos),
                            );

                            if (callout) {
                                activeCalloutKind = callout.kind;
                                activeCalloutColor = callout.color;
                            }
                        }

                        return false;
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
                    syncBlockLabelDraft(current);
                    syncTutorialBlockTarget(current);
                    syncCalloutColorDraft(current);
                    editorSignal += 1;
                    const attrs = current.getAttributes("codeBlock");
                    if (
                        typeof attrs.language === "string" &&
                        isSupportedLanguage(attrs.language)
                    ) {
                        language = attrs.language;
                    }
                    syncCodeLineMarkerDrafts(
                        normalizeCodeLineMarkers({
                            highlightLines: attrs.highlightLines,
                            additionLines: attrs.additionLines,
                            deletionLines: attrs.deletionLines,
                        }),
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
            window.removeEventListener("resize", closeFloatingMenus);
            window.removeEventListener("scroll", closeFloatingMenus, true);
            window.removeEventListener("keydown", closeOnEscape);
            window.removeEventListener("pointerdown", closePanelsOnOutsidePointer);
            mountedEditor?.destroy();
        };
    });

    $effect(() => {
        schedulePreviewRender(documentJson, exportOptions());
        return clearScheduledPreviewRender;
    });

    $effect(() => {
        clearScheduledDraftPersist();

        if (!canPersistDraft) {
            return;
        }

        scheduleDraftPersist(documentJson, currentDraftPreferences());
        return clearScheduledDraftPersist;
    });
</script>

<main class="workspace">
    <div class="toolbar-shell">
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
                type="button"
                title="예시 템플릿"
                aria-label="예시 템플릿"
                onclick={applyExampleTemplate}
            >
                <LayoutTemplate size={17} />
                <span>예시 템플릿</span>
            </button>
            <button
                class="copy-button"
                type="button"
                title="디씨 복사"
                aria-label={copyLabel}
                onclick={copyPreview}
                disabled={!html || isRendering}
            >
                {#if copyState === "copied"}
                    <Check size={17} />
                {:else if isRendering}
                    <span class="spin-icon"><Loader2 size={17} /></span>
                {:else}
                    <Clipboard size={17} />
                {/if}
                <span>{copyLabel}</span>
            </button>
            <button
                class:active={isMarkdownPanelOpen}
                type="button"
                title="Markdown"
                aria-label="Markdown"
                aria-expanded={isMarkdownPanelOpen}
                onclick={toggleMarkdownPanel}
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
            <button
                class:active={isStoragePanelOpen}
                type="button"
                title="저장함"
                aria-label="저장함"
                aria-expanded={isStoragePanelOpen}
                aria-controls="storage-panel"
                onclick={toggleStoragePanel}
            >
                <Save size={17} />
                <span>저장함</span>
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

        <div class="tool-group tool-panel-tabs" role="group" aria-label="도구 그룹">
            <button
                class:active={activeToolPanel === "blocks"}
                type="button"
                title="블록 도구"
                aria-label="블록 도구"
                aria-expanded={activeToolPanel === "blocks"}
                aria-controls="block-tools"
                onclick={() => toggleToolPanel("blocks")}
            >
                <Rows3 size={17} />
                <span>블록</span>
            </button>
            <button
                class:active={activeToolPanel === "code"}
                type="button"
                title="코드 도구"
                aria-label="코드 도구"
                aria-expanded={activeToolPanel === "code"}
                aria-controls="code-tools"
                onclick={() => toggleToolPanel("code")}
            >
                <Code2 size={17} />
                <span>코드</span>
            </button>
            <button
                class:active={activeToolPanel === "style"}
                type="button"
                title="스타일 도구"
                aria-label="스타일 도구"
                aria-expanded={activeToolPanel === "style"}
                aria-controls="style-tools"
                onclick={() => toggleToolPanel("style")}
            >
                <Paintbrush size={17} />
                <span>스타일</span>
            </button>
        </div>

        {#if isLinkPanelOpen}
            <div class="tool-group link-tool">
                <label>
                    <span><Link2 size={15} /> 링크</span>
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

        {#if activeToolPanel === "blocks"}
            <div id="block-tools" class="tool-group tool-panel block-insert-group">
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
            <label class="block-label-field">
                <span><Type size={15} /> 라벨</span>
                <input
                    type="text"
                    bind:value={blockLabelDraft}
                    aria-label="블록 라벨"
                    placeholder={blockLabelPlaceholder()}
                    disabled={blockLabelTarget === null}
                    onkeydown={applyBlockLabelOnEnter}
                />
            </label>
            <button
                type="button"
                title="라벨 적용"
                aria-label="라벨 적용"
                disabled={blockLabelTarget === null}
                onclick={applyBlockLabel}
            >
                <Check size={17} />
                <span>적용</span>
            </button>
            <button
                class:active={isCalloutActive()}
                type="button"
                title="콜아웃"
                aria-label="콜아웃"
                onclick={applySelectedCallout}
            >
                <Sparkles size={17} />
                <span>콜아웃</span>
            </button>
            <label class="callout-color-field">
                <span><Paintbrush size={15} /> 색상</span>
                <div class="callout-color-controls">
                    <div class="callout-color-swatches" aria-label="콜아웃 색상 프리셋">
                        {#each calloutColorOptions as item}
                            <button
                                class:active={activeCalloutKind === item.kind}
                                class="callout-color-swatch"
                                type="button"
                                aria-label={`${item.label} 콜아웃`}
                                title={`${item.label} 콜아웃`}
                                style={`--swatch:${calloutSwatchColor(item.kind, item.color)}`}
                                onclick={() =>
                                    applyCalloutPresetColor(item.kind, item.color)}
                                ondblclick={() =>
                                    openCalloutColorPicker(item.kind, item.color)}
                            ></button>
                        {/each}
                    </div>
                    <input
                        bind:this={calloutColorInput}
                        class="callout-color-input"
                        type="color"
                        bind:value={activeCalloutColor}
                        aria-label="사용자 콜아웃 색상"
                        tabindex="-1"
                        oninput={updateCalloutPickerColor}
                    />
                </div>
            </label>
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
        {/if}

        {#if activeToolPanel === "code"}
            <div id="code-tools" class="tool-group tool-panel tool-group-wide code-settings-group">
            <button
                class:active={isActive("codeBlock")}
                type="button"
                onclick={applyCodeBlock}
            >
                <Code2 size={17} />
                <span>코드</span>
            </button>
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
                    class:error={codeLineHighlightsInvalid}
                    type="text"
                    bind:value={codeLineHighlights}
                    aria-label="코드 강조 줄"
                    aria-invalid={codeLineHighlightsInvalid}
                    aria-describedby={codeLineHighlightsInvalid ? "code-line-range-help" : undefined}
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
                <span>추가줄</span>
                <input
                    class="line-highlight-input"
                    class:error={codeAdditionLinesInvalid}
                    type="text"
                    bind:value={codeAdditionLines}
                    aria-label="코드 추가 줄"
                    aria-invalid={codeAdditionLinesInvalid}
                    aria-describedby={codeAdditionLinesInvalid ? "code-line-range-help" : undefined}
                    placeholder="2,4-6"
                    onblur={applyCodeAdditionLines}
                    onkeydown={(event) => {
                        if (event.key === "Enter") {
                            applyCodeAdditionLines();
                        }
                    }}
                />
            </label>
            <label>
                <span>삭제줄</span>
                <input
                    class="line-highlight-input"
                    class:error={codeDeletionLinesInvalid}
                    type="text"
                    bind:value={codeDeletionLines}
                    aria-label="코드 삭제 줄"
                    aria-invalid={codeDeletionLinesInvalid}
                    aria-describedby={codeDeletionLinesInvalid ? "code-line-range-help" : undefined}
                    placeholder="2,4-6"
                    onblur={applyCodeDeletionLines}
                    onkeydown={(event) => {
                        if (event.key === "Enter") {
                            applyCodeDeletionLines();
                        }
                    }}
                />
            </label>
            {#if codeLineHighlightsInvalid || codeAdditionLinesInvalid || codeDeletionLinesInvalid}
                <span id="code-line-range-help" class="line-range-hint"
                    >{lineRangeHelp}</span
                >
            {/if}
            <label>
                <span><Paintbrush size={15} /> 테마</span>
                <select bind:value={theme} aria-label="코드 테마">
                    {#each supportedThemes as item}
                        <option value={item.id}>{item.label}</option>
                    {/each}
                </select>
            </label>
            <label>
                <span>코드 글자</span>
                <select bind:value={codeFontSize} aria-label="코드 글자 크기">
                    {#each codeSizes as item}
                        <option value={item}>{item}</option>
                    {/each}
                </select>
            </label>
            <label class="switch">
                <input type="checkbox" bind:checked={showLineNumbers} />
                <span>줄번호</span>
            </label>
            </div>
        {/if}

        {#if activeToolPanel === "style"}
            <div id="style-tools" class="tool-group tool-panel tool-group-wide typography-group">
            <label>
                <span><Paintbrush size={15} /> 글 배경</span>
                <select
                    bind:value={documentTheme}
                    aria-label="복사될 글 배경"
                    title="DC 야간모드와 별개로 복사될 글의 배경을 고릅니다"
                >
                    {#each documentThemes as item}
                        <option value={item.value}>{item.label}</option>
                    {/each}
                </select>
            </label>
            <label>
                <span>전체 글자</span>
                <select bind:value={bodyFontSize} aria-label="전체 글자 크기">
                    {#each bodySizes as item}
                        <option value={item}>{item}</option>
                    {/each}
                </select>
            </label>
            <label>
                <span>선택 글자</span>
                <select
                    bind:value={selectionFontSize}
                    aria-label="선택 글자 크기"
                    onchange={() => setFontSize(selectionFontSize)}
                >
                    {#each bodySizes as item}
                        <option value={item}>{item}</option>
                    {/each}
                </select>
            </label>
            <div class="swatches" aria-label="글자색">
                {#each swatches as swatch}
                    <button
                        class="swatch"
                        type="button"
                        title={`${swatch.label} 글자색`}
                        aria-label={`${swatch.label} 글자색`}
                        style={`--swatch:${swatch.color}`}
                        onclick={() => setTextColor(swatch.color)}
                    ></button>
                {/each}
            </div>
            </div>
        {/if}
    </section>

    {#if isStoragePanelOpen}
        <div id="storage-panel" class="storage-panel">
            <button
                class="panel-close-button storage-panel-close"
                type="button"
                title="저장함 닫기"
                aria-label="닫기"
                onclick={() => (isStoragePanelOpen = false)}
            >
                <X size={16} />
            </button>
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
                    <span
                        class:error={presetState === "error"}
                        class="preset-count">{presetStateLabel}</span
                    >
                </div>

                <div class="preset-list" aria-label="저장된 프리셋">
                    {#if presets.length === 0}
                        <span class="preset-empty">프리셋 없음</span>
                    {:else}
                        {#each presets as preset (preset.id)}
                            <div class="preset-item">
                                {#if isRenaming("preset", preset.id)}
                                    <input
                                        class="preset-rename-input"
                                        type="text"
                                        bind:value={renameDraft}
                                        maxlength="60"
                                        aria-label="프리셋 제목 변경"
                                        use:focusRenameInput
                                        onblur={() =>
                                            savePresetRename(preset.id)}
                                        onkeydown={(event) =>
                                            handleRenameKeydown(event, () =>
                                                savePresetRename(preset.id),
                                            )}
                                    />
                                {:else}
                                    <button
                                        type="button"
                                        class="preset-apply"
                                        title="더블클릭해서 제목 변경"
                                        onclick={(event) =>
                                            scheduleCardApply(
                                                () => applyPreset(preset),
                                                event,
                                            )}
                                        ondblclick={(event) =>
                                            beginPresetRename(preset, event)}
                                    >
                                        <span>{preset.name}</span>
                                        <small
                                            >{preset.preferences
                                                .documentTheme ===
                                            "darkEditorial"
                                                ? "어두운 글"
                                                : "밝은 글"} · {presetDateLabel(
                                                preset.updatedAt,
                                            )}</small
                                        >
                                    </button>
                                {/if}
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
                        onclick={() =>
                            saveDraftHistorySnapshot({ automatic: false })}
                    >
                        <Save size={16} />
                        <span>스냅샷</span>
                    </button>
                    <span
                        class:error={draftHistoryState === "error"}
                        class="draft-history-count"
                        aria-label="초안 히스토리 개수"
                        >{draftHistoryStateLabel}</span
                    >
                </div>

                <div class="draft-history-list" aria-label="저장된 초안">
                    {#if draftHistory.length === 0}
                        <span class="draft-history-empty">초안 없음</span>
                    {:else}
                        {#each draftHistory as snapshot (snapshot.id)}
                            <div class="draft-history-item">
                                {#if isRenaming("draft", snapshot.id)}
                                    <input
                                        class="preset-rename-input"
                                        type="text"
                                        bind:value={renameDraft}
                                        maxlength="60"
                                        aria-label="초안 제목 변경"
                                        use:focusRenameInput
                                        onblur={() =>
                                            saveDraftHistoryRename(
                                                snapshot.id,
                                            )}
                                        onkeydown={(event) =>
                                            handleRenameKeydown(event, () =>
                                                saveDraftHistoryRename(
                                                    snapshot.id,
                                                ),
                                            )}
                                    />
                                {:else}
                                    <button
                                        type="button"
                                        class="draft-history-apply"
                                        title="더블클릭해서 제목 변경"
                                        onclick={(event) =>
                                            scheduleCardApply(
                                                () =>
                                                    restoreDraftHistorySnapshot(
                                                        snapshot,
                                                    ),
                                                event,
                                            )}
                                        ondblclick={(event) =>
                                            beginDraftHistoryRename(
                                                snapshot,
                                                event,
                                            )}
                                    >
                                        <span>{draftHistoryName(snapshot)}</span>
                                        <small
                                            >{draftHistorySummary(
                                                snapshot,
                                            )}</small
                                        >
                                    </button>
                                {/if}
                                <button
                                    type="button"
                                    class="draft-history-delete"
                                    aria-label={`${draftHistoryName(
                                        snapshot,
                                    )} 삭제`}
                                    title="삭제"
                                    onclick={() =>
                                        deleteDraftHistory(snapshot.id)}
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        {/each}
                    {/if}
                </div>
            </section>
        </div>
    {/if}
    </div>

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
                    aria-label="Markdown 적용하기"
                    onclick={importMarkdownDraft}
                >
                    <FileText size={16} />
                    <span>적용하기</span>
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
                <button
                    class="markdown-clear-button"
                    type="button"
                    aria-label="Markdown 닫기"
                    onclick={() => (isMarkdownPanelOpen = false)}
                >
                    <X size={15} />
                    <span>닫기</span>
                </button>
                <span
                    class:error={markdownImportState === "error"}
                    class="markdown-status">{markdownImportStateLabel}</span
                >
            </div>
        </section>
    {/if}

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
                style={`--editor-body-font-size:${bodyFontSize};--editor-code-font-size:${codeFontSize}`}
                bind:this={editorHost}
            ></div>
            {#if codeLineContextMenu}
                <div
                    class="code-line-context-menu"
                    role="menu"
                    tabindex="-1"
                    aria-label={`코드 ${codeLineContextMenu.line}번 줄`}
                    style={`left:${codeLineContextMenu.x}px;top:${codeLineContextMenu.y}px`}
                    bind:this={codeLineContextMenuElement}
                    onpointerdown={(event) => event.stopPropagation()}
                >
                    <span class="code-line-context-title"
                        >{codeLineContextMenu.line}번 줄</span
                    >
                    {#each codeLineMarkers as marker}
                        <button
                            class:active={codeLineContextMenuActive(marker)}
                            type="button"
                            role="menuitem"
                            onclick={() => toggleCodeLineMarker(marker)}
                        >
                            {codeLineMarkerLabel(marker)}
                        </button>
                    {/each}
                </div>
            {/if}
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
                    <span class="status-pill" aria-label="현재 복붙 구조">DC 테이블</span>
                    <span class="status-pill" aria-label="현재 글 배경"
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

    <a
        class="floating-github-link"
        href="https://github.com/0disoft/dc-code-paste"
        target="_blank"
        rel="noopener noreferrer"
        title="GitHub 저장소"
        aria-label="GitHub 저장소 새 탭으로 열기"
    >
        <Github size={21} />
    </a>
</main>

<style>
    .workspace {
        width: min(1560px, calc(100vw - 28px));
        min-height: 100vh;
        margin: 0 auto;
        padding: 10px 0 34px;
    }

    .toolbar-shell {
        position: sticky;
        top: 8px;
        z-index: 20;
        display: grid;
        gap: 5px;
        max-height: calc(100vh - 16px);
        margin-bottom: 8px;
        overflow: auto;
        overscroll-behavior: contain;
        scrollbar-gutter: stable;
    }

    .toolbar {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        gap: 9px 10px;
        align-items: stretch;
        padding: 10px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: color-mix(in oklch, var(--panel) 98%, oklch(0% 0 0 / 0));
        box-shadow: 0 18px 44px oklch(0% 0 0 / 0.18);
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

    .tool-panel-tabs {
        grid-column: 3;
        width: max-content;
    }

    .toolbar .tool-panel-tabs button {
        min-width: 82px;
    }

    .link-tool,
    .tool-panel,
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
        font-weight: 500;
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

    .floating-github-link {
        position: fixed;
        left: 12px;
        bottom: 12px;
        z-index: 35;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        border: 1px solid color-mix(in oklch, var(--line) 82%, transparent);
        border-radius: 999px;
        background: color-mix(in oklch, var(--panel) 92%, transparent);
        color: var(--muted);
        box-shadow: 0 16px 34px oklch(0% 0 0 / 0.2);
        text-decoration: none;
        backdrop-filter: blur(10px);
        transition:
            border-color 0.16s ease,
            color 0.16s ease,
            transform 0.16s ease;
    }

    .floating-github-link:hover,
    .floating-github-link:focus-visible {
        border-color: color-mix(in oklch, var(--accent) 68%, var(--line));
        color: var(--accent);
        transform: translateY(-1px);
        outline: none;
    }

    .toolbar .copy-button {
        min-width: 112px;
        border-color: color-mix(in oklch, var(--accent) 72%, oklch(0% 0 0));
        background: var(--accent);
        color: oklch(22.89% 0.055 118.8);
        font-weight: 500;
    }

    .toolbar .copy-button:disabled {
        cursor: wait;
        opacity: 0.72;
    }

    label {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        color: var(--muted);
        font-size: 13px;
        font-weight: 500;
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

    input[type="text"].error {
        border-color: var(--danger);
        background: color-mix(in oklch, var(--danger) 12%, var(--panel-2));
    }

    input[type="text"]:disabled {
        cursor: not-allowed;
        opacity: 0.5;
    }

    .block-label-field input {
        width: 150px;
    }

    .callout-color-field {
        gap: 8px;
    }

    .callout-color-controls {
        display: inline-flex;
        gap: 8px;
        align-items: center;
    }

    .callout-color-swatches {
        display: inline-flex;
        gap: 6px;
        align-items: center;
    }

    .toolbar .callout-color-swatch {
        width: 24px;
        min-width: 24px;
        height: 24px;
        padding: 0;
        border-radius: 999px;
        background: var(--swatch);
    }

    .toolbar .callout-color-swatch.active {
        box-shadow:
            0 0 0 2px var(--panel-2),
            0 0 0 4px var(--accent);
    }

    .callout-color-input {
        position: absolute;
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
    }

    .code-filename-input,
    .line-highlight-input {
        width: 170px;
    }

    .line-range-hint {
        color: var(--danger);
        font-size: 12px;
        font-weight: 500;
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
            D2Coding,
            나눔고딕코딩,
            Noto Sans Mono CJK,
            JetBrains Mono,
            Fira Code,
            Hack,
            Source Code Pro,
            IBM Plex Mono,
            Roboto Mono,
            Consolas,
            Menlo,
            Monaco,
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
    .markdown-clear-button,
    .panel-close-button {
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

    .storage-panel {
        grid-column: 1 / -1;
        position: relative;
        display: grid;
        gap: 5px;
        margin: 0;
        padding-right: 38px;
    }

    .storage-panel-close {
        position: absolute;
        top: 9px;
        right: 9px;
        z-index: 1;
        width: 32px;
        min-width: 32px;
        height: 32px;
        padding: 0;
        color: var(--muted);
    }

    .storage-panel-close:hover {
        color: var(--danger);
    }

    .preset-panel,
    .draft-history-panel {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
        margin: 0;
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

    .preset-rename-input {
        min-width: 150px;
        max-width: 210px;
        border: 0;
        border-right: 1px solid var(--line);
        outline: 2px solid var(--accent);
        outline-offset: -2px;
        background: color-mix(in oklch, var(--panel) 88%, var(--accent) 12%);
        color: var(--text);
        padding: 7px 10px;
        font-size: 13px;
        font-weight: 900;
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

    .code-line-context-menu {
        position: fixed;
        z-index: 50;
        display: grid;
        min-width: 176px;
        gap: 4px;
        padding: 7px;
        border: 1px solid var(--line);
        border-radius: 7px;
        background: var(--panel);
        box-shadow: 0 14px 34px oklch(0% 0 0 / 0.32);
    }

    .code-line-context-title {
        padding: 5px 7px 4px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.2;
    }

    .code-line-context-menu button {
        justify-content: flex-start;
        min-height: 32px;
        border: 1px solid transparent;
        border-radius: 6px;
        background: transparent;
        color: var(--text);
        font-size: 14px;
        font-weight: 500;
    }

    .code-line-context-menu button:hover,
    .code-line-context-menu button.active {
        border-color: color-mix(in oklch, var(--accent) 48%, transparent);
        background: color-mix(in oklch, var(--accent) 16%, transparent);
        color: var(--accent);
    }

    .editor-surface :global(.article-editor) {
        min-height: 640px;
        outline: none;
        font-family:
            Pretendard,
            Noto Sans KR,
            Noto Sans CJK KR,
            본고딕,
            Nanum Gothic,
            NanumSquare Neo,
            나눔고딕,
            나눔스퀘어,
            나눔바른고딕,
            AppleGothic,
            Segoe UI,
            Malgun Gothic,
            맑은 고딕,
            Noto Sans,
            Arial,
            Helvetica Neue,
            Helvetica,
            sans-serif;
        font-size: var(--editor-body-font-size, 17px);
        line-height: 1.7;
        overflow-wrap: break-word;
        word-break: keep-all;
    }

    .editor-surface :global(.article-editor > *:first-child) {
        margin-top: 0;
    }

    .editor-surface :global(.article-editor h1) {
        margin: 0 0 14px;
        color: oklch(24.19% 0.019 255.77);
        font-size: 26px;
        font-weight: 700;
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
        position: relative;
        margin: 0 0 16px;
        overflow: auto;
        border: 1px solid oklch(25.36% 0.021 258.42);
        border-radius: 7px;
        background: oklch(18.22% 0.017 258.21);
        color: oklch(90.2% 0.018 258.33);
        padding: 14px 16px;
        box-shadow: inset 0 1px 0 oklch(100% 0 0 / 0.04);
        font-size: var(--editor-code-font-size, 15px);
        line-height: 1.4;
        font-family:
            Cascadia Mono,
            D2Coding,
            나눔고딕코딩,
            Noto Sans Mono CJK,
            JetBrains Mono,
            Fira Code,
            Hack,
            Source Code Pro,
            IBM Plex Mono,
            Roboto Mono,
            Consolas,
            Menlo,
            Monaco,
            monospace;
        overflow-wrap: normal;
        word-break: normal;
    }

    .editor-surface :global(.article-editor pre.dc-editor-code[data-filename]) {
        padding-top: 46px;
    }

    .editor-surface
        :global(.article-editor pre.dc-editor-code[data-filename]::before) {
        position: absolute;
        top: 0;
        right: 0;
        left: 0;
        display: block;
        padding: 8px 16px;
        border-bottom: 1px solid oklch(28.89% 0.019 258.78);
        background: oklch(13.54% 0.017 258.36);
        color: oklch(92.34% 0.018 258.5);
        content: attr(data-filename);
        font-size: 13px;
        font-weight: 800;
        line-height: 1.1;
    }

    .editor-surface :global(.article-editor pre code) {
        display: block;
        min-width: max-content;
        font-family: inherit;
    }

    .editor-surface :global(.article-editor .dc-code-token-keyword) {
        color: oklch(74.26% 0.139 304.74);
        font-weight: 800;
    }

    .editor-surface :global(.article-editor .dc-code-token-string) {
        color: oklch(78.2% 0.144 145.22);
    }

    .editor-surface :global(.article-editor .dc-code-token-comment) {
        color: oklch(62.18% 0.027 257.46);
        font-style: italic;
    }

    .editor-surface :global(.article-editor .dc-code-token-number) {
        color: oklch(80.21% 0.118 69.52);
    }

    .editor-surface :global(.article-editor .dc-code-token-function) {
        color: oklch(78.12% 0.098 235.62);
        font-weight: 700;
    }

    .editor-surface :global(.article-editor :not(pre) > code) {
        border-radius: 4px;
        background: oklch(94.93% 0.016 255.07);
        color: oklch(34.86% 0.087 278.64);
        font-family:
            Cascadia Mono,
            D2Coding,
            나눔고딕코딩,
            Noto Sans Mono CJK,
            JetBrains Mono,
            Fira Code,
            Hack,
            Source Code Pro,
            IBM Plex Mono,
            Roboto Mono,
            Consolas,
            Menlo,
            Monaco,
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
        align-items: center;
        margin: 0;
        padding: 11px 14px 11px 12px;
        border-bottom: 1px solid oklch(88.91% 0.035 247.16);
        line-height: 1.18;
    }

    .editor-surface :global(.dc-reference-item:last-child) {
        border-bottom: 0;
    }

    .editor-surface :global(.dc-reference-item::before) {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 30px;
        height: 18px;
        border-radius: 4px;
        background: oklch(56.77% 0.154 252.96);
        color: oklch(99.21% 0.006 247.8);
        content: counter(list-item, decimal-leading-zero);
        font-size: 11px;
        font-weight: 900;
        line-height: 18px;
        align-self: center;
    }

    .editor-surface :global(.dc-reference-item a) {
        display: inline-block;
        margin: 0;
        line-height: 1.18;
        vertical-align: middle;
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
        content: attr(data-label);
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
        position: relative;
        margin: 0 0 7px;
        padding-left: 28px;
        line-height: 1.62;
        list-style: none;
        min-width: 0;
    }

    .editor-surface :global(.dc-summary-item:last-child) {
        margin-bottom: 0;
    }

    .editor-surface :global(.dc-summary-item::before) {
        position: absolute;
        top: 0.81em;
        left: 0;
        width: 8px;
        height: 8px;
        transform: translateY(-50%);
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
        font-size: 28px;
        font-weight: 700;
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
        min-width: 34px;
        height: 22px;
        border-radius: 4px;
        background: oklch(61.2% 0.049 77.83);
        color: oklch(99.1% 0.006 93.08);
        content: attr(data-number);
        font-size: 12px;
        font-weight: 900;
        line-height: 22px;
    }

    .editor-surface :global(.dc-tutorial-number:not([data-number])::before) {
        content: counter(dc-tutorial-step, decimal-leading-zero);
    }

    .editor-surface :global(.dc-tutorial-title) {
        color: oklch(25.72% 0.021 255.63);
        font-size: 18px;
        font-weight: 900;
        line-height: 1.32;
    }

    .editor-surface :global(.dc-tutorial-body) {
        padding-left: 34px;
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
        border-left: 4px solid var(--dc-callout-border);
        border-radius: 7px;
        background: var(--dc-callout-background);
        color: var(--dc-callout-text);
    }

    .editor-surface-dark :global(.dc-callout) {
        border-left-color: var(--dc-callout-dark-border);
        background: var(--dc-callout-dark-background);
        color: var(--dc-callout-dark-text);
    }

    .editor-surface :global(.dc-callout-tip) {
        --dc-callout-border: oklch(70.89% 0.156 142.5);
        --dc-callout-background: oklch(96.48% 0.047 142.49);
        --dc-callout-text: oklch(30.18% 0.073 145.31);
    }

    .editor-surface-dark :global(.dc-callout-tip) {
        --dc-callout-dark-border: oklch(76.13% 0.153 142.04);
        --dc-callout-dark-background: oklch(11.88% 0.018 142.78);
        --dc-callout-dark-text: oklch(91.89% 0.026 143.2);
    }

    .editor-surface :global(.dc-callout-warning) {
        --dc-callout-border: oklch(73.08% 0.151 60.74);
        --dc-callout-background: oklch(96.87% 0.048 75.17);
        --dc-callout-text: oklch(34.21% 0.082 52.58);
    }

    .editor-surface-dark :global(.dc-callout-warning) {
        --dc-callout-dark-border: oklch(78.46% 0.145 69.41);
        --dc-callout-dark-background: oklch(12.26% 0.018 58.76);
        --dc-callout-dark-text: oklch(92.96% 0.03 76.33);
    }

    .editor-surface :global(.dc-callout-reference) {
        --dc-callout-border: oklch(68.74% 0.127 246.28);
        --dc-callout-background: oklch(96.27% 0.036 247.39);
        --dc-callout-text: oklch(32.26% 0.07 249.42);
    }

    .editor-surface-dark :global(.dc-callout-reference) {
        --dc-callout-dark-border: oklch(72.52% 0.142 232.16);
        --dc-callout-dark-background: oklch(11.62% 0.021 245.9);
        --dc-callout-dark-text: oklch(91.87% 0.029 233.82);
    }

    .editor-surface :global(.dc-callout-emphasis) {
        --dc-callout-border: oklch(64.73% 0.162 303.08);
        --dc-callout-background: oklch(96.21% 0.036 302.35);
        --dc-callout-text: oklch(33.84% 0.091 303.69);
    }

    .editor-surface-dark :global(.dc-callout-emphasis) {
        --dc-callout-dark-border: oklch(73.79% 0.151 303.45);
        --dc-callout-dark-background: oklch(12.04% 0.022 302.17);
        --dc-callout-dark-text: oklch(93.04% 0.029 303.2);
    }

    .editor-surface :global(.dc-callout-success) {
        --dc-callout-border: oklch(66.42% 0.152 154.12);
        --dc-callout-background: oklch(96.12% 0.041 152.76);
        --dc-callout-text: oklch(29.24% 0.08 154.12);
    }

    .editor-surface-dark :global(.dc-callout-success) {
        --dc-callout-dark-border: oklch(76.71% 0.151 154.54);
        --dc-callout-dark-background: oklch(11.76% 0.02 154.8);
        --dc-callout-dark-text: oklch(92.34% 0.029 154.17);
    }

    .editor-surface :global(.dc-callout-failure) {
        --dc-callout-border: oklch(62.42% 0.178 24.04);
        --dc-callout-background: oklch(96.23% 0.039 24.18);
        --dc-callout-text: oklch(34.1% 0.098 24.62);
    }

    .editor-surface-dark :global(.dc-callout-failure) {
        --dc-callout-dark-border: oklch(75.02% 0.17 24.82);
        --dc-callout-dark-background: oklch(12.02% 0.021 24.58);
        --dc-callout-dark-text: oklch(93.14% 0.03 24.92);
    }

    .editor-surface :global(.dc-callout-experiment) {
        --dc-callout-border: oklch(62.11% 0.15 263.9);
        --dc-callout-background: oklch(96.2% 0.032 264.42);
        --dc-callout-text: oklch(31.56% 0.081 264.1);
    }

    .editor-surface-dark :global(.dc-callout-experiment) {
        --dc-callout-dark-border: oklch(73.44% 0.145 264.2);
        --dc-callout-dark-background: oklch(11.48% 0.022 264.32);
        --dc-callout-dark-text: oklch(92.52% 0.031 264.14);
    }

    .editor-surface :global(.dc-callout-conclusion) {
        --dc-callout-border: oklch(72.44% 0.119 91.73);
        --dc-callout-background: oklch(96.87% 0.042 94.2);
        --dc-callout-text: oklch(34.5% 0.065 88.3);
    }

    .editor-surface-dark :global(.dc-callout-conclusion) {
        --dc-callout-dark-border: oklch(80.18% 0.126 91.43);
        --dc-callout-dark-background: oklch(12.18% 0.018 91.22);
        --dc-callout-dark-text: oklch(93.56% 0.027 91.42);
    }

    .editor-surface :global(.dc-callout-rebuttal) {
        --dc-callout-border: oklch(64.8% 0.157 330.2);
        --dc-callout-background: oklch(96.1% 0.038 330.12);
        --dc-callout-text: oklch(34.4% 0.096 329.55);
    }

    .editor-surface-dark :global(.dc-callout-rebuttal) {
        --dc-callout-dark-border: oklch(75.91% 0.154 330.36);
        --dc-callout-dark-background: oklch(12.11% 0.023 330.24);
        --dc-callout-dark-text: oklch(93.11% 0.031 330.24);
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
            D2Coding,
            나눔고딕코딩,
            Noto Sans Mono CJK,
            JetBrains Mono,
            Fira Code,
            Hack,
            Source Code Pro,
            IBM Plex Mono,
            Roboto Mono,
            Consolas,
            Menlo,
            Monaco,
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
            D2Coding,
            나눔고딕코딩,
            Noto Sans Mono CJK,
            JetBrains Mono,
            Fira Code,
            Hack,
            Source Code Pro,
            IBM Plex Mono,
            Roboto Mono,
            Consolas,
            Menlo,
            Monaco,
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

        .toolbar {
            grid-template-columns: minmax(0, 1fr);
        }

        .command-group,
        .inline-group,
        .tool-panel-tabs,
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

        .floating-github-link {
            left: 8px;
            bottom: 8px;
            width: 42px;
            height: 42px;
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
