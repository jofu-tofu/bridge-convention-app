# Local Staging (Docker)

Run the real production container stack locally with Stripe test mode and a dev Google OAuth client. This is what you use instead of a deployed staging environment to validate auth + billing flows that the Playwright billing suite can't cover (real Google consent screen, real Stripe Checkout, real webhook signature verification).

## What this validates that `npm run test:e2e` does not

- Real Google OAuth redirect + state/PKCE + first-login user row creation
- Real Stripe Checkout session creation with live price IDs
- Real Stripe webhook signature verification (`STRIPE_WEBHOOK_SECRET` path, not the dev-tools mock)
- Container build: Dockerfile regressions, env-var wiring, Caddy routing
- Session cookies under HTTPS + real domain scope

## One-time setup

1. **Google OAuth test client.** Google Cloud Console → APIs & Services → Credentials → Create OAuth 2.0 client. Authorized redirect URI: `https://localhost/api/auth/callback/google`. Copy client id and secret.

2. **Stripe test mode keys.** Stripe Dashboard in test mode → Developers → API keys. Grab `sk_test_...`. Under Products, pick the monthly subscription price id (`price_...`).

3. **Stripe CLI** (one-time install): `brew install stripe/stripe-cli/stripe` or equivalent. Run `stripe login` once.

4. **Copy env template and fill in secrets:**

   ```bash
   cp infra/.env.staging.example infra/.env.staging
   # edit infra/.env.staging with values from steps 1–2
   ```

   `STRIPE_WEBHOOK_SECRET` comes from step 6 below.

5. **Trust Caddy's local CA once** so `https://localhost` doesn't show a cert warning:

   ```bash
   docker compose -f infra/docker-compose.local.yml up web
   # first start: Caddy generates an internal CA inside the container volume
   # copy the root cert out and trust it:
   docker compose -f infra/docker-compose.local.yml exec web cat /data/caddy/pki/authorities/local/root.crt \
     | sudo tee /usr/local/share/ca-certificates/caddy-local.crt
   sudo update-ca-certificates
   ```

   (macOS: add the cert to Keychain instead.) You can also just click past the browser warning — the flow still works.

## Running the stack

```bash
# Build images from current source and start the stack:
docker compose -f infra/docker-compose.local.yml up --build

# In another terminal, forward Stripe test-mode webhooks:
stripe listen --forward-to https://localhost/api/billing/webhook --skip-verify
# Copy the whsec_... it prints into STRIPE_WEBHOOK_SECRET in infra/.env.staging,
# then restart the api container so it picks up the secret.
```

Visit `https://localhost` — prod Caddy + prerendered SvelteKit + real bridge-api.

## 5-minute manual smoke

1. **Fresh sign-in.** Incognito → `https://localhost` → click Sign in → Google consent screen → redirected back signed in. Expect `GET /api/auth/me` returns a user with `subscription_tier: "free"`.
2. **Paywall.** Open a paid bundle. Expect paywall overlay.
3. **Checkout.** Click Subscribe → redirected to Stripe Checkout (test mode, real URL) → use card `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP → redirected to `/billing/success`.
4. **Tier flip.** `GET /api/auth/me` now returns `subscription_tier: "paid"`. Stripe CLI terminal shows webhook events forwarded and `200 OK` responses (signature verified).
5. **Portal + cancel.** Settings → Account → Manage subscription → cancel in portal → return to app. Tier stays paid until period end; the `customer.subscription.deleted` webhook fires and is accepted.

If any step fails, the Docker stack caught a real-environment bug the Playwright billing suite cannot reach.

## Tear down

```bash
docker compose -f infra/docker-compose.local.yml down -v
```

`-v` wipes the SQLite volume so the next run starts with a clean user table.

## Future work: containerized e2e target

The Playwright billing + auth specs today target the raw `bridge-api` dev-tools binary on `:3001` and Vite dev server on `:1420`. A natural next step is a second Playwright project that targets `https://localhost` against this docker stack — catches the same build regressions as the manual smoke but automated. Blockers:

- Needs a `/api/dev/login` equivalent available in the local-staging build, or test-specific auth fixtures injected via Stripe CLI webhook triggers
- Needs the local TLS cert trusted in the Playwright browser context (`ignoreHTTPSErrors: true`)

Not worth building until real OAuth/Stripe-path regressions show up — the manual smoke catches those today.
