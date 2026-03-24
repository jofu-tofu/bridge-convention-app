<script lang="ts">
  import type { Seat, Vulnerability } from "../../../service";
  import DebugSection from "./DebugSection.svelte";

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

<DebugSection title="Deal Info" preview="{conventionName ?? 'None'} | {dealer ?? '\u2014'} | {phase}">
  <div class="text-[10px] grid grid-cols-[auto_1fr] gap-x-2 gap-y-0">
    <span class="text-text-muted">convention</span>
    <span class="text-text-primary">{conventionName ?? "None"} <span class="text-text-muted">({conventionId ?? "\u2014"})</span></span>
    {#if devSeed !== null}
      <span class="text-text-muted">seed</span>
      <span class="text-text-primary">{devSeed}</span>
    {/if}
    <span class="text-text-muted">dealer</span>
    <span class="text-text-primary">{dealer ?? "\u2014"}</span>
    <span class="text-text-muted">vul</span>
    <span class="text-text-primary">{vulnerability ?? "\u2014"}</span>
    <span class="text-text-muted">phase</span>
    <span class="text-text-primary">{phase}</span>
  </div>
</DebugSection>
