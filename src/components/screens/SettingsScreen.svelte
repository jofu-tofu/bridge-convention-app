<script lang="ts">
  import type { OpponentMode } from "../../bootstrap/types";
  import { getAppStore } from "../../stores/context";

  const appStore = getAppStore();
</script>

<main class="max-w-3xl mx-auto h-full flex flex-col p-6 pb-0" aria-label="Settings">
  <div class="shrink-0">
    <div class="flex items-center gap-4 mb-6">
      <button
        class="min-w-[--size-touch-target] min-h-[--size-touch-target] flex items-center justify-center text-text-secondary hover:text-text-primary cursor-pointer transition-colors rounded-[--radius-md]"
        onclick={() => appStore.navigateToMenu()}
        aria-label="Back to menu"
        data-testid="settings-back"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          ><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg
        >
      </button>
      <h1 class="text-3xl font-bold text-text-primary">Settings</h1>
    </div>
  </div>

  <div class="flex-1 overflow-y-auto pb-6 space-y-6">
    <!-- Opponent Interference -->
    <section class="bg-bg-card border border-border-subtle rounded-[--radius-lg] p-5">
      <label class="block text-base font-semibold text-text-primary mb-1" for="opponent-mode">
        Opponent Interference
      </label>
      <p class="text-sm text-text-secondary mb-3">
        Controls how East/West opponents behave during practice deals.
      </p>
      <select
        id="opponent-mode"
        class="bg-bg-base border border-border-subtle rounded-[--radius-md] px-3 py-2 text-sm text-text-primary cursor-pointer w-full max-w-xs"
        value={appStore.opponentMode}
        onchange={(e) => appStore.setOpponentMode(e.currentTarget.value as OpponentMode)}
        data-testid="opponent-mode-select"
      >
        <option value="natural">Natural</option>
        <option value="none">None</option>
      </select>
      <p class="text-xs text-text-muted mt-2">
        {appStore.opponentMode === "natural"
          ? "Opponents bid naturally with 6+ HCP and a 5+ card suit."
          : "Opponents always pass."}
      </p>
    </section>
  </div>
</main>
