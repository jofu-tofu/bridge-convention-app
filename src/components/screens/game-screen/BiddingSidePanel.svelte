<script lang="ts">
  import type { Call } from "../../../engine/types";
  import type { ViewportBidFeedback, TeachingDetail } from "../../../core/viewport";
  import BidPanel from "../../game/BidPanel.svelte";
  import BidFeedbackPanel from "../../game/bid-feedback/BidFeedbackPanel.svelte";
  interface Props {
    legalCalls: Call[];
    onBid: (call: Call) => void;
    disabled: boolean;
    isUserTurn: boolean;
    isFeedbackBlocking: boolean;
    onRetry: () => void;
    viewportFeedback: ViewportBidFeedback | null;
    teachingDetail: TeachingDetail | null;
    onNewDeal: () => void;
    onOpenSettings: () => void;
  }

  let {
    legalCalls,
    onBid,
    disabled,
    isUserTurn,
    isFeedbackBlocking: _isFeedbackBlocking,
    onRetry,
    viewportFeedback,
    teachingDetail,
    onNewDeal,
    onOpenSettings,
  }: Props = $props();

  const hasFeedback = $derived(viewportFeedback !== null);
</script>

<div class="flex flex-col h-full min-h-0">
<div class="min-w-0 min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
  <h2
    class="text-[--text-label] font-medium text-text-muted mb-2 uppercase tracking-wider"
    aria-live="polite"
  >
    {#if hasFeedback}
      Your bid
    {:else if isUserTurn}
      Your bid
    {:else}
      Waiting...
    {/if}
  </h2>
  <BidPanel {legalCalls} {onBid} {disabled} compact />
  <div class="mt-3" class:hidden={!hasFeedback}>
    {#if viewportFeedback}
      <BidFeedbackPanel
        feedback={viewportFeedback}
        teaching={teachingDetail}
        {onRetry}
      />
    {/if}
  </div>
</div>

  <div class="shrink-0 pt-3 mt-auto border-t border-border-subtle flex flex-col gap-2">
    <button
      class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-[--radius-md] font-medium text-[--text-body] transition-colors border border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-default cursor-pointer"
      onclick={onOpenSettings}
      data-testid="bidding-open-settings"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
      Settings
    </button>
    <button
      class="w-full px-3 py-2 rounded-[--radius-md] font-medium text-[--text-body] transition-colors bg-accent-primary hover:bg-accent-primary-hover text-text-on-accent cursor-pointer"
      onclick={onNewDeal}
      data-testid="settings-new-deal"
    >
      New Deal
    </button>
  </div>
</div>
