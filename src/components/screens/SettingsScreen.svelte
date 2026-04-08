<script lang="ts">
  import { OpponentMode } from "../../service";
  import type { PlayProfileId, VulnerabilityDistribution, BaseModuleInfo, SystemSelectionId } from "../../service";
  import { AVAILABLE_BASE_SYSTEMS, DEFAULT_DRILL_TUNING, PLAY_PROFILES, buildBaseModuleInfos } from "../../service";
  import { VULN_KEYS, VULN_LABELS, DEFAULT_OFF_CONVENTION_RATE } from "../shared/vulnerability-labels";
  import type { VulnKey } from "../shared/vulnerability-labels";
  import { getAppStore, getCustomSystemsStore, getAuthStore } from "../../stores/context";
  import ToggleGroup from "../shared/ToggleGroup.svelte";

  const appStore = getAppStore();
  const customSystems = getCustomSystemsStore();
  const auth = getAuthStore();

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

  const baseModules: readonly BaseModuleInfo[] = $derived(buildBaseModuleInfos());

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
    <!-- Account -->
    <section class="bg-bg-card border border-border-subtle rounded-[--radius-lg] p-5" data-testid="account-section">
      <h2 class="text-base font-semibold text-text-primary mb-1">
        Account
      </h2>
      {#if auth.loading}
        <p class="text-sm text-text-muted">Checking login status...</p>
      {:else if auth.isLoggedIn && auth.user}
        <div class="flex items-center gap-3 mt-2">
          {#if auth.user.avatar_url}
            <img
              src={auth.user.avatar_url}
              alt=""
              class="w-10 h-10 rounded-full"
            />
          {:else}
            <div class="w-10 h-10 rounded-full bg-bg-base border border-border-subtle flex items-center justify-center text-text-muted text-sm font-semibold">
              {auth.user.display_name.charAt(0).toUpperCase()}
            </div>
          {/if}
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-text-primary truncate">{auth.user.display_name}</p>
            {#if auth.user.email}
              <p class="text-xs text-text-muted truncate">{auth.user.email}</p>
            {/if}
          </div>
          <button
            class="text-sm text-text-muted hover:text-text-primary cursor-pointer transition-colors"
            onclick={() => auth.logout()}
            data-testid="logout-button"
          >
            Sign out
          </button>
        </div>
      {:else}
        <p class="text-sm text-text-secondary mb-3">
          Sign in to save your progress and sync settings across devices.
        </p>
        <div class="flex gap-2">
          <button
            class="flex items-center gap-2 px-4 py-2 rounded-[--radius-md] border border-border-subtle bg-bg-base text-sm text-text-primary hover:border-border-prominent cursor-pointer transition-colors"
            onclick={() => auth.login("google")}
            data-testid="login-google"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Google
          </button>
          <button
            class="flex items-center gap-2 px-4 py-2 rounded-[--radius-md] border border-border-subtle bg-bg-base text-sm text-text-primary hover:border-border-prominent cursor-pointer transition-colors"
            onclick={() => auth.login("github")}
            data-testid="login-github"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            GitHub
          </button>
        </div>
      {/if}
    </section>

    <!-- Base System -->
    <section class="bg-bg-card border border-border-subtle rounded-[--radius-lg] p-5">
      <h2 class="text-base font-semibold text-text-primary mb-1">
        Base System
      </h2>
      <p class="text-sm text-text-secondary mb-3">
        Your overall bidding system. This determines point ranges, opening requirements, and which conventions are available.
      </p>
      <ToggleGroup
        items={AVAILABLE_BASE_SYSTEMS.map(sys => ({ id: sys.id, label: sys.shortLabel, title: sys.label, testId: `settings-system-${sys.id}` }))}
        active={appStore.baseSystemId}
        onSelect={(id) => appStore.setBaseSystemId(id as SystemSelectionId)}
        ariaLabel="Base bidding system"
      />

      {#if customSystems.systems.length > 0}
        <div class="mt-3 max-h-32 overflow-y-auto space-y-1">
          {#each customSystems.systems as sys (sys.id)}
            <button
              class="w-full text-left px-3 py-2 rounded-[--radius-md] text-sm transition-colors cursor-pointer
                {appStore.baseSystemId === sys.id
                  ? 'bg-accent-primary text-text-on-accent font-semibold'
                  : 'bg-bg-base border border-border-subtle text-text-primary hover:border-border-prominent'}"
              onclick={() => appStore.setBaseSystemId(sys.id)}
              data-testid="settings-system-{sys.id}"
            >
              {sys.name}
            </button>
          {/each}
        </div>
      {/if}

      <button
        class="mt-2 text-xs text-accent-primary hover:underline cursor-pointer"
        onclick={() => appStore.navigateToWorkshop()}
      >
        + Create custom system
      </button>
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
        Controls whether East/West opponents bid during practice deals.
      </p>
      <select
        id="opponent-mode"
        class="bg-bg-base border border-border-subtle rounded-[--radius-md] px-3 py-2 text-sm text-text-primary cursor-pointer w-full max-w-xs"
        value={appStore.opponentMode}
        onchange={(e) => appStore.setOpponentMode(e.currentTarget.value as OpponentMode)}
        data-testid="opponent-mode-select"
      >
        <option value={OpponentMode.Natural}>Natural</option>
        <option value={OpponentMode.None}>None</option>
      </select>
      <p class="text-xs text-text-muted mt-2">
        {appStore.opponentMode === OpponentMode.Natural
          ? "Opponents compete when they have a hand worth bidding."
          : "Opponents always pass."}
      </p>
    </section>

    <!-- Play Difficulty -->
    <section class="bg-bg-card border border-border-subtle rounded-[--radius-lg] p-5">
      <label class="block text-base font-semibold text-text-primary mb-1" for="play-profile">
        Opponent Play Skill
      </label>
      <p class="text-sm text-text-secondary mb-3">
        How skillfully opponents play their cards.
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
            Higher values mean more hands where you should just pass.
          </p>
        </div>
      {/if}
    </section>
  </div>
</main>
