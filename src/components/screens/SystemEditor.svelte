<script lang="ts">
  import { SvelteSet } from "svelte/reactivity";
  import type { BaseSystemId, SystemConfig, CustomSystem } from "../../service";
  import { AVAILABLE_BASE_SYSTEMS, getSystemConfig, DEFAULT_BASE_MODULE_IDS } from "../../service";
  import { listModules } from "../../service/service-helpers";
  import { getCustomSystemsStore } from "../../stores/context";
  import ToggleGroup from "../shared/ToggleGroup.svelte";

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

  let ntFormula = $state(sourceConfig.pointConfig?.ntFormula ?? "hcp-only");
  let trumpFormula = $state(sourceConfig.pointConfig?.trumpFormula ?? "hcp-plus-shortage");

  let selectedModules = new SvelteSet<string>(system?.baseModuleIds ?? [...DEFAULT_BASE_MODULE_IDS]);

  // Validation
  const nameError = $derived(customSystems.validateName(name, system?.id));
  const ntRangeError = $derived(ntMinHcp > ntMaxHcp ? "Min must be ≤ Max" : null);
  const inviteRangeError = $derived(inviteMin > inviteMax ? "Min must be ≤ Max" : null);
  const thresholdOrderError = $derived(gameMin > slamMin ? "Game min must be ≤ Slam min" : null);
  const dontRangeError = $derived(dontMinHcp > dontMaxHcp ? "Min must be ≤ Max" : null);
  const oneNtRangeError = $derived(oneNtMinHcp > oneNtMaxHcp ? "Min must be ≤ Max" : null);

  const hasErrors = $derived(
    !!nameError || !!ntRangeError || !!inviteRangeError ||
    !!thresholdOrderError || !!dontRangeError || !!oneNtRangeError
  );

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
      pointConfig: { ntFormula, trumpFormula },
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

  // Generate HCP options 0-40
  const hcpOptions = Array.from({ length: 41 }, (_, i) => i);

  const selectClass = "bg-bg-base border border-border-subtle rounded-[--radius-md] px-3 py-2 text-sm text-text-primary cursor-pointer";
</script>

<main class="max-w-3xl mx-auto h-full flex flex-col p-6 pb-0" aria-label="System Editor">
  <div class="shrink-0 flex items-center justify-between mb-6">
    <button
      class="text-sm text-text-muted hover:text-text-primary transition-colors cursor-pointer"
      onclick={onCancel}
    >
      &larr; Workshop
    </button>
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

  <div class="flex-1 overflow-y-auto pb-6 space-y-5">
    <!-- System Name -->
    <div class="bg-bg-card border border-border-subtle rounded-[--radius-lg] p-5">
      <label class="block text-sm font-semibold text-text-primary mb-2">System Name</label>
      <input
        type="text"
        class="w-full {selectClass}"
        bind:value={name}
        placeholder="My Custom System"
        data-testid="editor-name"
      />
      {#if nameError}
        <p class="text-xs text-red-400 mt-1">{nameError}</p>
      {/if}

      {#if !system}
        <label class="block text-xs text-text-muted mt-3 mb-1">Starting from:</label>
        <select class={selectClass} bind:value={startingFrom} onchange={() => resetToPreset(startingFrom)}>
          {#each AVAILABLE_BASE_SYSTEMS as sys (sys.id)}
            <option value={sys.id}>{sys.label}</option>
          {/each}
        </select>
      {/if}
    </div>

    <!-- 1NT Opening -->
    <div class="bg-bg-card border border-border-subtle rounded-[--radius-lg] p-5">
      <h3 class="text-sm font-semibold text-text-primary mb-3">1NT Opening</h3>
      <div class="flex items-center gap-2">
        <label class="text-xs text-text-muted">HCP Range</label>
        <select class={selectClass} bind:value={ntMinHcp}>
          {#each hcpOptions as v (v)}<option value={v}>{v}</option>{/each}
        </select>
        <span class="text-text-muted text-sm">to</span>
        <select class={selectClass} bind:value={ntMaxHcp}>
          {#each hcpOptions as v (v)}<option value={v}>{v}</option>{/each}
        </select>
        <span class="text-xs text-text-muted">HCP</span>
      </div>
      {#if ntRangeError}
        <p class="text-xs text-red-400 mt-1">{ntRangeError}</p>
      {/if}
    </div>

    <!-- Responder Thresholds -->
    <div class="bg-bg-card border border-border-subtle rounded-[--radius-lg] p-5">
      <h3 class="text-sm font-semibold text-text-primary mb-3">Responder Thresholds</h3>

      <div class="space-y-3">
        <div>
          <label class="text-xs text-text-muted">Invite Range</label>
          <div class="flex items-center gap-2 mt-1">
            <span class="text-xs text-text-muted w-8">HCP:</span>
            <select class={selectClass} bind:value={inviteMin}>
              {#each hcpOptions as v (v)}<option value={v}>{v}</option>{/each}
            </select>
            <span class="text-text-muted text-xs">to</span>
            <select class={selectClass} bind:value={inviteMax}>
              {#each hcpOptions as v (v)}<option value={v}>{v}</option>{/each}
            </select>
            <span class="text-xs text-text-muted ml-4 w-10">Suit TP:</span>
            <select class={selectClass} bind:value={inviteMinTp}>
              {#each hcpOptions as v (v)}<option value={v}>{v}</option>{/each}
            </select>
            <span class="text-text-muted text-xs">to</span>
            <select class={selectClass} bind:value={inviteMaxTp}>
              {#each hcpOptions as v (v)}<option value={v}>{v}</option>{/each}
            </select>
          </div>
          {#if inviteRangeError}
            <p class="text-xs text-red-400 mt-1">{inviteRangeError}</p>
          {/if}
        </div>

        <div class="flex items-center gap-4">
          <div>
            <label class="text-xs text-text-muted">Game Minimum</label>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-xs text-text-muted w-8">HCP:</span>
              <select class={selectClass} bind:value={gameMin}>
                {#each hcpOptions as v (v)}<option value={v}>{v}</option>{/each}
              </select>
              <span class="text-xs text-text-muted ml-4 w-10">Suit TP:</span>
              <select class={selectClass} bind:value={gameMinTp}>
                {#each hcpOptions as v (v)}<option value={v}>{v}</option>{/each}
              </select>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <div>
            <label class="text-xs text-text-muted">Slam Explore</label>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-xs text-text-muted w-8">HCP:</span>
              <select class={selectClass} bind:value={slamMin}>
                {#each hcpOptions as v (v)}<option value={v}>{v}</option>{/each}
              </select>
              <span class="text-xs text-text-muted ml-4 w-10">Suit TP:</span>
              <select class={selectClass} bind:value={slamMinTp}>
                {#each hcpOptions as v (v)}<option value={v}>{v}</option>{/each}
              </select>
            </div>
          </div>
        </div>
        {#if thresholdOrderError}
          <p class="text-xs text-red-400 mt-1">{thresholdOrderError}</p>
        {/if}
      </div>
    </div>

    <!-- Opener Rebid -->
    <div class="bg-bg-card border border-border-subtle rounded-[--radius-lg] p-5">
      <h3 class="text-sm font-semibold text-text-primary mb-3">Opener Rebid</h3>
      <div class="flex items-center gap-2">
        <label class="text-xs text-text-muted">Not Minimum</label>
        <span class="text-xs text-text-muted w-8">HCP:</span>
        <select class={selectClass} bind:value={openerNotMin}>
          {#each hcpOptions as v (v)}<option value={v}>{v}</option>{/each}
        </select>
        <span class="text-xs text-text-muted ml-4 w-10">Suit TP:</span>
        <select class={selectClass} bind:value={openerNotMinTp}>
          {#each hcpOptions as v (v)}<option value={v}>{v}</option>{/each}
        </select>
      </div>
    </div>

    <!-- Suit Responses -->
    <div class="bg-bg-card border border-border-subtle rounded-[--radius-lg] p-5">
      <h3 class="text-sm font-semibold text-text-primary mb-3">Suit Responses</h3>
      <div class="flex items-center gap-4 flex-wrap">
        <div class="flex items-center gap-2">
          <label class="text-xs text-text-muted">2-Level Minimum</label>
          <select class={selectClass} bind:value={twoLevelMin}>
            {#each hcpOptions as v (v)}<option value={v}>{v}</option>{/each}
          </select>
          <span class="text-xs text-text-muted">HCP</span>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs text-text-muted">Forcing Duration</label>
          <select class="{selectClass} max-w-[10rem]" bind:value={forcingDuration}>
            <option value="one-round">One Round</option>
            <option value="game">Game Forcing</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 1NT Response to 1M -->
    <div class="bg-bg-card border border-border-subtle rounded-[--radius-lg] p-5">
      <h3 class="text-sm font-semibold text-text-primary mb-3">1NT Response to 1M</h3>
      <div class="flex items-center gap-4 flex-wrap">
        <div class="flex items-center gap-2">
          <label class="text-xs text-text-muted">Forcing Status</label>
          <select class="{selectClass} max-w-[10rem]" bind:value={oneNtForcing}>
            <option value="non-forcing">Non-Forcing</option>
            <option value="semi-forcing">Semi-Forcing</option>
            <option value="forcing">Forcing</option>
          </select>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs text-text-muted">HCP Range</label>
          <select class={selectClass} bind:value={oneNtMinHcp}>
            {#each hcpOptions as v (v)}<option value={v}>{v}</option>{/each}
          </select>
          <span class="text-text-muted text-xs">to</span>
          <select class={selectClass} bind:value={oneNtMaxHcp}>
            {#each hcpOptions as v (v)}<option value={v}>{v}</option>{/each}
          </select>
        </div>
      </div>
      {#if oneNtRangeError}
        <p class="text-xs text-red-400 mt-1">{oneNtRangeError}</p>
      {/if}
    </div>

    <!-- Opening Requirements -->
    <div class="bg-bg-card border border-border-subtle rounded-[--radius-lg] p-5">
      <h3 class="text-sm font-semibold text-text-primary mb-3">Opening Requirements</h3>
      <div class="flex items-center gap-2">
        <label class="text-xs text-text-muted">Major Suit Minimum Length</label>
        <ToggleGroup
          items={[
            { id: "4", label: "4-card", testId: "editor-major-4" },
            { id: "5", label: "5-card", testId: "editor-major-5" },
          ]}
          active={String(majorMinLength)}
          onSelect={(id) => { majorMinLength = Number(id) as 4 | 5; }}
          ariaLabel="Major suit minimum length"
        />
      </div>
    </div>

    <!-- Interference -->
    <div class="bg-bg-card border border-border-subtle rounded-[--radius-lg] p-5">
      <h3 class="text-sm font-semibold text-text-primary mb-3">Interference</h3>
      <div class="flex items-center gap-2">
        <label class="text-xs text-text-muted">Redouble Minimum</label>
        <select class={selectClass} bind:value={redoubleMin}>
          {#each hcpOptions as v (v)}<option value={v}>{v}</option>{/each}
        </select>
        <span class="text-xs text-text-muted">HCP</span>
      </div>
    </div>

    <!-- DONT Overcalls -->
    <div class="bg-bg-card border border-border-subtle rounded-[--radius-lg] p-5">
      <h3 class="text-sm font-semibold text-text-primary mb-3">DONT Overcalls</h3>
      <div class="flex items-center gap-2">
        <label class="text-xs text-text-muted">HCP Range</label>
        <select class={selectClass} bind:value={dontMinHcp}>
          {#each hcpOptions as v (v)}<option value={v}>{v}</option>{/each}
        </select>
        <span class="text-text-muted text-xs">to</span>
        <select class={selectClass} bind:value={dontMaxHcp}>
          {#each hcpOptions as v (v)}<option value={v}>{v}</option>{/each}
        </select>
      </div>
      {#if dontRangeError}
        <p class="text-xs text-red-400 mt-1">{dontRangeError}</p>
      {/if}
    </div>

    <!-- Point Formulas -->
    <div class="bg-bg-card border border-border-subtle rounded-[--radius-lg] p-5">
      <h3 class="text-sm font-semibold text-text-primary mb-3">Point Formulas</h3>
      <div class="flex items-center gap-4 flex-wrap">
        <div class="flex items-center gap-2">
          <label class="text-xs text-text-muted">NT Hands</label>
          <select class="{selectClass} max-w-[14rem]" bind:value={ntFormula}>
            <option value="hcp-only">HCP Only</option>
            <option value="hcp-plus-shortage">HCP + Shortage</option>
            <option value="hcp-plus-all-distribution">HCP + All Distribution</option>
          </select>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs text-text-muted">Trump Hands</label>
          <select class="{selectClass} max-w-[14rem]" bind:value={trumpFormula}>
            <option value="hcp-only">HCP Only</option>
            <option value="hcp-plus-shortage">HCP + Shortage</option>
            <option value="hcp-plus-all-distribution">HCP + All Distribution</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Base Conventions -->
    <div class="bg-bg-card border border-border-subtle rounded-[--radius-lg] p-5">
      <h3 class="text-sm font-semibold text-text-primary mb-2">Base Conventions</h3>
      <p class="text-xs text-text-muted mb-3">Always active during practice.</p>
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
    </div>

    <!-- Bottom save/cancel buttons -->
    <div class="flex justify-end gap-2 pt-2 pb-4">
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
      >Save</button>
    </div>
  </div>
</main>
