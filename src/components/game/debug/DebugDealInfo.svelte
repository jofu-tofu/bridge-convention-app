<script lang="ts">
  import type { Seat, Vulnerability } from "../../../engine/types";

  interface Props {
    conventionName: string | null;
    conventionId: string | null;
    devSeed: number | null;
    dealer: Seat | undefined;
    vulnerability: Vulnerability | undefined;
    phase: string;
  }

  let { conventionName, conventionId, devSeed, dealer, vulnerability, phase }: Props = $props();
</script>

<details>
  <summary class="text-text-primary font-semibold text-sm cursor-pointer py-1">Deal Info</summary>
  <div class="pl-2 py-1 flex flex-col gap-0.5">
    <div>
      Convention: <span class="text-text-primary">{conventionName ?? "None"}</span>
      <span class="text-text-muted">({conventionId ?? "\u2014"})</span>
    </div>
    {#if devSeed !== null}
      <div>Seed: <span class="text-text-primary">{devSeed}</span></div>
    {/if}
    <div>Dealer: <span class="text-text-primary">{dealer ?? "\u2014"}</span></div>
    <div>Vulnerability: <span class="text-text-primary">{vulnerability ?? "\u2014"}</span></div>
    <div>Phase: <span class="text-text-primary">{phase}</span></div>
  </div>
</details>
