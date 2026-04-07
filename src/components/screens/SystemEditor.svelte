<script lang="ts">
  import { SvelteSet } from "svelte/reactivity";
  import type { BaseSystemId, SystemConfig, CustomSystem } from "../../service";
  import { AVAILABLE_BASE_SYSTEMS, getSystemConfig, DEFAULT_BASE_MODULE_IDS } from "../../service";
  import { listModules } from "../../service/service-helpers";
  import { getCustomSystemsStore } from "../../stores/context";
  import ToggleGroup from "../shared/ToggleGroup.svelte";
  import NumberStepper from "../shared/NumberStepper.svelte";
  import RangeStepper from "../shared/RangeStepper.svelte";
  import EditorSection from "./EditorSection.svelte";

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

  const selectClass = "bg-bg-base border border-border-subtle rounded-[--radius-md] px-3 py-2 text-sm text-text-primary cursor-pointer";
</script>

<main class="max-w-3xl mx-auto h-full flex flex-col p-6 pb-0" aria-label="System Editor">
  <!-- Back link (scrolls with content) -->
  <div class="shrink-0 mb-4">
    <button
      class="text-sm text-text-muted hover:text-text-primary transition-colors cursor-pointer"
      onclick={onCancel}
    >
      &larr; Workshop
    </button>
  </div>

  <div class="flex-1 overflow-y-auto pb-20 space-y-4">
    <!-- Fixed header: System Name + Starting From -->
    <div class="bg-bg-card border border-border-subtle rounded-[--radius-lg] p-5">
      <label class="block text-sm font-semibold text-text-primary mb-2">System Name
      <input
        type="text"
        class="w-full bg-bg-base border border-border-subtle rounded-[--radius-md] px-3 py-2 text-sm text-text-primary font-normal"
        bind:value={name}
        placeholder="My Custom System"
        data-testid="editor-name"
      />
      </label>
      {#if nameError}
        <p class="text-xs text-red-400 mt-1">{nameError}</p>
      {/if}

      {#if !system}
        <label class="block text-xs text-text-muted mt-3 mb-1">Starting from:
        <select class={selectClass} bind:value={startingFrom} onchange={() => resetToPreset(startingFrom)}>
          {#each AVAILABLE_BASE_SYSTEMS as sys (sys.id)}
            <option value={sys.id}>{sys.label}</option>
          {/each}
        </select>
        </label>
      {/if}
    </div>

    <!-- 1. Opening & Responses -->
    <EditorSection title="Opening & Responses" defaultOpen={true}>
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
        <p class="text-xs text-text-muted mb-1.5">2-Level Forcing Duration</p>
        <select class="{selectClass} max-w-[10rem]" bind:value={forcingDuration}>
          <option value="one-round">One Round</option>
          <option value="game">Game Forcing</option>
        </select>
      </div>

      <!-- 1NT Response Forcing Status -->
      <div>
        <p class="text-xs text-text-muted mb-1.5">1NT Response Forcing Status</p>
        <select class="{selectClass} max-w-[10rem]" bind:value={oneNtForcing}>
          <option value="non-forcing">Non-Forcing</option>
          <option value="semi-forcing">Semi-Forcing</option>
          <option value="forcing">Forcing</option>
        </select>
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
    </EditorSection>

    <!-- 2. Hand Evaluation -->
    <EditorSection title="Hand Evaluation" defaultOpen={true}>
      <!-- Point Formulas -->
      <div>
        <p class="text-xs text-text-muted mb-2">Point Formulas</p>
        <div class="grid grid-cols-2 gap-3">
          <!-- NT panel -->
          <div class="bg-bg-base border border-border-subtle rounded-[--radius-md] p-3">
            <p class="text-xs font-semibold text-text-primary mb-2">NT Hands</p>
            <div class="space-y-1.5">
              <label class="flex items-center gap-2">
                <input type="checkbox" checked disabled class="accent-accent-primary opacity-50" />
                <span class="text-xs text-text-muted">HCP</span>
                <span class="text-xs text-text-muted/60 ml-auto">always on</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" bind:checked={ntShortage} class="accent-accent-primary" />
                <span class="text-xs text-text-primary">Shortage Points</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" bind:checked={ntLength} class="accent-accent-primary" />
                <span class="text-xs text-text-primary">Length Points</span>
              </label>
            </div>
          </div>
          <!-- Trump panel -->
          <div class="bg-bg-base border border-border-subtle rounded-[--radius-md] p-3">
            <p class="text-xs font-semibold text-text-primary mb-2">Trump Hands</p>
            <div class="space-y-1.5">
              <label class="flex items-center gap-2">
                <input type="checkbox" checked disabled class="accent-accent-primary opacity-50" />
                <span class="text-xs text-text-muted">HCP</span>
                <span class="text-xs text-text-muted/60 ml-auto">always on</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" bind:checked={trumpShortage} class="accent-accent-primary" />
                <span class="text-xs text-text-primary">Shortage Points</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" bind:checked={trumpLength} class="accent-accent-primary" />
                <span class="text-xs text-text-primary">Length Points</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Responder Invite Range -->
      <div>
        <p class="text-xs text-text-muted mb-1.5">Responder Invite Range</p>
        <div class="flex items-center gap-4 flex-wrap">
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

      <!-- Responder Game Minimum -->
      <div>
        <p class="text-xs text-text-muted mb-1.5">Responder Game Minimum</p>
        <div class="flex items-center gap-4 flex-wrap">
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

      <!-- Responder Slam Explore -->
      <div>
        <p class="text-xs text-text-muted mb-1.5">Responder Slam Explore</p>
        <div class="flex items-center gap-4 flex-wrap">
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

      <!-- Opener Not Minimum -->
      <div>
        <p class="text-xs text-text-muted mb-1.5">Opener Not Minimum</p>
        <div class="flex items-center gap-4 flex-wrap">
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
    </EditorSection>

    <!-- 3. Competitive Bidding -->
    <EditorSection title="Competitive Bidding">
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
    </EditorSection>

    <!-- 4. Base Conventions -->
    <EditorSection title="Base Conventions">
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
    </EditorSection>
  </div>

  <!-- Sticky save bar -->
  <div class="sticky bottom-0 z-10 bg-bg-base/90 backdrop-blur-sm border-t border-border-subtle px-5 py-3 flex items-center justify-between -mx-6">
    <div>
      {#if allErrors.length > 0}
        <span class="text-xs text-red-400">{allErrors.length} {allErrors.length === 1 ? 'issue' : 'issues'}</span>
      {/if}
    </div>
    <div class="flex gap-2">
      <button
        class="px-4 py-2 rounded-[--radius-md] text-sm font-medium text-text-muted hover:text-text-primary border border-border-subtle transition-colors cursor-pointer"
        onclick={onCancel}
      >Cancel</button>
      <button
        class="px-4 py-2 rounded-[--radius-md] text-sm font-semibold transition-colors cursor-pointer
          {hasErrors
            ? 'bg-bg-elevated text-text-muted cursor-not-allowed'
            : 'bg-accent-primary text-text-on-accent hover:bg-accent-primary/90'}"
        disabled={hasErrors}
        onclick={handleSave}
        data-testid="editor-save"
      >Save</button>
    </div>
  </div>
</main>
