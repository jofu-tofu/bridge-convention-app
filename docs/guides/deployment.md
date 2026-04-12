# Deployment Guide

Use this guide for release, rollback, and deployment-debugging work. Keep
deployment rationale in `docs/product/product-direction.md`; keep repo-local
asset details in `infra/README.md`.

## When to Read This

- Cutting a release
- Verifying what CI or the release pipeline should do
- Rolling back production
- Figuring out whether a change belongs in repo-local `infra/` files or on the VPS

## Release Workflow

Deploy = tag and push:

```bash
git tag v<version>
git push origin v<version>
```

That triggers the release pipeline:

1. GitHub Actions builds the production web image (`Rust/WASM -> SvelteKit/Vite -> Caddy`)
2. The image is pushed to `ghcr.io/jofu-tofu/bridge-convention-app`
3. The workflow SSHs into the VPS, updates `/opt/bridge-app/docker-compose.yml` to the new tag, pulls, and restarts

## CI vs Release

- `deploy.yml` runs on pushes and pull requests: type-check, unit tests, lint, production build
- `release.yml` runs on `v*` tags: Docker build, GHCR push, VPS deploy

## Production Topology

- Hosting: self-hosted VPS (Netcup)
- Reverse proxy: Caddy
- CDN/DNS/TLS edge: Cloudflare
- Registry: GHCR
- Repo-local deployment assets: `infra/`
- VPS runtime compose file: `/opt/bridge-app/docker-compose.yml`

The important boundary is that `infra/` is the repo's source for Docker/Caddy
assets, but the VPS still runs from its own checked-out compose file under
`/opt/bridge-app/`.

## Rollback

Rollback is manual on the VPS:

1. SSH to the VPS
2. Edit `/opt/bridge-app/docker-compose.yml` to a previous image tag
3. Run:

```bash
docker compose pull
docker compose up -d
```

## Required Secrets

- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`

## Stripe / Billing

### Required Billing Env Vars

Use the same variable names locally and on the VPS; only the values differ.

- `STRIPE_SECRET_KEY`
  Dev: `sk_test_...`
  Prod: `sk_live_...`
- `STRIPE_WEBHOOK_SECRET`
  Dev: `whsec_...` from `stripe listen --forward-to localhost:3001/api/billing/webhook`
  Prod: `whsec_...` from the live webhook endpoint in the Stripe dashboard
- `STRIPE_PRICE_ID_MONTHLY`
  Dev: sandbox monthly `price_...`
  Prod: live monthly `price_...` recreated in live mode
- `STRIPE_PRICE_ID_ANNUAL`
  Dev: sandbox annual `price_...` if annual billing is enabled for testing
  Prod: live annual `price_...` recreated in live mode
- `BILLING_SUCCESS_URL`
  Dev: `http://localhost:1420/billing/success`
  Prod: `https://<your-domain>/billing/success`
- `BILLING_CANCEL_URL`
  Dev: `http://localhost:1420/billing/cancel`
  Prod: `https://<your-domain>/billing/cancel`

The API also reads `CONVENTIONS_FIXTURES_DIR`. In production the image now copies
`crates/bridge-conventions/fixtures` to `/app/fixtures` and sets
`CONVENTIONS_FIXTURES_DIR=/app/fixtures` by default.

### Stripe Dashboard Setup Checklist

Before going live:

1. Activate the Stripe account for live payments.
2. Create the Bridge Lab product in live mode.
3. Create the live monthly and annual prices; copy both live `price_...` IDs into the VPS `.env`.
4. Register the live webhook endpoint pointing at `https://<your-domain>/api/billing/webhook`.
5. Copy the live webhook signing secret into `STRIPE_WEBHOOK_SECRET`.
6. Configure the Stripe Customer Portal so cancel / payment-method updates work without manual support.
7. Set the card statement descriptor before taking live payments.

### How Env Reaches The VPS

The repo does not ship `.env` to the server. The VPS runtime compose file uses
`env_file: ../.env`, so the API container reads `/opt/.env` relative to
`/opt/bridge-app/docker-compose.yml` on the host. Place that file on the VPS
manually and keep it mode `600`.

### Launch-Day Checklist

1. Replace every Stripe test value with the matching live value.
2. Recreate monthly and annual `price_...` IDs in live mode; sandbox price IDs will not work.
3. Update `BILLING_SUCCESS_URL` and `BILLING_CANCEL_URL` to `https://...`.
4. Confirm the webhook endpoint is the live HTTPS URL and the signing secret matches it.
5. Restart the API container after updating `/opt/.env`.

## Where To Look Next

- Deployment rationale and architecture: `docs/product/product-direction.md`
- Repo-local Docker/Caddy assets and local container commands: `infra/README.md`
