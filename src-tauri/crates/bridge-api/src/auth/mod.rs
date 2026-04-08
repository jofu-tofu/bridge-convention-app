pub mod handlers;
pub mod models;
pub mod oauth;
pub mod session;

use axum::routing::{get, post};
use axum::Router;

use crate::AppState;

pub fn auth_routes() -> Router<AppState> {
    Router::new()
        .route("/api/auth/login/{provider}", get(handlers::login_redirect))
        .route("/api/auth/callback/{provider}", get(handlers::oauth_callback))
        .route("/api/auth/logout", post(handlers::logout))
        .route("/api/auth/me", get(handlers::get_me))
}
