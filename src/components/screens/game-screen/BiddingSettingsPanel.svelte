<script lang="ts">
  import type { OpponentMode, VulnerabilityDistribution } from "../../../core/contracts/drill";
  import { DEFAULT_DRILL_TUNING } from "../../../core/contracts/drill";
  import type { BaseSystemId } from "../../../core/contracts/base-system-vocabulary";
  import { AVAILABLE_BASE_SYSTEMS } from "../../../core/contracts/system-config";
  import { getAppStore } from "../../../stores/context";

  interface Props {
    onNewDeal: () => void;
  }

  let { onNewDeal }: Props = $props();

  const appStore = getAppStore();

  const VULN_KEYS = ["none", "ours", "theirs", "both"] as const;
  const VULN_SHORT: Record<typeof VULN_KEYS[number], string> = {
    none: "None",
    ours: "NS",
    theirs: "EW",
    both: "Both",
  };

  function isVulnEnabled(key: typeof VULN_KEYS[number]): boolean {
    return appStore.drillTuning.vulnerabilityDistribution[key] > 0;
  }

  const lastNonZero: Record<string, number> = {};

  function toggleVuln(key: typeof VULN_KEYS[number]) {
    const current = appStore.drillTuning.vulnerabilityDistribution;
    const enabled = current[key] > 0;
    if (enabled) {
      const othersEnabled = VULN_KEYS.some((k) => k !== key && current[k] > 0);
      if (!othersEnabled) return;
      lastNonZero[key] = current[key];
    }
    const updated: VulnerabilityDistribution = {
      ...current,
      [key]: enabled ? 0 : (lastNonZero[key] ?? 1),
    };
    appStore.setVulnerabilityDistribution(updated);
  }

  const isDefaultVuln = $derived.by(() => {
    const dist = appStore.drillTuning.vulnerabilityDistribution;
    const def = DEFAULT_DRILL_TUNING.vulnerabilityDistribution;
    return VULN_KEYS.every((k) => dist[k] === def[k]);
  });
</script>

<section class="flex flex-col h-full min-h-0" aria-label="Practice settings">
  <h2 class="text-[--text-label] font-medium text-text-muted mb-2 uppercase tracking-wider shrink-0 px-1">
    Settings
  </h2>

  <div class="flex-1 overflow-y-auto space-y-3 min-h-0">
    <!-- Base System -->
    <div>
      <h3 class="text-[--text-detail] font-medium text-text-secondary mb-1 px-1">System</h3>
      <div class="flex gap-1" role="group" aria-label="Base bidding system">
        {#each AVAILABLE_BASE_SYSTEMS as sys (sys.id)}
          {@const active = appStore.baseSystemId === sys.id}
          <button
            class="flex-1 px-2 py-1 rounded-[--radius-sm] border text-[--text-label] font-medium cursor-pointer transition-colors
              {active
                ? 'bg-accent-primary/10 border-accent-primary text-accent-primary'
                : 'bg-bg-base border-border-subtle text-text-muted hover:border-border-default'}"
            onclick={() => appStore.setBaseSystemId(sys.id)}
            aria-pressed={active}
            title={sys.label}
            data-testid="settings-system-{sys.id}"
          >
            {sys.shortLabel}
          </button>
        {/each}
      </div>
    </div>

    <!-- Vulnerability -->
    <div>
      <div class="flex items-center justify-between mb-1 px-1">
        <h3 class="text-[--text-detail] font-medium text-text-secondary">Vulnerability</h3>
        {#if !isDefaultVuln}
          <button
            class="text-[--text-annotation] text-accent-primary hover:text-accent-primary-hover cursor-pointer transition-colors"
            onclick={() => appStore.setVulnerabilityDistribution(DEFAULT_DRILL_TUNING.vulnerabilityDistribution)}
            data-testid="settings-vuln-reset"
          >
            Reset
          </button>
        {/if}
      </div>
      <div class="grid grid-cols-2 gap-1" role="group" aria-label="Vulnerability states">
        {#each VULN_KEYS as key (key)}
          {@const enabled = isVulnEnabled(key)}
          <button
            class="flex items-center gap-1.5 px-2 py-1 rounded-[--radius-sm] border text-[--text-label] font-medium cursor-pointer transition-colors
              {enabled
                ? 'bg-accent-primary/10 border-accent-primary text-accent-primary'
                : 'bg-bg-base border-border-subtle text-text-muted hover:border-border-default'}"
            onclick={() => toggleVuln(key)}
            aria-pressed={enabled}
            data-testid="settings-vuln-{key}"
          >
            <span
              class="w-3 h-3 rounded-[--radius-sm] border-2 flex items-center justify-center shrink-0 transition-colors
                {enabled ? 'bg-accent-primary border-accent-primary' : 'border-border-default bg-bg-base'}"
              aria-hidden="true"
            >
              {#if enabled}
                <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              {/if}
            </span>
            {VULN_SHORT[key]}
          </button>
        {/each}
      </div>
    </div>

    <!-- Opponent Mode -->
    <div>
      <h3 class="text-[--text-detail] font-medium text-text-secondary mb-1 px-1">Opponents</h3>
      <div class="flex gap-1" role="group" aria-label="Opponent mode">
        {#each [["natural", "Natural"], ["none", "Silent"]] as [value, label] (value)}
          {@const active = appStore.opponentMode === value}
          <button
            class="flex-1 px-2 py-1 rounded-[--radius-sm] border text-[--text-label] font-medium cursor-pointer transition-colors
              {active
                ? 'bg-accent-primary/10 border-accent-primary text-accent-primary'
                : 'bg-bg-base border-border-subtle text-text-muted hover:border-border-default'}"
            onclick={() => appStore.setOpponentMode(value as OpponentMode)}
            aria-pressed={active}
            data-testid="settings-opp-{value}"
          >
            {label}
          </button>
        {/each}
      </div>
      <p class="text-[--text-annotation] text-text-muted mt-1 px-1">
        {appStore.opponentMode === "natural" ? "Opponents bid naturally" : "Opponents always pass"}
      </p>
    </div>

    <!-- Off-Convention -->
    <div>
      <label class="flex items-center gap-2 cursor-pointer px-1">
        <input
          type="checkbox"
          class="w-3.5 h-3.5 rounded-[--radius-sm] accent-accent-primary"
          checked={appStore.drillTuning.includeOffConvention ?? false}
          onchange={(e) => appStore.setIncludeOffConvention(e.currentTarget.checked)}
          data-testid="settings-off-conv"
        />
        <span class="text-[--text-detail] text-text-primary">Off-convention deals</span>
      </label>
      {#if appStore.drillTuning.includeOffConvention}
        <div class="mt-1 px-1">
          <input
            type="range"
            min="0.1"
            max="0.7"
            step="0.05"
            value={appStore.drillTuning.offConventionRate ?? 0.3}
            oninput={(e) => appStore.setOffConventionRate(parseFloat(e.currentTarget.value))}
            class="w-full accent-accent-primary cursor-pointer"
            data-testid="settings-off-conv-rate"
          />
          <p class="text-[--text-annotation] text-text-muted">
            {Math.round((appStore.drillTuning.offConventionRate ?? 0.3) * 100)}% off-convention
          </p>
        </div>
      {/if}
    </div>

    <!-- Display settings (UI-only, do not affect deal generation) -->
    <div class="border-t border-border-subtle pt-3">
      <h3 class="text-[--text-detail] font-medium text-text-secondary mb-1 px-1">Display</h3>
      <label class="flex items-center gap-2 cursor-pointer px-1">
        <input
          type="checkbox"
          class="w-3.5 h-3.5 rounded-[--radius-sm] accent-accent-primary"
          checked={appStore.displaySettings.showEducationalAnnotations}
          onchange={(e) => appStore.setShowEducationalAnnotations(e.currentTarget.checked)}
          data-testid="settings-edu-annotations"
        />
        <span class="text-[--text-detail] text-text-primary">Educational labels</span>
      </label>
      <p class="text-[--text-annotation] text-text-muted mt-1 px-1">
        {appStore.displaySettings.showEducationalAnnotations
          ? "Show all bid annotations"
          : "Only alerts & announcements"}
      </p>
    </div>
  </div>

  <!-- New Deal button — anchored to bottom -->
  <div class="shrink-0 pt-3 mt-auto border-t border-border-subtle">
    <button
      class="w-full px-3 py-2 rounded-[--radius-md] font-medium text-[--text-body] transition-colors bg-accent-primary hover:bg-accent-primary-hover text-text-on-accent cursor-pointer"
      onclick={onNewDeal}
      data-testid="settings-new-deal"
    >
      New Deal
    </button>

  </div>
</section>
