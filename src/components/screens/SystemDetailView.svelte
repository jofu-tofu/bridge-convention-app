<script lang="ts">
  import type { SystemConfig } from "../../service";
  import { PROFILE_CATEGORIES, formatFieldValue, formatTrumpTpValue } from "./profile-display";

  interface Props {
    config: SystemConfig;
  }

  const { config }: Props = $props();
</script>

<div class="space-y-3">
  {#each PROFILE_CATEGORIES as category, i (category.label)}
    <section
      class="profile-card bg-bg-card border border-border-subtle rounded-[--radius-lg] overflow-hidden"
      style="animation-delay: {i * 40}ms;"
    >
      <!-- Category header with left accent -->
      <div class="flex items-center gap-3 px-5 pt-4 pb-2">
        <span class="w-1 h-4 rounded-full bg-accent-primary/60 shrink-0" aria-hidden="true"></span>
        <h3 class="text-xs font-semibold text-text-muted uppercase tracking-widest">
          {category.label}
        </h3>
      </div>

      <!-- Fields -->
      <div class="px-5 pb-4">
        {#if category.hasTotalPoints}
          <!-- 3-column layout for TP-enabled categories -->
          <table class="w-full text-sm">
            <thead>
              <tr class="text-xs text-text-muted">
                <th class="text-left font-medium pb-1.5 w-[40%]"></th>
                <th class="text-right font-medium pb-1.5 px-2">NT / HCP</th>
                <th class="text-right font-medium pb-1.5 px-2">Suit / TP</th>
              </tr>
            </thead>
            <tbody>
              {#each category.fields as field, fi (field.label)}
                <tr class={fi > 0 ? "border-t border-border-subtle/50" : ""}>
                  <td class="py-2.5 text-text-secondary">{field.label}</td>
                  <td class="py-2.5 px-2 text-right font-semibold text-text-primary tabular-nums tracking-tight">
                    {formatFieldValue(config, field)}
                  </td>
                  <td class="py-2.5 px-2 text-right font-semibold text-text-primary tabular-nums tracking-tight">
                    {formatTrumpTpValue(config, field)}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <!-- Standard 2-column layout -->
          {#each category.fields as field, fi (field.label)}
            {#if fi > 0}
              <div class="border-t border-border-subtle/50 my-0" aria-hidden="true"></div>
            {/if}
            <div class="flex items-baseline justify-between py-2.5 gap-4">
              <span class="text-sm text-text-secondary">{field.label}</span>
              <span class="text-sm font-semibold text-text-primary tabular-nums tracking-tight">
                {formatFieldValue(config, field)}
              </span>
            </div>
          {/each}
        {/if}
      </div>
    </section>
  {/each}
</div>

<style>
  @keyframes cardIn {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .profile-card {
    animation: cardIn 0.25s ease-out both;
  }
</style>
