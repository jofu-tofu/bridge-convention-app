<script lang="ts">
  import type { FlowChartEdge } from "./flow-chart-types";

  interface Props {
    edge: FlowChartEdge;
    highlighted: boolean;
  }

  let { edge, highlighted }: Props = $props();
</script>

<path
  d={edge.path}
  fill="none"
  stroke={highlighted ? "var(--color-accent-primary)" : "var(--color-border-default)"}
  stroke-width={highlighted ? 2 : 1.5}
  stroke-opacity={highlighted ? 1 : 0.6}
/>
