<script lang="ts">
  import { ZONE_BG, ZONE_TEXT, ZONE_BORDER, thresholdPct } from "./strength-bar";

  interface Props {
    inviteMin: number;
    gameMin: number;
    slamMin: number;
    inviteMinTp: number;
    gameMinTp: number;
    slamMinTp: number;
    ntLabel: string;
    trumpLabel: string;
  }

  const { inviteMin, gameMin, slamMin, inviteMinTp, gameMinTp, slamMinTp, ntLabel, trumpLabel }: Props = $props();

  // NT zone widths
  const ntWeakPct = $derived(thresholdPct(inviteMin));
  const ntInvitePct = $derived(thresholdPct(gameMin) - thresholdPct(inviteMin));
  const ntGamePct = $derived(thresholdPct(slamMin) - thresholdPct(gameMin));
  const ntSlamPct = $derived(100 - thresholdPct(slamMin));

  // Trump zone widths
  const tpWeakPct = $derived(thresholdPct(inviteMinTp));
  const tpInvitePct = $derived(thresholdPct(gameMinTp) - thresholdPct(inviteMinTp));
  const tpGamePct = $derived(thresholdPct(slamMinTp) - thresholdPct(gameMinTp));
  const tpSlamPct = $derived(100 - thresholdPct(slamMinTp));
</script>

{#snippet bar(weakPct: number, invPct: number, gmPct: number, slPct: number)}
  <div class="flex h-6 rounded-[--radius-md] overflow-hidden border border-border-subtle">
    {#if weakPct > 0}
      <div
        class="flex items-center justify-center text-[10px] font-medium transition-all duration-200 {ZONE_BG.weak} {ZONE_TEXT.weak} border-r {ZONE_BORDER.weak}"
        style="width: {weakPct}%"
      >
        {#if weakPct > 14}Weak{/if}
      </div>
    {/if}
    {#if invPct > 0}
      <div
        class="flex items-center justify-center text-[10px] font-medium transition-all duration-200 {ZONE_BG.invite} {ZONE_TEXT.invite} border-r {ZONE_BORDER.invite}"
        style="width: {invPct}%"
      >
        {#if invPct > 14}Invite{/if}
      </div>
    {/if}
    {#if gmPct > 0}
      <div
        class="flex items-center justify-center text-[10px] font-medium transition-all duration-200 {ZONE_BG.game} {ZONE_TEXT.game} border-r {ZONE_BORDER.game}"
        style="width: {gmPct}%"
      >
        {#if gmPct > 14}Game{/if}
      </div>
    {/if}
    {#if slPct > 0}
      <div
        class="flex items-center justify-center text-[10px] font-medium transition-all duration-200 {ZONE_BG.slam} {ZONE_TEXT.slam}"
        style="width: {slPct}%"
      >
        {#if slPct > 14}Slam{/if}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet thresholds(inv: number, gm: number, sl: number)}
  <div class="relative h-3.5">
    <span
      class="absolute text-[10px] transition-all duration-200 {ZONE_TEXT.invite}"
      style="left: {thresholdPct(inv)}%; transform: translateX(-50%);"
    >{inv}</span>
    <span
      class="absolute text-[10px] transition-all duration-200 {ZONE_TEXT.game}"
      style="left: {thresholdPct(gm)}%; transform: translateX(-50%);"
    >{gm}</span>
    <span
      class="absolute text-[10px] transition-all duration-200 {ZONE_TEXT.slam}"
      style="left: {thresholdPct(sl)}%; transform: translateX(-50%);"
    >{sl}</span>
  </div>
{/snippet}

<div class="grid grid-cols-2 gap-3">
  <div class="space-y-1">
    <p class="text-[10px] font-semibold text-text-muted uppercase tracking-wider">NT <span class="font-normal lowercase">({ntLabel})</span></p>
    {@render bar(ntWeakPct, ntInvitePct, ntGamePct, ntSlamPct)}
    {@render thresholds(inviteMin, gameMin, slamMin)}
  </div>
  <div class="space-y-1">
    <p class="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Trump <span class="font-normal lowercase">({trumpLabel})</span></p>
    {@render bar(tpWeakPct, tpInvitePct, tpGamePct, tpSlamPct)}
    {@render thresholds(inviteMinTp, gameMinTp, slamMinTp)}
  </div>
</div>
