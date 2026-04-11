# Stage 1 — cargo-chef: analyze workspace dependencies for caching
FROM rust:1-bookworm AS chef
RUN cargo install cargo-chef && rustup target add wasm32-unknown-unknown
WORKDIR /build
COPY Cargo.toml Cargo.lock ./
COPY crates/ crates/
RUN cargo chef prepare --recipe-path /build/recipe.json

# Stage 2 — cache Rust dependencies (rebuilds only when Cargo.lock changes)
FROM rust:1-bookworm AS rust-deps
RUN cargo install cargo-chef \
    && curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh \
    && rustup target add wasm32-unknown-unknown
COPY --from=chef /build/recipe.json /build/recipe.json
WORKDIR /build
RUN cargo chef cook --release --target wasm32-unknown-unknown -p bridge-wasm --recipe-path /build/recipe.json

# Stage 3 — build WASM package
FROM rust-deps AS wasm-build
COPY Cargo.toml Cargo.lock /build/
COPY crates/ /build/crates/
WORKDIR /build
RUN wasm-pack build crates/bridge-wasm --target web --out-dir pkg

# Stage 4 — Node build (npm ci + vite build)
FROM node:20-slim AS node-build
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY --from=wasm-build /build/crates/bridge-wasm/pkg/ crates/bridge-wasm/pkg/
COPY static/ static/
COPY src/ src/
COPY index.html svelte.config.js vite.config.ts tsconfig.json ./
COPY scripts/ scripts/
COPY content/ content/
RUN npm run dds:ensure && npx vite build && npx tsx scripts/build-guides-html.ts

# Stage 5 — production: serve static files with Caddy
FROM caddy:2-alpine AS production
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=node-build /build/dist/ /srv/
EXPOSE 80
