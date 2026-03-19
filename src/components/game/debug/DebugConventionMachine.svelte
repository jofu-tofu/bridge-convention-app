<script lang="ts">
  import type { MachineDebugSnapshot } from "../../../core/contracts";
  import DebugSection from "./DebugSection.svelte";

  interface Props {
    machineSnapshot: MachineDebugSnapshot | null;
  }

  let { machineSnapshot }: Props = $props();
</script>

<DebugSection
  title="Convention Machine"
  preview={machineSnapshot ? machineSnapshot.currentStateId : null}
>
  {#if machineSnapshot}
    {@const ms = machineSnapshot}
    <!-- Core registers — always visible, compact grid -->
    <div class="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0 text-[10px]">
      <span class="text-text-muted">state</span>
      <span class="text-cyan-300 font-bold">{ms.currentStateId}</span>
      <span class="text-text-muted">forcing</span>
      <span class="{ms.registers.forcingState === 'game-forcing' ? 'text-red-300 font-bold' : ms.registers.forcingState === 'forcing-one-round' ? 'text-yellow-300' : 'text-text-primary'}">{ms.registers.forcingState}</span>
      <span class="text-text-muted">obligation</span>
      <span class="text-text-primary">{ms.registers.obligation.kind} ({ms.registers.obligation.obligatedSide})</span>
      <span class="text-text-muted">strain</span>
      <span class="text-text-primary">{ms.registers.agreedStrain.type}{ms.registers.agreedStrain.suit ? ` (${ms.registers.agreedStrain.suit})` : ""}{ms.registers.agreedStrain.confidence ? ` [${ms.registers.agreedStrain.confidence}]` : ""}</span>
      <span class="text-text-muted">competition</span>
      <span class="text-text-primary">{ms.registers.competitionMode}</span>
      <span class="text-text-muted">captain</span>
      <span class="text-text-primary">{ms.registers.captain}</span>
    </div>

    <!-- Active groups — inline badges -->
    <div class="mt-1 text-[10px]">
      <span class="text-text-muted">groups:</span>
      {#each ms.activeSurfaceGroupIds as gid (gid)}
        <span class="ml-1 px-0.5 bg-cyan-900/50 text-cyan-200 rounded text-[9px]">{gid}</span>
      {/each}
    </div>

    <!-- Capabilities — inline if present -->
    {#if Object.keys(ms.registers.systemCapabilities).length > 0}
      <div class="mt-0.5 text-[10px]">
        <span class="text-text-muted">capabilities:</span>
        {#each Object.entries(ms.registers.systemCapabilities) as [k, v] (k)}
          <span class="ml-1 text-purple-300">{k}={v}</span>
        {/each}
      </div>
    {/if}

    <!-- State history — collapsed -->
    {#if ms.stateHistory.length > 0}
      <DebugSection title="State History" count={ms.stateHistory.length} nested>
        <div class="text-[10px] text-text-primary">{ms.stateHistory.join(" → ")}</div>
      </DebugSection>
    {/if}

    <!-- Transitions — collapsed -->
    {#if ms.transitionHistory.length > 0}
      <DebugSection title="Transitions" count={ms.transitionHistory.length} nested>
        <div class="text-[10px] text-text-primary">{ms.transitionHistory.join(", ")}</div>
      </DebugSection>
    {/if}

    <!-- Submachine stack — collapsed -->
    {#if ms.submachineStack.length > 0}
      <DebugSection title="Submachine Stack" count={ms.submachineStack.length} nested>
        {#each ms.submachineStack as frame (frame.parentMachineId)}
          <div class="text-[10px] text-orange-300">{frame.parentMachineId} → {frame.returnStateId}</div>
        {/each}
      </DebugSection>
    {/if}

    <!-- Diagnostics — collapsed -->
    {#if ms.diagnostics.length > 0}
      <DebugSection title="Diagnostics" count={ms.diagnostics.length} badge={ms.diagnostics.some(d => d.level === 'error') ? 'error' : ms.diagnostics.some(d => d.level === 'warn') ? 'warn' : null} badgeColor={ms.diagnostics.some(d => d.level === 'error') ? 'bg-red-900/50 text-red-300' : 'bg-yellow-900/50 text-yellow-300'} nested>
        {#each ms.diagnostics as d, i (i)}
          <div class="text-[10px] {d.level === 'warn' ? 'text-yellow-400' : d.level === 'error' ? 'text-red-400' : 'text-text-muted'}">
            [{d.level}] {d.moduleId ? `${d.moduleId}: ` : ""}{d.message}
          </div>
        {/each}
      </DebugSection>
    {/if}

    <!-- Handoffs — collapsed -->
    {#if ms.handoffTraces.length > 0}
      <DebugSection title="Handoffs" count={ms.handoffTraces.length} nested>
        {#each ms.handoffTraces as h, i (i)}
          <div class="text-[10px] text-orange-300">{h.fromModuleId} → {h.toModuleId}: {h.reason}</div>
        {/each}
      </DebugSection>
    {/if}
  {:else}
    <div class="text-text-muted italic text-[10px]">No machine state</div>
  {/if}
</DebugSection>
