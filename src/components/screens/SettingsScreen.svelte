<script lang="ts">
  import { SubscriptionTier } from "../../service";
  import { getAuthStore } from "../../stores/context";
  import AuthModal from "../shared/AuthModal.svelte";
  import ManageSubscriptionButton from "../shared/ManageSubscriptionButton.svelte";
  import CardSurface from "../shared/CardSurface.svelte";
  import AppScreen from "../shared/AppScreen.svelte";

  const auth = getAuthStore();

  let authModal = $state<ReturnType<typeof AuthModal>>();
</script>

<AppScreen width="form" title="Settings" subtitle="Account and subscription. Practice and drill defaults live on the /practice screen.">
  <div class="space-y-3">
    <CardSurface as="section" class="p-4" testId="account-section">
      <h2 class="text-sm font-semibold text-text-primary mb-3">Account</h2>
      {#if auth.loading}
        <p class="text-sm text-text-muted">Checking login status...</p>
      {:else if auth.isLoggedIn && auth.user}
        <div class="space-y-3">
          <div class="flex items-center gap-3">
            {#if auth.user.avatar_url}
              <img
                src={auth.user.avatar_url}
                alt=""
                class="w-8 h-8 rounded-full"
              />
            {:else}
              <div class="w-8 h-8 rounded-full bg-bg-base border border-border-subtle flex items-center justify-center text-text-muted text-xs font-semibold">
                {auth.user.display_name.charAt(0).toUpperCase()}
              </div>
            {/if}
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-text-primary truncate">{auth.user.display_name}</p>
              {#if auth.user.email}
                <p class="text-xs text-text-muted truncate">{auth.user.email}</p>
              {/if}
            </div>
            <button
              class="text-xs text-text-muted hover:text-text-primary cursor-pointer transition-colors"
              onclick={() => auth.logout()}
              data-testid="logout-button"
            >
              Sign out
            </button>
          </div>

          {#if auth.user.subscription_tier !== SubscriptionTier.Free}
            <ManageSubscriptionButton />
          {/if}
        </div>
      {:else}
        <div class="space-y-3">
          <p class="text-sm text-text-secondary">Sign in to sync your progress across devices.</p>
          <button
            class="px-4 py-2 rounded-[--radius-md] text-sm font-medium bg-accent-primary hover:bg-accent-primary-hover text-text-on-accent cursor-pointer transition-colors"
            onclick={() => authModal?.open()}
            data-testid="settings-login-open"
          >
            Sign in
          </button>
        </div>
      {/if}
    </CardSurface>
  </div>
  <AuthModal bind:this={authModal} />
</AppScreen>
