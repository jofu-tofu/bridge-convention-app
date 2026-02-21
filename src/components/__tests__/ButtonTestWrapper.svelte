<script lang="ts">
  import Button from "../shared/Button.svelte";

  interface Props {
    variant?: "primary" | "secondary" | "ghost";
    disabled?: boolean;
    onclick?: () => void;
    text?: string;
  }

  let { variant = "primary", disabled = false, onclick, text = "Click me" }: Props = $props();
</script>

<Button {variant} {disabled} {onclick}>{text}</Button>
