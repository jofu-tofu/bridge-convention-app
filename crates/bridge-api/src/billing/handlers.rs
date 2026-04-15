use axum::body::Bytes;
use axum::extract::rejection::JsonRejection;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use axum_extra::extract::CookieJar;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::FromRow;

use crate::auth::models::User;
use crate::auth::session;
use crate::error::AppError;
use crate::AppState;

use super::stripe_client;

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
enum BillingPlan {
    Monthly,
    Annual,
}

#[derive(Deserialize)]
pub struct CheckoutRequest {
    plan: BillingPlan,
}

#[derive(Serialize)]
struct UrlResponse {
    url: String,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: &'static str,
}

#[derive(FromRow)]
struct StripeEventState {
    last_stripe_event_created: Option<i64>,
}

pub async fn create_checkout(
    State(state): State<AppState>,
    jar: CookieJar,
    request: Result<Json<CheckoutRequest>, JsonRejection>,
) -> Result<Response, AppError> {
    let user = current_user(&state, &jar).await?;
    let Json(request) = request.map_err(|_| AppError::BadRequest("invalid_request".to_string()))?;
    let customer_id = ensure_customer_id(&state, &user).await?;
    let price_id = match request.plan {
        BillingPlan::Monthly => state.config.stripe_price_id_monthly.as_str(),
        BillingPlan::Annual => state.config.stripe_price_id_annual.as_str(),
    };

    let url = state
        .stripe
        .create_checkout_session(
            &customer_id,
            price_id,
            &user.id,
            &state.config.billing_success_url,
            &state.config.billing_cancel_url,
        )
        .await?;

    Ok(Json(UrlResponse { url }).into_response())
}

pub async fn create_portal(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Response, AppError> {
    let user = current_user(&state, &jar).await?;
    let customer_id = match user.stripe_customer_id.as_deref() {
        Some(customer_id) => parse_customer_id(customer_id)?,
        None => {
            return Ok((
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: "no_subscription",
                }),
            )
                .into_response())
        }
    };

    let url = state
        .stripe
        .create_portal_session(&customer_id, &state.config.billing_cancel_url)
        .await?;

    Ok(Json(UrlResponse { url }).into_response())
}

pub async fn handle_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Response, AppError> {
    let signature = match headers
        .get("Stripe-Signature")
        .and_then(|value| value.to_str().ok())
    {
        Some(signature) => signature,
        None => return Ok(StatusCode::BAD_REQUEST.into_response()),
    };

    let event = match stripe_client::verify_webhook(
        &body,
        signature,
        &state.config.stripe_webhook_secret,
    ) {
        Ok(event) => event,
        Err(err) => {
            tracing::warn!("stripe webhook verification failed: {err}");
            return Ok(StatusCode::BAD_REQUEST.into_response());
        }
    };

    // Event-ID dedup: Stripe retries webhooks; the HMAC replay window alone
    // does not stop a captured event from being re-delivered later. A unique
    // insert on event.id gives true idempotency independent of `created`.
    let insert = sqlx::query("INSERT OR IGNORE INTO stripe_events (id) VALUES (?)")
        .bind(&event.id)
        .execute(&state.pool)
        .await?;

    if insert.rows_affected() == 0 {
        tracing::debug!(event_id = %event.id, "stripe webhook already processed; skipping");
        return Ok(StatusCode::OK.into_response());
    }

    process_webhook_event(&state, event).await?;

    Ok(StatusCode::OK.into_response())
}

async fn process_webhook_event(
    state: &AppState,
    event: stripe_client::VerifiedEvent,
) -> Result<(), AppError> {
    let stripe_client::VerifiedEvent {
        type_,
        created,
        data_object,
        ..
    } = event;

    match type_.as_str() {
        "checkout.session.completed" => {
            let Some(user_id) = data_object
                .get("client_reference_id")
                .and_then(Value::as_str)
            else {
                warn_missing_webhook_field(type_.as_str(), "client_reference_id");
                return Ok(());
            };
            let Some(customer_id) = extract_string_id(&data_object, "customer") else {
                warn_missing_webhook_field(type_.as_str(), "customer");
                return Ok(());
            };

            backfill_checkout_customer(state, user_id, customer_id).await?;
        }
        "customer.subscription.created" | "customer.subscription.updated" => {
            let Some(customer_id) = extract_string_id(&data_object, "customer") else {
                warn_missing_webhook_field(type_.as_str(), "customer");
                return Ok(());
            };
            let Some(status) = data_object.get("status").and_then(Value::as_str) else {
                warn_missing_webhook_field(type_.as_str(), "status");
                return Ok(());
            };
            let Some(period_end) = extract_current_period_end(&data_object) else {
                warn_missing_webhook_field(type_.as_str(), "current_period_end");
                return Ok(());
            };
            let Some(price_id) = extract_price_id(&data_object) else {
                warn_missing_webhook_field(type_.as_str(), "items.data[0].price.id");
                return Ok(());
            };

            apply_subscription_update(
                state,
                created,
                customer_id,
                status,
                period_end,
                Some(price_id),
            )
            .await?;
        }
        "customer.subscription.deleted" => {
            let Some(customer_id) = extract_string_id(&data_object, "customer") else {
                warn_missing_webhook_field(type_.as_str(), "customer");
                return Ok(());
            };

            apply_subscription_deleted(state, created, customer_id).await?;
        }
        "invoice.payment_failed" => {
            let customer_id = extract_string_id(&data_object, "customer");
            tracing::warn!(customer_id, "stripe invoice payment failed");
        }
        other => {
            tracing::debug!(event_type = other, "ignoring stripe webhook event");
        }
    }

    Ok(())
}

async fn current_user(state: &AppState, jar: &CookieJar) -> Result<User, AppError> {
    let token = jar
        .get("session")
        .map(|cookie| cookie.value().to_string())
        .ok_or(AppError::Unauthorized)?;

    session::lookup_session(&state.pool, &token)
        .await?
        .ok_or(AppError::Unauthorized)
}

async fn ensure_customer_id(state: &AppState, user: &User) -> Result<stripe::CustomerId, AppError> {
    if let Some(customer_id) = user.stripe_customer_id.as_deref() {
        return parse_customer_id(customer_id);
    }

    let customer_id = state
        .stripe
        .create_customer(&user.id, user.email.as_deref())
        .await?;

    sqlx::query(
        "UPDATE users
         SET stripe_customer_id = ?, updated_at = datetime('now')
         WHERE id = ?",
    )
    .bind(customer_id.as_str())
    .bind(&user.id)
    .execute(&state.pool)
    .await?;

    Ok(customer_id)
}

async fn backfill_checkout_customer(
    state: &AppState,
    user_id: &str,
    customer_id: &str,
) -> Result<(), AppError> {
    let result = sqlx::query(
        "UPDATE users
         SET stripe_customer_id = ?, updated_at = datetime('now')
         WHERE id = ? AND stripe_customer_id IS NULL",
    )
    .bind(customer_id)
    .bind(user_id)
    .execute(&state.pool)
    .await?;

    if result.rows_affected() == 0 {
        tracing::debug!(
            user_id,
            customer_id,
            "stripe checkout customer backfill skipped"
        );
    }

    Ok(())
}

async fn apply_subscription_update(
    state: &AppState,
    event_created: i64,
    customer_id: &str,
    status: &str,
    current_period_end: i64,
    price_id: Option<&str>,
) -> Result<(), AppError> {
    let result = sqlx::query(
        "UPDATE users
         SET subscription_status = ?,
             subscription_current_period_end = ?,
             subscription_price_id = ?,
             last_stripe_event_created = ?,
             updated_at = datetime('now')
         WHERE stripe_customer_id = ?
           AND (last_stripe_event_created IS NULL OR last_stripe_event_created <= ?)",
    )
    .bind(status)
    .bind(current_period_end)
    .bind(price_id)
    .bind(event_created)
    .bind(customer_id)
    .bind(event_created)
    .execute(&state.pool)
    .await?;

    if result.rows_affected() == 0 {
        log_skipped_subscription_event(state, customer_id, event_created).await?;
    }

    Ok(())
}

async fn apply_subscription_deleted(
    state: &AppState,
    event_created: i64,
    customer_id: &str,
) -> Result<(), AppError> {
    let result = sqlx::query(
        "UPDATE users
         SET subscription_status = 'canceled',
             last_stripe_event_created = ?,
             updated_at = datetime('now')
         WHERE stripe_customer_id = ?
           AND (last_stripe_event_created IS NULL OR last_stripe_event_created <= ?)",
    )
    .bind(event_created)
    .bind(customer_id)
    .bind(event_created)
    .execute(&state.pool)
    .await?;

    if result.rows_affected() == 0 {
        log_skipped_subscription_event(state, customer_id, event_created).await?;
    }

    Ok(())
}

async fn log_skipped_subscription_event(
    state: &AppState,
    customer_id: &str,
    event_created: i64,
) -> Result<(), AppError> {
    let existing = sqlx::query_as::<_, StripeEventState>(
        "SELECT last_stripe_event_created
         FROM users
         WHERE stripe_customer_id = ?",
    )
    .bind(customer_id)
    .fetch_optional(&state.pool)
    .await?;

    match existing {
        Some(existing)
            if existing.last_stripe_event_created.unwrap_or_default() > event_created =>
        {
            tracing::debug!(
                customer_id,
                event_created,
                last_event_created = existing.last_stripe_event_created,
                "ignoring stale stripe subscription event"
            );
        }
        Some(_) => {
            tracing::warn!(customer_id, "stripe subscription event update was skipped");
        }
        None => {
            tracing::warn!(
                customer_id,
                "stripe subscription event had no matching user"
            );
        }
    }

    Ok(())
}

fn parse_customer_id(customer_id: &str) -> Result<stripe::CustomerId, AppError> {
    customer_id.parse().map_err(|err| {
        AppError::Internal(format!(
            "invalid stored stripe customer id {customer_id}: {err}"
        ))
    })
}

fn warn_missing_webhook_field(event_type: &str, field: &str) {
    tracing::warn!(
        event_type,
        field,
        "ignoring stripe webhook with missing required field"
    );
}

fn extract_string_id<'a>(object: &'a Value, field: &str) -> Option<&'a str> {
    object.get(field).and_then(|value| {
        value
            .as_str()
            .or_else(|| value.get("id").and_then(Value::as_str))
    })
}

fn extract_price_id(object: &Value) -> Option<&str> {
    object
        .pointer("/items/data/0/price/id")
        .and_then(Value::as_str)
        .or_else(|| {
            object
                .pointer("/items/data/0/price")
                .and_then(Value::as_str)
        })
}

fn extract_current_period_end(object: &Value) -> Option<i64> {
    object
        .get("current_period_end")
        .and_then(Value::as_i64)
        .or_else(|| {
            object
                .pointer("/items/data/0/current_period_end")
                .and_then(Value::as_i64)
        })
}
