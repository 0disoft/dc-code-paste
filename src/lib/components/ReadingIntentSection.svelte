<script lang="ts">
  import { getContext } from 'svelte';
  import type { WorkspaceState } from '#lib/state/workspace.svelte.ts';
  import { WORKSPACE_CONTEXT_KEY } from '#lib/state/workspace-context.ts';
  import { readingIntentOptions } from '#lib/editor/reading-intent-format.ts';

  let { compact = false, onSourceRequest }: { compact?: boolean; onSourceRequest?: () => void } = $props();

  const workspace = getContext<WorkspaceState>(WORKSPACE_CONTEXT_KEY);

  const selection = $derived(workspace.readingIntentSelection);

  function labelFor(value: string): string {
    const option = readingIntentOptions.find((item) => item.value === value);
    return option ? option.label : value;
  }

  const hint = $derived(
    selection.mixed
      ? '여러 의도가 선택됐습니다.'
      : selection.intent
        ? `'${labelFor(selection.intent)}' 의도가 선택되어 있습니다.`
        : '문장을 선택해 읽는 의도를 표시하세요.'
  );

  function handlePointerDown(event: PointerEvent) {
    event.preventDefault();
  }
</script>

<section class="ui-section" role="group" aria-label="읽는 의도">
  {#if !compact}
    <span class="ui-section-title">읽는 의도</span>
  {/if}

  <div class="reading-intent-controls">
    {#if compact && onSourceRequest}
      <button type="button" class="ui-btn ui-btn--outline" aria-label="문장 출처 연결" disabled={!selection.canApply} onpointerdown={handlePointerDown} onclick={onSourceRequest}>출처</button>
    {/if}
    {#each readingIntentOptions as option (option.value)}
      <button
        type="button"
        class="ui-btn ui-btn--outline"
        class:is-active={selection.intent === option.value && !selection.mixed}
        aria-label={`읽는 의도: ${option.label}`}
        aria-pressed={selection.intent === option.value && !selection.mixed}
        disabled={!selection.canApply}
        onpointerdown={handlePointerDown}
        onclick={() => workspace.setReadingIntent(option.value)}
      >
        {compact ? option.shortLabel : option.label}
      </button>
    {/each}

    <button
      type="button"
      class="ui-btn ui-btn--outline"
      aria-label="읽는 의도 해제"
      disabled={!selection.canApply || (!selection.mixed && !selection.intent)}
      onpointerdown={handlePointerDown}
      onclick={() => workspace.setReadingIntent(null)}
    >
      해제
    </button>
  </div>

  {#if !compact}
    <p class="ui-hint">{hint}</p>
  {/if}
</section>

<style>
  .reading-intent-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .reading-intent-controls .ui-btn {
    min-height: 32px;
    min-width: 32px;
  }
</style>
