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

## Where To Look Next

- Deployment rationale and architecture: `docs/product/product-direction.md`
- Repo-local Docker/Caddy assets and local container commands: `infra/README.md`
