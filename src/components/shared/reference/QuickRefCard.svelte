<script lang="ts">
  import SummaryCard from "./SummaryCard.svelte";
  import ResponseTable from "./ResponseTable.svelte";
  import type { ReferenceResponseTable, ReferenceSummaryCard } from "./types";

  interface Props {
    moduleId: string;
    summaryCard: ReferenceSummaryCard;
    responseTable: ReferenceResponseTable;
  }

  let { moduleId, summaryCard, responseTable }: Props = $props();
</script>

<section class="root" aria-label="Printable quick reference">
  <div class="space-y-4">
    <SummaryCard {moduleId} {summaryCard} />
    <ResponseTable {moduleId} {responseTable} />
  </div>
</section>

<style>
  @media screen {
    .root {
      display: none;
    }
  }
</style>
