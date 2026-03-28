<script lang="ts">
  import type { Snippet } from "svelte";

  type Variant = "correct" | "acceptable" | "near-miss" | "incorrect";

  interface Props {
    variant: Variant;
    centered?: boolean;
    children: Snippet;
  }

  const { variant, centered = false, children }: Props = $props();

  // Tailwind JIT purges dynamically built class strings — use complete literal strings.
  const VARIANT_CLASSES: Record<Variant, string> = {
    correct: "border-fb-correct/60 bg-fb-correct-bg/80",
    acceptable: "border-fb-acceptable/60 bg-fb-acceptable-bg/80",
    "near-miss": "border-fb-near-miss/60 bg-fb-near-miss-bg/80",
    incorrect: "border-fb-incorrect/60 bg-fb-incorrect-bg/80",
  };
</script>

<div
  class="rounded-[--radius-md] border-2 {VARIANT_CLASSES[variant]} px-3 py-3 min-w-0 {centered ? 'text-center' : ''}"
  role="alert"
>
  {@render children()}
</div>
