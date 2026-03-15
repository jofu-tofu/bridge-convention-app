<script lang="ts">
  import type { MachineDebugSnapshot } from "../../../core/contracts";

  interface Props {
    machineSnapshot: MachineDebugSnapshot | null;
  }

  let { machineSnapshot }: Props = $props();
</script>

<details>
  <summary class="text-text-primary font-semibold text-sm cursor-pointer py-1">Convention Machine</summary>
  <div class="pl-2 py-1">
    {#if machineSnapshot}
      {@const ms = machineSnapshot}
      <div class="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
        <span class="text-text-muted">state</span>
        <span class="text-cyan-300 font-bold">{ms.currentStateId}</span>
        <span class="text-text-muted">forcing</span>
        <span class="text-text-primary {ms.registers.forcingState === 'game-forcing' ? 'text-red-300 font-bold' : ms.registers.forcingState === 'forcing-one-round' ? 'text-yellow-300' : ''}">{ms.registers.forcingState}</span>
        <span class="text-text-muted">obligation</span>
        <span class="text-text-primary">{ms.registers.obligation.kind} ({ms.registers.obligation.obligatedSide})</span>
        <span class="text-text-muted">strain</span>
        <span class="text-text-primary">{ms.registers.agreedStrain.type}{ms.registers.agreedStrain.suit ? ` (${ms.registers.agreedStrain.suit})` : ""}{ms.registers.agreedStrain.confidence ? ` [${ms.registers.agreedStrain.confidence}]` : ""}</span>
        <span class="text-text-muted">competition</span>
        <span class="text-text-primary">{ms.registers.competitionMode}</span>
        <span class="text-text-muted">captain</span>
        <span class="text-text-primary">{ms.registers.captain}</span>
      </div>
      {#if Object.keys(ms.registers.systemCapabilities).length > 0}
        <div class="mt-1">
          <span class="text-text-muted">capabilities:</span>
          {#each Object.entries(ms.registers.systemCapabilities) as [k, v] (k)}
            <span class="ml-1 text-purple-300">{k}={v}</span>
          {/each}
        </div>
      {/if}
      <div class="mt-1">
        <span class="text-text-muted">active groups:</span>
        {#each ms.activeSurfaceGroupIds as gid (gid)}
          <span class="ml-1 px-1 bg-cyan-900/50 text-cyan-200 rounded">{gid}</span>
        {/each}
      </div>
      {#if ms.stateHistory.length > 0}
        <div class="mt-1">
          <span class="text-text-muted">state history:</span>
          <span class="text-text-primary ml-1">{ms.stateHistory.join(" → ")}</span>
        </div>
      {/if}
      {#if ms.transitionHistory.length > 0}
        <div class="mt-0.5">
          <span class="text-text-muted">transitions:</span>
          <span class="text-text-primary ml-1">{ms.transitionHistory.join(", ")}</span>
        </div>
      {/if}
      {#if ms.submachineStack.length > 0}
        <div class="mt-0.5">
          <span class="text-text-muted">submachine stack:</span>
          {#each ms.submachineStack as frame (frame.parentMachineId)}
            <span class="ml-1 text-orange-300">{frame.parentMachineId}→{frame.returnStateId}</span>
          {/each}
        </div>
      {/if}
      {#if ms.diagnostics.length > 0}
        <div class="mt-1 border-t border-border-subtle/30 pt-1">
          {#each ms.diagnostics as d, i (i)}
            <div class="{d.level === 'warn' ? 'text-yellow-400' : d.level === 'error' ? 'text-red-400' : 'text-text-muted'}">
              [{d.level}] {d.moduleId ? `${d.moduleId}: ` : ""}{d.message}
            </div>
          {/each}
        </div>
      {/if}
      {#if ms.handoffTraces.length > 0}
        <div class="mt-1 border-t border-border-subtle/30 pt-1">
          <span class="text-text-muted">handoffs:</span>
          {#each ms.handoffTraces as h, i (i)}
            <div class="text-orange-300">{h.fromModuleId} → {h.toModuleId}: {h.reason}</div>
          {/each}
        </div>
      {/if}
    {:else}
      <div class="text-text-muted italic">No machine state</div>
    {/if}
  </div>
</details>
