<script lang="ts">
  import type { OpponentMode, PlayProfileId, VulnerabilityDistribution, BaseModuleInfo } from "../../service";
  import { AVAILABLE_BASE_SYSTEMS, DEFAULT_DRILL_TUNING, PLAY_PROFILES, buildBaseModuleInfos } from "../../service";
  import { VULN_KEYS, VULN_LABELS, DEFAULT_OFF_CONVENTION_RATE } from "../shared/vulnerability-labels";
  import type { VulnKey } from "../shared/vulnerability-labels";
  import { getAppStore } from "../../stores/context";
  import ToggleGroup from "../shared/ToggleGroup.svelte";

  const appStore = getAppStore();

  const PROFILE_ENTRIES: { id: PlayProfileId; label: string }[] = [
    { id: "beginner", label: "Beginner" },
    { id: "club-player", label: "Club Player" },
    { id: "expert", label: "Expert" },
    { id: "world-class", label: "World Class" },
  ];

  function isVulnEnabled(key: VulnKey): boolean {
    return appStore.drillTuning.vulnerabilityDistribution[key] > 0;
  }

  // Track last non-zero weight per key so toggling off→on restores it
  // (future-proofs for sliders that set weights like 3, 0.5, etc.)
  const lastNonZero: Record<string, number> = {};

  function toggleVuln(key: VulnKey) {
    const current = appStore.drillTuning.vulnerabilityDistribution;
    const enabled = current[key] > 0;
    // Don't allow disabling all — at least one must remain
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

  function resetVuln() {
    appStore.setVulnerabilityDistribution(
      DEFAULT_DRILL_TUNING.vulnerabilityDistribution,
    );
  }

  function vulnPercent(weight: number, total: number): number {
    return total > 0 ? Math.round((weight / total) * 100) : 0;
  }

  const vulnSummary = $derived.by(() => {
    const dist = appStore.drillTuning.vulnerabilityDistribution;
    const active = VULN_KEYS.filter((k) => dist[k] > 0);
    const total = VULN_KEYS.reduce((sum, k) => sum + dist[k], 0);
    if (active.length === 0) return "No vulnerability states selected.";
    if (active.length === 1) return `Always: ${VULN_LABELS[active[0]!]}.`;
    // Check if all active weights are equal
    const allEqual = active.every((k) => dist[k] === dist[active[0]!]);
    if (allEqual && active.length === 4) return "Equal distribution across all four states.";
    if (allEqual) return `Equal distribution: ${active.map((k) => VULN_LABELS[k]).join(", ")}.`;
    // Show percentages for non-uniform weights
    return active.map((k) => `${VULN_LABELS[k]} ${vulnPercent(dist[k], total)}%`).join(", ") + ".";
  });

  const baseModules: readonly BaseModuleInfo[] = $derived(buildBaseModuleInfos(appStore.baseSystemId));

  const isDefaultVuln = $derived.by(() => {
    const dist = appStore.drillTuning.vulnerabilityDistribution;
    const def = DEFAULT_DRILL_TUNING.vulnerabilityDistribution;
    return VULN_KEYS.every((k) => dist[k] === def[k]);
  });
</script>

<main class="max-w-3xl mx-auto h-full flex flex-col p-6 pb-0" aria-label="Settings">
  <div class="shrink-0">
    <h1 class="text-3xl font-bold text-text-primary mb-6">Practice Settings</h1>
  </div>

  <div class="flex-1 overflow-y-auto pb-6 space-y-6">
    <!-- Base System -->
    <section class="bg-bg-card border border-border-subtle rounded-[--radius-lg] p-5">
      <h2 class="text-base font-semibold text-text-primary mb-1">
        Base System
      </h2>
      <p class="text-sm text-text-secondary mb-3">
        The bidding system framework that sets HCP ranges and conventions.
      </p>
      <ToggleGroup
        items={AVAILABLE_BASE_SYSTEMS.map(sys => ({ id: sys.id, label: sys.shortLabel, title: sys.label, testId: `settings-system-${sys.id}` }))}
        active={appStore.baseSystemId}
        onSelect={(id) => appStore.setBaseSystemId(id as import("../../service").BaseSystemId)}
        ariaLabel="Base bidding system"
      />
    </section>

    <!-- Base Conventions -->
    <section class="bg-bg-card border border-border-subtle rounded-[--radius-lg] p-5" data-testid="base-conventions">
      <h2 class="text-base font-semibold text-text-primary mb-1">
        Base Conventions
      </h2>
      <p class="text-sm text-text-secondary mb-3">
        Always active regardless of which convention you practice.
      </p>
      <ul class="space-y-2">
        {#each baseModules as mod (mod.id)}
          <li class="flex flex-col px-3 py-2 rounded-[--radius-md] bg-bg-base border border-border-subtle">
            <span class="text-sm font-medium text-text-primary">{mod.displayName}</span>
            <span class="text-xs text-text-muted">{mod.description}</span>
          </li>
        {/each}
      </ul>
    </section>

    <!-- Vulnerability Distribution -->
    <section class="bg-bg-card border border-border-subtle rounded-[--radius-lg] p-5">
      <div class="flex items-center justify-between mb-1">
        <h2 class="text-base font-semibold text-text-primary">
          Vulnerability
        </h2>
        {#if !isDefaultVuln}
          <button
            class="text-xs text-accent-primary hover:text-accent-primary-hover cursor-pointer transition-colors"
            onclick={resetVuln}
            data-testid="vuln-reset"
          >
            Reset to default
          </button>
        {/if}
      </div>
      <p class="text-sm text-text-secondary mb-3">
        Choose which vulnerability conditions appear in practice deals.
      </p>
      <div class="grid grid-cols-2 gap-2" role="group" aria-label="Vulnerability states">
        {#each VULN_KEYS as key (key)}
          {@const enabled = isVulnEnabled(key)}
          <button
            class="flex items-center gap-2.5 px-3 py-2.5 rounded-[--radius-md] border text-sm font-medium cursor-pointer transition-colors
              {enabled
                ? 'bg-accent-primary/10 border-accent-primary text-accent-primary'
                : 'bg-bg-base border-border-subtle text-text-muted hover:border-border-default'}"
            onclick={() => toggleVuln(key)}
            aria-pressed={enabled}
            data-testid="vuln-toggle-{key}"
          >
            <span
              class="w-4 h-4 rounded-sm border-2 flex items-center justify-center shrink-0 transition-colors
                {enabled ? 'bg-accent-primary border-accent-primary' : 'border-border-default bg-bg-base'}"
              aria-hidden="true"
            >
              {#if enabled}
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              {/if}
            </span>
            {VULN_LABELS[key]}
          </button>
        {/each}
      </div>
      <p class="text-xs text-text-muted mt-2">
        {vulnSummary}
      </p>
    </section>

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

    <!-- Play Difficulty -->
    <section class="bg-bg-card border border-border-subtle rounded-[--radius-lg] p-5">
      <label class="block text-base font-semibold text-text-primary mb-1" for="play-profile">
        Opponent Play Skill
      </label>
      <p class="text-sm text-text-secondary mb-3">
        Controls how skillfully opponents play their cards during the play phase.
      </p>
      <select
        id="play-profile"
        class="bg-bg-base border border-border-subtle rounded-[--radius-md] px-3 py-2 text-sm text-text-primary cursor-pointer w-full max-w-xs"
        value={appStore.playProfileId ?? "world-class"}
        onchange={(e) => appStore.setPlayProfileId(e.currentTarget.value as PlayProfileId)}
        data-testid="play-profile-select"
      >
        {#each PROFILE_ENTRIES as entry (entry.id)}
          <option value={entry.id}>{entry.label}</option>
        {/each}
      </select>
      <p class="text-xs text-text-muted mt-2">
        {PLAY_PROFILES[appStore.playProfileId ?? "world-class"].description}
      </p>
    </section>

    <!-- Off-Convention Deals -->
    <section class="bg-bg-card border border-border-subtle rounded-[--radius-lg] p-5">
      <div class="flex items-center justify-between mb-1">
        <h2 class="text-base font-semibold text-text-primary">
          Off-Convention Deals
        </h2>
      </div>
      <p class="text-sm text-text-secondary mb-3">
        Include deals where the convention doesn't apply, so you can practice
        recognizing when to pass.
      </p>
      <label class="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          class="w-4 h-4 rounded-sm accent-accent-primary"
          checked={appStore.drillTuning.includeOffConvention ?? false}
          onchange={(e) => appStore.setIncludeOffConvention(e.currentTarget.checked)}
          data-testid="off-convention-toggle"
        />
        <span class="text-sm text-text-primary">Include off-convention deals</span>
      </label>
      {#if appStore.drillTuning.includeOffConvention}
        <div class="mt-3">
          <label class="block text-sm text-text-secondary mb-1.5" for="off-conv-rate">
            Frequency: {Math.round((appStore.drillTuning.offConventionRate ?? DEFAULT_OFF_CONVENTION_RATE) * 100)}% of deals
          </label>
          <input
            id="off-conv-rate"
            type="range"
            min="0.1"
            max="0.7"
            step="0.05"
            value={appStore.drillTuning.offConventionRate ?? DEFAULT_OFF_CONVENTION_RATE}
            oninput={(e) => appStore.setOffConventionRate(parseFloat(e.currentTarget.value))}
            class="w-full max-w-xs accent-accent-primary cursor-pointer"
            data-testid="off-convention-rate"
          />
          <p class="text-xs text-text-muted mt-1">
            About {Math.round((appStore.drillTuning.offConventionRate ?? DEFAULT_OFF_CONVENTION_RATE) * 100)}% of practice
            deals will be hands where the convention doesn't apply.
          </p>
        </div>
      {/if}
    </section>
  </div>
</main>
