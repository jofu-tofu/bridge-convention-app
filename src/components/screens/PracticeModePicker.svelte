<script lang="ts">
  import type { PracticeMode } from "../../service";

  interface Props {
    conventionName: string;
    onSelect: (mode: PracticeMode) => void;
    onCancel?: () => void;
  }
  let { conventionName, onSelect, onCancel }: Props = $props();

  interface ModeOption {
    mode: PracticeMode;
    title: string;
    description: string;
    isDefault: boolean;
  }

  const modes: ModeOption[] = [
    {
      mode: "decision-drill",
      title: "Decision Drill",
      description: "Jump to the key decision point",
      isDefault: true,
    },
    {
      mode: "full-auction",
      title: "Full Auction",
      description: "Bid the complete auction from the opening",
      isDefault: false,
    },
  ];
</script>

<div class="flex flex-col gap-4 max-w-lg w-full">
  <div>
    <h2 class="text-lg font-semibold text-text-primary">
      Practice {conventionName}
    </h2>
    <p class="text-sm text-text-secondary mt-1">Choose a practice mode.</p>
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    {#each modes as opt (opt.mode)}
      <button
        type="button"
        class="group flex flex-col items-start gap-2 p-4 rounded-[--radius-lg]
          border transition-all cursor-pointer text-left
          border-border-subtle hover:border-accent-primary/40 hover:shadow-md
          bg-bg-card"
        data-testid="mode-{opt.mode}"
        onclick={() => onSelect(opt.mode)}
      >
        <div class="flex items-center gap-2">
          <span class="text-[--text-body] font-semibold text-text-primary group-hover:text-accent-primary transition-colors">
            {opt.title}
          </span>
          {#if opt.isDefault}
            <span class="text-[--text-annotation] px-1.5 py-0.5 rounded-full bg-bg-elevated text-text-muted font-medium">
              Default
            </span>
          {/if}
        </div>
        <p class="text-[--text-detail] text-text-secondary leading-relaxed">
          {opt.description}
        </p>
      </button>
    {/each}
  </div>

  {#if onCancel}
    <button
      type="button"
      class="self-start text-[--text-detail] text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
      data-testid="mode-cancel"
      onclick={onCancel}
    >
      Cancel
    </button>
  {/if}
</div>
