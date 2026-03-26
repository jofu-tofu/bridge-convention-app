<script lang="ts">
  import type { OpponentMode, PlayProfileId } from "../../../service";
  import { PLAY_PROFILES, AVAILABLE_BASE_SYSTEMS } from "../../../service";
  import { getAppStore } from "../../../stores/context";

  const appStore = getAppStore();

  const OFF_CONVENTION_RATE = { MIN: 0.1, MAX: 0.7, STEP: 0.05, DEFAULT: 0.3 } as const;

  const PROFILE_OPTIONS: { id: PlayProfileId; label: string }[] = [
    { id: "beginner", label: "Beginner" },
    { id: "club-player", label: "Club" },
    { id: "expert", label: "Expert" },
    { id: "world-class", label: "World Class" },
  ];
</script>

<div class="space-y-3">
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

    <!-- Play Difficulty -->
    <div>
      <h3 class="text-[--text-detail] font-medium text-text-secondary mb-1 px-1">Play Skill</h3>
      <div class="flex gap-1" role="group" aria-label="Opponent play difficulty">
        {#each PROFILE_OPTIONS as opt (opt.id)}
          {@const active = (appStore.playProfileId ?? "world-class") === opt.id}
          <button
            class="flex-1 px-2 py-1 rounded-[--radius-sm] border text-[--text-label] font-medium cursor-pointer transition-colors
              {active
                ? 'bg-accent-primary/10 border-accent-primary text-accent-primary'
                : 'bg-bg-base border-border-subtle text-text-muted hover:border-border-default'}"
            onclick={() => appStore.setPlayProfileId(opt.id)}
            aria-pressed={active}
            title={PLAY_PROFILES[opt.id].description}
            data-testid="settings-play-{opt.id}"
          >
            {opt.label}
          </button>
        {/each}
      </div>
      <p class="text-[--text-annotation] text-text-muted mt-1 px-1">
        {PLAY_PROFILES[appStore.playProfileId ?? "world-class"].description}
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
            min={OFF_CONVENTION_RATE.MIN}
            max={OFF_CONVENTION_RATE.MAX}
            step={OFF_CONVENTION_RATE.STEP}
            value={appStore.drillTuning.offConventionRate ?? OFF_CONVENTION_RATE.DEFAULT}
            oninput={(e) => appStore.setOffConventionRate(parseFloat(e.currentTarget.value))}
            class="w-full accent-accent-primary cursor-pointer"
            data-testid="settings-off-conv-rate"
          />
          <p class="text-[--text-annotation] text-text-muted">
            {Math.round((appStore.drillTuning.offConventionRate ?? OFF_CONVENTION_RATE.DEFAULT) * 100)}% off-convention
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
