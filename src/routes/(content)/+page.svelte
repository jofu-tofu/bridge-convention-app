<script lang="ts">
  import { browser } from "$app/environment";
  import { getAuthStoreOptional } from "../../stores/context";
  import AuthModal from "../../components/shared/AuthModal.svelte";
  import LoggedInLanding from "../../components/screens/landing/LoggedInLanding.svelte";

  const auth = browser ? getAuthStoreOptional() : undefined;
  let authModal = $state<ReturnType<typeof AuthModal>>();
  const isLoggedIn = $derived(!!auth?.isLoggedIn);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        url: "https://bridgelab.net/",
        name: "BridgeLab",
      },
      {
        "@type": "Organization",
        url: "https://bridgelab.net/",
        name: "BridgeLab",
        logo: "https://bridgelab.net/brand/logo.svg",
      },
    ],
  };
</script>

<svelte:head>
  <title>Practice any bridge bidding convention — BridgeLab</title>
  <meta
    name="description"
    content="The visual reference manual + practice app for Stayman, Jacoby, Bergen, and everything else."
  />
  <link rel="canonical" href="https://bridgelab.net/" />
  <meta property="og:title" content="Practice any bridge bidding convention — BridgeLab" />
  <meta
    property="og:description"
    content="The visual reference manual + practice app for Stayman, Jacoby, Bergen, and everything else."
  />
  <meta property="og:url" content="https://bridgelab.net/" />
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html `<script type="application/ld+json">${JSON.stringify(jsonLd)}<` + `/script>`}
</svelte:head>

{#if isLoggedIn}
  <LoggedInLanding />
{:else}
<main class="landing">
  <div class="inner">
    <h1>Practice any bridge bidding convention.</h1>
    <p class="sub">
      The visual reference manual + practice app for Stayman, Jacoby, Bergen, and everything else.
    </p>
    <div class="ctas">
      <button type="button" class="cta primary" onclick={() => authModal?.open()}>
        Sign up free
      </button>
      <a class="cta secondary" href="/practice?convention=nt-bundle">Try a hand</a>
    </div>
    <nav class="links" aria-label="Explore">
      <a href="/practice">Practice</a>
      <span aria-hidden="true">·</span>
      <a href="/learn">Visual Reference Manual</a>
      <span aria-hidden="true">·</span>
      <a href="/guides">Guides</a>
    </nav>
  </div>
</main>
{/if}

<AuthModal bind:this={authModal} />

<style>
  .landing {
    display: flex;
    justify-content: center;
    padding: 6rem 0 2rem;
  }
  .inner {
    width: 100%;
    max-width: 640px;
    text-align: center;
  }
  h1 {
    font-size: clamp(2rem, 5vw, 3rem);
    line-height: 1.15;
    color: var(--color-text-primary);
    margin: 0 0 1rem;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .sub {
    font-size: 1.125rem;
    color: var(--color-text-secondary);
    margin: 0 0 2rem;
    line-height: 1.55;
  }
  .ctas {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
    flex-wrap: wrap;
    margin-bottom: 2rem;
  }
  .cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: 1rem;
    text-decoration: none;
    cursor: pointer;
    border: 1px solid transparent;
    font-family: inherit;
    transition: opacity 150ms ease, border-color 150ms ease;
  }
  .cta.primary {
    background: var(--color-accent-primary);
    color: var(--color-text-on-accent);
  }
  .cta.primary:hover,
  .cta.primary:focus-visible {
    opacity: 0.9;
  }
  .cta.secondary {
    background: transparent;
    color: var(--color-text-primary);
    border-color: var(--color-border-subtle);
  }
  .cta.secondary:hover,
  .cta.secondary:focus-visible {
    border-color: var(--color-border-prominent);
  }
  .cta:focus-visible {
    outline: 2px solid var(--color-accent-primary);
    outline-offset: 2px;
  }
  .links {
    display: flex;
    gap: 0.6rem;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
    color: var(--color-text-muted);
    font-size: 0.95rem;
  }
  .links a {
    color: var(--color-text-secondary);
    text-decoration: none;
  }
  .links a:hover,
  .links a:focus-visible {
    color: var(--color-text-primary);
    text-decoration: underline;
  }
  @media (max-width: 520px) {
    .landing {
      padding-top: 3rem;
    }
    .ctas {
      flex-direction: column;
      align-items: stretch;
    }
    .cta {
      width: 100%;
    }
  }
</style>
