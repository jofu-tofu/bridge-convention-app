<script lang="ts">
  import ContentScreen from "../../../components/shared/ContentScreen.svelte";
  import { MODULE_CATEGORIES } from "../../../components/shared/module-catalog";
  import { SITE_URL } from "../seo";
  import type { LearnSidebarModule } from "./+layout.server";

  const { data } = $props();
  const modules: LearnSidebarModule[] = data.sidebarModules;
  const total = modules.length;

  const pageUrl = `${SITE_URL}/learn/`;
  const description =
    "Learn bridge bidding conventions — Stayman, Jacoby Transfers, Bergen Raises, DONT, and more.";

  const CATEGORY_BLURBS: Record<string, string> = {
    "Opening Bids": "How to start the auction — standard opens and strong forcing bids.",
    "Notrump Responses": "Structured systems over 1NT and 2NT: Stayman, transfers, Smolen.",
    "Major Raises": "Constructive and invitational raises of partner's major.",
    "Responder Rebids": "Follow-ups after partner opens and responder describes further.",
    "Weak Bids": "Preempts and obstructive openings that use up opponents' bidding room.",
    "Competitive": "Overcalling, interfering, and defending against interference.",
    "Slam": "Ace- and king-asking machinery for slam bidding.",
    "Other": "Additional conventions.",
  };

  const CATEGORY_ORDER = [
    "Opening Bids",
    "Notrump Responses",
    "Major Raises",
    "Responder Rebids",
    "Weak Bids",
    "Competitive",
    "Slam",
    "Other",
  ];

  type Group = { category: string; blurb: string; modules: LearnSidebarModule[] };

  const groups: Group[] = (() => {
    const byCat = new Map<string, LearnSidebarModule[]>();
    for (const m of modules) {
      const cat = MODULE_CATEGORIES[m.moduleId] ?? "Other";
      const list = byCat.get(cat);
      if (list) list.push(m);
      else byCat.set(cat, [m]);
    }
    const result: Group[] = [];
    for (const cat of CATEGORY_ORDER) {
      const list = byCat.get(cat);
      if (list && list.length > 0) {
        result.push({ category: cat, blurb: CATEGORY_BLURBS[cat] ?? "", modules: list });
      }
    }
    for (const [cat, list] of byCat) {
      if (!CATEGORY_ORDER.includes(cat)) {
        result.push({ category: cat, blurb: CATEGORY_BLURBS[cat] ?? "", modules: list });
      }
    }
    return result;
  })();
</script>

<svelte:head>
  <title>Learn Bridge Conventions | BridgeLab</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={pageUrl} />
  <meta property="og:title" content="Learn Bridge Conventions — BridgeLab" />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={pageUrl} />
</svelte:head>

<ContentScreen
  title="Learn Bridge Conventions"
  subtitle="Browse {total} conventions by category, or jump into structured study material."
>
  <section class="section-links">
    <a href="/lessons/">
      <strong>Lessons</strong>
      <span>Short guided walkthroughs that teach one convention at a time.</span>
    </a>
    <a href="/systems/">
      <strong>Bidding Systems</strong>
      <span>Side-by-side reference for SAYC, 2/1, and Acol.</span>
    </a>
  </section>

  <section class="practice-cta">
    <p><strong>Ready to practice?</strong> Drill bridge conventions with instant feedback.</p>
    <a class="cta-button" href="/practice">Go to practice</a>
  </section>

  <p class="hint">
    Looking for a specific convention? Use the search bar in the sidebar.
  </p>

  {#each groups as group (group.category)}
    <section class="category">
      <header>
        <h2>{group.category}</h2>
        {#if group.blurb}<p>{group.blurb}</p>{/if}
      </header>
      <ul>
        {#each group.modules as mod (mod.moduleId)}
          <li><a href="/learn/{mod.moduleId}/">{mod.displayName}</a></li>
        {/each}
      </ul>
    </section>
  {/each}
</ContentScreen>

<style>
  .section-links {
    margin: 0 0 1.5rem;
    display: grid;
    gap: 0.75rem;
  }

  @media (min-width: 640px) {
    .section-links {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .section-links a {
    display: block;
    padding: 1rem 1.25rem;
    background: var(--color-bg-elevated, #141b2d);
    border: 1px solid var(--color-border-default, #1e293b);
    border-radius: 10px;
    text-decoration: none;
  }

  .section-links a:hover {
    border-color: var(--color-accent-primary, #38bdf8);
  }

  .section-links strong {
    display: block;
    color: var(--color-text-primary, #e8edf5);
    font-size: 1rem;
    margin-bottom: 0.25rem;
  }

  .section-links span {
    display: block;
    color: var(--color-text-muted, #64748b);
    font-size: 0.875rem;
  }

  .practice-cta {
    margin: 0 0 2rem;
    padding: 1.25rem 1.5rem;
    background: var(--color-bg-elevated, #141b2d);
    border: 1px solid var(--color-border-default, #1e293b);
    border-radius: 12px;
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1rem;
    align-items: center;
    justify-content: space-between;
  }

  .practice-cta p { margin: 0; font-size: 0.9375rem; }
  .practice-cta strong { color: var(--color-text-primary, #e8edf5); }

  .cta-button {
    display: inline-block;
    background: var(--color-accent-primary, #38bdf8);
    color: #0a0f1a;
    font-weight: 600;
    font-size: 0.875rem;
    padding: 0.5rem 1.25rem;
    border-radius: 8px;
    text-decoration: none;
  }

  .hint {
    margin: 0 0 2rem;
    font-size: 0.8125rem;
    color: var(--color-text-muted, #64748b);
  }

  .category {
    margin: 0 0 1.75rem;
  }

  .category header {
    margin-bottom: 0.75rem;
  }

  .category h2 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text-primary, #e8edf5);
    margin: 0 0 0.25rem;
  }

  .category header p {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-text-muted, #64748b);
  }

  .category ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .category a {
    display: inline-block;
    padding: 0.375rem 0.75rem;
    background: var(--color-bg-elevated, #141b2d);
    border: 1px solid var(--color-border-default, #1e293b);
    border-radius: 999px;
    color: var(--color-text-primary, #e8edf5);
    font-size: 0.875rem;
    text-decoration: none;
  }

  .category a:hover {
    border-color: var(--color-accent-primary, #38bdf8);
    color: var(--color-accent-primary, #38bdf8);
  }
</style>
