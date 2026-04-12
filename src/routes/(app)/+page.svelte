<script lang="ts">
  import { getAuthStoreOptional } from "../../stores/context";

  const auth = getAuthStoreOptional();
  const isLoggedIn = $derived(auth?.isLoggedIn ?? false);
</script>

<section class="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-20 text-center">
  <h1 class="text-4xl font-bold text-text-primary">
    {isLoggedIn ? "Welcome back" : "Learn bridge bidding by playing"}
  </h1>
  <p class="text-text-secondary">
    {isLoggedIn
      ? "Pick up where you left off or start a new practice session."
      : "Drill conventions, review every bid, and build a bidding system that's actually yours."}
  </p>
  <a
    href="/practice"
    class="rounded-md bg-accent-primary px-6 py-3 font-semibold text-text-on-accent no-underline hover:opacity-90"
  >
    {isLoggedIn ? "Continue practicing" : "Start practicing"}
  </a>
</section>
