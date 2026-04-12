pub mod entitlements;
pub mod handlers;
pub mod stripe_client;

use axum::routing::post;
use axum::Router;

use crate::AppState;

pub fn billing_routes() -> Router<AppState> {
    Router::new()
        .route("/api/billing/checkout", post(handlers::create_checkout))
        .route("/api/billing/portal", post(handlers::create_portal))
        .route("/api/billing/webhook", post(handlers::handle_webhook))
}
