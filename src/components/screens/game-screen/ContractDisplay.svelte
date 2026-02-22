<script lang="ts">
  import type { Contract } from "../../../engine/types";
  import { STRAIN_SYMBOLS } from "../../../lib/format";

  interface Props {
    contract: Contract;
    /** Size variant for the contract text */
    size?: "sm" | "md" | "lg";
  }

  let { contract, size = "md" }: Props = $props();

  const textSize = $derived(
    size === "sm" ? "text-sm" : size === "lg" ? "text-lg" : "text-base",
  );
</script>

<p class="{textSize} font-mono text-text-primary">
  {contract.level}{STRAIN_SYMBOLS[contract.strain]}{contract.doubled
    ? " X"
    : ""}{contract.redoubled ? " XX" : ""}
  by {contract.declarer}
</p>
