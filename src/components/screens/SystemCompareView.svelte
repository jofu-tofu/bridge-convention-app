<script lang="ts">
  import { AVAILABLE_BASE_SYSTEMS, getSystemConfig } from "../../service";
  import type { BaseSystemId } from "../../service";
  import {
    PROFILE_CATEGORIES,
    formatFieldValue,
    formatTrumpTpValue,
    valuesMatch,
    valuesMatchTrumpTp,
  } from "./profile-display";

  const allConfigs = AVAILABLE_BASE_SYSTEMS.map((s) => getSystemConfig(s.id as BaseSystemId));
</script>

<div class="compare-table bg-bg-card border border-border-subtle rounded-[--radius-lg] overflow-hidden">
  <table class="w-full table-fixed border-collapse text-sm">
    <thead>
      <tr class="border-b border-border-subtle">
        <th class="text-left px-4 py-3 text-text-muted font-medium w-[38%]"></th>
        {#each AVAILABLE_BASE_SYSTEMS as sys (sys.id)}
          <th class="text-center px-3 py-3 font-semibold text-text-primary text-sm tracking-tight">
            {sys.shortLabel}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each PROFILE_CATEGORIES as category, ci (category.label)}
        <!-- Category divider row -->
        <tr class="category-row" style="animation-delay: {ci * 30}ms;">
          <td
            colspan={1 + AVAILABLE_BASE_SYSTEMS.length}
            class="px-4 py-2 border-t border-border-subtle"
          >
            <div class="flex items-center gap-2">
              <span class="w-1 h-3 rounded-full bg-accent-primary/50 shrink-0" aria-hidden="true"></span>
              <span class="text-xs font-semibold text-text-muted uppercase tracking-widest">{category.label}</span>
            </div>
          </td>
        </tr>
        {#each category.fields as field (field.label)}
          {#if category.hasTotalPoints}
            <!-- HCP sub-row -->
            {@const hcpDiffers = !valuesMatch(allConfigs, field)}
            <tr
              class="border-t border-border-subtle/30 transition-colors
                {hcpDiffers ? 'diff-row' : ''}"
            >
              <td class="px-4 py-1.5 text-text-secondary">
                <span class="text-xs text-text-muted mr-1">NT / HCP</span>
                {field.label}
              </td>
              {#each allConfigs as config (config.systemId)}
                <td
                  class="px-3 py-1.5 text-center tabular-nums tracking-tight
                    {hcpDiffers ? 'font-semibold text-accent-primary' : 'text-text-primary'}"
                >
                  {formatFieldValue(config, field)}
                </td>
              {/each}
            </tr>
            <!-- Suit TP sub-row -->
            {@const trumpDiffers = !valuesMatchTrumpTp(allConfigs, field)}
            <tr
              class="border-t border-border-subtle/20 transition-colors
                {trumpDiffers ? 'diff-row' : ''}"
            >
              <td class="px-4 py-1.5 text-text-secondary">
                <span class="text-xs text-text-muted mr-1">Suit / TP</span>
                {field.label}
              </td>
              {#each allConfigs as config (config.systemId)}
                <td
                  class="px-3 py-1.5 text-center tabular-nums tracking-tight
                    {trumpDiffers ? 'font-semibold text-accent-primary' : 'text-text-primary'}"
                >
                  {formatTrumpTpValue(config, field)}
                </td>
              {/each}
            </tr>
          {:else}
            <!-- Standard single row for non-TP fields -->
            {@const differs = !valuesMatch(allConfigs, field)}
            <tr
              class="border-t border-border-subtle/30 transition-colors
                {differs ? 'diff-row' : ''}"
            >
              <td class="px-4 py-2.5 text-text-secondary">{field.label}</td>
              {#each allConfigs as config (config.systemId)}
                <td
                  class="px-3 py-2.5 text-center tabular-nums tracking-tight
                    {differs ? 'font-semibold text-accent-primary' : 'text-text-primary'}"
                >
                  {formatFieldValue(config, field)}
                </td>
              {/each}
            </tr>
          {/if}
        {/each}
      {/each}
    </tbody>
  </table>
</div>

<style>
  @keyframes tableIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .compare-table {
    animation: tableIn 0.2s ease-out;
  }
  .diff-row {
    background: rgba(77, 144, 247, 0.04);
  }
  .diff-row:hover {
    background: rgba(77, 144, 247, 0.08);
  }
  .category-row {
    background: rgba(255, 255, 255, 0.015);
  }
</style>
