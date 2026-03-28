<script lang="ts">
  import type { OpponentMode, PlayProfileId } from "../../../service";
  import { PLAY_PROFILES, AVAILABLE_BASE_SYSTEMS } from "../../../service";
  import { getAppStore } from "../../../stores/context";
  import ToggleGroup from "../../shared/ToggleGroup.svelte";

  interface Props {
    readonly?: boolean;
  }
  const { readonly: isReadonly = false }: Props = $props();

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
    {#if isReadonly}
      <p class="text-[--text-annotation] text-text-muted mb-2 px-1">Settings locked for this deal</p>
    {/if}
    <!-- Base System -->
    <div class={isReadonly ? 'opacity-50' : ''}>
      <h3 class="text-[--text-detail] font-medium text-text-secondary mb-1 px-1">System</h3>
      <ToggleGroup
        items={AVAILABLE_BASE_SYSTEMS.map(sys => ({ id: sys.id, label: sys.shortLabel, title: sys.label, testId: `settings-system-${sys.id}` }))}
        active={appStore.baseSystemId}
        onSelect={(id) => appStore.setBaseSystemId(id as import("../../../service").BaseSystemId)}
        ariaLabel="Base bidding system"
        compact
        disabled={isReadonly}
      />
    </div>

    <!-- Opponent Mode -->
    <div class={isReadonly ? 'opacity-50' : ''}>
      <h3 class="text-[--text-detail] font-medium text-text-secondary mb-1 px-1">Opponents</h3>
      <ToggleGroup
        items={[
          { id: "natural", label: "Natural", testId: "settings-opp-natural" },
          { id: "none", label: "Silent", testId: "settings-opp-none" },
        ]}
        active={appStore.opponentMode}
        onSelect={(id) => appStore.setOpponentMode(id as OpponentMode)}
        ariaLabel="Opponent mode"
        compact
        disabled={isReadonly}
      />
      <p class="text-[--text-annotation] text-text-muted mt-1 px-1">
        {appStore.opponentMode === "natural" ? "Opponents bid naturally" : "Opponents always pass"}
      </p>
    </div>

    <!-- Play Difficulty -->
    <div>
      <h3 class="text-[--text-detail] font-medium text-text-secondary mb-1 px-1">Play Skill</h3>
      <ToggleGroup
        items={PROFILE_OPTIONS.map(opt => ({ id: opt.id, label: opt.label, title: PLAY_PROFILES[opt.id].description, testId: `settings-play-${opt.id}` }))}
        active={appStore.playProfileId ?? "world-class"}
        onSelect={(id) => appStore.setPlayProfileId(id as PlayProfileId)}
        ariaLabel="Opponent play difficulty"
        compact
      />
      <p class="text-[--text-annotation] text-text-muted mt-1 px-1">
        {PLAY_PROFILES[appStore.playProfileId ?? "world-class"].description}
      </p>
    </div>

    <!-- Off-Convention -->
    <div class={isReadonly ? 'opacity-50' : ''}>
      <label class="flex items-center gap-2 px-1 {isReadonly ? 'cursor-not-allowed' : 'cursor-pointer'}">
        <input
          type="checkbox"
          class="w-3.5 h-3.5 rounded-[--radius-sm] accent-accent-primary"
          checked={appStore.drillTuning.includeOffConvention ?? false}
          onchange={(e) => appStore.setIncludeOffConvention(e.currentTarget.checked)}
          disabled={isReadonly}
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
            class="w-full accent-accent-primary {isReadonly ? 'cursor-not-allowed' : 'cursor-pointer'}"
            disabled={isReadonly}
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
