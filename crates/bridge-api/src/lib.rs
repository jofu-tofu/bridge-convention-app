pub mod auth;
pub mod billing;
pub mod config;
pub mod conventions;
pub mod db;
pub mod error;
pub mod test_support;
pub mod user;

use std::sync::Arc;

use axum::routing::get;
use axum::Router;
use sqlx::SqlitePool;
use tower_http::cors::{Any, CorsLayer};

use billing::stripe_client::{LiveStripeOps, StripeOps};
use config::Config;

#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    pub config: Config,
    pub stripe: Arc<dyn StripeOps>,
}

impl AppState {
    pub fn new(pool: SqlitePool, config: Config) -> Self {
        let stripe = Arc::new(LiveStripeOps::new(&config.stripe_secret_key));
        Self {
            pool,
            config,
            stripe,
        }
    }

    pub fn new_with_stripe(pool: SqlitePool, config: Config, stripe: Arc<dyn StripeOps>) -> Self {
        Self {
            pool,
            config,
            stripe,
        }
    }
}

pub fn app(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/api/health", get(health))
        .merge(auth::auth_routes())
        .merge(billing::billing_routes())
        .merge(conventions::conventions_routes())
        .layer(cors)
        .with_state(state)
}

async fn health() -> &'static str {
    "ok"
}
