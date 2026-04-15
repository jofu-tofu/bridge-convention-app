<script lang="ts">
  import { onMount } from "svelte";

  interface NavSection {
    readonly id: string;
    readonly label: string;
  }

  interface Props {
    sections: readonly NavSection[];
  }

  let { sections }: Props = $props();
  let activeId = $state(sections[0]?.id ?? "");

  onMount(() => {
    if (typeof IntersectionObserver === "undefined" || sections.length === 0) {
      return undefined;
    }

    const ratios = new Map<string, number>();
    const root = document.querySelector<HTMLElement>(".shell-main");
    const targets = sections
      .map((section) => {
        const element = document.getElementById(section.id);
        return element ? { id: section.id, element } : null;
      })
      .filter((item): item is { id: string; element: HTMLElement } => item !== null);

    if (targets.length === 0) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).id;
          ratios.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }

        const next = [...ratios.entries()]
          .filter(([, ratio]) => ratio > 0)
          .sort((a, b) => b[1] - a[1])[0]?.[0];

        if (next) {
          activeId = next;
        }
      },
      {
        root,
        rootMargin: "-15% 0px -55% 0px",
        threshold: [0, 0.2, 0.45, 0.7, 1],
      },
    );

    for (const target of targets) {
      observer.observe(target.element);
    }

    return () => observer.disconnect();
  });
</script>

<nav class="toc" aria-label="On this page">
  <p class="toc-title">On this page</p>
  <ol>
    {#each sections as section (section.id)}
      <li>
        <a
          href={`#${section.id}`}
          aria-current={activeId === section.id ? "true" : undefined}
          class:toc-link-active={activeId === section.id}
          onclick={() => {
            activeId = section.id;
          }}
        >
          {section.label}
        </a>
      </li>
    {/each}
  </ol>
</nav>

<style>
  .toc {
    display: none;
  }

  @media (min-width: 1024px) {
    .toc {
      display: block;
      position: sticky;
      top: 4rem;
      font-size: 0.875rem;
    }
  }

  .toc-title {
    color: var(--color-text-muted);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin: 0 0 0.75rem;
  }

  .toc ol {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .toc a {
    color: var(--color-text-secondary);
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding-left: 0.75rem;
    position: relative;
  }

  .toc a::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 2px;
    border-radius: 9999px;
    background: transparent;
  }

  .toc-link-active,
  .toc a:hover,
  .toc a:focus-visible {
    color: var(--color-text-primary);
  }

  .toc-link-active::before {
    background: var(--color-accent-primary);
  }

  .toc a:hover,
  .toc a:focus-visible {
    text-decoration: underline;
  }
</style>
