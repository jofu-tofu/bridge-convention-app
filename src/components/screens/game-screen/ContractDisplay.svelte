<script lang="ts">
  import type { Contract } from "../../../engine/types";
  import { formatContractWithDeclarer } from "../../../service/display/format";

  interface Props {
    contract: Contract;
    /** Size variant for the contract text */
    size?: "sm" | "md" | "lg";
  }

  let { contract, size = "md" }: Props = $props();

  const textSize = $derived(
    size === "sm" ? "text-[--text-detail]" : size === "lg" ? "text-[--text-value]" : "text-[--text-body]",
  );
</script>

<p class="{textSize} font-mono text-text-primary">
  {formatContractWithDeclarer(contract)}
</p>
