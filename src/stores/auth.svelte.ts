import type { AuthClient, AuthUser } from "../service";

export function createAuthStore(authClient: AuthClient) {
  let user = $state<AuthUser | null>(null);
  let loading = $state(true);

  // Fetch current user on creation (non-blocking)
  authClient.fetchCurrentUser().then((u) => {
    user = u;
    loading = false;
  }).catch(() => {
    loading = false;
  });

  return {
    get user() { return user; },
    get isLoggedIn() { return user !== null; },
    get loading() { return loading; },

    login(provider: "google" | "github") {
      window.location.href = authClient.getLoginUrl(provider);
    },

    async logout() {
      await authClient.logout();
      user = null;
    },
  };
}
