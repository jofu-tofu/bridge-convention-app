# Infrastructure

Repo-local deployment assets live here so the project root stays focused on the
app toolchain. For release, rollback, and production workflow details, read
`docs/guides/deployment.md`.

- `Dockerfile.web`: production web image build
- `Dockerfile.api`: production API image build
- `docker-compose.yml`: compose definition for deployed containers
- `Caddyfile`: web server config mounted by compose and copied into the web image

Build context remains the repo root. Example commands:

```bash
docker build -f infra/Dockerfile.web .
docker build -f infra/Dockerfile.api .
docker compose -f infra/docker-compose.yml up
```
