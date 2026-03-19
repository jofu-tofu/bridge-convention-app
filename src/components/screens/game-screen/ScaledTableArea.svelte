<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    scale: number;
    origin?: string;
    /** Base table width before scaling (default 800) */
    tableWidth?: number;
    /** Base table height before scaling (default 650) */
    tableHeight?: number;
    children: Snippet;
  }

  let {
    scale,
    origin: _origin = "top left",
    tableWidth = 800,
    tableHeight = 650,
    children,
  }: Props = $props();

  const scaledW = $derived(Math.round(tableWidth * scale));
  const scaledH = $derived(Math.round(tableHeight * scale));
</script>

<div class="flex-1 flex items-center justify-center p-2 min-w-0 min-h-0 overflow-hidden">
  <div
    class="relative"
    style="width: {scaledW}px; max-width: 100%; height: {scaledH}px; max-height: 100%;"
  >
    <div
      class="absolute top-0 left-0"
      style="width: {tableWidth}px; height: {tableHeight}px; transform: scale({scale}); transform-origin: top left; font-size: calc(var(--panel-font, 1rem) / {scale});"
    >
      {@render children()}
    </div>
  </div>
</div>
