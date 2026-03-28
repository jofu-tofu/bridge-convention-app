<script lang="ts">
  interface Props {
    step: number;
    maxSteps: number;
    trickIndex: number;
    playIndex: number;
    totalTricks: number;
    hasNextDecision: boolean;
    onStepBack: () => void;
    onStepForward: () => void;
    onJumpStart: () => void;
    onJumpEnd: () => void;
    onNextDecision: () => void;
  }

  const {
    step,
    maxSteps,
    trickIndex,
    playIndex,
    totalTricks,
    hasNextDecision,
    onStepBack,
    onStepForward,
    onJumpStart,
    onJumpEnd,
    onNextDecision,
  }: Props = $props();

  const atStart = $derived(step <= 0);
  const atEnd = $derived(step >= maxSteps - 1);

  const positionLabel = $derived.by(() => {
    if (step === 0) return "Start";
    if (playIndex < 0) return `Trick ${trickIndex + 1}`;
    return `Trick ${trickIndex + 1} · Play ${playIndex + 1}/4`;
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (!atStart) onStepBack();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (!atEnd) onStepForward();
    } else if (e.key === "Home") {
      e.preventDefault();
      onJumpStart();
    } else if (e.key === "End") {
      e.preventDefault();
      onJumpEnd();
    }
  }
</script>

<div
  class="flex items-center gap-2 bg-bg-card border border-border-subtle rounded-[--radius-lg] px-3 py-1.5 shadow-sm"
  onkeydown={handleKeydown}
  tabindex="0"
  role="toolbar"
  aria-label="Replay controls"
>
  <div class="flex items-center gap-1">
    <button
      type="button"
      class="replay-btn"
      onclick={onJumpStart}
      disabled={atStart}
      aria-label="Jump to start"
      title="Jump to start"
    >&#x25C1;&#x25C1;</button>
    <button
      type="button"
      class="replay-btn"
      onclick={onStepBack}
      disabled={atStart}
      aria-label="Step back"
      title="Step back"
    >&#x25C1;</button>
    <button
      type="button"
      class="replay-btn"
      onclick={onStepForward}
      disabled={atEnd}
      aria-label="Step forward"
      title="Step forward"
    >&#x25B7;</button>
    <button
      type="button"
      class="replay-btn"
      onclick={onJumpEnd}
      disabled={atEnd}
      aria-label="Jump to end"
      title="Jump to end"
    >&#x25B7;&#x25B7;</button>
  </div>

  <span class="text-[--text-detail] text-text-secondary flex-1 text-center truncate">
    {positionLabel}
    <span class="text-text-muted">/ {totalTricks} tricks</span>
  </span>

  {#if hasNextDecision}
    <button
      type="button"
      class="text-[--text-detail] text-accent-primary hover:text-accent-primary-hover font-medium px-2 py-0.5 rounded-[--radius-md] hover:bg-bg-elevated transition-colors shrink-0"
      onclick={onNextDecision}
      aria-label="Skip to next decision point"
      title="Next decision point"
    >
      Next Decision &#x25B7;
    </button>
  {/if}
</div>

<style>
  .replay-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: var(--size-touch-target);
    min-height: var(--size-touch-target);
    padding: 0 0.25rem;
    font-size: var(--text-detail);
    color: var(--color-text-secondary);
    background: transparent;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: color 0.15s, background-color 0.15s;
  }
  .replay-btn:hover:not(:disabled) {
    color: var(--color-text-primary);
    background-color: var(--color-bg-elevated);
  }
  .replay-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }
</style>
