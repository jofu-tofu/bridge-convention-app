<script lang="ts">
  interface Props {
    size?: "sm" | "md";
  }

  const { size = "sm" }: Props = $props();

  const sizeClass = size === "md" ? "w-5 h-5" : "w-4 h-4";
</script>

<span
  class="inline-block {sizeClass} border-2 border-current border-t-transparent rounded-full animate-spin"
  aria-hidden="true"
></span>
