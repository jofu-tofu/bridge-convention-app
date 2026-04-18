<script lang="ts">
  import { goto } from "$app/navigation";

  let dialogRef = $state<HTMLDialogElement>();

  export function open() {
    dialogRef?.showModal();
  }

  export function close() {
    dialogRef?.close();
  }

  function handleShowPricing() {
    close();
    void goto("/billing/pricing");
  }
</script>

<dialog
  bind:this={dialogRef}
  class="m-auto bg-bg-card border border-border-subtle rounded-[--radius-lg] shadow-xl p-0 w-[calc(100%-2rem)] max-w-sm"
  onclick={(e) => { if (e.target === e.currentTarget) close(); }}
  data-testid="paywall-overlay"
>
  <div class="flex flex-col p-5">
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-base font-semibold text-text-primary">Unlock All Conventions</h2>
      <button
        class="min-w-[--size-touch-target] min-h-[--size-touch-target] flex items-center justify-center text-text-secondary hover:text-text-primary cursor-pointer transition-colors rounded-[--radius-md]"
        onclick={close}
        aria-label="Close"
        data-testid="paywall-overlay-close"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>

    <p class="text-sm text-text-secondary mb-4 leading-relaxed">
      Practice all convention bundles with full configuration &mdash; practice modes, role selection, and system customization.
    </p>

    <div class="flex flex-col gap-2">
      <button
        class="w-full py-2.5 rounded-[--radius-md] text-sm font-semibold transition-colors cursor-pointer
          text-text-on-accent bg-accent-primary hover:bg-accent-primary-hover shadow-sm"
        onclick={handleShowPricing}
        data-testid="paywall-overlay-subscribe"
      >
        See pricing
      </button>
      <button
        class="w-full py-2 rounded-[--radius-md] text-sm font-medium transition-colors cursor-pointer
          text-text-muted hover:text-text-primary"
        onclick={close}
        data-testid="paywall-overlay-dismiss"
      >
        Maybe later
      </button>
    </div>
  </div>
</dialog>

<style>
  dialog::backdrop {
    background: rgba(0, 0, 0, 0.5);
  }
</style>
