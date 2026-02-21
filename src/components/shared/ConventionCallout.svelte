<script lang="ts">
  interface Props {
    ruleName: string;
    explanation: string;
  }

  let { ruleName, explanation }: Props = $props();
</script>

<span class="inline-flex items-center gap-2">
  <span class="inline-block px-2 py-0.5 rounded-[--radius-sm] text-xs font-semibold bg-accent-primary-subtle text-accent-primary">
    {ruleName}
  </span>
  <span class="text-text-secondary text-sm">{explanation}</span>
</span>
