<script lang="ts">
    import { Loader2, RotateCcw, Sparkles, X } from "lucide-svelte";

    type LlmModelOption = { id: string; name: string };

    type Props = {
        llmProvider: string;
        llmProviders: { id: string; label: string }[];
        llmModel: string;
        llmApiKey: string;
        llmUserPrompt: string;
        shouldShowLlmModelAutocomplete: boolean;
        activeLlmModelAutocompleteOptions: LlmModelOption[];
        isOpenRouterTopWeeklyOnly: boolean;
        openRouterModelState: "idle" | "loading" | "loaded" | "fallback" | "error";
        openRouterModelError: string;
        openRouterModelStateLabel: string;
        openCodeGoModelStateLabel: string;
        activeLlmProvider: { apiKeyPlaceholder: string };
        llmGenerationState: "idle" | "loading" | "ready" | "error";
        llmGenerationError: string;
        llmGenerationStateLabel: string;
        isLlmGenerateDisabled: boolean;
        onSelectProvider: (value: string) => void;
        onInputModel: (value: string) => void;
        onSelectModel: (modelId: string) => void;
        onFocusModelInput: () => void;
        onBlurModelInput: () => void;
        onSetOpenRouterTopWeeklyOnly: (value: boolean) => void;
        onRefreshModels: () => void;
        onInputApiKey: () => void;
        onChangeApiKey: () => void;
        onInputPrompt: () => void;
        onGenerate: () => void;
        onClose: () => void;
    };

    let {
        llmProvider,
        llmProviders,
        llmModel = $bindable(""),
        llmApiKey = $bindable(""),
        llmUserPrompt = $bindable(""),
        shouldShowLlmModelAutocomplete,
        activeLlmModelAutocompleteOptions,
        isOpenRouterTopWeeklyOnly,
        openRouterModelState,
        openRouterModelError,
        openRouterModelStateLabel,
        openCodeGoModelStateLabel,
        activeLlmProvider,
        llmGenerationState,
        llmGenerationError,
        llmGenerationStateLabel,
        isLlmGenerateDisabled,
        onSelectProvider,
        onInputModel,
        onSelectModel,
        onFocusModelInput,
        onBlurModelInput,
        onSetOpenRouterTopWeeklyOnly,
        onRefreshModels,
        onInputApiKey,
        onChangeApiKey,
        onInputPrompt,
        onGenerate,
        onClose,
    }: Props = $props();
</script>

<section id="llm-panel" class="llm-panel" aria-label="AI 글 작성">
    <div class="llm-grid">
        <label class="llm-field">
            <span>제공자</span>
            <select
                value={llmProvider}
                onchange={(event) =>
                    onSelectProvider(event.currentTarget.value)}
            >
                {#each llmProviders as provider}
                    <option value={provider.id}>{provider.label}</option>
                {/each}
            </select>
        </label>
        <div class="llm-field">
            <label for="llm-model-input">모델</label>
            <div class="llm-model-row">
                <div class="llm-model-combobox">
                    <input
                        id="llm-model-input"
                        type="text"
                        name="dc-code-paste-model-query"
                        bind:value={llmModel}
                        autocomplete="off"
                        autocapitalize="off"
                        spellcheck="false"
                        data-form-type="other"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        role="combobox"
                        aria-autocomplete="list"
                        aria-haspopup="listbox"
                        aria-expanded={shouldShowLlmModelAutocomplete}
                        aria-controls="llm-model-suggestions"
                        placeholder="모델 ID 직접 입력"
                        onfocus={onFocusModelInput}
                        onblur={onBlurModelInput}
                        oninput={(event) =>
                            onInputModel(event.currentTarget.value)}
                    />
                    {#if shouldShowLlmModelAutocomplete}
                        <div
                            id="llm-model-suggestions"
                            class="llm-model-suggestions"
                            role="listbox"
                            aria-label="모델 추천"
                        >
                            {#each activeLlmModelAutocompleteOptions as model}
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={model.id === llmModel}
                                    onmousedown={(event) =>
                                        event.preventDefault()}
                                    onclick={() => onSelectModel(model.id)}
                                >
                                    <span>{model.id}</span>
                                    {#if model.name !== model.id}
                                        <small>{model.name}</small>
                                    {/if}
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>
                {#if llmProvider === "openrouter"}
                    <label
                        class="llm-model-filter"
                        title="지난주 사용량 기준 상위 80개만 표시"
                    >
                        <input
                            type="checkbox"
                            checked={isOpenRouterTopWeeklyOnly}
                            onchange={(event) =>
                                onSetOpenRouterTopWeeklyOnly(
                                    event.currentTarget.checked,
                                )}
                        />
                        <span>주간 인기 80</span>
                    </label>
                    <button
                        class="llm-model-refresh"
                        type="button"
                        title="모델 목록 새로고침"
                        aria-label="모델 목록 새로고침"
                        disabled={openRouterModelState === "loading"}
                        onclick={onRefreshModels}
                    >
                        {#if openRouterModelState === "loading"}
                            <span class="spin-icon"
                                ><Loader2 size={14} /></span
                            >
                        {:else}
                            <RotateCcw size={14} />
                        {/if}
                    </button>
                {/if}
            </div>
        </div>
        <label class="llm-field">
            <span>API 키</span>
            <input
                class="llm-secret-input"
                type="password"
                name="dc-code-paste-api-token"
                bind:value={llmApiKey}
                autocomplete="off"
                autocapitalize="off"
                inputmode="text"
                spellcheck="false"
                data-form-type="other"
                data-lpignore="true"
                data-1p-ignore="true"
                placeholder={activeLlmProvider.apiKeyPlaceholder}
                oninput={onInputApiKey}
                onchange={onChangeApiKey}
            />
        </label>
    </div>
    <label class="llm-field llm-prompt-field">
        <span>요청</span>
        <textarea
            class="llm-prompt-input"
            bind:value={llmUserPrompt}
            placeholder="예: 스마트폰 배터리를 오래 쓰는 현실적인 방법을 정리해줘"
            oninput={onInputPrompt}
        ></textarea>
    </label>
    <div class="llm-actions">
        <button
            class="markdown-import-button"
            type="button"
            aria-label="AI 글 생성하기"
            aria-busy={llmGenerationState === "loading"}
            disabled={isLlmGenerateDisabled}
            onclick={onGenerate}
        >
            {#if llmGenerationState === "loading"}
                <span class="spin-icon"><Loader2 size={16} /></span>
                <span>생성 중</span>
            {:else}
                <Sparkles size={16} />
                <span>생성하기</span>
            {/if}
        </button>
        <button
            class="markdown-clear-button"
            type="button"
            aria-label="AI 작성 닫기"
            onclick={onClose}
        >
            <X size={15} />
            <span>닫기</span>
        </button>
        <span
            class:error={llmGenerationState === "error"}
            class="markdown-status llm-status"
            title={llmGenerationState === "error"
                ? llmGenerationError
                : ""}>{llmGenerationStateLabel}</span
        >
        {#if llmProvider === "openrouter"}
            <span
                class:error={openRouterModelState === "error"}
                class="markdown-status llm-status"
                title={openRouterModelState === "error"
                    ? openRouterModelError
                    : ""}>{openRouterModelStateLabel}</span
            >
        {/if}
        {#if llmProvider === "opencode-go"}
            <span
                class="markdown-status llm-status"
                title="">{openCodeGoModelStateLabel}</span
            >
        {/if}
        <span class="llm-note">키는 저장하지 않음</span>
    </div>
</section>

<style>
    .llm-panel {
        display: grid;
        gap: 10px;
        margin-bottom: 0;
        padding: 10px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: color-mix(in oklch, var(--panel) 88%, transparent);
    }

    .llm-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
    }

    .llm-field {
        display: grid;
        align-items: stretch;
        gap: 5px;
        min-width: 0;
        color: var(--muted);
        font-size: 13px;
        font-weight: 500;
    }

    .llm-field > label,
    .llm-field > span {
        display: inline-flex;
        align-items: center;
        min-height: 18px;
        color: var(--muted);
        font-size: 13px;
        font-weight: 500;
    }

    .llm-field input,
    .llm-field select,
    .llm-prompt-input {
        width: 100%;
        min-width: 0;
        border: 1px solid var(--line);
        border-radius: 7px;
        background: var(--panel-2);
        color: var(--text);
        font: inherit;
        outline: none;
    }

    .llm-field input,
    .llm-field select {
        height: 36px;
        padding: 0 11px;
    }

    .llm-secret-input {
        -webkit-text-security: disc;
    }

    .llm-model-row {
        display: flex;
        align-items: center;
        gap: 7px;
        min-width: 0;
    }

    .llm-model-combobox {
        position: relative;
        flex: 1 1 auto;
        min-width: 0;
    }

    .llm-model-suggestions {
        position: absolute;
        z-index: 30;
        top: calc(100% + 5px);
        right: 0;
        left: 0;
        display: grid;
        max-height: 250px;
        overflow: auto;
        border: 1px solid var(--border);
        border-radius: 7px;
        background: var(--panel);
        box-shadow: 0 16px 34px color-mix(in oklch, black 36%, transparent);
        padding: 4px;
    }

    .llm-model-suggestions button {
        display: grid;
        gap: 2px;
        width: 100%;
        min-height: 36px;
        border: 0;
        border-radius: 5px;
        background: transparent;
        color: var(--text);
        padding: 6px 8px;
        text-align: left;
        cursor: pointer;
    }

    .llm-model-suggestions button:hover,
    .llm-model-suggestions button:focus-visible,
    .llm-model-suggestions button[aria-selected="true"] {
        background: color-mix(in oklch, var(--accent) 14%, transparent);
        outline: none;
    }

    .llm-model-suggestions span,
    .llm-model-suggestions small {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .llm-model-suggestions small {
        color: var(--muted);
        font-size: 11px;
        font-weight: 500;
    }

    .llm-model-filter {
        display: inline-flex;
        flex: 0 0 auto;
        align-items: center;
        gap: 6px;
        min-height: 36px;
        padding: 0 9px;
        border: 1px solid var(--border);
        border-radius: 7px;
        color: var(--muted);
        font-size: 13px;
        white-space: nowrap;
        cursor: pointer;
        user-select: none;
    }

    .llm-model-filter input {
        width: 14px;
        min-width: 14px;
        height: 14px;
        padding: 0;
        margin: 0;
        accent-color: var(--accent);
    }

    .llm-model-refresh {
        display: inline-flex;
        flex: 0 0 auto;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border: 1px solid var(--line);
        border-radius: 7px;
        background: var(--panel-2);
        color: var(--text);
        cursor: pointer;
    }

    .llm-model-refresh:disabled {
        cursor: wait;
        opacity: 0.62;
    }

    .llm-prompt-field {
        display: grid;
    }

    .llm-prompt-input {
        min-height: 112px;
        resize: vertical;
        padding: 10px 11px;
        line-height: 1.55;
    }

    .llm-field input:focus,
    .llm-field select:focus,
    .llm-prompt-input:focus {
        border-color: var(--accent);
    }

    .llm-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
    }

    .llm-status {
        min-width: 0;
        max-width: min(520px, 100%);
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .llm-note {
        color: color-mix(in oklch, var(--muted) 76%, transparent);
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
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

    .markdown-import-button:disabled {
        cursor: not-allowed;
        opacity: 0.48;
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
        .llm-grid {
            grid-template-columns: 1fr;
        }

        .llm-model-row {
            flex-wrap: wrap;
        }

        .llm-model-combobox {
            flex-basis: 100%;
        }
    }
</style>
