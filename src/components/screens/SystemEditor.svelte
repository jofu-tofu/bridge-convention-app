<script lang="ts">
  import { fly } from "svelte/transition";
  import { SvelteSet } from "svelte/reactivity";
  import type { BaseSystemId, SystemConfig, CustomSystem } from "../../service";
  import { AVAILABLE_BASE_SYSTEMS, getSystemConfig, DEFAULT_BASE_MODULE_IDS } from "../../service";
  import { listModules } from "../../service/service-helpers";
  import { getCustomSystemsStore } from "../../stores/context";
  import ToggleGroup from "../shared/ToggleGroup.svelte";
  import NumberStepper from "../shared/NumberStepper.svelte";
  import RangeStepper from "../shared/RangeStepper.svelte";
  import SystemProfileViz from "./SystemProfileViz.svelte";

  interface Props {
    system: CustomSystem | null;
    basedOn: BaseSystemId | null;
    onSave: (system: CustomSystem) => void;
    onCancel: () => void;
  }

  const { system, basedOn, onSave, onCancel }: Props = $props();

  const customSystems = getCustomSystemsStore();
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
    if (selectedModules.has(id)) {
      selectedModules.delete(id);
    } else {
      selectedModules.add(id);
    }
  }

  let activeTab = $state<"openings" | "strength" | "competitive" | "modules">("openings");

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

  <!-- Two-panel body -->
  <div class="flex-1 flex flex-row gap-6 min-h-0 p-5">
    <!-- Left panel: Live viz (desktop only) -->
    <div class="hidden lg:flex flex-1 min-w-0">
      <div class="w-full bg-bg-card border border-border-subtle rounded-[--radius-lg] p-5">
        <SystemProfileViz
          ntMin={ntMinHcp} ntMax={ntMaxHcp}
          {inviteMin} {inviteMax} {gameMin} {slamMin} {openerNotMin}
          {inviteMinTp} {inviteMaxTp} {gameMinTp} {slamMinTp} {openerNotMinTp}
          {majorMinLength} {oneNtForcing}
          oneNtMin={oneNtMinHcp} oneNtMax={oneNtMaxHcp}
          {twoLevelMin} {forcingDuration}
          {ntShortage} {ntLength} {trumpShortage} {trumpLength}
          {redoubleMin} {dontMinHcp} {dontMaxHcp}
          modules={selectedModules}
        />
      </div>
    </div>

    <!-- Right panel: Tabbed fields -->
    <div class="w-full lg:w-80 lg:shrink-0 flex flex-col min-h-0">
      <!-- Tab buttons: 2x2 grid on desktop, horizontal on mobile -->
      <div class="shrink-0 mb-4">
        <div class="grid grid-cols-4 lg:grid-cols-2 gap-1.5">
          {#each [
            { id: "openings", label: "Openings" },
            { id: "strength", label: "Strength" },
            { id: "competitive", label: "Compete" },
            { id: "modules", label: "Modules" },
          ] as tab (tab.id)}
            <button
              class="px-2 py-1.5 rounded-[--radius-sm] text-xs font-medium transition-colors cursor-pointer border
                {activeTab === tab.id
                  ? 'bg-accent-primary/10 border-accent-primary text-accent-primary'
                  : 'bg-bg-base border-border-subtle text-text-muted hover:border-border-default'}"
              onclick={() => { activeTab = tab.id as typeof activeTab; }}
              aria-pressed={activeTab === tab.id}
            >{tab.label}</button>
          {/each}
        </div>
      </div>

      <!-- Tab content -->
      <div class="flex-1 overflow-y-auto min-h-0">
        {#key activeTab}
          <div class="space-y-4" in:fly={{ x: 20, duration: 120 }} out:fly={{ x: -20, duration: 120 }}>
            {#if activeTab === "openings"}
              <!-- 1NT Opening HCP Range -->
              <div>
                <p class="text-xs text-text-muted mb-1.5">1NT Opening HCP Range</p>
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

              <!-- Major Suit Min Length -->
              <div>
                <p class="text-xs text-text-muted mb-1.5">Major Suit Minimum Length</p>
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

              <!-- 1NT Response Forcing Status -->
              <div>
                <p class="text-xs text-text-muted mb-1.5">1NT Response Forcing</p>
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
              </div>

              <!-- 1NT Response HCP Range -->
              <div>
                <p class="text-xs text-text-muted mb-1.5">1NT Response HCP Range</p>
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

              <!-- 2-Level New Suit Minimum -->
              <div>
                <p class="text-xs text-text-muted mb-1.5">2-Level New Suit Minimum</p>
                <NumberStepper
                  value={twoLevelMin}
                  suffix="HCP"
                  onchange={(v) => { twoLevelMin = v; }}
                  testId="editor-two-level-min"
                />
              </div>

              <!-- 2-Level Forcing Duration -->
              <div>
                <p class="text-xs text-text-muted mb-1.5">2-Level Forcing</p>
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

            {:else if activeTab === "strength"}
              <!-- Point Formulas -->
              <div>
                <p class="text-xs text-text-muted mb-2">Point Formulas</p>
                <div class="grid grid-cols-2 gap-3">
                  <!-- NT panel -->
                  <div class="bg-bg-base border border-border-subtle rounded-[--radius-md] p-3">
                    <p class="text-xs font-semibold text-text-primary mb-2">NT</p>
                    <div class="space-y-1.5">
                      <label class="flex items-center gap-2">
                        <input type="checkbox" checked disabled class="accent-accent-primary opacity-50" />
                        <span class="text-xs text-text-muted">HCP</span>
                        <span class="text-[10px] text-text-muted/60 ml-auto">always</span>
                      </label>
                      <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" bind:checked={ntShortage} class="accent-accent-primary" />
                        <span class="text-xs text-text-primary">Shortage</span>
                      </label>
                      <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" bind:checked={ntLength} class="accent-accent-primary" />
                        <span class="text-xs text-text-primary">Length</span>
                      </label>
                    </div>
                  </div>
                  <!-- Trump panel -->
                  <div class="bg-bg-base border border-border-subtle rounded-[--radius-md] p-3">
                    <p class="text-xs font-semibold text-text-primary mb-2">Trump</p>
                    <div class="space-y-1.5">
                      <label class="flex items-center gap-2">
                        <input type="checkbox" checked disabled class="accent-accent-primary opacity-50" />
                        <span class="text-xs text-text-muted">HCP</span>
                        <span class="text-[10px] text-text-muted/60 ml-auto">always</span>
                      </label>
                      <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" bind:checked={trumpShortage} class="accent-accent-primary" />
                        <span class="text-xs text-text-primary">Shortage</span>
                      </label>
                      <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" bind:checked={trumpLength} class="accent-accent-primary" />
                        <span class="text-xs text-text-primary">Length</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Thresholds: HCP | TP two-column layout -->
              <div class="space-y-3">
                <div class="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1 items-center text-xs text-text-muted">
                  <span></span>
                  <span class="text-center font-medium">HCP</span>
                  <span class="text-center font-medium">TP</span>
                </div>

                <!-- Invite -->
                <div>
                  <p class="text-xs text-text-muted mb-1.5">Invite Range</p>
                  <div class="flex items-center gap-3 flex-wrap">
                    <RangeStepper
                      minValue={inviteMin}
                      maxValue={inviteMax}
                      suffix="HCP"
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
                      suffix="TP"
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

                <!-- Game -->
                <div>
                  <p class="text-xs text-text-muted mb-1.5">Game Minimum</p>
                  <div class="flex items-center gap-3 flex-wrap">
                    <NumberStepper
                      value={gameMin}
                      suffix="HCP"
                      onchange={(v) => { gameMin = v; }}
                      testId="editor-game-min"
                    />
                    <NumberStepper
                      value={gameMinTp}
                      suffix="TP"
                      onchange={(v) => { gameMinTp = v; }}
                      testId="editor-game-min-tp"
                    />
                  </div>
                </div>

                <!-- Slam -->
                <div>
                  <p class="text-xs text-text-muted mb-1.5">Slam Explore</p>
                  <div class="flex items-center gap-3 flex-wrap">
                    <NumberStepper
                      value={slamMin}
                      suffix="HCP"
                      onchange={(v) => { slamMin = v; }}
                      testId="editor-slam-min"
                    />
                    <NumberStepper
                      value={slamMinTp}
                      suffix="TP"
                      onchange={(v) => { slamMinTp = v; }}
                      testId="editor-slam-min-tp"
                    />
                  </div>
                  {#if thresholdOrderError}
                    <p class="text-xs text-red-400 mt-1">{thresholdOrderError}</p>
                  {/if}
                  {#if tpThresholdOrderError}
                    <p class="text-xs text-red-400 mt-1">{tpThresholdOrderError}</p>
                  {/if}
                </div>

                <!-- Opener -->
                <div>
                  <p class="text-xs text-text-muted mb-1.5">Opener Not Minimum</p>
                  <div class="flex items-center gap-3 flex-wrap">
                    <NumberStepper
                      value={openerNotMin}
                      suffix="HCP"
                      onchange={(v) => { openerNotMin = v; }}
                      testId="editor-opener-not-min"
                    />
                    <NumberStepper
                      value={openerNotMinTp}
                      suffix="TP"
                      onchange={(v) => { openerNotMinTp = v; }}
                      testId="editor-opener-not-min-tp"
                    />
                  </div>
                </div>
              </div>

            {:else if activeTab === "competitive"}
              <!-- Redouble Minimum -->
              <div>
                <p class="text-xs text-text-muted mb-1.5">Redouble Minimum</p>
                <NumberStepper
                  value={redoubleMin}
                  suffix="HCP"
                  onchange={(v) => { redoubleMin = v; }}
                  testId="editor-redouble-min"
                />
              </div>

              <!-- DONT Overcall HCP Range -->
              <div>
                <p class="text-xs text-text-muted mb-1.5">DONT Overcall HCP Range</p>
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

            {:else if activeTab === "modules"}
              <p class="text-xs text-text-muted mb-2">Always active during practice.</p>
              <div class="space-y-2">
                {#each allModules as mod (mod.moduleId)}
                  <label class="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedModules.has(mod.moduleId)}
                      disabled={mod.moduleId === "natural-bids"}
                      onchange={() => toggleModule(mod.moduleId)}
                      class="accent-accent-primary"
                    />
                    <div>
                      <span class="text-sm text-text-primary">{mod.displayName}</span>
                      {#if mod.moduleId === "natural-bids"}
                        <span class="text-xs text-text-muted ml-1">(required)</span>
                      {/if}
                    </div>
                  </label>
                {/each}
              </div>
            {/if}
          </div>
        {/key}
      </div>
    </div>
  </div>
</main>
