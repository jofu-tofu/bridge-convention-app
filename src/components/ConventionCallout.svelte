<script lang="ts">
  interface Props {
    ruleName: string;
    explanation: string;
  }

  let { ruleName, explanation }: Props = $props();
</script>

<span class="inline-flex items-center gap-2">
  <span class="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-blue-800 text-blue-200">
    {ruleName}
  </span>
  <span class="text-gray-400 text-sm">{explanation}</span>
</span>
