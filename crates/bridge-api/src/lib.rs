pub mod auth;
pub mod billing;
pub mod config;
pub mod conventions;
pub mod db;
#[cfg(feature = "dev-tools")]
pub mod dev;
pub mod drills;
pub mod error;
pub mod test_support;
pub mod user;

use std::sync::Arc;

use axum::http::{header, HeaderValue, Method};
use axum::routing::get;
use axum::Router;
use sqlx::SqlitePool;
use tower_http::cors::{AllowOrigin, CorsLayer};

#[cfg(not(feature = "dev-tools"))]
use billing::stripe_client::LiveStripeOps;
use billing::stripe_client::StripeOps;
use config::Config;

#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    pub config: Config,
    pub stripe: Arc<dyn StripeOps>,
}

impl AppState {
    pub fn new(pool: SqlitePool, config: Config) -> Self {
        #[cfg(feature = "dev-tools")]
        let stripe: Arc<dyn StripeOps> = Arc::new(dev::InProcessMockStripe::new());
        #[cfg(not(feature = "dev-tools"))]
        let stripe: Arc<dyn StripeOps> = Arc::new(LiveStripeOps::new(&config.stripe_secret_key));
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
    let origins: Vec<HeaderValue> = state
        .config
        .cors_allowed_origins
        .iter()
        .filter_map(|origin| HeaderValue::from_str(origin).ok())
        .collect();

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_credentials(true)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([header::CONTENT_TYPE, header::COOKIE, header::AUTHORIZATION]);

    let router = Router::new()
        .route("/api/health", get(health))
        .merge(auth::auth_routes())
        .merge(billing::billing_routes())
        .merge(conventions::conventions_routes())
        .merge(drills::routes());

    #[cfg(feature = "dev-tools")]
    let router = router.merge(dev::dev_routes());

    router.layer(cors).with_state(state)
}

async fn health() -> &'static str {
    "ok"
}
