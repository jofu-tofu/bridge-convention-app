<svelte:head>
  <title>BridgeLab — Practice bridge bidding conventions</title>
  <meta
    name="description"
    content="Drill Stayman, Jacoby Transfers, Bergen Raises and more. Play real hands, review every bid, and build a bidding system that's actually yours."
  />
  <link rel="canonical" href="https://bridgelab.net/" />
  <meta property="og:title" content="BridgeLab — Practice bridge bidding conventions" />
  <meta
    property="og:description"
    content="Drill bidding conventions with deterministic practice hands and instant per-bid feedback."
  />
  <meta property="og:url" content="https://bridgelab.net/" />
</svelte:head>

<section class="hero">
  <h1>Learn bridge bidding by playing.</h1>
  <p class="lede">
    Drill conventions, review every bid, and build a bidding system that's actually yours.
  </p>
  <a class="cta" href="/practice">Start practicing</a>
</section>

<section class="value-props">
  <article>
    <h2>Practice</h2>
    <p>
      Randomised hands that target the decisions you're learning. Every bid gets feedback against
      the convention you picked.
    </p>
    <a href="/practice">Open the practice picker →</a>
  </article>
  <article>
    <h2>Learn</h2>
    <p>
      Short, self-contained modules for each convention — Stayman, Jacoby Transfers, Bergen Raises,
      Michaels, and more.
    </p>
    <a href="/learn">Browse learning modules →</a>
  </article>
  <article>
    <h2>Guides</h2>
    <p>Essays and explainers on bidding theory, convention design, and how to study bridge.</p>
    <a href="/guides">Read the guides →</a>
  </article>
</section>

<style>
  .hero {
    padding: 4rem 0 3rem;
    text-align: center;
  }
  .hero h1 {
    font-size: clamp(2.25rem, 5vw, 3.5rem);
    color: var(--color-text-primary);
    margin: 0 0 1rem;
    line-height: 1.1;
  }
  .lede {
    font-size: 1.25rem;
    max-width: 640px;
    margin: 0 auto 2rem;
    color: var(--color-text-secondary);
  }
  .cta {
    display: inline-block;
    padding: 0.9rem 1.75rem;
    border-radius: 0.5rem;
    background: var(--color-accent-primary);
    color: var(--color-text-on-accent);
    font-weight: 600;
    text-decoration: none;
  }
  .cta:hover {
    opacity: 0.9;
  }
  .value-props {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1.5rem;
    margin-top: 2rem;
  }
  .value-props article {
    padding: 1.5rem;
    border: 1px solid var(--color-border-muted, rgba(148, 163, 184, 0.2));
    border-radius: 0.75rem;
    background: var(--color-bg-elevated, rgba(15, 23, 42, 0.4));
  }
  .value-props h2 {
    margin: 0 0 0.5rem;
    color: var(--color-text-primary);
    font-size: 1.25rem;
  }
  .value-props a {
    color: var(--color-accent-primary);
    text-decoration: none;
  }
</style>
