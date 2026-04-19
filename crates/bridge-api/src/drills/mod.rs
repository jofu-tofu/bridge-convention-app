pub mod entitlement;
pub mod handlers;
pub mod models;
pub mod repository;

use axum::routing::{delete, get, post, put};
use axum::Router;

use crate::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/drills", get(handlers::list_drills))
        .route("/api/drills", post(handlers::create_drill))
        .route("/api/drills/{id}", put(handlers::update_drill))
        .route("/api/drills/{id}", delete(handlers::delete_drill))
        .route("/api/drills/{id}/launched", post(handlers::mark_launched))
}
