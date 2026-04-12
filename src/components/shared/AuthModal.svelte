<script lang="ts">
  import { goto } from "$app/navigation";
  import { getAuthStoreOptional } from "../../stores/context";

  const auth = getAuthStoreOptional();

  let dialogRef = $state<HTMLDialogElement>();

  export function open() { dialogRef?.showModal(); }
  export function close() { dialogRef?.close(); }
</script>

<dialog
  bind:this={dialogRef}
  class="m-auto bg-bg-card border border-border-subtle rounded-[--radius-lg] shadow-xl p-0 w-[calc(100%-2rem)] max-w-xs"
  onclick={(e) => { if (e.target === e.currentTarget) close(); }}
  data-testid="auth-modal"
>
  <div class="flex flex-col">
    {#if auth?.isLoggedIn && auth.user}
      <!-- Logged in: account info -->
      <header class="flex items-center justify-between p-4 pb-2 shrink-0">
        <h2 class="text-sm font-semibold text-text-primary">Account</h2>
        <button
          class="min-w-[--size-touch-target] min-h-[--size-touch-target] flex items-center justify-center text-text-secondary hover:text-text-primary cursor-pointer transition-colors rounded-[--radius-md]"
          onclick={close}
          aria-label="Close"
          data-testid="auth-modal-close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </header>
      <div class="px-4 pb-4 space-y-4">
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
        </div>
        <div class="flex flex-col gap-2">
          <button
            class="w-full py-2 rounded-[--radius-md] text-sm font-medium transition-colors cursor-pointer border border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-prominent"
            onclick={() => { void goto("/settings"); close(); }}
            data-testid="auth-modal-settings"
          >
            Go to Settings
          </button>
          <button
            class="w-full py-2 rounded-[--radius-md] text-sm font-medium transition-colors cursor-pointer text-text-muted hover:text-text-primary"
            onclick={async () => { await auth?.logout(); close(); void goto("/"); }}
            data-testid="auth-modal-logout"
          >
            Sign out
          </button>
        </div>
      </div>
    {:else}
      <!-- Logged out: sign in -->
      <header class="flex items-center justify-between p-4 pb-2 shrink-0">
        <h2 class="text-sm font-semibold text-text-primary">Sign in</h2>
        <button
          class="min-w-[--size-touch-target] min-h-[--size-touch-target] flex items-center justify-center text-text-secondary hover:text-text-primary cursor-pointer transition-colors rounded-[--radius-md]"
          onclick={close}
          aria-label="Close"
          data-testid="auth-modal-close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </header>
      <div class="px-4 pb-4 space-y-4">
        <p class="text-sm text-text-secondary">Sign in to sync your progress across devices.</p>
        <div class="flex flex-col gap-2">
          {#if auth?.canDevLogin}
            <button
              class="w-full py-2.5 text-sm font-medium rounded-[--radius-md] bg-accent-primary text-text-on-accent hover:opacity-90 cursor-pointer transition-opacity"
              onclick={async () => { await auth?.devLogin(); close(); }}
              data-testid="auth-modal-dev-login"
            >
              Sign in as Dev User
            </button>
          {/if}
          <button
            class="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-medium rounded-[--radius-md] border border-border-subtle bg-bg-base text-text-primary hover:border-border-prominent cursor-pointer transition-colors"
            onclick={() => auth?.login("google")}
            data-testid="auth-modal-google"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </button>
        </div>
      </div>
    {/if}
  </div>
</dialog>

<style>
  dialog::backdrop {
    background: rgba(0, 0, 0, 0.5);
  }
</style>
