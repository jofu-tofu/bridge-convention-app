<script lang="ts">
  // Surfaced when drill creation exhausts deal-generation retries even
  // after one automatic retry. Phrased in user-facing terms; the
  // technical "rejection sampling / witness" vocabulary stays out of
  // the UI per the Phase 4 plan.

  interface Props {
    onDismiss: () => void;
    onTryAgain?: () => void;
  }

  const { onDismiss, onTryAgain }: Props = $props();

  let dialogRef = $state<HTMLDialogElement>();

  export function open() {
    dialogRef?.showModal();
  }

  export function close() {
    dialogRef?.close();
  }

  $effect(() => {
    if (dialogRef && !dialogRef.open) dialogRef.showModal();
  });

  function handleTryAgain() {
    close();
    onTryAgain?.();
    onDismiss();
  }

  function handleDismiss() {
    close();
    onDismiss();
  }
</script>

<dialog
  bind:this={dialogRef}
  class="m-auto bg-bg-card border border-border-subtle rounded-[--radius-lg] shadow-xl p-0 w-[calc(100%-2rem)] max-w-sm"
  onclick={(e) => { if (e.target === e.currentTarget) handleDismiss(); }}
  data-testid="drill-error-modal"
>
  <div class="flex flex-col p-5">
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-base font-semibold text-text-primary">Couldn't generate a hand</h2>
      <button
        class="min-w-[--size-touch-target] min-h-[--size-touch-target] flex items-center justify-center text-text-secondary hover:text-text-primary cursor-pointer transition-colors rounded-[--radius-md]"
        onclick={handleDismiss}
        aria-label="Close"
        data-testid="drill-error-modal-close"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>

    <p class="text-sm text-text-secondary mb-4 leading-relaxed">
      We couldn't deal a hand for this drill. Try a different convention, or refresh the page and try again.
    </p>

    <div class="flex flex-col gap-2">
      {#if onTryAgain}
        <button
          class="w-full py-2.5 rounded-[--radius-md] text-sm font-semibold transition-colors cursor-pointer
            text-text-on-accent bg-accent-primary hover:bg-accent-primary-hover shadow-sm"
          onclick={handleTryAgain}
          data-testid="drill-error-modal-retry"
        >
          Try again
        </button>
      {/if}
      <button
        class="w-full py-2 rounded-[--radius-md] text-sm font-medium transition-colors cursor-pointer
          text-text-muted hover:text-text-primary"
        onclick={handleDismiss}
        data-testid="drill-error-modal-dismiss"
      >
        Close
      </button>
    </div>
  </div>
</dialog>

<style>
  dialog::backdrop {
    background: rgba(0, 0, 0, 0.5);
  }
</style>
