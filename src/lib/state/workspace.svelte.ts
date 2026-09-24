import { onDestroy, onMount, tick, untrack } from "svelte";
import { createEditorMountController } from "$lib/state/editor-mount";

import type { Editor, JSONContent } from "@tiptap/core";

import type { Node as ProseMirrorNode, ResolvedPos } from "@tiptap/pm/model";

import { NodeSelection, TextSelection } from "@tiptap/pm/state";

import type { EditorView } from "@tiptap/pm/view";

import { defaultProseFontFamily } from "$lib/dc/font-stacks";

import { sanitizeReadableTextColor } from "$lib/dc/sanitize-style";

import {
  defaultDcExportStructure,
  createDcExportSession,
  type DcDocumentTheme,
  type DcExportOptions,
} from "$lib/dc/export-document";

import { sampleDocument } from "$lib/editor/sample-document";

import {
  defaultLanguage,
  defaultTheme,
  isSupportedLanguage,
  supportedLanguageGroups,
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

import { selectedInlineRangeToCalloutCommand } from "$lib/editor/selection-commands";
import { createEditorCommandAdapter } from "$lib/editor/command-adapter";
import { isComposingKeyEvent } from "$lib/editor/keyboard-shortcuts";

import {
  clearDraftSnapshot,
  draftStorageKey,
  maxDraftHistoryCount,
  parseDraftSnapshot,
  readDraftSnapshot,
  readDraftSnapshotWithRecovery,
  type DraftHistorySnapshot,
  type DraftPreferences,
} from "$lib/editor/draft-storage";

import {
  ctaGroupLayoutOptions,
  normalizeCtaGroupLayout,
  type CtaGroupLayout,
} from "$lib/editor/cta-group";

import { normalizeEditableLinkHref } from "$lib/editor/link";

import { llmAuthoringPrompt } from "$lib/editor/llm-authoring-prompt";

import {
  autocompleteLlmModelOptions,
  defaultLlmProviderId,
  llmModelAutocompleteLimit,
  llmProviders,
  openRouterTopWeeklyModelLimit,
  providerDefinition,
  requestOpenRouterModels,
  type OpenRouterModelOption,
  type LlmProviderId,
} from "$lib/editor/llm-generation";

import { hasUnclosedCustomBlock, parseMarkdownToDocument } from "$lib/editor/markdown-import";

import {
  codeLineRangeContains,
  codeLineRangeLabel,
  selectedCodeLineRangeFromOffsets,
  type CodeLineRange,
} from "$lib/editor/code-line-range";

import { normalizeQuoteStyle, quoteStyleOptions, type QuoteStyle } from "$lib/editor/quote-style";

import { defaultSummaryBoxLabel } from "$lib/editor/summary-box";

import {
  createDefaultTutorialBlock,
  createTutorialStep,
  createTutorialBlockFromText,
  normalizeTutorialStepNumber,
} from "$lib/editor/tutorial-block";

import { normalizeCodeFilename } from "$lib/highlighter/code-block-metadata";

import { maxHighlightLineNumber, normalizeHighlightLines } from "$lib/highlighter/highlight-lines";

import {
  createPresetSnapshot,
  deletePresetSnapshot,
  readPresetSnapshots,
  renamePresetSnapshot,
  writePresetSnapshots,
  type PresetSnapshot,
} from "$lib/editor/preset-storage";

import {
  copyDcPreview,
  copyPlainTextWithState,
  copySourceHtml as copySourceHtmlText,
  createCopyFeedbackController,
  createWorkspacePreviewRenderer,
} from "$lib/state/workspace-export";
import { createLlmRequestController, type LlmGenerationState } from "$lib/state/llm-request";
import {
  createDraftPersistenceController,
  type DraftSaveState,
} from "$lib/state/draft-persistence";
import { createDraftHistoryController, draftHistoryFingerprint } from "$lib/state/draft-history";

export function createWorkspaceState() {
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
  } satisfies Record<DcDocumentTheme, { background: string; fallback: string }>;

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
    attrName: "label" | "number" | "title";
  };

  type TutorialBlockTarget = {
    pos: number;
  };

  type RenameTarget = { kind: "preset"; id: string } | { kind: "draft"; id: string };

  type CodeLineMarker = "highlightLines" | "additionLines" | "deletionLines";

  type CodeLineContextMenu = {
    x: number;
    y: number;
    range: CodeLineRange;
    pos: number;
  };

  const codeLineMarkers: CodeLineMarker[] = ["highlightLines", "additionLines", "deletionLines"];

  let editorHost = $state<HTMLDivElement>();

  let editor = $state<Editor>();

  let blockLabelInput = $state<HTMLInputElement>();

  let codeFilenameInput = $state<HTMLInputElement>();

  let linkInput = $state<HTMLInputElement>();

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
  let previewError = $state("");
  let editorMountState = $state<"idle" | "loading" | "ready" | "error">("idle");
  let retryEditorMount: (() => Promise<void>) | undefined;

  let previewMode = $state<"rendered" | "source">("rendered");

  let copyState = $state<"idle" | "copied" | "error">("idle");
  let manualCopyHtml = $state("");

  let sourceCopyState = $state<"idle" | "copied" | "error">("idle");

  let isLinkPanelOpen = $state(false);

  let linkDraft = $state("");

  let linkError = $state(false);

  let isMarkdownPanelOpen = $state(false);

  let markdownDraft = $state("");

  let markdownImportState = $state<"idle" | "imported" | "error">("idle");

  let markdownImportError = $state("");

  let llmPromptCopyState = $state<"idle" | "copied" | "error">("idle");

  let isLlmPanelOpen = $state(false);

  let llmProvider = $state<LlmProviderId>(defaultLlmProviderId);

  let llmApiKey = $state("");

  let llmModel = $state("");

  let llmUserPrompt = $state("");

  let openRouterModels = $state<OpenRouterModelOption[]>([]);

  let isOpenRouterTopWeeklyOnly = $state(true);

  let isLlmModelAutocompleteOpen = $state(false);

  let openRouterModelState = $state<"idle" | "loading" | "loaded" | "fallback" | "error">("idle");

  let openRouterModelError = $state("");

  let llmGenerationState = $state<LlmGenerationState>("idle");

  let llmGenerationInFlight = $state(false);

  let llmGenerationError = $state("");

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
  let draftSaveState = $state<DraftSaveState>("idle");
  let draftLastSavedAt = $state("");
  let invalidDraftRaw = $state("");
  let invalidDraftBackupKey = $state("");
  let invalidDraftDownloaded = $state(false);

  let openRouterModelLoadTurn = 0;

  const exportSession = createDcExportSession();
  const copyFeedback = createCopyFeedbackController();
  const llmRequest = createLlmRequestController({
    getDraft: () => markdownDraft,
    applyResult(result) {
      markdownDraft = result.markdown;
      resetMarkdownImportState();
      isMarkdownPanelOpen = true;
      isStoragePanelOpen = false;
      if (result.completionState === "complete") isLlmPanelOpen = false;
    },
    setState(value) {
      llmGenerationState = value;
    },
    setError(value) {
      llmGenerationError = value;
    },
    setInFlight(value) {
      llmGenerationInFlight = value;
    },
  });
  const draftPersistence = createDraftPersistenceController({
    debounceMs: draftPersistDebounceMs,
    getStorage: draftStorage,
    getCurrent: () => ({ document: documentJson, preferences: currentDraftPreferences() }),
    canPersist: () => canPersistDraft,
    cloneDocument: cloneDocumentContent,
    clonePreferences: cloneDraftPreferences,
    setState(value) {
      draftSaveState = value;
    },
    setSavedAt(value) {
      draftLastSavedAt = value;
    },
    onSaved: maybeSaveAutomaticDraftHistory,
  });
  const draftHistoryController = createDraftHistoryController({
    autoIntervalMs: draftHistoryAutoIntervalMs,
    getStorage: draftStorage,
    getCurrent: () => ({ document: documentJson, preferences: currentDraftPreferences() }),
    cloneDocument: cloneDocumentContent,
    clonePreferences: cloneDraftPreferences,
    applySnapshot(value) {
      applyDraftPreferences(value.preferences);
      replaceEditorDocument(value.document);
    },
    setHistory(value) {
      draftHistory = value;
    },
    setState(value) {
      draftHistoryState = value;
    },
  });
  const editorCommands = createEditorCommandAdapter({
    getEditor: () => editor,
    onCommand: refreshEditorState,
  });
  const previewRenderer = createWorkspacePreviewRenderer({
    debounceMs: previewRenderDebounceMs,
    renderDocument: exportSession.exportDocument,
    setHtml(value) {
      html = value;
    },
    setIsRendering(value) {
      isRendering = value;
    },
    setError(value) {
      previewError = value;
    },
  });

  const htmlSize = $derived(html.length === 0 ? "0KB" : `${Math.ceil(html.length / 1024)}KB`);

  const copyLabel = $derived(copyState === "copied" ? "복사됨" : "디씨 복사");

  const sourceCopyLabel = $derived(sourceCopyState === "copied" ? "복사됨" : "원문 복사");

  const documentThemeLabel = $derived(
    documentThemes.find((item) => item.value === documentTheme)?.label ?? "밝은 글",
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
        ? markdownImportError || "비어 있음"
        : "대기",
  );

  const lineRangeHelp = `1-${maxHighlightLineNumber.toLocaleString()} 사이 숫자와 쉼표, 범위만 입력`;

  const codeLineHighlightsInvalid = $derived(isLineRangeInputInvalid(codeLineHighlights));

  const codeAdditionLinesInvalid = $derived(isLineRangeInputInvalid(codeAdditionLines));

  const codeDeletionLinesInvalid = $derived(isLineRangeInputInvalid(codeDeletionLines));

  const llmPromptCopyLabel = $derived(
    llmPromptCopyState === "copied"
      ? "복사됨"
      : llmPromptCopyState === "error"
        ? "복사 실패"
        : "가이드",
  );

  const activeLlmProvider = $derived(providerDefinition(llmProvider));

  const isActiveLlmApiKeyRequired = $derived(activeLlmProvider.requiresApiKey !== false);

  const isActiveLlmBrowserGenerationSupported = $derived(
    activeLlmProvider.supportsBrowserGeneration !== false,
  );

  const llmModelOptions = $derived(
    llmProvider === "openrouter" && openRouterModels.length > 0
      ? openRouterModels
      : activeLlmProvider.models.map((model) => ({
          id: model,
          name: model,
        })),
  );

  const shouldShowInitialLlmModels = $derived(
    llmModel.trim().length === 0 &&
      llmModelOptions.length > 0 &&
      (llmProvider !== "openrouter" || (isOpenRouterTopWeeklyOnly && openRouterModels.length > 0)),
  );

  const activeLlmModelAutocompleteOptions = $derived(
    autocompleteLlmModelOptions(llmModelOptions, llmModel, {
      limit:
        llmProvider === "openrouter" && shouldShowInitialLlmModels
          ? openRouterTopWeeklyModelLimit
          : llmModelAutocompleteLimit,
      showInitialOptions: shouldShowInitialLlmModels,
    }),
  );

  const shouldShowLlmModelAutocomplete = $derived(
    isLlmModelAutocompleteOpen && activeLlmModelAutocompleteOptions.length > 0,
  );

  const llmGenerationStateLabel = $derived(
    llmGenerationState === "loading"
      ? "생성 중"
      : llmGenerationState === "stale"
        ? "이전 요청 응답 대기"
        : llmGenerationState === "ready"
          ? "Markdown에 넣음"
          : llmGenerationState === "incomplete"
            ? llmGenerationError
            : llmGenerationState === "error"
              ? llmGenerationError || "요청 실패"
              : "대기",
  );

  const isLlmGenerateDisabled = $derived(
    llmGenerationInFlight ||
      !isActiveLlmBrowserGenerationSupported ||
      (isActiveLlmApiKeyRequired && !llmApiKey.trim()) ||
      !llmModel.trim() ||
      !llmUserPrompt.trim(),
  );

  const openRouterModelStateLabel = $derived(
    llmProvider !== "openrouter"
      ? ""
      : openRouterModelState === "loading"
        ? "모델 불러오는 중"
        : openRouterModelState === "loaded"
          ? isOpenRouterTopWeeklyOnly
            ? `주간 인기 ${openRouterModels.length.toLocaleString()}개`
            : `${openRouterModels.length.toLocaleString()}개 불러옴`
          : openRouterModelState === "fallback"
            ? `공개 목록 ${openRouterModels.length.toLocaleString()}개`
            : openRouterModelState === "error"
              ? openRouterModelError || "모델 불러오기 실패"
              : isOpenRouterTopWeeklyOnly
                ? "주간 인기 대기"
                : "모델 목록 대기",
  );

  const openCodeGoModelStateLabel = $derived(
    llmProvider === "opencode-go"
      ? (activeLlmProvider.browserGenerationBlockedReason ?? "브라우저 직접 실행 불가")
      : "",
  );

  $effect(() => {
    if (typeof window !== "undefined" && codeLineContextMenu) {
      window.requestAnimationFrame(() => codeLineContextMenuElement?.focus());
    }
  });

  function draftStorage() {
    try {
      return typeof window === "undefined" ? undefined : window.localStorage;
    } catch {
      return undefined;
    }
  }

  function downloadInvalidDraft() {
    if (!invalidDraftRaw) {
      return;
    }

    const url = URL.createObjectURL(new Blob([invalidDraftRaw], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "dc-code-paste-invalid-draft.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    invalidDraftDownloaded = true;
  }

  function resumeDraftSaving() {
    if (!invalidDraftRaw || (!invalidDraftBackupKey && !invalidDraftDownloaded)) {
      return;
    }

    const storage = draftStorage();
    if (!storage) {
      return;
    }

    try {
      if (!invalidDraftBackupKey) {
        storage.removeItem(draftStorageKey);
      }
      invalidDraftRaw = "";
      canPersistDraft = true;
      scheduleDraftPersist(documentJson, currentDraftPreferences());
    } catch {
      // Keep the original draft and the warning visible when storage remains blocked.
    }
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
      structure: defaultDcExportStructure,
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
      structure: defaultDcExportStructure,
    };
  }

  function cloneSerializableValue<T>(value: T): T {
    return JSON.parse(JSON.stringify($state.snapshot(value))) as T;
  }

  function cloneDocumentContent(document: JSONContent): JSONContent {
    return cloneSerializableValue(document);
  }

  function cloneDraftPreferences(preferences: DraftPreferences): DraftPreferences {
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

  function firstCodeBlockLanguage(value: JSONContent): DcLanguageId | undefined {
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
    const ownTextLength = typeof value.text === "string" ? value.text.length : 0;
    const childTextLength =
      value.content?.reduce((total, child) => total + countDocumentText(child), 0) ?? 0;

    return ownTextLength + childTextLength;
  }

  function languageLabel(value: DcLanguageId) {
    return supportedLanguages.find((item) => item.id === value)?.label ?? value;
  }

  function currentDraftHistoryFingerprint() {
    return draftHistoryController.currentFingerprint();
  }

  function checkpointCurrentDraftBeforeReplacement() {
    return draftHistoryController.checkpointBeforeReplacement();
  }

  function draftHistorySummary(snapshot: DraftHistorySnapshot) {
    const themeLabel =
      snapshot.preferences.documentTheme === "darkEditorial" ? "어두운 글" : "밝은 글";
    const textLength = countDocumentText(snapshot.document).toLocaleString();

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

  function clearScheduledPreviewRender() {
    previewRenderer.clearScheduledPreviewRender();
  }

  function clearScheduledDraftPersist() {
    draftPersistence.clearScheduled();
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
    cancelLlmGeneration();
    closeCodeLineContextMenu();
    cancelRename();
    isLinkPanelOpen = false;
    isMarkdownPanelOpen = false;
    isLlmPanelOpen = false;
    isStoragePanelOpen = false;
    activeToolPanel = null;
    resetMarkdownImportState();
  }

  function resetMarkdownImportState() {
    markdownImportState = "idle";
    markdownImportError = "";
  }

  function toggleMarkdownPanel() {
    isMarkdownPanelOpen = !isMarkdownPanelOpen;
    resetMarkdownImportState();

    if (isMarkdownPanelOpen) {
      cancelLlmGeneration();
      isLlmPanelOpen = false;
      isStoragePanelOpen = false;
    }
  }

  function toggleStoragePanel() {
    isStoragePanelOpen = !isStoragePanelOpen;

    if (isStoragePanelOpen) {
      cancelLlmGeneration();
      isMarkdownPanelOpen = false;
      isLlmPanelOpen = false;
      resetMarkdownImportState();
    }
  }

  function toggleLlmPanel() {
    isLlmPanelOpen = !isLlmPanelOpen;
    llmRequest.clearError();

    if (isLlmPanelOpen) {
      isMarkdownPanelOpen = false;
      isStoragePanelOpen = false;
      resetMarkdownImportState();
      if (llmProvider === "openrouter" && openRouterModelState === "idle") {
        void refreshOpenRouterModels();
      }
    } else {
      cancelLlmGeneration();
    }
  }

  function closeLlmPanel() {
    cancelLlmGeneration();
    isLlmPanelOpen = false;
  }

  function cancelLlmGeneration() {
    llmRequest.cancel();
  }

  function markLlmInputChanged() {
    llmRequest.markInputChanged();
  }

  function selectLlmProvider(value: string) {
    markLlmInputChanged();
    const nextProviderDefinition = llmProviders.find(
      (provider) => provider.id === value && provider.supportsBrowserGeneration !== false,
    );
    const nextProvider = nextProviderDefinition?.id ?? defaultLlmProviderId;

    llmProvider = nextProvider;
    llmModel = "";
    isLlmModelAutocompleteOpen = true;

    if (nextProvider === "openrouter") {
      void refreshOpenRouterModels();
    }
  }

  function updateLlmModel(value: string) {
    llmModel = value;
    markLlmInputChanged();
    isLlmModelAutocompleteOpen = true;
  }

  function selectLlmModel(value: string) {
    llmModel = value;
    markLlmInputChanged();
    isLlmModelAutocompleteOpen = false;
  }

  function closeLlmModelAutocompleteSoon() {
    window.setTimeout(() => {
      isLlmModelAutocompleteOpen = false;
    }, 120);
  }

  function closeLlmModelAutocomplete() {
    isLlmModelAutocompleteOpen = false;
  }

  async function refreshOpenRouterModels() {
    if (llmProvider !== "openrouter") {
      return;
    }

    const turn = ++openRouterModelLoadTurn;
    const useTopWeeklyLimit = isOpenRouterTopWeeklyOnly;

    openRouterModelState = "loading";
    openRouterModelError = "";

    try {
      const models = await requestOpenRouterModels(llmApiKey, {
        limit: useTopWeeklyLimit ? openRouterTopWeeklyModelLimit : undefined,
      });
      applyOpenRouterModels(models, "loaded", turn);
    } catch (error) {
      if (!llmApiKey.trim()) {
        applyOpenRouterModelError(error, turn);
        return;
      }

      try {
        const models = await requestOpenRouterModels("", {
          limit: useTopWeeklyLimit ? openRouterTopWeeklyModelLimit : undefined,
        });
        applyOpenRouterModels(models, "fallback", turn);
      } catch (fallbackError) {
        applyOpenRouterModelError(fallbackError, turn);
      }
    }
  }

  function setOpenRouterTopWeeklyOnly(value: boolean) {
    isOpenRouterTopWeeklyOnly = value;
    openRouterModelError = "";

    if (llmProvider === "openrouter") {
      void refreshOpenRouterModels();
    }
  }

  function applyOpenRouterModels(
    models: OpenRouterModelOption[],
    state: "loaded" | "fallback",
    turn: number,
  ) {
    if (turn !== openRouterModelLoadTurn) {
      return;
    }

    openRouterModels = models;
    openRouterModelState = models.length > 0 ? state : "error";
    openRouterModelError = models.length > 0 ? "" : "사용 가능한 모델 없음";

    isLlmModelAutocompleteOpen = true;
  }

  function applyOpenRouterModelError(error: unknown, turn: number) {
    if (turn !== openRouterModelLoadTurn) {
      return;
    }

    openRouterModelState = "error";
    openRouterModelError =
      error instanceof Error ? error.message : "OpenRouter 모델 목록을 불러오지 못했습니다.";
  }

  function beginPresetRename(preset: PresetSnapshot, event: MouseEvent) {
    event.preventDefault();
    renameTarget = { kind: "preset", id: preset.id };
    renameDraft = preset.name;
  }

  function beginDraftHistoryRename(snapshot: DraftHistorySnapshot, event: MouseEvent) {
    event.preventDefault();
    renameTarget = { kind: "draft", id: snapshot.id };
    renameDraft = draftHistoryName(snapshot);
  }

  function cancelRename() {
    renameTarget = null;
    renameDraft = "";
  }

  function refreshPresetSnapshots() {
    const storage = draftStorage();
    presets = storage ? readPresetSnapshots(storage) : [];
  }

  function refreshDraftHistorySnapshots() {
    draftHistoryController.refresh();
  }

  function setDraftHistorySavedState() {
    draftHistoryController.setSavedState();
  }

  function saveDraftHistorySnapshot(options: { automatic: boolean }) {
    return draftHistoryController.save(options);
  }

  function maybeSaveAutomaticDraftHistory() {
    draftHistoryController.maybeSaveAutomatic();
  }

  function restoreDraftHistorySnapshot(snapshot: DraftHistorySnapshot) {
    draftHistoryController.restore(snapshot);
  }

  function saveDraftHistoryRename(id: string) {
    if (!isRenaming("draft", id)) {
      return;
    }

    if (draftHistoryController.rename(id, renameDraft)) cancelRename();
  }

  function deleteDraftHistory(id: string) {
    if (isRenaming("draft", id)) {
      cancelRename();
    }

    draftHistoryController.remove(id);
  }

  function importMarkdownDraft() {
    if (!markdownDraft.trim()) {
      markdownImportState = "error";
      markdownImportError = "비어 있음";
      return;
    }

    if (hasUnclosedCustomBlock(markdownDraft)) {
      markdownImportState = "error";
      markdownImportError = "닫히지 않은 ::: 블록";
      return;
    }

    if (!checkpointCurrentDraftBeforeReplacement()) {
      markdownImportState = "error";
      markdownImportError = "복구 지점 저장 실패";
      return;
    }

    const nextDocument = parseMarkdownToDocument(markdownDraft, {
      defaultLanguage: language,
      sanitizeCodeHighlightLines: true,
    });
    const importedLanguage = firstCodeBlockLanguage(nextDocument);

    if (importedLanguage) {
      language = importedLanguage;
    }

    replaceEditorDocument(nextDocument);

    markdownImportError = "";
    markdownImportState = "imported";
    isMarkdownPanelOpen = false;
    window.setTimeout(() => {
      resetMarkdownImportState();
    }, 1300);
  }

  function clearMarkdownDraft() {
    markdownDraft = "";
    resetMarkdownImportState();
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
    const nextPresets = [preset, ...readPresetSnapshots(storage)].slice(0, 30);

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
    if (!checkpointCurrentDraftBeforeReplacement()) {
      presetState = "error";
      return;
    }

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
      structure: defaultDcExportStructure,
    };
  }

  async function renderPreview(nextDocument: JSONContent, options: DcExportOptions) {
    await previewRenderer.renderPreview(nextDocument, options);
  }

  async function retryPreview() {
    await renderPreview(documentJson, exportOptions());
  }

  function retryEditor() {
    void retryEditorMount?.();
  }

  function schedulePreviewRender(nextDocument: JSONContent, options: DcExportOptions) {
    previewRenderer.schedulePreviewRender(nextDocument, options);
  }

  function scheduleDraftPersist(nextDocument: JSONContent, preferences: DraftPreferences) {
    draftPersistence.schedule({ document: nextDocument, preferences });
  }

  function flushScheduledDraftPersist() {
    draftPersistence.flush();
  }

  function retryDraftSave() {
    draftPersistence.retry();
  }

  function observeDraftStorageChange(raw: string | null) {
    draftPersistence.observeExternal(raw);
  }

  function loadOtherTabDraft() {
    const storage = draftStorage();
    if (!storage || !editor || draftSaveState !== "conflict") {
      return;
    }

    let raw: string | null;
    try {
      raw = storage.getItem(draftStorageKey);
    } catch {
      return;
    }
    const remote = raw ? parseDraftSnapshot(raw) : undefined;
    if (!remote) {
      return;
    }
    try {
      editor.schema.nodeFromJSON(remote.document).check();
    } catch {
      return;
    }
    if (!checkpointCurrentDraftBeforeReplacement()) {
      return;
    }

    draftPersistence.acceptRemote(raw, remote);
    applyDraftPreferences(cloneDraftPreferences(remote.preferences));
    replaceEditorDocument(remote.document);
  }

  function overwriteOtherTabDraft() {
    const storage = draftStorage();
    if (!storage || draftSaveState !== "conflict") {
      return;
    }

    const recovered = readDraftSnapshotWithRecovery(storage, (snapshot) => {
      try {
        editor?.schema.nodeFromJSON(snapshot.document).check();
        return true;
      } catch {
        return false;
      }
    });
    if (recovered.invalidRaw && !recovered.backupKey) {
      return;
    }
    let raw: string | null;
    try {
      raw = storage.getItem(draftStorageKey);
    } catch {
      return;
    }
    draftPersistence.overwriteBaseline(raw);
    draftPersistence.persistCurrent();
  }

  function normalizeBlockLabel(value: unknown) {
    return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 40) : "";
  }

  function normalizeEditableBlockValue(
    value: unknown,
    target: Pick<EditableBlockLabelTarget, "attrName" | "fallback">,
  ) {
    return target.attrName === "number"
      ? normalizeTutorialStepNumber(value, Number(target.fallback))
      : normalizeBlockLabel(value);
  }

  function editableBlockLabelFallback(nodeName: string, attrs: Record<string, unknown> = {}) {
    if (nodeName === "heroBlock") {
      return { attrName: "label" as const, fallback: "CODING GUIDE" };
    }

    if (nodeName === "summaryBox") {
      return { attrName: "label" as const, fallback: defaultSummaryBoxLabel };
    }

    if (nodeName === "tutorialStep") {
      return { attrName: "number" as const, fallback: "1" };
    }

    if (nodeName === "comparisonColumn") {
      return {
        attrName: "title" as const,
        fallback: attrs.side === "right" ? "After" : "Before",
      };
    }

    const calloutKind = calloutKindFromNodeName(nodeName);
    return calloutKind
      ? { attrName: "label" as const, fallback: defaultCalloutLabel(calloutKind) }
      : undefined;
  }

  function findEditableBlockLabelTargetFromResolvedPos(
    resolvedPos: ResolvedPos,
  ): (EditableBlockLabelTarget & { label: string }) | null {
    for (let depth = resolvedPos.depth; depth > 0; depth -= 1) {
      const node = resolvedPos.node(depth);
      const config = editableBlockLabelFallback(node.type.name, node.attrs);

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

  function syncBlockLabelTarget(target: (EditableBlockLabelTarget & { label: string }) | null) {
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
    return findEditableBlockLabelTargetFromResolvedPos(current.state.selection.$from);
  }

  function syncBlockLabelDraft(current: Editor) {
    syncBlockLabelTarget(findEditableBlockLabelTarget(current));
  }

  function syncBlockLabelDraftFromPosition(current: Editor, pos: number) {
    syncBlockLabelTarget(
      findEditableBlockLabelTargetFromResolvedPos(current.state.doc.resolve(pos)),
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
    tutorialBlockTarget = findTutorialBlockTargetFromResolvedPos(current.state.selection.$from);
  }

  function syncTutorialBlockTargetFromPosition(current: Editor, pos: number) {
    tutorialBlockTarget = findTutorialBlockTargetFromResolvedPos(current.state.doc.resolve(pos));
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
    const callout = selectedCalloutFromResolvedPos(current.state.selection.$from);

    if (callout) {
      activeCalloutKind = callout.kind;
      activeCalloutColor = callout.color;
    }
  }

  function syncCalloutColorDraftFromPosition(current: Editor, pos: number) {
    const callout = selectedCalloutFromResolvedPos(current.state.doc.resolve(pos));

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
    return editor ? calloutNodeNames.some((nodeName) => editor?.isActive(nodeName)) : false;
  }

  function runEditorCommand(command: (current: Editor) => boolean) {
    editorCommands.run(command);
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
      const fallback = node ? editableBlockLabelFallback(node.type.name, node.attrs) : undefined;

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
    if (event.key !== "Enter" || isComposingKeyEvent(event)) {
      return;
    }

    event.preventDefault();
    applyBlockLabel();
  }

  function applyCodeBlock() {
    if (codeLineHighlightsInvalid || codeAdditionLinesInvalid || codeDeletionLinesInvalid) {
      return;
    }

    const { highlightLines, additionLines, deletionLines } = normalizeCodeLineMarkers({
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

    editorCommands.applyCodeBlock({
      language,
      highlightLines,
      filename,
      additionLines,
      deletionLines,
    });
  }

  function applyCodeFilename() {
    const filename = normalizeCodeFilename(codeFilename);
    codeFilename = filename;
    runEditorCommand((current) =>
      current.chain().focus().updateAttributes("codeBlock", { filename }).run(),
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
      current.chain().focus().updateAttributes("codeBlock", markerAttrs).run(),
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
      current.chain().focus().updateAttributes("codeBlock", markerAttrs).run(),
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
      current.chain().focus().updateAttributes("codeBlock", markerAttrs).run(),
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

  function toggleLinesInRange(value: unknown, range: CodeLineRange) {
    const lines = lineSetFromRange(value);
    let allLinesActive = true;

    for (let line = range.fromLine; line <= range.toLine; line += 1) {
      if (!lines.has(line)) {
        allLinesActive = false;
        break;
      }
    }

    for (let line = range.fromLine; line <= range.toLine; line += 1) {
      if (allLinesActive) {
        lines.delete(line);
      } else {
        lines.add(line);
      }
    }

    return compactLineSet(lines);
  }

  function isCodeLineRangeActive(value: unknown, range: CodeLineRange) {
    const lines = lineSetFromRange(value);

    for (let line = range.fromLine; line <= range.toLine; line += 1) {
      if (!lines.has(line)) {
        return false;
      }
    }

    return true;
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

  function closestEditableBlockLabelElement(target: EventTarget | null): HTMLElement | undefined {
    if (!(target instanceof Element)) {
      return undefined;
    }

    const tutorialLabel = target.closest(
      ".dc-tutorial-head, .dc-tutorial-number, .dc-tutorial-title",
    );
    if (tutorialLabel) {
      const tutorialStep = tutorialLabel.closest(".dc-tutorial-step");
      return tutorialStep instanceof HTMLElement ? tutorialStep : undefined;
    }

    if (target.closest(".dc-tutorial-body")) {
      return undefined;
    }

    const element = target.closest(
      [".dc-hero-block", ".dc-summary-box", ".dc-callout", ".dc-comparison-column"].join(","),
    );

    return element instanceof HTMLElement ? element : undefined;
  }

  function closestEditableLinkElement(target: EventTarget | null): HTMLElement | undefined {
    if (!(target instanceof Element)) {
      return undefined;
    }

    const element = target.closest(
      ["a[href]", "a[data-dc-cta-button]", "[data-dc-link-box]", "[data-dc-reference-item]"].join(
        ",",
      ),
    );

    return element instanceof HTMLElement ? element : undefined;
  }

  function codeFilenameBarHeight(pre: HTMLElement) {
    const parsedPaddingTop = Number.parseFloat(getComputedStyle(pre).paddingTop);

    return Number.isFinite(parsedPaddingTop) ? parsedPaddingTop : 0;
  }

  function isCodeFilenameBarEvent(pre: HTMLElement, event: MouseEvent) {
    if (!pre.hasAttribute("data-filename")) {
      return false;
    }

    const rect = pre.getBoundingClientRect();
    const headerHeight = codeFilenameBarHeight(pre);

    return (
      headerHeight > 0 && event.clientY >= rect.top && event.clientY <= rect.top + headerHeight
    );
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

  function codeBlockFromPre(view: EditorView, pre: HTMLElement) {
    const rect = pre.getBoundingClientRect();
    const headerHeight = codeFilenameBarHeight(pre);
    const position = view.posAtCoords({
      left: rect.left + Math.min(Math.max(rect.width - 4, 4), 18),
      top: rect.top + headerHeight + 1,
    });

    return position ? codeBlockAtPosition(view, position.pos) : undefined;
  }

  function clickedCodeLine(pre: HTMLElement, lineCount: number, event: MouseEvent) {
    const code = pre.querySelector("code") ?? pre;
    const rect = code.getBoundingClientRect();
    const style = getComputedStyle(code);
    const fontSize = Number.parseFloat(style.fontSize);
    const parsedLineHeight = Number.parseFloat(style.lineHeight);
    const lineHeight = Number.isFinite(parsedLineHeight) ? parsedLineHeight : fontSize * 1.4;
    const y = event.clientY - rect.top + pre.scrollTop;
    const line = Math.floor(Math.max(0, y) / lineHeight) + 1;

    return Math.max(1, Math.min(lineCount, line));
  }

  function selectedCodeLineRange(
    view: EditorView,
    codeBlock: { node: ProseMirrorNode; pos: number },
    clickedLine: number,
  ): CodeLineRange | undefined {
    const selection = view.state.selection;

    if (selection.empty) {
      return undefined;
    }

    const contentStart = codeBlock.pos + 1;
    const contentEnd = contentStart + codeBlock.node.content.size;

    if (selection.from < contentStart || selection.to > contentEnd) {
      return undefined;
    }

    const range = selectedCodeLineRangeFromOffsets(
      codeBlock.node.textContent,
      selection.from - contentStart,
      selection.to - contentStart,
    );

    if (!range || !codeLineRangeContains(range, clickedLine)) {
      return undefined;
    }

    return range;
  }

  async function focusCodeFilenameInput() {
    await tick();
    codeFilenameInput?.focus();
    codeFilenameInput?.select();
  }

  async function focusBlockLabelInput() {
    await tick();
    blockLabelInput?.focus();
    blockLabelInput?.select();
  }

  async function focusLinkInput() {
    await tick();
    linkInput?.focus();
    linkInput?.select();
  }

  function isEditableHrefNodeName(nodeName: string) {
    return nodeName === "linkBox" || nodeName === "ctaButton" || nodeName === "referenceItem";
  }

  function hrefFromAttributes(attrs: Record<string, unknown>) {
    return typeof attrs.href === "string" ? normalizeEditableLinkHref(attrs.href) : undefined;
  }

  function editableHrefNodeTargetFromResolvedPos(
    resolvedPos: ResolvedPos,
  ): { pos: number; href: string } | undefined {
    for (let depth = resolvedPos.depth; depth > 0; depth -= 1) {
      const node = resolvedPos.node(depth);

      if (!isEditableHrefNodeName(node.type.name)) {
        continue;
      }

      const href = hrefFromAttributes(node.attrs);
      return {
        pos: resolvedPos.before(depth),
        href: href ?? "",
      };
    }

    return undefined;
  }

  function linkMarkHrefAtPosition(view: EditorView, pos: number) {
    const linkType = view.state.schema.marks.link;

    if (!linkType) {
      return undefined;
    }

    const safePos = Math.max(0, Math.min(view.state.doc.content.size, pos));
    const resolvedPos = view.state.doc.resolve(safePos);
    const marks = [
      ...resolvedPos.marks(),
      ...(resolvedPos.nodeAfter?.marks ?? []),
      ...(resolvedPos.nodeBefore?.marks ?? []),
    ];
    const linkMark = marks.find((mark) => mark.type === linkType);

    return linkMark ? hrefFromAttributes(linkMark.attrs) : undefined;
  }

  function editableLinkHrefFromElement(element: HTMLElement) {
    return (
      normalizeEditableLinkHref(element.getAttribute("data-href") ?? "") ??
      normalizeEditableLinkHref(element.getAttribute("href") ?? "")
    );
  }

  function editableHrefNodeTargetFromElement(
    view: EditorView,
    element: HTMLElement,
  ): { pos: number; href: string } | undefined {
    try {
      const pos = view.posAtDOM(element, 0);
      const target = editableHrefNodeTargetFromResolvedPos(
        view.state.doc.resolve(Math.max(0, Math.min(view.state.doc.content.size, pos + 1))),
      );

      if (target) {
        return target;
      }
    } catch {
      return undefined;
    }

    return undefined;
  }

  function retargetActiveHrefNode(current: Editor, href: string) {
    let target: { pos: number; href: string } | undefined;

    if (current.state.selection instanceof NodeSelection) {
      const selectedNode = current.state.selection.node;

      if (isEditableHrefNodeName(selectedNode.type.name)) {
        target = {
          pos: current.state.selection.from,
          href: hrefFromAttributes(selectedNode.attrs) ?? "",
        };
      }
    }

    target ??= editableHrefNodeTargetFromResolvedPos(current.state.selection.$from);

    if (!target) {
      return false;
    }

    const node = current.state.doc.nodeAt(target.pos);

    if (!node || !isEditableHrefNodeName(node.type.name)) {
      return false;
    }

    current.commands.focus();
    current.view.dispatch(
      current.state.tr
        .setNodeMarkup(target.pos, node.type, { ...node.attrs, href })
        .scrollIntoView(),
    );

    return true;
  }

  function openCodeFilenameEditorFromEvent(view: EditorView, event: MouseEvent) {
    const pre = closestCodePre(event.target);

    if (!pre || !isCodeFilenameBarEvent(pre, event)) {
      return false;
    }

    const codeBlock = codeBlockFromPre(view, pre);

    if (!codeBlock) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    closeCodeLineContextMenu();
    activeToolPanel = "code";
    codeFilename = normalizeCodeFilename(codeBlock.node.attrs.filename);

    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, codeBlock.pos)));
    void focusCodeFilenameInput();

    return true;
  }

  function openEditableLinkFromEvent(view: EditorView, event: MouseEvent) {
    const element = closestEditableLinkElement(event.target);

    if (!element) {
      return false;
    }

    const position = view.posAtCoords({
      left: event.clientX,
      top: event.clientY,
    });
    const nodeTarget =
      editableHrefNodeTargetFromElement(view, element) ??
      (position
        ? editableHrefNodeTargetFromResolvedPos(view.state.doc.resolve(position.pos))
        : undefined);
    const markHref = position ? linkMarkHrefAtPosition(view, position.pos) : undefined;
    const href = nodeTarget?.href ?? markHref ?? editableLinkHrefFromElement(element);

    if (!href) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    closeCodeLineContextMenu();
    isLinkPanelOpen = true;
    linkError = false;
    linkDraft = href;

    if (nodeTarget) {
      view.dispatch(
        view.state.tr
          .setSelection(NodeSelection.create(view.state.doc, nodeTarget.pos))
          .scrollIntoView(),
      );
    } else if (position) {
      const safePos = Math.max(0, Math.min(view.state.doc.content.size, position.pos));
      view.dispatch(
        view.state.tr.setSelection(TextSelection.create(view.state.doc, safePos)).scrollIntoView(),
      );
    }

    void focusLinkInput();

    return true;
  }

  function openBlockLabelEditorFromEvent(view: EditorView, event: MouseEvent) {
    if (closestCodePre(event.target)) {
      return false;
    }

    const element = closestEditableBlockLabelElement(event.target);
    let target: (EditableBlockLabelTarget & { label: string }) | null = null;

    if (element) {
      try {
        const pos = view.posAtDOM(element, 0);
        target = findEditableBlockLabelTargetFromResolvedPos(
          view.state.doc.resolve(Math.max(0, Math.min(view.state.doc.content.size, pos + 1))),
        );
      } catch {
        target = null;
      }
    }

    const position = view.posAtCoords({
      left: event.clientX,
      top: event.clientY,
    });

    if (!target && !position) {
      return false;
    }

    target ??= findEditableBlockLabelTargetFromResolvedPos(
      view.state.doc.resolve(position?.pos ?? 0),
    );

    if (!target) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    closeCodeLineContextMenu();
    activeToolPanel = "blocks";
    syncBlockLabelTarget(target);
    void focusBlockLabelInput();

    return true;
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
    const clickedLine = clickedCodeLine(pre, lineCount, event);
    const range = selectedCodeLineRange(view, codeBlock, clickedLine) ?? {
      fromLine: clickedLine,
      toLine: clickedLine,
    };

    codeLineContextMenu = {
      x: Math.min(event.clientX, Math.max(8, window.innerWidth - 184)),
      y: Math.min(event.clientY, Math.max(8, window.innerHeight - 160)),
      range,
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

    return isCodeLineRangeActive(
      normalizeCodeLineMarkers({
        highlightLines: node.attrs.highlightLines,
        additionLines: node.attrs.additionLines,
        deletionLines: node.attrs.deletionLines,
      })[marker],
      codeLineContextMenu.range,
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
        [marker]: toggleLinesInRange(node.attrs[marker], codeLineContextMenu.range),
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
    const previousDefault = previousKind ? defaultCalloutLabel(previousKind) : "";
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

    const label = calloutLabelAfterToneChange(node.type.name, node.attrs, kind);
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
        return retargetCalloutAtPosition(current, selectionFrom.before(depth), kind, toneColor);
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
          .command(selectedInlineRangeToCalloutCommand(kind, activeCalloutColor))
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
      retargetCalloutAtPosition(editor, trackedTarget.pos, kind, activeCalloutColor);

    if (!didRetargetTrackedCallout) {
      retargetActiveCallout(editor, kind, activeCalloutColor);
    }

    refreshEditorState(editor);

    if (didRetargetTrackedCallout && trackedTarget) {
      const node = editor.state.doc.nodeAt(trackedTarget.pos);
      const label = normalizeBlockLabel(node?.attrs.label) || defaultCalloutLabel(kind);

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
    return editorCommands.selectedText();
  }

  function applyLinkBox() {
    const href = normalizeEditableLinkHref(linkDraft) ?? normalizeEditableLinkHref(selectedText());

    if (!href) {
      isLinkPanelOpen = true;
      linkError = true;
      return;
    }

    linkError = false;
    linkDraft = href;
    editorCommands.applyLinkBox(href);
  }

  function applySectionHeading() {
    editorCommands.applySectionHeading();
  }

  function applyQuote() {
    const nextQuoteStyle = normalizeQuoteStyle(quoteStyle);
    quoteStyle = nextQuoteStyle;
    editorCommands.applyQuote(nextQuoteStyle);
  }

  function updateActiveQuoteStyle() {
    const nextQuoteStyle = normalizeQuoteStyle(quoteStyle);
    quoteStyle = nextQuoteStyle;

    editorCommands.updateActiveQuoteStyle(nextQuoteStyle);
  }

  function applyCtaButton() {
    const selection = selectedText();
    const href = normalizeEditableLinkHref(linkDraft) ?? normalizeEditableLinkHref(selection);

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
    editorCommands.applyCtaButton(href, fallbackLabel);
  }

  function applyCtaGroup() {
    const layout = normalizeCtaGroupLayout(ctaGroupLayout);
    ctaGroupLayout = layout;

    editorCommands.applyCtaGroup(layout);
  }

  function updateActiveCtaGroupLayout() {
    const layout = normalizeCtaGroupLayout(ctaGroupLayout);
    ctaGroupLayout = layout;

    editorCommands.updateActiveCtaGroupLayout(layout);
  }

  function applyReferenceList() {
    editorCommands.applyReferenceList();
  }

  function applySummaryBox() {
    editorCommands.applySummaryBox();
  }

  function applyHeroBlock() {
    editorCommands.applyHeroBlock();
  }

  function selectedTutorialBlock(current: Editor) {
    const selectionTarget = findTutorialBlockTargetFromResolvedPos(current.state.selection.$from);

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
          return current.chain().focus().insertContent(createDefaultTutorialBlock()).run();
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
      tutorialBlock ? current.chain().focus().insertContent(tutorialBlock).run() : false,
    );
  }

  function applyComparisonBlock() {
    editorCommands.applyComparisonBlock();
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
    runEditorCommand(
      (current) =>
        retargetActiveHrefNode(current, href) ||
        current.chain().focus().extendMarkRange("link").setLink({ href }).run(),
    );
  }

  function unsetLink() {
    linkError = false;
    linkDraft = "";
    runEditorCommand(
      (current) =>
        retargetActiveHrefNode(current, "") ||
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
    const readableColor = sanitizeReadableTextColor(color, safety.background, safety.fallback);

    runEditorCommand((current) => current.chain().focus().setColor(readableColor).run());
  }

  function setFontSize(value: string) {
    runEditorCommand((current) => current.chain().focus().setFontSize(value).run());
  }

  function resetDraft() {
    if (!window.confirm("현재 글을 모두 지우고 빈 문서로 초기화할까?")) {
      return;
    }

    if (!checkpointCurrentDraftBeforeReplacement()) {
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
    draftHistoryController.markBaseline();
  }

  function applyExampleTemplate() {
    if (!window.confirm("현재 글을 예시 템플릿으로 바꿀까?")) {
      return;
    }

    if (!checkpointCurrentDraftBeforeReplacement()) {
      return;
    }
    applyDraftPreferences(defaultDraftPreferences());
    replaceEditorDocument(sampleDocument);
    isLinkPanelOpen = false;
    linkDraft = "";
    linkError = false;
    draftHistoryController.markBaseline();
  }

  async function copyPreview() {
    const operation = copyFeedback.begin("preview", (value) => {
      copyState = value;
    });
    if (!operation) return;
    const currentDocument = documentJson;
    const currentOptions = exportOptions();
    const optionsFingerprint = JSON.stringify(currentOptions);
    const isCurrent = () =>
      operation.isCurrent() &&
      documentJson === currentDocument &&
      JSON.stringify(exportOptions()) === optionsFingerprint;
    await copyDcPreview({
      document: currentDocument,
      exportOptions: currentOptions,
      renderDocument: exportSession.exportDocument,
      plainText: editor?.getText() ?? "",
      isCurrent,
      setManualHtml(value) {
        if (isCurrent()) manualCopyHtml = value;
      },
      setState: operation.setState,
      scheduleReset: operation.scheduleReset,
    });
  }

  async function copySourceHtml() {
    const operation = copyFeedback.begin("source", (value) => {
      sourceCopyState = value;
    });
    if (!operation) return;
    await copySourceHtmlText({
      html,
      setState: operation.setState,
      scheduleReset: operation.scheduleReset,
    });
  }

  async function copyLlmAuthoringGuide() {
    const operation = copyFeedback.begin("guide", (value) => {
      llmPromptCopyState = value;
    });
    if (!operation) return;
    await copyPlainTextWithState({
      text: llmAuthoringPrompt,
      setState: operation.setState,
      scheduleReset: operation.scheduleReset,
    });
  }

  async function generateMarkdownWithLlm() {
    if (isLlmGenerateDisabled) return;
    await llmRequest.generate({
      provider: llmProvider,
      apiKey: llmApiKey,
      model: llmModel,
      userPrompt: llmUserPrompt,
      authoringPrompt: llmAuthoringPrompt,
      siteUrl: "https://0disoft.github.io/dc-code-paste/",
      appTitle: "dc-code-paste",
    });
  }

  function toggleToolPanel(panel: ToolPanelId) {
    activeToolPanel = activeToolPanel === panel ? null : panel;
  }

  onDestroy(() => {
    copyFeedback.dispose();
    llmRequest.dispose();
    clearScheduledPreviewRender();
    exportSession.dispose();
    flushScheduledDraftPersist();
    draftPersistence.dispose();
    draftHistoryController.dispose();
  });

  onMount(() => {
    let mountedEditor: Editor | undefined;
    const closeFloatingMenus = () => closeCodeLineContextMenu();
    const flushDraftOnPageExit = () => flushScheduledDraftPersist();
    const handleDraftStorageEvent = (event: StorageEvent) => {
      if (event.key === draftStorageKey && canPersistDraft) {
        observeDraftStorageChange(event.newValue);
      }
    };
    const flushDraftWhenHidden = () => {
      if (document.visibilityState === "hidden") {
        flushScheduledDraftPersist();
      }
    };
    const closePanelsOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      if (
        target.closest(".toolbar-shell") ||
        target.closest(".code-line-context-menu") ||
        target.closest(".markdown-panel") ||
        target.closest(".llm-panel") ||
        target.closest(".storage-panel")
      ) {
        return;
      }

      if (
        isLinkPanelOpen ||
        isMarkdownPanelOpen ||
        isLlmPanelOpen ||
        isStoragePanelOpen ||
        activeToolPanel
      ) {
        closeTransientPanels();
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isComposingKeyEvent(event)) {
        if (
          codeLineContextMenu ||
          isLinkPanelOpen ||
          isMarkdownPanelOpen ||
          isLlmPanelOpen ||
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
    window.addEventListener("pagehide", flushDraftOnPageExit);
    window.addEventListener("storage", handleDraftStorageEvent);
    document.addEventListener("visibilitychange", flushDraftWhenHidden);
    refreshPresetSnapshots();
    draftHistoryController.initialize();

    async function mountEditor() {
      const [{ Editor, getSchema }, { createEditorExtensions }] = await Promise.all([
        import("@tiptap/core"),
        import("$lib/editor/extensions"),
      ]);

      if (editorMountController.isDisposed || !editorHost) {
        return;
      }

      const extensions = createEditorExtensions();
      const schema = getSchema(extensions);
      const storage = draftStorage();
      const draftRead = storage
        ? readDraftSnapshotWithRecovery(storage, (snapshot) => {
            try {
              schema.nodeFromJSON(snapshot.document).check();
              return true;
            } catch {
              return false;
            }
          })
        : {};
      let observedRaw: string | null;
      try {
        observedRaw = storage?.getItem(draftStorageKey) ?? null;
      } catch {
        observedRaw = null;
      }
      draftPersistence.seedObserved(observedRaw);
      invalidDraftRaw = draftRead.invalidRaw ?? "";
      invalidDraftBackupKey = draftRead.backupKey ?? "";
      if (draftRead.snapshot) {
        documentJson = cloneDocumentContent(draftRead.snapshot.document);
        applyDraftPreferences(cloneDraftPreferences(draftRead.snapshot.preferences));
        draftPersistence.acceptRemote(observedRaw, draftRead.snapshot);
      }

      mountedEditor = new Editor({
        element: editorHost,
        extensions,
        content: documentJson,
        editorProps: {
          attributes: {
            class: "article-editor",
            spellcheck: "false",
          },
          handleDOMEvents: {
            contextmenu: (view, event) => {
              if (!(event instanceof MouseEvent)) {
                return false;
              }

              return (
                openEditableLinkFromEvent(view, event) ||
                openCodeFilenameEditorFromEvent(view, event) ||
                openCodeLineContextMenu(view, event) ||
                openBlockLabelEditorFromEvent(view, event)
              );
            },
            dblclick: (view, event) =>
              event instanceof MouseEvent ? openCodeFilenameEditorFromEvent(view, event) : false,
          },
          handleClick: (view, pos) => {
            closeCodeLineContextMenu();
            if (editor) {
              syncBlockLabelDraftFromPosition(editor, pos);
              syncTutorialBlockTargetFromPosition(editor, pos);
              syncCalloutColorDraftFromPosition(editor, pos);
            } else {
              syncBlockLabelTarget(
                findEditableBlockLabelTargetFromResolvedPos(view.state.doc.resolve(pos)),
              );
              tutorialBlockTarget = findTutorialBlockTargetFromResolvedPos(
                view.state.doc.resolve(pos),
              );
              const callout = selectedCalloutFromResolvedPos(view.state.doc.resolve(pos));

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
          canPersistDraft = !invalidDraftRaw || Boolean(invalidDraftBackupKey);
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
          if (typeof attrs.language === "string" && isSupportedLanguage(attrs.language)) {
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
          quoteStyle = normalizeQuoteStyle(blockquoteAttrs.quoteStyle);
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
          ctaGroupLayout = normalizeCtaGroupLayout(ctaGroupAttrs.layout);
          const textStyleAttrs = current.getAttributes("textStyle");
          if (typeof textStyleAttrs.fontSize === "string") {
            selectionFontSize = textStyleAttrs.fontSize;
          }
        },
      });
    }

    const editorMountController = createEditorMountController({
      mount: mountEditor,
      isReady: () => Boolean(mountedEditor),
      setState(value) {
        editorMountState = value;
      },
      onFailure() {
        canPersistDraft = false;
      },
    });
    retryEditorMount = editorMountController.attempt;
    void editorMountController.attempt();

    return () => {
      editorMountController.dispose();
      retryEditorMount = undefined;
      window.removeEventListener("resize", closeFloatingMenus);
      window.removeEventListener("scroll", closeFloatingMenus, true);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("pagehide", flushDraftOnPageExit);
      window.removeEventListener("storage", handleDraftStorageEvent);
      document.removeEventListener("visibilitychange", flushDraftWhenHidden);
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

    const nextDocument = documentJson;
    const preferences = currentDraftPreferences();
    untrack(() => scheduleDraftPersist(nextDocument, preferences));
    return clearScheduledDraftPersist;
  });
  return {
    loadOtherTabDraft,
    overwriteOtherTabDraft,
    get draftSaveState() {
      return draftSaveState;
    },
    get draftLastSavedAt() {
      return draftLastSavedAt;
    },
    retryDraftSave,
    get invalidDraftRaw() {
      return invalidDraftRaw;
    },
    get invalidDraftBackupKey() {
      return invalidDraftBackupKey;
    },
    get invalidDraftDownloaded() {
      return invalidDraftDownloaded;
    },
    downloadInvalidDraft,
    resumeDraftSaving,
    get editorHost() {
      return editorHost;
    },
    set editorHost(value) {
      editorHost = value;
    },
    get editor() {
      return editor;
    },
    set editor(value) {
      editor = value;
    },
    get blockLabelInput() {
      return blockLabelInput;
    },
    set blockLabelInput(value) {
      blockLabelInput = value;
    },
    get codeFilenameInput() {
      return codeFilenameInput;
    },
    set codeFilenameInput(value) {
      codeFilenameInput = value;
    },
    get linkInput() {
      return linkInput;
    },
    set linkInput(value) {
      linkInput = value;
    },
    get documentJson() {
      return documentJson;
    },
    set documentJson(value) {
      documentJson = value;
    },
    get language() {
      return language;
    },
    set language(value) {
      language = value;
    },
    get theme() {
      return theme;
    },
    set theme(value) {
      theme = value;
    },
    get bodyFontSize() {
      return bodyFontSize;
    },
    set bodyFontSize(value) {
      bodyFontSize = value;
    },
    get selectionFontSize() {
      return selectionFontSize;
    },
    set selectionFontSize(value) {
      selectionFontSize = value;
    },
    get quoteStyle() {
      return quoteStyle;
    },
    set quoteStyle(value) {
      quoteStyle = value;
    },
    get ctaGroupLayout() {
      return ctaGroupLayout;
    },
    set ctaGroupLayout(value) {
      ctaGroupLayout = value;
    },
    get activeCalloutKind() {
      return activeCalloutKind;
    },
    set activeCalloutKind(value) {
      activeCalloutKind = value;
    },
    get activeCalloutColor() {
      return activeCalloutColor;
    },
    set activeCalloutColor(value) {
      activeCalloutColor = value;
    },
    get codeFontSize() {
      return codeFontSize;
    },
    set codeFontSize(value) {
      codeFontSize = value;
    },
    get codeLineHighlights() {
      return codeLineHighlights;
    },
    set codeLineHighlights(value) {
      codeLineHighlights = value;
    },
    get codeAdditionLines() {
      return codeAdditionLines;
    },
    set codeAdditionLines(value) {
      codeAdditionLines = value;
    },
    get codeDeletionLines() {
      return codeDeletionLines;
    },
    set codeDeletionLines(value) {
      codeDeletionLines = value;
    },
    get codeFilename() {
      return codeFilename;
    },
    set codeFilename(value) {
      codeFilename = value;
    },
    get showLineNumbers() {
      return showLineNumbers;
    },
    set showLineNumbers(value) {
      showLineNumbers = value;
    },
    get documentTheme() {
      return documentTheme;
    },
    set documentTheme(value) {
      documentTheme = value;
    },
    get html() {
      return html;
    },
    set html(value) {
      html = value;
    },
    get isRendering() {
      return isRendering;
    },
    set isRendering(value) {
      isRendering = value;
    },
    get previewError() {
      return previewError;
    },
    get editorMountState() {
      return editorMountState;
    },
    get previewMode() {
      return previewMode;
    },
    set previewMode(value) {
      previewMode = value;
    },
    get copyState() {
      return copyState;
    },
    get manualCopyHtml() {
      return manualCopyHtml;
    },
    set copyState(value) {
      copyState = value;
    },
    get sourceCopyState() {
      return sourceCopyState;
    },
    set sourceCopyState(value) {
      sourceCopyState = value;
    },
    get isLinkPanelOpen() {
      return isLinkPanelOpen;
    },
    set isLinkPanelOpen(value) {
      isLinkPanelOpen = value;
    },
    get linkDraft() {
      return linkDraft;
    },
    set linkDraft(value) {
      linkDraft = value;
    },
    get linkError() {
      return linkError;
    },
    set linkError(value) {
      linkError = value;
    },
    get isMarkdownPanelOpen() {
      return isMarkdownPanelOpen;
    },
    set isMarkdownPanelOpen(value) {
      isMarkdownPanelOpen = value;
    },
    get markdownDraft() {
      return markdownDraft;
    },
    set markdownDraft(value) {
      markdownDraft = value;
    },
    get markdownImportState() {
      return markdownImportState;
    },
    get llmPromptCopyState() {
      return llmPromptCopyState;
    },
    set llmPromptCopyState(value) {
      llmPromptCopyState = value;
    },
    get isLlmPanelOpen() {
      return isLlmPanelOpen;
    },
    set isLlmPanelOpen(value) {
      isLlmPanelOpen = value;
    },
    get llmProvider() {
      return llmProvider;
    },
    set llmProvider(value) {
      llmProvider = value;
    },
    get llmApiKey() {
      return llmApiKey;
    },
    set llmApiKey(value) {
      llmApiKey = value;
    },
    get llmModel() {
      return llmModel;
    },
    set llmModel(value) {
      llmModel = value;
    },
    get llmUserPrompt() {
      return llmUserPrompt;
    },
    set llmUserPrompt(value) {
      llmUserPrompt = value;
    },
    get openRouterModels() {
      return openRouterModels;
    },
    set openRouterModels(value) {
      openRouterModels = value;
    },
    get isOpenRouterTopWeeklyOnly() {
      return isOpenRouterTopWeeklyOnly;
    },
    set isOpenRouterTopWeeklyOnly(value) {
      isOpenRouterTopWeeklyOnly = value;
    },
    get isLlmModelAutocompleteOpen() {
      return isLlmModelAutocompleteOpen;
    },
    set isLlmModelAutocompleteOpen(value) {
      isLlmModelAutocompleteOpen = value;
    },
    get openRouterModelState() {
      return openRouterModelState;
    },
    set openRouterModelState(value) {
      openRouterModelState = value;
    },
    get openRouterModelError() {
      return openRouterModelError;
    },
    set openRouterModelError(value) {
      openRouterModelError = value;
    },
    get llmGenerationState() {
      return llmGenerationState;
    },
    get llmGenerationError() {
      return llmGenerationError;
    },
    get isStoragePanelOpen() {
      return isStoragePanelOpen;
    },
    set isStoragePanelOpen(value) {
      isStoragePanelOpen = value;
    },
    get activeToolPanel() {
      return activeToolPanel;
    },
    set activeToolPanel(value) {
      activeToolPanel = value;
    },
    get blockLabelDraft() {
      return blockLabelDraft;
    },
    set blockLabelDraft(value) {
      blockLabelDraft = value;
    },
    get blockLabelTarget() {
      return blockLabelTarget;
    },
    set blockLabelTarget(value) {
      blockLabelTarget = value;
    },
    get tutorialBlockTarget() {
      return tutorialBlockTarget;
    },
    set tutorialBlockTarget(value) {
      tutorialBlockTarget = value;
    },
    get presetName() {
      return presetName;
    },
    set presetName(value) {
      presetName = value;
    },
    get presets() {
      return presets;
    },
    set presets(value) {
      presets = value;
    },
    get presetState() {
      return presetState;
    },
    set presetState(value) {
      presetState = value;
    },
    get draftHistory() {
      return draftHistory;
    },
    set draftHistory(value) {
      draftHistory = value;
    },
    get draftHistoryState() {
      return draftHistoryState;
    },
    set draftHistoryState(value) {
      draftHistoryState = value;
    },
    get renameTarget() {
      return renameTarget;
    },
    set renameTarget(value) {
      renameTarget = value;
    },
    get renameDraft() {
      return renameDraft;
    },
    set renameDraft(value) {
      renameDraft = value;
    },
    get calloutColorInput() {
      return calloutColorInput;
    },
    set calloutColorInput(value) {
      calloutColorInput = value;
    },
    get codeLineContextMenu() {
      return codeLineContextMenu;
    },
    set codeLineContextMenu(value) {
      codeLineContextMenu = value;
    },
    get codeLineContextMenuElement() {
      return codeLineContextMenuElement;
    },
    set codeLineContextMenuElement(value) {
      codeLineContextMenuElement = value;
    },
    get editorSignal() {
      return editorSignal;
    },
    set editorSignal(value) {
      editorSignal = value;
    },
    get canPersistDraft() {
      return canPersistDraft;
    },
    set canPersistDraft(value) {
      canPersistDraft = value;
    },
    get htmlSize() {
      return htmlSize;
    },
    get copyLabel() {
      return copyLabel;
    },
    get sourceCopyLabel() {
      return sourceCopyLabel;
    },
    get documentThemeLabel() {
      return documentThemeLabel;
    },
    get presetStateLabel() {
      return presetStateLabel;
    },
    get draftHistoryStateLabel() {
      return draftHistoryStateLabel;
    },
    get markdownImportStateLabel() {
      return markdownImportStateLabel;
    },
    get codeLineHighlightsInvalid() {
      return codeLineHighlightsInvalid;
    },
    get codeAdditionLinesInvalid() {
      return codeAdditionLinesInvalid;
    },
    get codeDeletionLinesInvalid() {
      return codeDeletionLinesInvalid;
    },
    get llmPromptCopyLabel() {
      return llmPromptCopyLabel;
    },
    get activeLlmProvider() {
      return activeLlmProvider;
    },
    get llmModelOptions() {
      return llmModelOptions;
    },
    get shouldShowInitialLlmModels() {
      return shouldShowInitialLlmModels;
    },
    get activeLlmModelAutocompleteOptions() {
      return activeLlmModelAutocompleteOptions;
    },
    get shouldShowLlmModelAutocomplete() {
      return shouldShowLlmModelAutocomplete;
    },
    get llmGenerationStateLabel() {
      return llmGenerationStateLabel;
    },
    get isLlmGenerateDisabled() {
      return isLlmGenerateDisabled;
    },
    get openRouterModelStateLabel() {
      return openRouterModelStateLabel;
    },
    get openCodeGoModelStateLabel() {
      return openCodeGoModelStateLabel;
    },
    draftStorage,
    defaultDraftPreferences,
    currentDraftPreferences,
    cloneSerializableValue,
    cloneDocumentContent,
    cloneDraftPreferences,
    replaceEditorDocument,
    isKnownBodySize,
    isKnownCodeSize,
    applyDraftPreferences,
    firstCodeBlockLanguage,
    presetDateLabel,
    countDocumentText,
    languageLabel,
    draftHistoryFingerprint,
    currentDraftHistoryFingerprint,
    draftHistorySummary,
    defaultDraftHistoryName,
    draftHistoryName,
    isRenaming,
    clearScheduledPreviewRender,
    clearScheduledDraftPersist,
    isLineRangeInputInvalid,
    closeTransientPanels,
    toggleMarkdownPanel,
    toggleStoragePanel,
    toggleLlmPanel,
    closeLlmPanel,
    markLlmInputChanged,
    selectLlmProvider,
    updateLlmModel,
    selectLlmModel,
    closeLlmModelAutocomplete,
    closeLlmModelAutocompleteSoon,
    refreshOpenRouterModels,
    setOpenRouterTopWeeklyOnly,
    applyOpenRouterModels,
    applyOpenRouterModelError,
    beginPresetRename,
    beginDraftHistoryRename,
    cancelRename,
    refreshPresetSnapshots,
    refreshDraftHistorySnapshots,
    setDraftHistorySavedState,
    saveDraftHistorySnapshot,
    maybeSaveAutomaticDraftHistory,
    restoreDraftHistorySnapshot,
    saveDraftHistoryRename,
    deleteDraftHistory,
    resetMarkdownImportState,
    importMarkdownDraft,
    clearMarkdownDraft,
    saveCurrentPreset,
    applyPreset,
    savePresetRename,
    deletePreset,
    exportOptions,
    renderPreview,
    schedulePreviewRender,
    retryPreview,
    retryEditor,
    scheduleDraftPersist,
    normalizeBlockLabel,
    normalizeEditableBlockValue,
    editableBlockLabelFallback,
    findEditableBlockLabelTargetFromResolvedPos,
    syncBlockLabelTarget,
    findEditableBlockLabelTarget,
    syncBlockLabelDraft,
    syncBlockLabelDraftFromPosition,
    findTutorialBlockTargetFromResolvedPos,
    syncTutorialBlockTarget,
    syncTutorialBlockTargetFromPosition,
    selectedCalloutFromResolvedPos,
    syncCalloutColorDraft,
    syncCalloutColorDraftFromPosition,
    refreshEditorState,
    isActive,
    canUndo,
    canRedo,
    isCalloutActive,
    runEditorCommand,
    blockLabelPlaceholder,
    applyBlockLabel,
    applyBlockLabelOnEnter,
    applyCodeBlock,
    applyCodeFilename,
    applyCodeLineHighlights,
    applyCodeAdditionLines,
    applyCodeDeletionLines,
    syncCodeLineMarkerDrafts,
    lineSetFromRange,
    compactLineSet,
    removeLines,
    normalizeCodeLineMarkers,
    toggleLinesInRange,
    isCodeLineRangeActive,
    codeLineMarkerLabel,
    closestCodePre,
    closestEditableBlockLabelElement,
    closestEditableLinkElement,
    codeFilenameBarHeight,
    isCodeFilenameBarEvent,
    codeBlockAtPosition,
    codeBlockFromPre,
    clickedCodeLine,
    selectedCodeLineRange,
    focusCodeFilenameInput,
    focusBlockLabelInput,
    focusLinkInput,
    isEditableHrefNodeName,
    hrefFromAttributes,
    editableHrefNodeTargetFromResolvedPos,
    linkMarkHrefAtPosition,
    editableLinkHrefFromElement,
    editableHrefNodeTargetFromElement,
    retargetActiveHrefNode,
    openCodeFilenameEditorFromEvent,
    openEditableLinkFromEvent,
    openBlockLabelEditorFromEvent,
    openCodeLineContextMenu,
    closeCodeLineContextMenu,
    codeLineContextMenuActive,
    toggleCodeLineMarker,
    calloutLabelAfterToneChange,
    retargetCalloutAtPosition,
    retargetActiveCallout,
    applyCallout,
    applySelectedCallout,
    updateActiveCalloutColor,
    applyCalloutPresetColor,
    calloutSwatchColor,
    updateCalloutPickerColor,
    openCalloutColorPicker,
    selectedText,
    applyLinkBox,
    applySectionHeading,
    applyQuote,
    updateActiveQuoteStyle,
    applyCtaButton,
    applyCtaGroup,
    updateActiveCtaGroupLayout,
    applyReferenceList,
    applySummaryBox,
    applyHeroBlock,
    selectedTutorialBlock,
    nextTutorialStepNumber,
    applyTutorialBlock,
    applyComparisonBlock,
    setLink,
    unsetLink,
    toggleLinkPanel,
    setTextColor,
    setFontSize,
    resetDraft,
    applyExampleTemplate,
    copyPreview,
    copySourceHtml,
    copyLlmAuthoringGuide,
    generateMarkdownWithLlm,
    toggleToolPanel,
    bodyFontFamily,
    selectionFontFamily,
    defaultBodyFontSize,
    defaultCodeFontSize,
    bodySizes,
    codeSizes,
    emptyDocument,
    draftHistoryAutoIntervalMs,
    previewRenderDebounceMs,
    draftPersistDebounceMs,
    documentThemes,
    editorThemeColorSafety,
    swatches,
    calloutColorOptions,
    codeLineMarkers,
    lineRangeHelp,
    get previewRenderTimer() {
      return previewRenderer.previewRenderTimer;
    },
    get renderTurn() {
      return previewRenderer.renderTurn;
    },
    openRouterModelLoadTurn,
    onDestroy,
    onMount,
    tick,
    NodeSelection,
    TextSelection,
    defaultProseFontFamily,
    sanitizeReadableTextColor,
    defaultDcExportStructure,
    sampleDocument,
    defaultLanguage,
    defaultTheme,
    isSupportedLanguage,
    supportedLanguageGroups,
    supportedLanguages,
    supportedThemes,
    calloutKindFromNodeName,
    calloutNodeNameByKind,
    defaultCalloutLabel,
    isCalloutNodeName,
    calloutNodeNames,
    defaultCalloutToneColor,
    defaultCalloutToneColors,
    normalizeCalloutToneColor,
    selectedInlineRangeToCalloutCommand,
    clearDraftSnapshot,
    maxDraftHistoryCount,
    readDraftSnapshot,
    ctaGroupLayoutOptions,
    normalizeCtaGroupLayout,
    normalizeEditableLinkHref,
    llmAuthoringPrompt,
    autocompleteLlmModelOptions,
    defaultLlmProviderId,
    llmModelAutocompleteLimit,
    llmProviders,
    openRouterTopWeeklyModelLimit,
    providerDefinition,
    requestOpenRouterModels,
    parseMarkdownToDocument,
    codeLineRangeContains,
    codeLineRangeLabel,
    selectedCodeLineRangeFromOffsets,
    normalizeQuoteStyle,
    quoteStyleOptions,
    defaultSummaryBoxLabel,
    createDefaultTutorialBlock,
    createTutorialStep,
    createTutorialBlockFromText,
    normalizeTutorialStepNumber,
    normalizeCodeFilename,
    maxHighlightLineNumber,
    normalizeHighlightLines,
    createPresetSnapshot,
    deletePresetSnapshot,
    readPresetSnapshots,
    renamePresetSnapshot,
    writePresetSnapshots,
  };
}

export type WorkspaceState = ReturnType<typeof createWorkspaceState>;
