<script lang="ts">
  import { goto } from "$app/navigation";
  import {
    AVAILABLE_BASE_SYSTEMS,
    PracticeMode,
    PracticeRole,
    displayConventionName,
    listConventions,
  } from "../../service";
  import type { ConventionInfo, SystemSelectionId } from "../../service";
  import { getAppStore, getCustomSystemsStore, getDrillsStore } from "../../stores/context";
  import { DRILL_NAME_MAX } from "../../stores/drills.svelte";
  import type { Drill, DrillPracticeRole } from "../../stores/drills.svelte";
  import SectionHeader from "../shared/SectionHeader.svelte";
  import ToggleGroup from "../shared/ToggleGroup.svelte";

  interface Props {
    mode: "create" | "edit";
    drill?: Drill;
    prefillConvention?: string;
  }

  const { mode, drill, prefillConvention }: Props = $props();

  const appStore = getAppStore();
  const customSystems = getCustomSystemsStore();
  const drillsStore = getDrillsStore();
  const allConventions = listConventions();

  const availableConventionIds = new Set(allConventions.map((convention) => convention.id));
  const initialModuleIds =
    mode === "edit"
      ? (drill?.moduleIds ?? []).filter((moduleId) => availableConventionIds.has(moduleId))
      : prefillConvention && availableConventionIds.has(prefillConvention)
        ? [prefillConvention]
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
  let nameError = $state<string | null>(null);
  let selectionError = $state<string | null>(null);

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

  $effect(() => {
    if (!suggestedName) return;
    if (nameTouched && name !== lastSuggestedName) return;
    name = suggestedName;
    lastSuggestedName = suggestedName;
  });

  function toggleConvention(moduleId: string): void {
    selectedModuleIds = selectedModuleIds.includes(moduleId)
      ? selectedModuleIds.filter((id) => id !== moduleId)
      : [...selectedModuleIds, moduleId];
    selectionError = null;
  }

  function validateForm(): boolean {
    const nextNameError = drillsStore.validateName(name);
    nameTouched = true;
    nameError = nextNameError;
    selectionError = selectedModuleIds.length > 0 ? null : "Select at least one convention";
    return !nextNameError && !selectionError;
  }

  function persistDrill(): Drill | null {
    if (!validateForm()) return null;

    if (mode === "edit" && drill) {
      drillsStore.update(drill.id, {
        name,
        moduleIds: selectedModuleIds,
        practiceMode,
        practiceRole,
        systemSelectionId,
      });
      return drillsStore.getById(drill.id) ?? null;
    }

    return drillsStore.create({
      name,
      moduleIds: selectedModuleIds,
      practiceMode,
      practiceRole,
      systemSelectionId,
    });
  }

  async function saveOnly(): Promise<void> {
    const saved = persistDrill();
    if (!saved) return;
    await goto("/practice/drills");
  }

  async function saveAndLaunch(): Promise<void> {
    const saved = persistDrill();
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
        sourceDrillId: saved.id,
      },
      allConventions,
    );
    drillsStore.markLaunched(saved.id);
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
      <SectionHeader level="h3">Conventions</SectionHeader>
      <p class="text-xs text-text-muted">Pick one convention for a single drill or several for round-robin practice.</p>
    </div>

    {#if selectedConventions.length > 0}
      <div class="flex flex-wrap gap-2">
        {#each selectedConventions as convention (convention.id)}
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full border border-accent-primary/40 bg-accent-primary/10 px-3 py-1 text-xs font-medium text-accent-primary cursor-pointer"
            onclick={() => toggleConvention(convention.id)}
          >
            {displayConventionName(convention.name)}
            <span aria-hidden="true">×</span>
          </button>
        {/each}
      </div>
    {/if}

    <div class="grid gap-2 sm:grid-cols-2">
      {#each allConventions as convention (convention.id)}
        {@const selected = selectedModuleIds.includes(convention.id)}
        <button
          type="button"
          class="rounded-[--radius-md] border px-3 py-2 text-left transition-colors cursor-pointer
            {selected
              ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
              : 'border-border-subtle bg-bg-base text-text-primary hover:border-border-default'}"
          onclick={() => toggleConvention(convention.id)}
          data-testid="drill-form-convention-{convention.id}"
          aria-pressed={selected}
        >
          <span class="block text-sm font-medium">{displayConventionName(convention.name)}</span>
          <span class="mt-0.5 block text-xs text-text-muted">{convention.description}</span>
        </button>
      {/each}
    </div>

    {#if selectionError}
      <p class="text-xs text-red-400" role="alert">{selectionError}</p>
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
      class="rounded-[--radius-md] border border-border-subtle px-3 py-1.5 text-sm font-medium text-text-primary hover:border-border-default cursor-pointer"
      onclick={() => void saveOnly()}
      data-testid="drill-form-save"
    >
      Save
    </button>
    <button
      type="button"
      class="rounded-[--radius-md] bg-accent-primary px-3 py-1.5 text-sm font-medium text-text-on-accent hover:bg-accent-primary-hover cursor-pointer"
      onclick={() => void saveAndLaunch()}
      data-testid="drill-form-save-launch"
    >
      Save &amp; Launch
    </button>
  </div>
</form>
