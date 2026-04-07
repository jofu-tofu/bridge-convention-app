<script lang="ts">
  import { formatPointFormula } from "./profile-display";

  interface Props {
    ntMin: number;
    ntMax: number;
    inviteMin: number;
    inviteMax: number;
    gameMin: number;
    slamMin: number;
    openerNotMin: number;
    inviteMinTp: number;
    inviteMaxTp: number;
    gameMinTp: number;
    slamMinTp: number;
    openerNotMinTp: number;
    majorMinLength: 4 | 5;
    oneNtForcing: string;
    oneNtMin: number;
    oneNtMax: number;
    twoLevelMin: number;
    forcingDuration: string;
    ntShortage: boolean;
    ntLength: boolean;
    trumpShortage: boolean;
    trumpLength: boolean;
    redoubleMin: number;
    dontMinHcp: number;
    dontMaxHcp: number;
    modules: Set<string>;
  }

  const {
    ntMin, ntMax,
    inviteMin, inviteMax, gameMin, slamMin, openerNotMin,
    inviteMinTp, inviteMaxTp, gameMinTp, slamMinTp, openerNotMinTp,
    majorMinLength, oneNtForcing, oneNtMin, oneNtMax,
    twoLevelMin, forcingDuration,
    ntShortage, ntLength, trumpShortage, trumpLength,
    redoubleMin, dontMinHcp, dontMaxHcp,
    modules,
  }: Props = $props();

  // Ladder band positions (percentage from top, 0–40 HCP scale)
  const SCALE_MAX = 40;
  const pct = (v: number) => (1 - v / SCALE_MAX) * 100;

  const inviteBandTop = $derived(pct(inviteMax));
  const inviteBandBottom = $derived(pct(inviteMin));
  const gameBandTop = $derived(pct(SCALE_MAX));
  const gameBandBottom = $derived(pct(gameMin));
  const slamBandTop = $derived(pct(SCALE_MAX));
  const slamBandBottom = $derived(pct(slamMin));
  const openerLine = $derived(pct(openerNotMin));

  // Formula text
  const ntFormula = $derived(formatPointFormula({ includeShortage: ntShortage, includeLength: ntLength }));
  const trumpFormula = $derived(formatPointFormula({ includeShortage: trumpShortage, includeLength: trumpLength }));

  // Response summary labels
  const forcingLabel = $derived(
    oneNtForcing === "forcing" ? "F" :
    oneNtForcing === "semi-forcing" ? "SF" : "NF"
  );
  const durationLabel = $derived(forcingDuration === "game" ? "GF" : "1RF");

  // Module count
  const moduleCount = $derived(modules.size);
</script>

<div class="flex flex-col gap-4 h-full">
  <!-- 1. 1NT Opening badge -->
  <div class="flex justify-center">
    <span
      class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border-2 border-accent-primary/40 bg-accent-primary/5 text-sm font-semibold text-accent-primary transition-all duration-200"
    >
      1NT: {ntMin}–{ntMax} HCP
    </span>
  </div>

  <!-- 2. Strength ladder -->
  <div class="flex-1 min-h-0 flex items-stretch">
    <div class="flex w-full gap-2">
      <!-- HCP labels (left) -->
      <div class="flex flex-col justify-between text-xs text-text-muted w-8 shrink-0 py-1">
        <span>40</span>
        <span>30</span>
        <span>20</span>
        <span>10</span>
        <span>0</span>
      </div>

      <!-- Ladder bar -->
      <div class="relative flex-1 rounded-[--radius-md] bg-bg-base border border-border-subtle overflow-hidden">
        <!-- Grey weak zone (0 to inviteMin) -->
        <div
          class="absolute left-0 right-0 bg-text-muted/10 transition-all duration-200 ease-out"
          style="top: {inviteBandBottom}%; bottom: 0%;"
        ></div>

        <!-- Amber invite band -->
        <div
          class="absolute left-0 right-0 bg-amber-500/25 border-y border-amber-500/40 transition-all duration-200 ease-out"
          style="top: {inviteBandTop}%; bottom: {100 - inviteBandBottom}%;"
        >
          <span class="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-amber-400/80">Invite</span>
        </div>

        <!-- Green game band -->
        <div
          class="absolute left-0 right-0 bg-emerald-500/20 border-y border-emerald-500/40 transition-all duration-200 ease-out"
          style="top: {gameBandTop}%; bottom: {100 - gameBandBottom}%;"
        >
          <span class="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-emerald-400/80">Game</span>
        </div>

        <!-- Blue slam band -->
        <div
          class="absolute left-0 right-0 bg-blue-500/20 border-y border-blue-500/40 transition-all duration-200 ease-out"
          style="top: {slamBandTop}%; bottom: {100 - slamBandBottom}%;"
        >
          <span class="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-blue-400/80">Slam</span>
        </div>

        <!-- Opener not-minimum dashed line -->
        <div
          class="absolute left-0 right-0 border-t-2 border-dashed border-text-muted/50 transition-all duration-200 ease-out"
          style="top: {openerLine}%;"
        >
          <span class="absolute right-2 -top-3.5 text-[10px] text-text-muted">Opener {openerNotMin}+</span>
        </div>

        <!-- HCP threshold labels on left edge -->
        <div
          class="absolute left-2 text-[10px] font-medium text-amber-400 transition-all duration-200 ease-out"
          style="top: {inviteBandTop}%; transform: translateY(-50%);"
        >{inviteMax}</div>
        <div
          class="absolute left-2 text-[10px] font-medium text-amber-400 transition-all duration-200 ease-out"
          style="top: {inviteBandBottom}%; transform: translateY(-50%);"
        >{inviteMin}</div>
        <div
          class="absolute left-2 text-[10px] font-medium text-emerald-400 transition-all duration-200 ease-out"
          style="top: {gameBandBottom}%; transform: translateY(-50%);"
        >{gameMin}</div>
        <div
          class="absolute left-2 text-[10px] font-medium text-blue-400 transition-all duration-200 ease-out"
          style="top: {slamBandBottom}%; transform: translateY(-50%);"
        >{slamMin}</div>
      </div>

      <!-- TP labels (right) -->
      <div class="relative w-14 shrink-0 text-[10px] text-text-muted">
        <div class="absolute transition-all duration-200 ease-out" style="top: {pct(inviteMaxTp)}%; transform: translateY(-50%);">
          {inviteMaxTp} TP
        </div>
        <div class="absolute transition-all duration-200 ease-out" style="top: {pct(inviteMinTp)}%; transform: translateY(-50%);">
          {inviteMinTp} TP
        </div>
        <div class="absolute transition-all duration-200 ease-out" style="top: {pct(gameMinTp)}%; transform: translateY(-50%);">
          {gameMinTp} TP
        </div>
        <div class="absolute transition-all duration-200 ease-out" style="top: {pct(slamMinTp)}%; transform: translateY(-50%);">
          {slamMinTp} TP
        </div>
        <div class="absolute transition-all duration-200 ease-out" style="top: {pct(openerNotMinTp)}%; transform: translateY(-50%);">
          {openerNotMinTp} TP
        </div>
      </div>
    </div>
  </div>

  <!-- 3. Formula pills -->
  <div class="flex gap-2 justify-center flex-wrap">
    <span class="px-2.5 py-1 rounded-full bg-bg-elevated text-xs text-text-secondary border border-border-subtle">
      NT: {ntFormula}
    </span>
    <span class="px-2.5 py-1 rounded-full bg-bg-elevated text-xs text-text-secondary border border-border-subtle">
      Trump: {trumpFormula}
    </span>
  </div>

  <!-- 4. Response summary -->
  <p class="text-xs text-text-muted text-center leading-relaxed">
    {majorMinLength}-card majors · 1NT {forcingLabel} {oneNtMin}–{oneNtMax} · 2-level {twoLevelMin}+ {durationLabel}
  </p>

  <!-- 5. Competitive & module summary -->
  <div class="text-center space-y-1.5">
    <p class="text-xs text-text-muted">
      Rdbl {redoubleMin}+ · DONT {dontMinHcp}–{dontMaxHcp}
    </p>
    <div class="flex justify-center gap-1 flex-wrap">
      {#each Array.from({ length: moduleCount }) as _, i (i)}
        <span class="w-2 h-2 rounded-full bg-accent-primary/70"></span>
      {/each}
    </div>
  </div>
</div>
