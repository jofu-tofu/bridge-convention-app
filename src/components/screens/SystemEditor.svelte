<script lang="ts">
  import { SvelteSet } from "svelte/reactivity";
  import type { BaseSystemId, SystemConfig, CustomSystem } from "../../service";
  import { AVAILABLE_BASE_SYSTEMS, getSystemConfig, DEFAULT_BASE_MODULE_IDS } from "../../service";
  import { listModules } from "../../service/service-helpers";
  import { getCustomSystemsStore, getUserModuleStore } from "../../stores/context";
  import ToggleGroup from "../shared/ToggleGroup.svelte";
  import NumberStepper from "../shared/NumberStepper.svelte";
  import RangeStepper from "../shared/RangeStepper.svelte";
  import { formatPointFormula } from "./profile-display";
  import StrengthBar from "./StrengthBar.svelte";
  import { type CatalogModule, mergeModules } from "../shared/module-catalog";
  import ModuleChecklist from "../shared/ModuleChecklist.svelte";

  interface Props {
    system: CustomSystem | null;
    basedOn: BaseSystemId | null;
    onSave: (system: CustomSystem) => void;
    onCancel: () => void;
    onNavigateConventions?: () => void;
  }

  const { system, basedOn, onSave, onCancel, onNavigateConventions }: Props = $props();

  const customSystems = getCustomSystemsStore();
  const userModuleStore = getUserModuleStore();
  const allModules = listModules();

  // Initialize state from existing system or preset
  const sourcePreset: BaseSystemId = system?.basedOn ?? basedOn ?? "sayc";
  const sourceConfig = system?.config ?? { ...getSystemConfig(sourcePreset), systemId: "custom" as const };

  let name = $state(system?.name ?? `${AVAILABLE_BASE_SYSTEMS.find((s) => s.id === sourcePreset)?.shortLabel ?? sourcePreset} (custom)`);
  let startingFrom = $state<BaseSystemId>(sourcePreset);

  // Deep clone the config for editing
  let ntMinHcp = $state(sourceConfig.ntOpening.minHcp);
  let ntMaxHcp = $state(sourceConfig.ntOpening.maxHcp);

  let inviteMin = $state(sourceConfig.responderThresholds.inviteMin);
  let inviteMax = $state(sourceConfig.responderThresholds.inviteMax);
  let gameMin = $state(sourceConfig.responderThresholds.gameMin);
  let slamMin = $state(sourceConfig.responderThresholds.slamMin);
  let inviteMinTp = $state(sourceConfig.responderThresholds.inviteMinTp.trump);
  let inviteMaxTp = $state(sourceConfig.responderThresholds.inviteMaxTp.trump);
  let gameMinTp = $state(sourceConfig.responderThresholds.gameMinTp.trump);
  let slamMinTp = $state(sourceConfig.responderThresholds.slamMinTp.trump);

  let openerNotMin = $state(sourceConfig.openerRebid.notMinimum);
  let openerNotMinTp = $state(sourceConfig.openerRebid.notMinimumTp.trump);

  let twoLevelMin = $state(sourceConfig.suitResponse.twoLevelMin);
  let forcingDuration = $state(sourceConfig.suitResponse.twoLevelForcingDuration);

  let oneNtForcing = $state(sourceConfig.oneNtResponseAfterMajor.forcing);
  let oneNtMinHcp = $state(sourceConfig.oneNtResponseAfterMajor.minHcp);
  let oneNtMaxHcp = $state(sourceConfig.oneNtResponseAfterMajor.maxHcp);

  let majorMinLength = $state(sourceConfig.openingRequirements.majorSuitMinLength);

  let redoubleMin = $state(sourceConfig.interference.redoubleMin);

  let dontMinHcp = $state(sourceConfig.dontOvercall.minHcp);
  let dontMaxHcp = $state(sourceConfig.dontOvercall.maxHcp);

  const defaultNtFormula = { includeShortage: false, includeLength: false };
  const defaultTrumpFormula = { includeShortage: true, includeLength: false };
  let ntShortage = $state(sourceConfig.pointConfig?.ntFormula.includeShortage ?? false);
  let ntLength = $state(sourceConfig.pointConfig?.ntFormula.includeLength ?? false);
  let trumpShortage = $state(sourceConfig.pointConfig?.trumpFormula.includeShortage ?? true);
  let trumpLength = $state(sourceConfig.pointConfig?.trumpFormula.includeLength ?? false);

  /** Formula labels used as stepper suffixes and column headers. */
  const ntFormulaShort = $derived(formatPointFormula({ includeShortage: ntShortage, includeLength: ntLength }));
  const trumpFormulaShort = $derived(formatPointFormula({ includeShortage: trumpShortage, includeLength: trumpLength }));

  let selectedModules = new SvelteSet<string>(system?.baseModuleIds ?? [...DEFAULT_BASE_MODULE_IDS]);

  // Validation
  const nameError = $derived(customSystems.validateName(name, system?.id));
  const ntRangeError = $derived(ntMinHcp > ntMaxHcp ? "Min must be ≤ Max" : null);
  const inviteRangeError = $derived(inviteMin > inviteMax ? "Min must be ≤ Max" : null);
  const thresholdOrderError = $derived(gameMin > slamMin ? "Game min must be ≤ Slam min" : null);
  const dontRangeError = $derived(dontMinHcp > dontMaxHcp ? "Min must be ≤ Max" : null);
  const oneNtRangeError = $derived(oneNtMinHcp > oneNtMaxHcp ? "Min must be ≤ Max" : null);

  const inviteTpRangeError = $derived(inviteMinTp > inviteMaxTp ? "Min must be ≤ Max" : null);
  const tpThresholdOrderError = $derived(gameMinTp > slamMinTp ? "Game min must be ≤ Slam min" : null);

  const allErrors = $derived([
    nameError, ntRangeError, inviteRangeError, thresholdOrderError,
    dontRangeError, oneNtRangeError, inviteTpRangeError, tpThresholdOrderError,
  ].filter(Boolean));
  const hasErrors = $derived(allErrors.length > 0);

  function resetToPreset(id: BaseSystemId) {
    const preset = getSystemConfig(id);
    startingFrom = id;
    ntMinHcp = preset.ntOpening.minHcp;
    ntMaxHcp = preset.ntOpening.maxHcp;
    inviteMin = preset.responderThresholds.inviteMin;
    inviteMax = preset.responderThresholds.inviteMax;
    gameMin = preset.responderThresholds.gameMin;
    slamMin = preset.responderThresholds.slamMin;
    inviteMinTp = preset.responderThresholds.inviteMinTp.trump;
    inviteMaxTp = preset.responderThresholds.inviteMaxTp.trump;
    gameMinTp = preset.responderThresholds.gameMinTp.trump;
    slamMinTp = preset.responderThresholds.slamMinTp.trump;
    openerNotMin = preset.openerRebid.notMinimum;
    openerNotMinTp = preset.openerRebid.notMinimumTp.trump;
    twoLevelMin = preset.suitResponse.twoLevelMin;
    forcingDuration = preset.suitResponse.twoLevelForcingDuration;
    oneNtForcing = preset.oneNtResponseAfterMajor.forcing;
    oneNtMinHcp = preset.oneNtResponseAfterMajor.minHcp;
    oneNtMaxHcp = preset.oneNtResponseAfterMajor.maxHcp;
    majorMinLength = preset.openingRequirements.majorSuitMinLength;
    redoubleMin = preset.interference.redoubleMin;
    dontMinHcp = preset.dontOvercall.minHcp;
    dontMaxHcp = preset.dontOvercall.maxHcp;
    ntShortage = preset.pointConfig?.ntFormula.includeShortage ?? defaultNtFormula.includeShortage;
    ntLength = preset.pointConfig?.ntFormula.includeLength ?? defaultNtFormula.includeLength;
    trumpShortage = preset.pointConfig?.trumpFormula.includeShortage ?? defaultTrumpFormula.includeShortage;
    trumpLength = preset.pointConfig?.trumpFormula.includeLength ?? defaultTrumpFormula.includeLength;
  }

  function buildConfig(): SystemConfig {
    return {
      systemId: "custom",
      displayName: name.trim(),
      ntOpening: { minHcp: ntMinHcp, maxHcp: ntMaxHcp },
      responderThresholds: {
        inviteMin, inviteMax, gameMin, slamMin,
        inviteMinTp: { trump: inviteMinTp }, inviteMaxTp: { trump: inviteMaxTp },
        gameMinTp: { trump: gameMinTp }, slamMinTp: { trump: slamMinTp },
      },
      openerRebid: { notMinimum: openerNotMin, notMinimumTp: { trump: openerNotMinTp } },
      interference: { redoubleMin },
      suitResponse: { twoLevelMin, twoLevelForcingDuration: forcingDuration },
      oneNtResponseAfterMajor: { forcing: oneNtForcing, maxHcp: oneNtMaxHcp, minHcp: oneNtMinHcp },
      openingRequirements: { majorSuitMinLength: majorMinLength },
      dontOvercall: { minHcp: dontMinHcp, maxHcp: dontMaxHcp },
      pointConfig: {
        ntFormula: { includeShortage: ntShortage, includeLength: ntLength },
        trumpFormula: { includeShortage: trumpShortage, includeLength: trumpLength },
      },
    };
  }

  function handleSave() {
    if (hasErrors) return;
    const config = buildConfig();
    const moduleIds = [...selectedModules];

    if (system) {
      customSystems.updateSystem(system.id, { name: name.trim(), config, baseModuleIds: moduleIds });
      onSave({ ...system, name: name.trim(), config, baseModuleIds: moduleIds, updatedAt: new Date().toISOString() });
    } else {
      const created = customSystems.createSystem(startingFrom, name.trim());
      customSystems.updateSystem(created.id, { config, baseModuleIds: moduleIds });
      onSave({ ...created, config, baseModuleIds: moduleIds });
    }
  }

  function toggleModule(id: string) {
    if (id === "natural-bids") return;

    // Mutual exclusion: user module vs its forked source
    const userMod = userModuleStore.getModule(id);
    if (userMod?.metadata.forkedFrom) {
      selectedModules.delete(userMod.metadata.forkedFrom.moduleId);
    }

    // If toggling on a system module, uncheck any user forks of it
    if (!userMod) {
      for (const um of userModuleStore.listModules()) {
        if (um.metadata.forkedFrom?.moduleId === id && selectedModules.has(um.metadata.moduleId)) {
          selectedModules.delete(um.metadata.moduleId);
        }
      }
    }

    if (selectedModules.has(id)) {
      selectedModules.delete(id);
    } else {
      selectedModules.add(id);
    }
  }

  const catalogModules: CatalogModule[] = $derived(mergeModules(allModules, userModuleStore.listModules()));

  const activeModuleCount = $derived(selectedModules.size);
  const totalModuleCount = $derived(catalogModules.length);

  /** Check if a user module ID in selectedModules is unavailable. */
  function isUnavailable(moduleId: string): boolean {
    return moduleId.startsWith("user:") && !userModuleStore.hasModule(moduleId);
  }

  const unavailableModuleIds = $derived(
    [...selectedModules].filter(isUnavailable),
  );

  function removeUnavailable(moduleId: string) {
    selectedModules.delete(moduleId);
  }

  let activeEditorTab = $state<"parameters" | "modules">("parameters");

  const selectClass = "bg-bg-base border border-border-subtle rounded-[--radius-md] px-3 py-2 text-sm text-text-primary cursor-pointer";
</script>

<main class="h-full flex flex-col overflow-hidden" aria-label="System Editor">
  <!-- Header -->
  <div class="shrink-0 flex items-center gap-3 px-5 py-3 border-b border-border-subtle bg-bg-card">
    <button
      class="text-sm text-text-muted hover:text-text-primary transition-colors cursor-pointer whitespace-nowrap"
      onclick={onCancel}
    >
      &larr; Workshop
    </button>

    <div class="flex-1 min-w-0 max-w-xs">
      <input
        type="text"
        class="w-full bg-bg-base border border-border-subtle rounded-[--radius-md] px-3 py-1.5 text-sm text-text-primary"
        bind:value={name}
        placeholder="My Custom System"
        data-testid="editor-name"
      />
      {#if nameError}
        <p class="text-xs text-red-400 mt-0.5">{nameError}</p>
      {/if}
    </div>

    {#if !system}
      <select class="{selectClass} text-xs py-1.5" bind:value={startingFrom} onchange={() => resetToPreset(startingFrom)}>
        {#each AVAILABLE_BASE_SYSTEMS as sys (sys.id)}
          <option value={sys.id}>{sys.label}</option>
        {/each}
      </select>
    {/if}

    <div class="ml-auto flex items-center gap-2">
      {#if allErrors.length > 0}
        <span class="px-2 py-0.5 rounded-full bg-red-500/20 text-xs text-red-400 font-medium">
          {allErrors.length} {allErrors.length === 1 ? "issue" : "issues"}
        </span>
      {/if}
      <button
        class="px-3 py-1.5 rounded-[--radius-md] text-sm font-medium text-text-muted hover:text-text-primary border border-border-subtle transition-colors cursor-pointer"
        onclick={onCancel}
      >Cancel</button>
      <button
        class="px-3 py-1.5 rounded-[--radius-md] text-sm font-semibold transition-colors cursor-pointer
          {hasErrors
            ? 'bg-bg-elevated text-text-muted cursor-not-allowed'
            : 'bg-accent-primary text-text-on-accent hover:bg-accent-primary/90'}"
        disabled={hasErrors}
        onclick={handleSave}
        data-testid="editor-save"
      >Save</button>
    </div>
  </div>

  <!-- Tab bar -->
  <div class="shrink-0 px-5 pt-2 border-b border-border-subtle bg-bg-card">
    <ToggleGroup
      items={[
        { id: "parameters", label: "Parameters" },
        { id: "modules", label: `Modules (${activeModuleCount})` },
      ]}
      active={activeEditorTab}
      onSelect={(id) => { activeEditorTab = id as typeof activeEditorTab; }}
      ariaLabel="Editor section"
      compact
    />
  </div>

  {#if activeEditorTab === "parameters"}
  <!-- Parameters tab -->
  <div class="flex-1 min-h-0 p-5 overflow-y-auto">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-5 items-start">

      <!-- Column 1: Bidding Structure + Competitive -->
      <div class="space-y-3">
        <p class="text-xs font-semibold text-text-muted uppercase tracking-wider">Bidding Structure</p>

        <div>
          <p class="text-xs text-text-secondary mb-1">1NT Opening Range</p>
          <RangeStepper
            minValue={ntMinHcp}
            maxValue={ntMaxHcp}
            suffix="HCP"
            onMinChange={(v) => { ntMinHcp = v; }}
            onMaxChange={(v) => { ntMaxHcp = v; }}
            testId="editor-nt-range"
          >
            {#snippet error()}
              {#if ntRangeError}
                <p class="text-xs text-red-400 mt-1">{ntRangeError}</p>
              {/if}
            {/snippet}
          </RangeStepper>
        </div>

        <div>
          <p class="text-xs text-text-secondary mb-1">Major Suit Opening Length</p>
          <ToggleGroup
            items={[
              { id: "4", label: "4-card", testId: "editor-major-4" },
              { id: "5", label: "5-card", testId: "editor-major-5" },
            ]}
            active={String(majorMinLength)}
            onSelect={(id) => { majorMinLength = Number(id) as 4 | 5; }}
            ariaLabel="Major suit minimum length"
            compact
          />
        </div>

        <div>
          <p class="text-xs text-text-secondary mb-1">1NT Response to 1&#9829;/1&#9824;</p>
          <div class="flex items-center gap-2 flex-wrap">
            <ToggleGroup
              items={[
                { id: "non-forcing", label: "NF" },
                { id: "semi-forcing", label: "Semi" },
                { id: "forcing", label: "F" },
              ]}
              active={oneNtForcing}
              onSelect={(id) => { oneNtForcing = id as typeof oneNtForcing; }}
              ariaLabel="1NT response forcing status"
              compact
            />
            <RangeStepper
              minValue={oneNtMinHcp}
              maxValue={oneNtMaxHcp}
              suffix="HCP"
              onMinChange={(v) => { oneNtMinHcp = v; }}
              onMaxChange={(v) => { oneNtMaxHcp = v; }}
              testId="editor-one-nt-range"
            >
              {#snippet error()}
                {#if oneNtRangeError}
                  <p class="text-xs text-red-400 mt-1">{oneNtRangeError}</p>
                {/if}
              {/snippet}
            </RangeStepper>
          </div>
        </div>

        <div>
          <p class="text-xs text-text-secondary mb-1">New Suit at 2-Level</p>
          <div class="flex items-center gap-2 flex-wrap">
            <NumberStepper
              value={twoLevelMin}
              suffix="HCP"
              onchange={(v) => { twoLevelMin = v; }}
              testId="editor-two-level-min"
            />
            <ToggleGroup
              items={[
                { id: "one-round", label: "1-round" },
                { id: "game", label: "GF" },
              ]}
              active={forcingDuration}
              onSelect={(id) => { forcingDuration = id as typeof forcingDuration; }}
              ariaLabel="2-level forcing duration"
              compact
            />
          </div>
        </div>

        <!-- Competitive -->
        <p class="text-xs font-semibold text-text-muted uppercase tracking-wider pt-2">Competitive</p>

        <div>
          <p class="text-xs text-text-secondary mb-1">Redouble Minimum</p>
          <NumberStepper
            value={redoubleMin}
            suffix="HCP"
            onchange={(v) => { redoubleMin = v; }}
            testId="editor-redouble-min"
          />
        </div>

        <div>
          <p class="text-xs text-text-secondary mb-1">DONT Overcall Range</p>
          <RangeStepper
            minValue={dontMinHcp}
            maxValue={dontMaxHcp}
            suffix="HCP"
            onMinChange={(v) => { dontMinHcp = v; }}
            onMaxChange={(v) => { dontMaxHcp = v; }}
            testId="editor-dont-range"
          >
            {#snippet error()}
              {#if dontRangeError}
                <p class="text-xs text-red-400 mt-1">{dontRangeError}</p>
              {/if}
            {/snippet}
          </RangeStepper>
        </div>
      </div>

      <!-- Column 2: Strength -->
      <div class="space-y-3">
        <p class="text-xs font-semibold text-text-muted uppercase tracking-wider">Strength</p>

        <!-- Strength bar -->
        <StrengthBar {inviteMin} {gameMin} {slamMin} {inviteMinTp} {gameMinTp} {slamMinTp} ntLabel={ntFormulaShort} trumpLabel={trumpFormulaShort} />

        <!-- Point Formulas — compact inline -->
        <div class="grid grid-cols-2 gap-2">
          <div class="bg-bg-base border border-border-subtle rounded-[--radius-md] p-2">
            <p class="text-xs font-semibold text-text-primary mb-1">NT Formula</p>
            <div class="space-y-0.5">
              <label class="flex items-center gap-1.5">
                <input type="checkbox" checked disabled class="accent-accent-primary opacity-50" />
                <span class="text-xs text-text-muted">HCP</span>
              </label>
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" bind:checked={ntShortage} class="accent-accent-primary" />
                <span class="text-xs text-text-primary">Shortage</span>
              </label>
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" bind:checked={ntLength} class="accent-accent-primary" />
                <span class="text-xs text-text-primary">Length</span>
              </label>
            </div>
          </div>
          <div class="bg-bg-base border border-border-subtle rounded-[--radius-md] p-2">
            <p class="text-xs font-semibold text-text-primary mb-1">Trump Formula</p>
            <div class="space-y-0.5">
              <label class="flex items-center gap-1.5">
                <input type="checkbox" checked disabled class="accent-accent-primary opacity-50" />
                <span class="text-xs text-text-muted">HCP</span>
              </label>
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" bind:checked={trumpShortage} class="accent-accent-primary" />
                <span class="text-xs text-text-primary">Shortage</span>
              </label>
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" bind:checked={trumpLength} class="accent-accent-primary" />
                <span class="text-xs text-text-primary">Length</span>
              </label>
            </div>
          </div>
        </div>

        <!-- Thresholds -->
        <div class="space-y-2">
          <div class="grid grid-cols-[auto_1fr_1fr] gap-x-2 items-center text-xs text-text-muted">
            <span></span>
            <span class="text-center font-medium">NT ({ntFormulaShort})</span>
            <span class="text-center font-medium">Trump ({trumpFormulaShort})</span>
          </div>

          <div>
            <p class="text-xs text-text-secondary mb-1">Invite Range</p>
            <div class="flex items-center gap-2 flex-wrap">
              <RangeStepper
                minValue={inviteMin}
                maxValue={inviteMax}
                suffix={ntFormulaShort}
                onMinChange={(v) => { inviteMin = v; }}
                onMaxChange={(v) => { inviteMax = v; }}
                testId="editor-invite-hcp"
              >
                {#snippet error()}
                  {#if inviteRangeError}
                    <p class="text-xs text-red-400 mt-1">{inviteRangeError}</p>
                  {/if}
                {/snippet}
              </RangeStepper>
              <RangeStepper
                minValue={inviteMinTp}
                maxValue={inviteMaxTp}
                suffix={trumpFormulaShort}
                onMinChange={(v) => { inviteMinTp = v; }}
                onMaxChange={(v) => { inviteMaxTp = v; }}
                testId="editor-invite-tp"
              >
                {#snippet error()}
                  {#if inviteTpRangeError}
                    <p class="text-xs text-red-400 mt-1">{inviteTpRangeError}</p>
                  {/if}
                {/snippet}
              </RangeStepper>
            </div>
          </div>

          <div>
            <p class="text-xs text-text-secondary mb-1">Game Minimum</p>
            <div class="flex items-center gap-2 flex-wrap">
              <NumberStepper value={gameMin} suffix={ntFormulaShort} onchange={(v) => { gameMin = v; }} testId="editor-game-min" />
              <NumberStepper value={gameMinTp} suffix={trumpFormulaShort} onchange={(v) => { gameMinTp = v; }} testId="editor-game-min-tp" />
            </div>
          </div>

          <div>
            <p class="text-xs text-text-secondary mb-1">Slam Explore</p>
            <div class="flex items-center gap-2 flex-wrap">
              <NumberStepper value={slamMin} suffix={ntFormulaShort} onchange={(v) => { slamMin = v; }} testId="editor-slam-min" />
              <NumberStepper value={slamMinTp} suffix={trumpFormulaShort} onchange={(v) => { slamMinTp = v; }} testId="editor-slam-min-tp" />
            </div>
            {#if thresholdOrderError}
              <p class="text-xs text-red-400 mt-1">{thresholdOrderError}</p>
            {/if}
            {#if tpThresholdOrderError}
              <p class="text-xs text-red-400 mt-1">{tpThresholdOrderError}</p>
            {/if}
          </div>

          <div>
            <p class="text-xs text-text-secondary mb-1">Opener Not Minimum</p>
            <div class="flex items-center gap-2 flex-wrap">
              <NumberStepper value={openerNotMin} suffix={ntFormulaShort} onchange={(v) => { openerNotMin = v; }} testId="editor-opener-not-min" />
              <NumberStepper value={openerNotMinTp} suffix={trumpFormulaShort} onchange={(v) => { openerNotMinTp = v; }} testId="editor-opener-not-min-tp" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  {:else if activeEditorTab === "modules"}
  <!-- Modules tab -->
  <div class="flex-1 min-h-0 p-5 overflow-y-auto">
    <div class="max-w-3xl">
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-text-secondary">{activeModuleCount} of {totalModuleCount} selected</p>
      </div>

      {#each unavailableModuleIds as uid (uid)}
        <div class="flex items-center justify-between bg-red-500/10 border border-red-500/30 rounded-[--radius-md] px-2 py-1 mb-1.5">
          <div class="flex items-center gap-1.5">
            <span class="px-1 py-0.5 text-[10px] font-medium rounded-full bg-red-500/20 text-red-400">unavailable</span>
            <span class="text-xs text-text-muted">{uid}</span>
          </div>
          <button
            class="text-xs text-red-400 hover:text-red-300 cursor-pointer"
            onclick={() => removeUnavailable(uid)}
          >Remove</button>
        </div>
      {/each}

      <ModuleChecklist
        modules={catalogModules}
        isSelected={(id) => selectedModules.has(id)}
        onToggle={toggleModule}
        disabledIds={["natural-bids"]}
        hasUserFork={(id) => userModuleStore.listModules().some((um) => um.metadata.forkedFrom?.moduleId === id)}
      />

      {#if onNavigateConventions}
        <button
          class="text-xs text-accent-primary hover:underline mt-3 cursor-pointer"
          onclick={onNavigateConventions}
        >
          Browse &amp; edit conventions &rarr;
        </button>
      {/if}
    </div>
  </div>
  {/if}
</main>
