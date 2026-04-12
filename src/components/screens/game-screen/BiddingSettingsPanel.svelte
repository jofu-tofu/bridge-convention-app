<script lang="ts">
  import { OpponentMode, PracticeMode, PracticeRole } from "../../../service";
  import type { PlayProfileId } from "../../../service";
  import { PLAY_PROFILES, AVAILABLE_BASE_SYSTEMS } from "../../../service";
  import { getAppStore } from "../../../stores/context";
  import ToggleGroup from "../../shared/ToggleGroup.svelte";

  interface Props {
    readonly?: boolean;
  }
  const { readonly: isReadonly = false }: Props = $props();

  const appStore = getAppStore();

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
    <!-- Practice Mode -->
    <div class={isReadonly ? 'opacity-50' : ''}>
      <h3 class="text-[--text-detail] font-medium text-text-secondary mb-1 px-1">Practice Mode</h3>
      <ToggleGroup
        items={[
          { id: PracticeMode.DecisionDrill, label: "Key Bid", testId: "settings-mode-decision" },
          { id: PracticeMode.FullAuction, label: "Full Auction", testId: "settings-mode-full" },
        ]}
        active={appStore.userPracticeMode ?? PracticeMode.DecisionDrill}
        onSelect={(id) => appStore.setUserPracticeMode(id as PracticeMode)}
        ariaLabel="Practice mode"
        compact
        disabled={isReadonly}
      />
      <p class="text-[--text-annotation] text-text-muted mt-1 px-1">
        {(appStore.userPracticeMode ?? PracticeMode.DecisionDrill) === PracticeMode.DecisionDrill
          ? "Jump to the key decision point"
          : "Bid the complete auction from the opening"}
      </p>
    </div>

    <!-- Practice Role -->
    {#if appStore.selectedConvention?.supportsRoleSelection}
      <div class={isReadonly ? 'opacity-50' : ''}>
        <h3 class="text-[--text-detail] font-medium text-text-secondary mb-1 px-1">Practice As</h3>
        <ToggleGroup
          items={[
            { id: PracticeRole.Responder, label: "Responder", testId: "settings-role-responder" },
            { id: PracticeRole.Opener, label: "Opener", testId: "settings-role-opener" },
            { id: PracticeRole.Both, label: "Both", testId: "settings-role-both" },
          ]}
          active={appStore.userPracticeRole ?? PracticeRole.Responder}
          onSelect={(id) => appStore.setUserPracticeRole(id as PracticeRole)}
          ariaLabel="Practice role"
          compact
          disabled={isReadonly}
        />
      </div>
    {/if}

    <!-- Base System -->
    <div class={isReadonly ? 'opacity-50' : ''}>
      <h3 class="text-[--text-detail] font-medium text-text-secondary mb-1 px-1">System</h3>
      <ToggleGroup
        items={AVAILABLE_BASE_SYSTEMS.map(sys => ({ id: sys.id, label: sys.shortLabel, title: sys.label, testId: `settings-system-${sys.id}` }))}
        active={appStore.baseSystemId}
        onSelect={(id) => appStore.setBaseSystemId(id as import("../../../service").SystemSelectionId)}
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
          { id: OpponentMode.Natural, label: "Natural", testId: "settings-opp-natural" },
          { id: OpponentMode.None, label: "Silent", testId: "settings-opp-none" },
        ]}
        active={appStore.opponentMode}
        onSelect={(id) => appStore.setOpponentMode(id as OpponentMode)}
        ariaLabel="Opponent mode"
        compact
        disabled={isReadonly}
      />
      <p class="text-[--text-annotation] text-text-muted mt-1 px-1">
        {appStore.opponentMode === OpponentMode.Natural ? "Opponents bid naturally" : "Opponents always pass"}
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
