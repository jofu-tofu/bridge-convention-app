mod auth;
mod config;
mod db;
mod error;
mod user;

use axum::routing::get;
use axum::Router;
use sqlx::SqlitePool;
use tower_http::cors::{Any, CorsLayer};

use config::Config;

#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    pub config: Config,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "bridge_api=info".into()),
        )
        .init();

    let config = Config::from_env();
    let pool = db::init_db(&config.database_url).await;

    let state = AppState { pool, config };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/api/health", get(health))
        .merge(auth::auth_routes())
        .layer(cors)
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3001")
        .await
        .expect("failed to bind to port 3001");

    tracing::info!("bridge-api listening on :3001");
    axum::serve(listener, app).await.expect("server error");
}

async fn health() -> &'static str {
    "ok"
}
