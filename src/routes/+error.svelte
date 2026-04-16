<script lang="ts">
  import { page } from "$app/state";
</script>

<div class="error-page">
  <h1>{page.status}</h1>
  <p>{page.error?.message ?? "Page not found"}</p>
  <a href="/">Back to home</a>
</div>

<style>
  .error-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background: #0b1018;
    color: #e8edf4;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    gap: 1rem;
  }

  h1 {
    font-size: 3rem;
    font-weight: 700;
  }

  p {
    color: #8fa3bd;
    font-size: 1rem;
  }

  a {
    color: var(--color-accent-primary);
    text-decoration: none;
    font-size: 0.875rem;
    transition: color 0.15s ease;
  }

  a:hover {
    color: var(--color-accent-primary-hover);
    text-decoration: underline;
  }
</style>
