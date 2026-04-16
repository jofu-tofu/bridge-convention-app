# Infrastructure

Repo-local deployment assets live here so the project root stays focused on the
app toolchain. For release, rollback, and production workflow details, read
`docs/guides/deployment.md`.

- `Dockerfile.web`: production web image build
- `Dockerfile.api`: production API image build
- `docker-compose.yml`: compose definition for deployed containers (pulls published images)
- `docker-compose.local.yml`: **local-staging** override — builds images from source, uses `Caddyfile.local` + `.env.staging` for running the full prod stack against Stripe test mode and a dev Google OAuth client
- `Caddyfile`: web server config mounted by compose and copied into the web image (production hostname)
- `Caddyfile.local`: local-staging web config — serves `https://localhost` with Caddy's internal CA
- `.env.staging.example`: template for `.env.staging`; real secrets go in `.env.staging` (git-ignored)

Build context remains the repo root. Example commands:

```bash
# Production images
docker build -f infra/Dockerfile.web .
docker build -f infra/Dockerfile.api .
docker compose -f infra/docker-compose.yml up

# Local staging (build from source + test-mode secrets)
cp infra/.env.staging.example infra/.env.staging  # fill in Google/Stripe test keys
docker compose -f infra/docker-compose.local.yml up --build
```

See `docs/guides/local-staging.md` for the full setup + 5-minute manual smoke that validates real Google OAuth + Stripe checkout + webhook signatures — the gaps the Playwright billing suite cannot cover.
