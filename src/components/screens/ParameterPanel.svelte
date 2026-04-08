<script lang="ts">
  import type { ConfigurableSurfaceView } from "../../service";
  import NumberStepper from "../shared/NumberStepper.svelte";

  interface Props {
    surfaces: readonly ConfigurableSurfaceView[];
    onParameterChange: (meaningId: string, clauseIndex: number, newValue: number | boolean) => void;
  }

  let { surfaces, onParameterChange }: Props = $props();

  function handleNumberChange(meaningId: string, clauseIndex: number, value: number) {
    onParameterChange(meaningId, clauseIndex, value);
  }

  function handleBooleanChange(meaningId: string, clauseIndex: number, checked: boolean) {
    onParameterChange(meaningId, clauseIndex, checked);
  }
</script>

<div class="space-y-4">
  {#each surfaces as surface (surface.meaningId)}
    {#if surface.parameters.length > 0}
      <div class="bg-bg-card rounded-[--radius-lg] border border-border-subtle p-4">
        <div class="mb-3">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-text-primary">{surface.name}</span>
            {#if surface.callDisplay}
              <span class="px-1.5 py-0.5 text-[10px] font-mono font-medium rounded bg-bg-surface text-text-muted">{surface.callDisplay}</span>
            {/if}
          </div>
          {#if surface.summary}
            <p class="text-xs text-text-muted mt-0.5">{surface.summary}</p>
          {/if}
        </div>

        <div class="space-y-3">
          {#each surface.parameters as param (param.factId + '-' + param.clauseIndex)}
            <div class="flex items-center justify-between gap-4">
              <div class="flex-1 min-w-0">
                <p class="text-xs text-text-secondary">{param.description}</p>
                {#if param.defaultValue !== null && param.defaultValue !== undefined && param.currentValue !== param.defaultValue}
                  <p class="text-[10px] text-text-muted mt-0.5">Default: {param.defaultValue}</p>
                {/if}
              </div>
              <div class="shrink-0">
                {#if param.valueType === "integer" && typeof param.currentValue === "number"}
                  <NumberStepper
                    value={param.currentValue}
                    min={param.validRange?.min ?? 0}
                    max={param.validRange?.max ?? 40}
                    onchange={(v) => handleNumberChange(surface.meaningId, param.clauseIndex, v)}
                    testId="param-{param.factId}"
                  />
                {:else if param.valueType === "boolean"}
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={param.currentValue === true}
                      onchange={(e) => handleBooleanChange(surface.meaningId, param.clauseIndex, (e.target as HTMLInputElement).checked)}
                      class="accent-accent-primary"
                    />
                  </label>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/each}

  {#if surfaces.every(s => s.parameters.length === 0)}
    <p class="text-sm text-text-muted italic">No configurable parameters in this module.</p>
  {/if}
</div>
