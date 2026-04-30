<script lang="ts">
  import { goto } from "$app/navigation";
  import {
    AVAILABLE_BASE_SYSTEMS,
    OpponentMode,
    PLAY_PROFILES,
    PracticeMode,
    PracticeRole,
    displayConventionName,
    listConventions,
  } from "../../service";
  import type { ConventionInfo, PlayProfileId, SystemSelectionId, VulnerabilityDistribution } from "../../service";
  import { DrillEntitlementError } from "../../service";
  import { getAppStore, getAuthStoreOptional, getCustomSystemsStore, getDrillsStore } from "../../stores/context";
  import { canPractice } from "../../stores/entitlements";
  import { DRILL_NAME_MAX } from "../../stores/drills.svelte";
  import type { Drill, DrillPracticeRole } from "../../stores/drills.svelte";
  import ConventionPicker from "../shared/ConventionPicker.svelte";
  import SectionHeader from "../shared/SectionHeader.svelte";
  import ToggleGroup from "../shared/ToggleGroup.svelte";
  import VulnerabilityPicker from "../shared/VulnerabilityPicker.svelte";

  interface Props {
    mode: "create" | "edit";
    drill?: Drill;
  }

  const { mode, drill }: Props = $props();

  const appStore = getAppStore();
  const customSystems = getCustomSystemsStore();
  const drillsStore = getDrillsStore();
  const authStore = getAuthStoreOptional();
  const allConventions = listConventions();

  function isLocked(moduleId: string): boolean {
    return !canPractice(authStore?.user ?? null, moduleId);
  }

  function conventionDisplay(moduleId: string): string {
    const match = allConventions.find((c) => c.id === moduleId);
    return match ? displayConventionName(match.name) : moduleId;
  }

  const availableConventionIds = new Set(allConventions.map((convention) => convention.id));
  const initialModuleIds =
    mode === "edit"
      ? (drill?.moduleIds ?? []).filter((moduleId) => availableConventionIds.has(moduleId))
      : [];

  let selectedModuleIds = $state<string[]>(initialModuleIds);
  let name = $state(mode === "edit" ? drill?.name ?? "" : "");
  let nameTouched = $state(mode === "edit");
  let lastSuggestedName = $state(mode === "edit" ? drill?.name ?? "" : "");
  let practiceMode = $state<PracticeMode>(
    drill?.practiceMode ?? appStore.userPracticeMode ?? PracticeMode.DecisionDrill,
  );
  let practiceRole = $state<DrillPracticeRole>(
    drill?.practiceRole ?? "auto",
  );
  let systemSelectionId = $state<SystemSelectionId>(
    drill?.systemSelectionId ?? appStore.baseSystemId,
  );
  let opponentMode = $state<OpponentMode>(
    drill?.opponentMode ?? appStore.opponentMode,
  );
  let playProfileId = $state<PlayProfileId>(
    drill?.playProfileId ?? appStore.playProfileId ?? "world-class",
  );
  let vulnerabilityDistribution = $state<VulnerabilityDistribution>(
    drill?.vulnerabilityDistribution ?? appStore.drillTuning.vulnerabilityDistribution,
  );
  let showEducationalAnnotations = $state<boolean>(
    drill?.showEducationalAnnotations ?? appStore.displaySettings.showEducationalAnnotations,
  );
  let nameError = $state<string | null>(null);
  let selectionError = $state<string | null>(null);
  let vulnError = $state<string | null>(null);
  let entitlementError = $state<string[] | null>(null);
  let saving = $state(false);
  let advancedOpen = $state(mode === "edit");

  const selectedConventions = $derived(
    selectedModuleIds
      .map((moduleId) => allConventions.find((convention) => convention.id === moduleId))
      .filter((convention): convention is ConventionInfo => Boolean(convention)),
  );

  const selectedNames = $derived(
    selectedConventions.map((convention) => displayConventionName(convention.name)),
  );

  const suggestedName = $derived.by(() => {
    if (selectedNames.length === 0) return "";
    if (selectedNames.length === 1) return `${selectedNames[0]} drill`;
    if (selectedNames.length === 2) return `${selectedNames[0]} + ${selectedNames[1]} drill`;
    return `${selectedNames[0]} + ${selectedNames.length - 1} more drill`;
  });

  const systemOptions = $derived([
    ...AVAILABLE_BASE_SYSTEMS.map((system) => ({
      id: system.id as SystemSelectionId,
      label: system.shortLabel,
      title: system.label,
      testId: `drill-form-system-${system.id}`,
    })),
  ]);

  const modeOptions = [
    { id: PracticeMode.DecisionDrill, label: "Decision", testId: "drill-form-mode-decision" },
    { id: PracticeMode.FullAuction, label: "Full auction", testId: "drill-form-mode-full" },
    { id: PracticeMode.Learn, label: "Learn", testId: "drill-form-mode-learn" },
  ];

  const roleOptions = [
    { id: "auto", label: "Auto", testId: "drill-form-role-auto" },
    { id: PracticeRole.Opener, label: "Opener", testId: "drill-form-role-opener" },
    { id: PracticeRole.Responder, label: "Responder", testId: "drill-form-role-responder" },
    { id: PracticeRole.Both, label: "Both", testId: "drill-form-role-both" },
  ];

  const opponentOptions: { id: OpponentMode; label: string; testId: string }[] = [
    { id: OpponentMode.Natural, label: "Natural", testId: "drill-form-opponents-natural" },
    { id: OpponentMode.None, label: "Silent", testId: "drill-form-opponents-silent" },
  ];

  const playProfileOptions: { id: PlayProfileId; label: string; testId: string }[] = [
    { id: "beginner", label: "Beginner", testId: "drill-form-skill-beginner" },
    { id: "club-player", label: "Club", testId: "drill-form-skill-club" },
    { id: "expert", label: "Expert", testId: "drill-form-skill-expert" },
    { id: "world-class", label: "World Class", testId: "drill-form-skill-world-class" },
  ];

  function isValidVulnDistribution(d: VulnerabilityDistribution): boolean {
    return d.none + d.ours + d.theirs + d.both > 0;
  }

  $effect(() => {
    if (!suggestedName) return;
    if (nameTouched && name !== lastSuggestedName) return;
    name = suggestedName;
    lastSuggestedName = suggestedName;
  });

  let addAnotherOpen = $state(false);

  function addConvention(moduleId: string): void {
    if (selectedModuleIds.includes(moduleId)) return;
    selectedModuleIds = [...selectedModuleIds, moduleId];
    selectionError = null;
    const stillLocked = selectedModuleIds.filter(isLocked);
    entitlementError = stillLocked.length > 0 ? stillLocked : null;
    addAnotherOpen = false;
  }

  function removeConvention(moduleId: string): void {
    selectedModuleIds = selectedModuleIds.filter((id) => id !== moduleId);
    if (entitlementError) {
      const stillLocked = entitlementError.filter((id) => selectedModuleIds.includes(id));
      entitlementError = stillLocked.length > 0 ? stillLocked : null;
    }
  }

  function validateForm(): boolean {
    const nextNameError = drillsStore.validateName(name);
    nameTouched = true;
    nameError = nextNameError;
    selectionError = selectedModuleIds.length > 0 ? null : "Select at least one convention";
    vulnError = isValidVulnDistribution(vulnerabilityDistribution)
      ? null
      : "Pick at least one vulnerability state";
    if (vulnError) {
      advancedOpen = true;
    }
    const lockedSelected = selectedModuleIds.filter(isLocked);
    if (lockedSelected.length > 0) {
      entitlementError = lockedSelected;
      return false;
    }
    entitlementError = null;
    return !nextNameError && !selectionError && !vulnError;
  }

  async function persistDrill(): Promise<Drill | null> {
    if (!validateForm()) return null;

    saving = true;
    try {
      if (mode === "edit" && drill) {
        await drillsStore.update(drill.id, {
          name,
          moduleIds: selectedModuleIds,
          practiceMode,
          practiceRole,
          systemSelectionId,
          opponentMode,
          playProfileId,
          vulnerabilityDistribution,
          showEducationalAnnotations,
        });
        return drillsStore.getById(drill.id) ?? null;
      }

      return await drillsStore.create({
        name,
        moduleIds: selectedModuleIds,
        practiceMode,
        practiceRole,
        systemSelectionId,
        opponentMode,
        playProfileId,
        vulnerabilityDistribution,
        showEducationalAnnotations,
      });
    } catch (err) {
      if (err instanceof DrillEntitlementError) {
        entitlementError = err.blockedModuleIds;
        return null;
      }
      throw err;
    } finally {
      saving = false;
    }
  }

  async function saveOnly(): Promise<void> {
    const saved = await persistDrill();
    if (!saved) return;
    await goto("/practice/drills");
  }

  async function saveAndLaunch(): Promise<void> {
    const saved = await persistDrill();
    if (!saved) return;

    const firstConvention = allConventions.find((convention) => convention.id === saved.moduleIds[0]);
    if (!firstConvention) {
      throw new Error(`Unknown convention: ${saved.moduleIds[0]}`);
    }

    appStore.selectConvention(firstConvention);
    appStore.applyDrillSession(
      {
        moduleIds: saved.moduleIds,
        practiceMode: saved.practiceMode,
        practiceRole: saved.practiceRole,
        systemSelectionId: saved.systemSelectionId,
        opponentMode: saved.opponentMode,
        playProfileId: saved.playProfileId,
        vulnerabilityDistribution: saved.vulnerabilityDistribution,
        showEducationalAnnotations: saved.showEducationalAnnotations,
        sourceDrillId: saved.id,
      },
      allConventions,
    );
    void drillsStore.markLaunched(saved.id);
    await goto("/game");
  }

  async function cancel(): Promise<void> {
    if (history.length > 1) {
      history.back();
      return;
    }
    await goto("/practice/drills");
  }
</script>

<form
  class="space-y-6 rounded-[--radius-xl] border border-border-subtle bg-bg-card p-5 shadow-sm"
  onsubmit={(event) => event.preventDefault()}
>
  <div class="space-y-2">
    <label for="drill-form-name" class="block">
      <SectionHeader level="h3">Name</SectionHeader>
    </label>
    <input
      id="drill-form-name"
      type="text"
      maxlength={DRILL_NAME_MAX}
      bind:value={name}
      placeholder={suggestedName || "Name this drill"}
      class="w-full rounded-[--radius-md] border border-border-subtle bg-bg-base px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent-primary"
      data-testid="drill-form-name"
      oninput={() => {
        nameTouched = true;
        nameError = drillsStore.validateName(name);
      }}
      onblur={() => {
        nameTouched = true;
        nameError = drillsStore.validateName(name);
      }}
    />
    {#if nameError}
      <p class="text-xs text-red-400" role="alert">{nameError}</p>
    {:else}
      <p class="text-xs text-text-muted">Required, max {DRILL_NAME_MAX} characters.</p>
    {/if}
  </div>

  <div class="space-y-3">
    <div class="space-y-1">
      <SectionHeader level="h3">Convention</SectionHeader>
      <p class="text-xs text-text-muted">Pick one convention. You can add more for round-robin practice.</p>
    </div>

    {#if selectedConventions.length > 0}
      <div class="flex flex-wrap gap-2" data-testid="drill-form-convention-chips">
        {#each selectedConventions as convention (convention.id)}
          <span
            class="inline-flex items-center gap-1.5 rounded-full border border-accent-primary/40 bg-accent-primary/10 px-3 py-1 text-xs font-medium text-accent-primary"
            data-testid="drill-form-convention-chip-{convention.id}"
          >
            {displayConventionName(convention.name)}
            <button
              type="button"
              class="text-accent-primary hover:text-accent-primary-hover cursor-pointer"
              aria-label="Remove {displayConventionName(convention.name)}"
              onclick={() => removeConvention(convention.id)}
              data-testid="drill-form-convention-chip-remove-{convention.id}"
            >
              <span aria-hidden="true">×</span>
            </button>
          </span>
        {/each}
      </div>
    {/if}

    {#if selectedConventions.length === 0}
      <ConventionPicker
        conventions={allConventions}
        isLocked={isLocked}
        onPick={(id) => addConvention(id)}
        triggerLabel="Choose a convention"
        testIdPrefix="drill-form-convention-picker"
      />
    {:else if addAnotherOpen}
      <ConventionPicker
        conventions={allConventions}
        excludeIds={selectedModuleIds}
        isLocked={isLocked}
        onPick={(id) => addConvention(id)}
        onCancel={() => { addAnotherOpen = false; }}
        triggerLabel="Choose another convention"
        testIdPrefix="drill-form-convention-picker"
        variant="subtle"
        openOnMount
      />
    {:else}
      <button
        type="button"
        class="inline-flex items-center gap-1 rounded-[--radius-md] px-1 py-0.5 text-xs font-medium text-text-muted hover:text-text-primary cursor-pointer focus:outline-none focus:underline"
        onclick={() => { addAnotherOpen = true; }}
        data-testid="drill-form-convention-add-another"
      >
        <span aria-hidden="true">+</span>
        Add another convention
      </button>
    {/if}

    {#if selectionError}
      <p class="text-xs text-red-400" role="alert">{selectionError}</p>
    {/if}
    {#if entitlementError}
      <p class="text-xs text-red-400" role="alert">
        Subscribe to add: {entitlementError.map(conventionDisplay).join(", ")}
      </p>
      <a
        href="/billing/pricing"
        class="text-xs font-medium text-accent-primary underline hover:text-accent-primary-hover"
      >
        Subscribe to unlock
      </a>
    {/if}
  </div>

  <div class="space-y-2">
    <SectionHeader level="h3">Mode</SectionHeader>
    <ToggleGroup
      items={modeOptions}
      active={practiceMode}
      onSelect={(id) => { practiceMode = id as PracticeMode; }}
      ariaLabel="Drill mode"
      compact
    />
  </div>

  <div class="space-y-2">
    <SectionHeader level="h3">Role</SectionHeader>
    <ToggleGroup
      items={roleOptions}
      active={practiceRole}
      onSelect={(id) => { practiceRole = id as DrillPracticeRole; }}
      ariaLabel="Drill role"
      compact
    />
    <p class="text-xs text-text-muted">Auto uses the selected convention&apos;s default seat for each deal.</p>
  </div>

  <details
    bind:open={advancedOpen}
    class="group rounded-[--radius-md] border border-border-subtle bg-bg-card"
    data-testid="drill-form-advanced"
  >
    <summary
      class="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm text-text-primary list-none [&::-webkit-details-marker]:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
    >
      <span class="flex flex-col gap-0.5">
        <span class="font-medium">Advanced</span>
        <span class="text-xs text-text-muted">System, opponents, play skill, vulnerability, annotations</span>
      </span>
      <span
        aria-hidden="true"
        class="text-text-muted transition-transform group-open:rotate-90"
      >
        ›
      </span>
    </summary>

    <div class="space-y-6 border-t border-border-subtle px-3 pb-4 pt-4">
      <div class="space-y-2">
        <SectionHeader level="h3">System</SectionHeader>
        <ToggleGroup
          items={systemOptions}
          active={systemSelectionId}
          onSelect={(id) => { systemSelectionId = id as SystemSelectionId; }}
          ariaLabel="Base bidding system"
          compact
        />
        {#if customSystems.systems.length > 0}
          <div class="space-y-1.5">
            {#each customSystems.systems as system (system.id)}
              <button
                type="button"
                class="w-full rounded-[--radius-md] border px-3 py-2 text-left text-sm transition-colors cursor-pointer
                  {systemSelectionId === system.id
                    ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                    : 'border-border-subtle bg-bg-base text-text-primary hover:border-border-default'}"
                onclick={() => { systemSelectionId = system.id; }}
                data-testid="drill-form-system-{system.id}"
              >
                {system.name}
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <div class="space-y-2">
        <SectionHeader level="h3">Opponents</SectionHeader>
        <ToggleGroup
          items={opponentOptions}
          active={opponentMode}
          onSelect={(id) => { opponentMode = id as OpponentMode; }}
          ariaLabel="Opponent mode"
          compact
        />
        <p class="text-xs text-text-muted">Natural opponents compete. Silent opponents always pass.</p>
      </div>

      <div class="space-y-2">
        <SectionHeader level="h3">Play Skill</SectionHeader>
        <ToggleGroup
          items={playProfileOptions}
          active={playProfileId}
          onSelect={(id) => { playProfileId = id as PlayProfileId; }}
          ariaLabel="Opponent play skill"
          compact
        />
        <p class="text-xs text-text-muted">{PLAY_PROFILES[playProfileId].description}</p>
      </div>

      <div class="space-y-2">
        <SectionHeader level="h3">Vulnerability</SectionHeader>
        <VulnerabilityPicker
          value={vulnerabilityDistribution}
          onChange={(next) => {
            vulnerabilityDistribution = next;
            vulnError = isValidVulnDistribution(next) ? null : "Pick at least one vulnerability state";
          }}
          label="Distribution"
          testIdPrefix="drill-form-vuln"
        />
        {#if vulnError}
          <p class="text-xs text-red-400" role="alert">{vulnError}</p>
        {/if}
      </div>

      <div class="space-y-2">
        <SectionHeader level="h3">Educational Annotations</SectionHeader>
        <label class="flex items-center gap-3 rounded-[--radius-md] border border-border-subtle bg-bg-base px-3 py-2 cursor-pointer">
          <input
            type="checkbox"
            class="h-4 w-4 rounded-[--radius-sm] accent-accent-primary"
            checked={showEducationalAnnotations}
            onchange={(event) => { showEducationalAnnotations = event.currentTarget.checked; }}
            data-testid="drill-form-annotations"
          />
          <span class="text-sm text-text-primary">Show educational labels</span>
        </label>
        <p class="text-xs text-text-muted">Keeps teaching callouts visible during review and learn mode.</p>
      </div>
    </div>
  </details>

  <div class="flex flex-wrap justify-end gap-2 pt-2">
    <button
      type="button"
      class="rounded-[--radius-md] px-3 py-1.5 text-sm font-medium text-text-secondary hover:text-text-primary cursor-pointer"
      onclick={() => void cancel()}
    >
      Cancel
    </button>
    <button
      type="button"
      disabled={saving || drillsStore.mutationsDisabled}
      class="rounded-[--radius-md] border border-border-subtle px-3 py-1.5 text-sm font-medium text-text-primary hover:border-border-default cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
      onclick={() => void saveOnly()}
      data-testid="drill-form-save"
    >
      {saving ? "Saving…" : "Save"}
    </button>
    <button
      type="button"
      disabled={saving || drillsStore.mutationsDisabled}
      class="rounded-[--radius-md] bg-accent-primary px-3 py-1.5 text-sm font-medium text-text-on-accent hover:bg-accent-primary-hover cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
      onclick={() => void saveAndLaunch()}
      data-testid="drill-form-save-launch"
    >
      {saving ? "Saving…" : "Save & Launch"}
    </button>
  </div>
</form>
