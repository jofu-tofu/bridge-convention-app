import type { DataPort, AuthUser } from "../service";

export function createAuthStore(dataPort: DataPort) {
  let user = $state<AuthUser | null>(null);
  let loading = $state(true);

  // Fetch current user on creation (non-blocking)
  dataPort.fetchCurrentUser().then((u) => {
    user = u;
    loading = false;
  }).catch(() => {
    loading = false;
  });

  return {
    get user() { return user; },
    get isLoggedIn() { return user !== null; },
    get loading() { return loading; },

    login(provider: "google") {
      window.location.href = dataPort.getLoginUrl(provider);
    },

    async logout() {
      await dataPort.logout();
      user = null;
    },

    async refresh() {
      user = await dataPort.fetchCurrentUser();
      return user;
    },

    get canDevLogin() { return typeof dataPort.devLogin === "function"; },

    async devLogin() {
      if (!dataPort.devLogin) return;
      await dataPort.devLogin();
      user = await dataPort.fetchCurrentUser();
    },
  };
}
