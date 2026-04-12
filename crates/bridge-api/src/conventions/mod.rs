pub mod handlers;

use axum::routing::get;
use axum::Router;

use crate::AppState;

pub fn conventions_routes() -> Router<AppState> {
    Router::new().route(
        "/api/conventions/{bundle_id}/definition",
        get(handlers::get_definition),
    )
}
