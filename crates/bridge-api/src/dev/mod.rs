//! Dev-only routes and Stripe mock. Compiled behind `#[cfg(feature = "dev-tools")]`
//! so the release binary never links these symbols.

use std::sync::Mutex;

use async_trait::async_trait;
use axum::extract::State;
use axum::response::{IntoResponse, Response};
use axum::routing::post;
use axum::{Json, Router};
use axum_extra::extract::cookie::Cookie;
use axum_extra::extract::CookieJar;
use serde::{Deserialize, Serialize};
use stripe::CustomerId;

use crate::auth::session;
use crate::billing::stripe_client::StripeOps;
use crate::error::AppError;
use crate::AppState;

pub fn dev_routes() -> Router<AppState> {
    Router::new().route("/api/dev/login", post(dev_login))
}

#[derive(Deserialize, Default)]
#[serde(default)]
pub struct DevLoginRequest {
    pub id: Option<String>,
    pub email: Option<String>,
    pub display_name: Option<String>,
    pub subscription_status: Option<String>,
    pub subscription_current_period_end: Option<i64>,
    pub stripe_customer_id: Option<String>,
    pub subscription_price_id: Option<String>,
}

#[derive(Serialize)]
struct DevLoginResponse {
    user_id: String,
    session_token: String,
}

/// POST /api/dev/login — upsert a user by id, set subscription fields, mint a
/// session cookie. Never reachable in production: gated by the `dev-tools`
/// feature at compile time.
///
/// `provider = "dev"` on `oauth_identities` ensures a real Google callback
/// (which always writes `provider = "google"`) cannot collide with these rows.
async fn dev_login(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(req): Json<DevLoginRequest>,
) -> Result<(CookieJar, Response), AppError> {
    // Resolve user_id: explicit > existing row keyed by stripe_customer_id > fresh UUID.
    // The stripe_customer_id lookup keeps devLogin idempotent across test runs that
    // reuse the same customer id — otherwise the unique index on users.stripe_customer_id
    // rejects the second insert.
    let user_id = match req.id {
        Some(id) => id,
        None => {
            let existing = match req.stripe_customer_id.as_deref() {
                Some(cus) => {
                    sqlx::query_scalar::<_, String>(
                        "SELECT id FROM users WHERE stripe_customer_id = ?",
                    )
                    .bind(cus)
                    .fetch_optional(&state.pool)
                    .await?
                }
                None => None,
            };
            existing.unwrap_or_else(|| uuid::Uuid::new_v4().to_string())
        }
    };
    let display_name = req.display_name.unwrap_or_else(|| "Dev User".to_string());

    sqlx::query(
        "INSERT INTO users (
            id, display_name, email,
            stripe_customer_id, subscription_status,
            subscription_current_period_end, subscription_price_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
            display_name = excluded.display_name,
            email = excluded.email,
            stripe_customer_id = excluded.stripe_customer_id,
            subscription_status = excluded.subscription_status,
            subscription_current_period_end = excluded.subscription_current_period_end,
            subscription_price_id = excluded.subscription_price_id,
            updated_at = datetime('now')",
    )
    .bind(&user_id)
    .bind(&display_name)
    .bind(&req.email)
    .bind(&req.stripe_customer_id)
    .bind(&req.subscription_status)
    .bind(req.subscription_current_period_end)
    .bind(&req.subscription_price_id)
    .execute(&state.pool)
    .await?;

    let identity_id = uuid::Uuid::new_v4().to_string();
    let provider_user_id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT OR IGNORE INTO oauth_identities (id, user_id, provider, provider_user_id)
         VALUES (?, ?, 'dev', ?)",
    )
    .bind(&identity_id)
    .bind(&user_id)
    .bind(&provider_user_id)
    .execute(&state.pool)
    .await?;

    let token = session::create_session(&state.pool, &user_id).await?;

    let cookie = Cookie::build(("session", token.clone()))
        .http_only(true)
        .secure(true)
        .same_site(axum_extra::extract::cookie::SameSite::Lax)
        .max_age(time::Duration::seconds(2_592_000))
        .path("/")
        .build();

    Ok((
        jar.add(cookie),
        Json(DevLoginResponse {
            user_id,
            session_token: token,
        })
        .into_response(),
    ))
}

/// In-process Stripe mock for the dev-tools binary. Returns deterministic URLs
/// with no network I/O so Playwright can intercept portal/checkout navigations
/// without hitting the real Stripe API.
pub struct InProcessMockStripe {
    next_customer: Mutex<u64>,
}

impl InProcessMockStripe {
    pub fn new() -> Self {
        Self {
            next_customer: Mutex::new(1),
        }
    }
}

impl Default for InProcessMockStripe {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl StripeOps for InProcessMockStripe {
    async fn create_customer(
        &self,
        _user_id: &str,
        _email: Option<&str>,
    ) -> Result<CustomerId, AppError> {
        let mut counter = self.next_customer.lock().expect("mutex poisoned");
        let id = format!("cus_devmock_{:06}", *counter);
        *counter += 1;
        id.parse()
            .map_err(|err| AppError::Internal(format!("mock customer id parse error: {err}")))
    }

    async fn create_checkout_session(
        &self,
        customer_id: &CustomerId,
        price_id: &str,
        _user_id: &str,
        _success_url: &str,
        _cancel_url: &str,
    ) -> Result<String, AppError> {
        Ok(format!(
            "https://dev-stripe.local/checkout/{customer_id}?price={price_id}"
        ))
    }

    async fn create_portal_session(
        &self,
        customer_id: &CustomerId,
        _return_url: &str,
    ) -> Result<String, AppError> {
        Ok(format!("https://dev-stripe.local/portal/{customer_id}"))
    }
}
