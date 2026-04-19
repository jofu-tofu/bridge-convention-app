<script lang="ts">
  import { goto } from "$app/navigation";
  import {
    AVAILABLE_BASE_SYSTEMS,
    OpponentMode,
    PLAY_PROFILES,
    PracticeMode,
    PracticeRole,
  } from "../../service";
  import type { PlayProfileId, SystemSelectionId } from "../../service";
  import { getAppStore, getCustomSystemsStore } from "../../stores/context";
  import SectionHeader from "../shared/SectionHeader.svelte";
  import ToggleGroup from "../shared/ToggleGroup.svelte";

  interface Props {
    showHeader?: boolean;
  }

  const { showHeader = true }: Props = $props();

  const appStore = getAppStore();
  const customSystems = getCustomSystemsStore();

  type ToggleOption<T> = { id: T; label: string; title?: string; testId: string };

  const modeOptions: ToggleOption<PracticeMode>[] = [
    { id: PracticeMode.DecisionDrill, label: "Decision", testId: "practice-settings-mode-decision" },
    { id: PracticeMode.FullAuction, label: "Auction", title: "Full auction", testId: "practice-settings-mode-full" },
    { id: PracticeMode.Learn, label: "Learn", testId: "practice-settings-mode-learn" },
  ];

  const roleOptions: ToggleOption<PracticeRole | "auto">[] = [
    { id: "auto", label: "Auto", testId: "practice-settings-role-auto" },
    { id: PracticeRole.Opener, label: "Opener", testId: "practice-settings-role-opener" },
    { id: PracticeRole.Responder, label: "Responder", testId: "practice-settings-role-responder" },
    { id: PracticeRole.Both, label: "Both", testId: "practice-settings-role-both" },
  ];

  const opponentOptions: ToggleOption<OpponentMode>[] = [
    { id: OpponentMode.Natural, label: "Natural", testId: "practice-settings-opponents-natural" },
    { id: OpponentMode.None, label: "Silent", testId: "practice-settings-opponents-silent" },
  ];

  const profileOptions: ToggleOption<PlayProfileId>[] = [
    { id: "beginner", label: "Beginner", testId: "practice-settings-skill-beginner" },
    { id: "club-player", label: "Club", testId: "practice-settings-skill-club" },
    { id: "expert", label: "Expert", testId: "practice-settings-skill-expert" },
    { id: "world-class", label: "World", title: "World Class", testId: "practice-settings-skill-world-class" },
  ];
</script>

<section class="rounded-[--radius-xl] border border-border-subtle bg-bg-card p-3 shadow-sm">
  <div class="space-y-2.5">
    {#if showHeader}
      <SectionHeader level="h2">Quick Practice Settings</SectionHeader>
    {/if}

    <div class="space-y-1">
      <SectionHeader level="h3">Mode</SectionHeader>
      <ToggleGroup
        items={modeOptions}
        active={appStore.userPracticeMode ?? PracticeMode.DecisionDrill}
        onSelect={(id) => appStore.setUserPracticeMode(id as PracticeMode)}
        ariaLabel="Practice mode"
        compact
      />
    </div>

    <div class="space-y-1">
      <SectionHeader level="h3">Role</SectionHeader>
      <ToggleGroup
        items={roleOptions}
        active={appStore.practiceRole}
        onSelect={(id) => appStore.setPracticeRole(id as PracticeRole | "auto")}
        ariaLabel="Practice role"
        compact
      />
    </div>

    <div class="space-y-1">
      <SectionHeader level="h3">System</SectionHeader>
      <ToggleGroup
        items={AVAILABLE_BASE_SYSTEMS.map((system) => ({
          id: system.id,
          label: system.shortLabel,
          title: system.label,
          testId: `practice-settings-system-${system.id}`,
        }))}
        active={appStore.baseSystemId}
        onSelect={(id) => appStore.setBaseSystemId(id as SystemSelectionId)}
        ariaLabel="Base bidding system"
        compact
      />
      {#if customSystems.systems.length > 0}
        <div class="space-y-1.5 pt-1">
          {#each customSystems.systems as system (system.id)}
            <button
              class="w-full rounded-[--radius-md] border px-3 py-1.5 text-left text-sm transition-colors cursor-pointer
                {appStore.baseSystemId === system.id
                  ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                  : 'border-border-subtle bg-bg-base text-text-primary hover:border-border-default'}"
              onclick={() => appStore.setBaseSystemId(system.id)}
              data-testid="practice-settings-system-{system.id}"
            >
              {system.name}
            </button>
          {/each}
        </div>
      {/if}
      <button
        class="text-xs font-medium text-accent-primary hover:text-accent-primary-hover cursor-pointer transition-colors"
        onclick={() => void goto("/workshop")}
      >
        + Create custom system
      </button>
    </div>

    <div class="space-y-1">
      <SectionHeader level="h3">Opponents</SectionHeader>
      <ToggleGroup
        items={opponentOptions}
        active={appStore.opponentMode}
        onSelect={(id) => appStore.setOpponentMode(id as OpponentMode)}
        ariaLabel="Opponent mode"
        compact
      />
    </div>

    <div class="space-y-1">
      <SectionHeader level="h3">Play Skill</SectionHeader>
      <ToggleGroup
        items={profileOptions}
        active={appStore.playProfileId ?? "world-class"}
        onSelect={(id) => appStore.setPlayProfileId(id as PlayProfileId)}
        ariaLabel="Opponent play skill"
        compact
      />
      <p class="text-xs text-text-muted leading-snug line-clamp-2">{PLAY_PROFILES[appStore.playProfileId ?? "world-class"].description}</p>
    </div>

    <label class="flex items-center gap-3 rounded-[--radius-md] border border-border-subtle bg-bg-base px-3 py-2 cursor-pointer">
      <input
        type="checkbox"
        class="h-4 w-4 rounded-[--radius-sm] accent-accent-primary"
        checked={appStore.displaySettings.showEducationalAnnotations}
        onchange={(event) => appStore.setShowEducationalAnnotations(event.currentTarget.checked)}
        data-testid="practice-settings-annotations"
      />
      <span class="text-sm text-text-primary">Show educational labels</span>
    </label>
  </div>
</section>
