<script lang="ts">
  import { ZONE_BG, ZONE_TEXT, ZONE_BORDER, thresholdPct } from "./strength-bar";

  interface Props {
    inviteMin: number;
    gameMin: number;
    slamMin: number;
  }

  const { inviteMin, gameMin, slamMin }: Props = $props();

  // Zone widths as percentages
  const weakPct = $derived(thresholdPct(inviteMin));
  const invitePct = $derived(thresholdPct(gameMin) - thresholdPct(inviteMin));
  const gamePct = $derived(thresholdPct(slamMin) - thresholdPct(gameMin));
  const slamPct = $derived(100 - thresholdPct(slamMin));
</script>

<div class="space-y-1.5">
  <p class="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Responder Strength</p>

  <!-- Bar -->
  <div class="flex h-7 rounded-[--radius-md] overflow-hidden border border-border-subtle">
    {#if weakPct > 0}
      <div
        class="flex items-center justify-center text-[10px] font-medium transition-all duration-200 {ZONE_BG.weak} {ZONE_TEXT.weak} border-r {ZONE_BORDER.weak}"
        style="width: {weakPct}%"
      >
        {#if weakPct > 12}Weak{/if}
      </div>
    {/if}
    {#if invitePct > 0}
      <div
        class="flex items-center justify-center text-[10px] font-medium transition-all duration-200 {ZONE_BG.invite} {ZONE_TEXT.invite} border-r {ZONE_BORDER.invite}"
        style="width: {invitePct}%"
      >
        {#if invitePct > 12}Invite{/if}
      </div>
    {/if}
    {#if gamePct > 0}
      <div
        class="flex items-center justify-center text-[10px] font-medium transition-all duration-200 {ZONE_BG.game} {ZONE_TEXT.game} border-r {ZONE_BORDER.game}"
        style="width: {gamePct}%"
      >
        {#if gamePct > 12}Game{/if}
      </div>
    {/if}
    {#if slamPct > 0}
      <div
        class="flex items-center justify-center text-[10px] font-medium transition-all duration-200 {ZONE_BG.slam} {ZONE_TEXT.slam}"
        style="width: {slamPct}%"
      >
        {#if slamPct > 12}Slam{/if}
      </div>
    {/if}
  </div>

  <!-- Threshold labels -->
  <div class="relative h-4">
    <span
      class="absolute text-[10px] transition-all duration-200 {ZONE_TEXT.invite}"
      style="left: {thresholdPct(inviteMin)}%; transform: translateX(-50%);"
    >{inviteMin}</span>
    <span
      class="absolute text-[10px] transition-all duration-200 {ZONE_TEXT.game}"
      style="left: {thresholdPct(gameMin)}%; transform: translateX(-50%);"
    >{gameMin}</span>
    <span
      class="absolute text-[10px] transition-all duration-200 {ZONE_TEXT.slam}"
      style="left: {thresholdPct(slamMin)}%; transform: translateX(-50%);"
    >{slamMin}</span>
  </div>
</div>
