# Stage 1 — cargo-chef: analyze workspace dependencies for caching
FROM rust:1-bookworm AS chef
RUN cargo install cargo-chef && rustup target add wasm32-unknown-unknown
WORKDIR /build
COPY src-tauri/ src-tauri/
RUN cd src-tauri && cargo chef prepare --recipe-path /build/recipe.json

# Stage 2 — cache Rust dependencies (rebuilds only when Cargo.lock changes)
FROM rust:1-bookworm AS rust-deps
RUN cargo install cargo-chef \
    && curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh \
    && rustup target add wasm32-unknown-unknown
COPY --from=chef /build/recipe.json /build/recipe.json
WORKDIR /build/src-tauri
# IMPORTANT: Use -p bridge-wasm, NOT --workspace. bridge-tauri requires libclang-dev
# (C++ FFI for DDS) and tauri (native-only), neither of which can target wasm32.
# Cooking only bridge-wasm and its transitive deps avoids pulling in those dependencies.
RUN cargo chef cook --release --target wasm32-unknown-unknown -p bridge-wasm --recipe-path /build/recipe.json

# Stage 3 — build WASM package
# Never use `cargo build --workspace` for WASM — wasm-pack isolates feature resolution
# to prevent getrandom/js from bleeding into native builds.
FROM rust-deps AS wasm-build
COPY src-tauri/ /build/src-tauri/
WORKDIR /build/src-tauri
RUN wasm-pack build crates/bridge-wasm --target web --out-dir pkg

# Stage 4 — Node build (npm ci + vite build)
FROM node:20-slim AS node-build
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY --from=wasm-build /build/src-tauri/crates/bridge-wasm/pkg/ src-tauri/crates/bridge-wasm/pkg/
COPY static/ static/
COPY src/ src/
COPY index.html svelte.config.js vite.config.ts tsconfig.json ./
COPY scripts/ensure-dds.sh scripts/ensure-dds.sh
RUN npm run dds:ensure && npx vite build

# Stage 5 — production: serve static files with Caddy
FROM caddy:2-alpine AS production
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=node-build /build/dist/ /srv/
EXPOSE 80
