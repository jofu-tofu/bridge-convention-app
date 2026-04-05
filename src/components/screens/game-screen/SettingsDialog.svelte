<script lang="ts">
  import BiddingSettingsPanel from "./BiddingSettingsPanel.svelte";
  import { PANEL_FONT_STYLE } from "../../shared/layout-props";

  interface Props {
    readonly?: boolean;
  }
  const { readonly: isReadonly = false }: Props = $props();

  let dialogRef = $state<HTMLDialogElement>();

  export function open() { dialogRef?.showModal(); }
  export function close() { dialogRef?.close(); }
</script>

<dialog
  bind:this={dialogRef}
  class="bg-bg-card border border-border-subtle rounded-[--radius-lg] shadow-xl p-0 w-[calc(100%-2rem)] max-w-sm"
  style={PANEL_FONT_STYLE}
  onclick={(e) => { if (e.target === e.currentTarget) close(); }}
  data-testid="settings-dialog"
>
  <div class="flex flex-col max-h-[80vh]">
    <header class="flex items-center justify-between p-4 pb-2 shrink-0">
      <h2 class="text-[--text-heading] font-semibold text-text-primary">Settings</h2>
      <button
        class="min-w-[--size-touch-target] min-h-[--size-touch-target] flex items-center justify-center text-text-secondary hover:text-text-primary cursor-pointer transition-colors rounded-[--radius-md]"
        onclick={close}
        aria-label="Close settings"
        data-testid="settings-dialog-close"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </header>
    <div class="flex-1 overflow-y-auto px-4 pb-4">
      <BiddingSettingsPanel readonly={isReadonly} />
    </div>
    <div class="shrink-0 p-4 pt-2 border-t border-border-subtle">
      <button
        class="w-full px-3 py-2 rounded-[--radius-md] font-medium text-[--text-body] transition-colors bg-accent-primary hover:bg-accent-primary-hover text-text-on-accent cursor-pointer"
        onclick={close}
        data-testid="settings-done"
      >
        Done
      </button>
    </div>
  </div>
</dialog>

<style>
  dialog::backdrop {
    background: rgba(0, 0, 0, 0.5);
  }
</style>
