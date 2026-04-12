<script lang="ts">
  import type { ReferenceRelatedLink } from "./types";

  interface Props {
    links: readonly ReferenceRelatedLink[];
  }

  let { links }: Props = $props();

  function titleCaseModuleId(moduleId: string): string {
    return moduleId
      .split("-")
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ");
  }
</script>

<section class="root rounded-[--radius-lg] border border-border-default bg-bg-card p-4" aria-labelledby="related-links-heading">
  <h2 id="related-links-heading" class="mb-4 text-[--text-heading] font-semibold text-text-primary">
    Related Conventions
  </h2>

  <ul class="space-y-3">
    {#each links as link (link.moduleId)}
      <li>
        <a
          class="block rounded-[--radius-md] border border-border-subtle bg-bg-base/70 px-4 py-3 text-[--text-body] leading-6 text-text-primary transition-colors hover:border-accent-primary"
          href={`/learn/${link.moduleId}/`}
        >
          <span class="font-semibold">{titleCaseModuleId(link.moduleId)}</span>
          <span class="text-text-muted"> — {link.discriminator}</span>
        </a>
      </li>
    {/each}
  </ul>
</section>

<style>
  @media print {
    .root {
      display: none;
    }
  }
</style>
