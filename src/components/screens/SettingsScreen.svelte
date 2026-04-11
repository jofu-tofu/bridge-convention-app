<script lang="ts">
  import { goto } from "$app/navigation";
  import { OpponentMode } from "../../service";
  import type { PlayProfileId, VulnerabilityDistribution, BaseModuleInfo, SystemSelectionId } from "../../service";
  import { AVAILABLE_BASE_SYSTEMS, DEFAULT_DRILL_TUNING, PLAY_PROFILES, buildBaseModuleInfos } from "../../service";
  import { VULN_KEYS, VULN_LABELS, DEFAULT_OFF_CONVENTION_RATE } from "../shared/vulnerability-labels";
  import type { VulnKey } from "../shared/vulnerability-labels";
  import { getAppStore, getCustomSystemsStore, getAuthStore } from "../../stores/context";
  import AuthModal from "../shared/AuthModal.svelte";
  import ToggleGroup from "../shared/ToggleGroup.svelte";
  import CardSurface from "../shared/CardSurface.svelte";

  type SettingsTab = "gameplay" | "account";

  const appStore = getAppStore();
  const customSystems = getCustomSystemsStore();
  const auth = getAuthStore();

  let authModal = $state<ReturnType<typeof AuthModal>>();

  const PROFILE_ENTRIES: { id: PlayProfileId; label: string }[] = [
    { id: "beginner", label: "Beginner" },
    { id: "club-player", label: "Club" },
    { id: "expert", label: "Expert" },
    { id: "world-class", label: "World Class" },
  ];

  let activeTab = $state<SettingsTab>("gameplay");
  let showAlwaysOn = $state(false);

  function isVulnEnabled(key: VulnKey): boolean {
    return appStore.drillTuning.vulnerabilityDistribution[key] > 0;
  }

  const lastNonZero: Record<string, number> = {};

  function toggleVuln(key: VulnKey) {
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
    const allEqual = active.every((k) => dist[k] === dist[active[0]!]);
    if (allEqual && active.length === 4) return "Equal distribution across all four states.";
    if (allEqual) return `Equal distribution: ${active.map((k) => VULN_LABELS[k]).join(", ")}.`;
    return active.map((k) => `${VULN_LABELS[k]} ${vulnPercent(dist[k], total)}%`).join(", ") + ".";
  });

  const baseModules: readonly BaseModuleInfo[] = $derived.by(() => {
    const id = appStore.baseSystemId;
    if (typeof id === "string" && id.startsWith("custom:")) {
      const system = customSystems.getSystem(id);
      if (system) return buildBaseModuleInfos(system.baseModuleIds);
    }
    return buildBaseModuleInfos();
  });

  const isDefaultVuln = $derived.by(() => {
    const dist = appStore.drillTuning.vulnerabilityDistribution;
    const def = DEFAULT_DRILL_TUNING.vulnerabilityDistribution;
    return VULN_KEYS.every((k) => dist[k] === def[k]);
  });
</script>

<main class="max-w-2xl mx-auto h-full flex flex-col p-4 sm:p-6 pb-0" aria-label="Settings">
  <div class="shrink-0">
    <h1 class="text-2xl font-bold text-text-primary mb-1">Settings</h1>
    <p class="text-text-secondary text-sm mb-4">Configure your practice experience.</p>
    <div class="mb-4">
      <ToggleGroup
        items={[
          { id: "gameplay", label: "Gameplay", testId: "settings-tab-gameplay" },
          { id: "account", label: "Account", testId: "settings-tab-account" },
        ]}
        active={activeTab}
        onSelect={(id) => { activeTab = id as SettingsTab; }}
        ariaLabel="Settings section"
        compact
      />
    </div>
  </div>

  {#if activeTab === "gameplay"}
  <div class="flex-1 overflow-y-auto pb-6 space-y-3">
    <!-- Base System -->
    <CardSurface as="section" class="p-4">
      <h2 class="text-sm font-semibold text-text-primary mb-2">Base System</h2>
      <ToggleGroup
        items={AVAILABLE_BASE_SYSTEMS.map(sys => ({ id: sys.id, label: sys.shortLabel, title: sys.label, testId: `settings-system-${sys.id}` }))}
        active={appStore.baseSystemId}
        onSelect={(id) => appStore.setBaseSystemId(id as SystemSelectionId)}
        ariaLabel="Base bidding system"
        compact
      />

      {#if customSystems.systems.length > 0}
        <div class="mt-2 max-h-24 overflow-y-auto space-y-1">
          {#each customSystems.systems as sys (sys.id)}
            <button
              class="w-full text-left px-3 py-1.5 rounded-[--radius-md] text-sm transition-colors cursor-pointer
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
        onclick={() => void goto("/workshop")}
      >
        + Create custom system
      </button>

      {#if baseModules.length > 0}
        <button
          class="mt-3 pt-2 border-t border-border-subtle w-full flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
          onclick={() => showAlwaysOn = !showAlwaysOn}
          aria-expanded={showAlwaysOn}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="transition-transform duration-200 {showAlwaysOn ? 'rotate-90' : ''}"
            aria-hidden="true"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
          {baseModules.length} always-on convention{baseModules.length !== 1 ? "s" : ""}
        </button>
        {#if showAlwaysOn}
          <ul class="space-y-1 mt-2">
            {#each baseModules as mod (mod.id)}
              <li class="flex flex-col px-2.5 py-1.5 rounded-[--radius-md] bg-bg-base border border-border-subtle">
                <span class="text-sm text-text-primary">{mod.displayName}</span>
                <span class="text-xs text-text-muted">{mod.description}</span>
              </li>
            {/each}
          </ul>
        {/if}
      {/if}
    </CardSurface>

    <!-- Opponents + Play Skill: side-by-side on desktop -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <CardSurface as="section" class="p-4">
        <h2 class="text-sm font-semibold text-text-primary mb-2">Opponents</h2>
        <ToggleGroup
          items={[
            { id: OpponentMode.Natural, label: "Natural", testId: "settings-opp-natural" },
            { id: OpponentMode.None, label: "Silent", testId: "settings-opp-none" },
          ]}
          active={appStore.opponentMode}
          onSelect={(id) => appStore.setOpponentMode(id as OpponentMode)}
          ariaLabel="Opponent mode"
          compact
        />
        <p class="text-xs text-text-muted mt-1.5">
          {appStore.opponentMode === OpponentMode.Natural
            ? "Opponents compete when worth bidding."
            : "Opponents always pass."}
        </p>
      </CardSurface>

      <CardSurface as="section" class="p-4">
        <h2 class="text-sm font-semibold text-text-primary mb-2">Play Skill</h2>
        <ToggleGroup
          items={PROFILE_ENTRIES.map(entry => ({ id: entry.id, label: entry.label, title: PLAY_PROFILES[entry.id].description, testId: `settings-play-${entry.id}` }))}
          active={appStore.playProfileId ?? "world-class"}
          onSelect={(id) => appStore.setPlayProfileId(id as PlayProfileId)}
          ariaLabel="Opponent play difficulty"
          compact
        />
        <p class="text-xs text-text-muted mt-1.5">
          {PLAY_PROFILES[appStore.playProfileId ?? "world-class"].description}
        </p>
      </CardSurface>
    </div>

    <!-- Deal Tuning: vulnerability + off-convention grouped -->
    <CardSurface as="section" class="p-4">
      <h2 class="text-sm font-semibold text-text-primary mb-3">Deal Tuning</h2>

      <!-- Vulnerability: compact pill chips -->
      <div>
        <div class="flex items-center gap-2 mb-2">
          <span class="text-sm text-text-secondary">Vulnerability</span>
          {#if !isDefaultVuln}
            <button
              class="text-xs text-accent-primary hover:text-accent-primary-hover cursor-pointer transition-colors ml-auto"
              onclick={resetVuln}
              data-testid="vuln-reset"
            >
              Reset
            </button>
          {/if}
        </div>
        <div class="flex flex-wrap gap-1.5" role="group" aria-label="Vulnerability states">
          {#each VULN_KEYS as key (key)}
            {@const enabled = isVulnEnabled(key)}
            <button
              class="px-3 py-1 rounded-full text-xs font-medium border cursor-pointer transition-colors
                {enabled
                  ? 'bg-accent-primary/15 border-accent-primary text-accent-primary'
                  : 'bg-bg-base border-border-subtle text-text-muted hover:border-border-default'}"
              onclick={() => toggleVuln(key)}
              aria-pressed={enabled}
              data-testid="vuln-toggle-{key}"
            >
              {VULN_LABELS[key]}
            </button>
          {/each}
        </div>
        <p class="text-xs text-text-muted mt-1.5">{vulnSummary}</p>
      </div>

      <!-- Off-Convention -->
      <div class="border-t border-border-subtle mt-3 pt-3">
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            class="w-4 h-4 rounded-sm accent-accent-primary"
            checked={appStore.drillTuning.includeOffConvention ?? false}
            onchange={(e) => appStore.setIncludeOffConvention(e.currentTarget.checked)}
            data-testid="off-convention-toggle"
          />
          <span class="text-sm text-text-primary">Off-convention deals</span>
          {#if appStore.drillTuning.includeOffConvention}
            <span class="text-xs text-text-muted ml-auto">
              {Math.round((appStore.drillTuning.offConventionRate ?? DEFAULT_OFF_CONVENTION_RATE) * 100)}%
            </span>
          {/if}
        </label>
        {#if appStore.drillTuning.includeOffConvention}
          <div class="mt-2 pl-6">
            <input
              type="range"
              min="0.1"
              max="0.7"
              step="0.05"
              value={appStore.drillTuning.offConventionRate ?? DEFAULT_OFF_CONVENTION_RATE}
              oninput={(e) => appStore.setOffConventionRate(parseFloat(e.currentTarget.value))}
              class="w-full max-w-xs accent-accent-primary cursor-pointer"
              data-testid="off-convention-rate"
            />
            <p class="text-xs text-text-muted mt-0.5">
              Higher = more hands where you should just pass.
            </p>
          </div>
        {/if}
      </div>
    </CardSurface>
  </div>

  {:else if activeTab === "account"}
  <div class="flex-1 overflow-y-auto pb-6 space-y-3">
    <CardSurface as="section" class="p-4" testId="account-section">
      <h2 class="text-sm font-semibold text-text-primary mb-3">Account</h2>
      {#if auth.loading}
        <p class="text-sm text-text-muted">Checking login status...</p>
      {:else if auth.isLoggedIn && auth.user}
        <div class="flex items-center gap-3">
          {#if auth.user.avatar_url}
            <img
              src={auth.user.avatar_url}
              alt=""
              class="w-8 h-8 rounded-full"
            />
          {:else}
            <div class="w-8 h-8 rounded-full bg-bg-base border border-border-subtle flex items-center justify-center text-text-muted text-xs font-semibold">
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
            class="text-xs text-text-muted hover:text-text-primary cursor-pointer transition-colors"
            onclick={() => auth.logout()}
            data-testid="logout-button"
          >
            Sign out
          </button>
        </div>
      {:else}
        <div class="space-y-3">
          <p class="text-sm text-text-secondary">Sign in to sync your progress across devices.</p>
          <button
            class="px-4 py-2 rounded-[--radius-md] text-sm font-medium bg-accent-primary hover:bg-accent-primary-hover text-text-on-accent cursor-pointer transition-colors"
            onclick={() => authModal?.open()}
            data-testid="settings-login-open"
          >
            Sign in
          </button>
        </div>
      {/if}
    </CardSurface>
  </div>
  {/if}
  <AuthModal bind:this={authModal} />
</main>
