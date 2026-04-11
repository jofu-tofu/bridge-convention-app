use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Redirect, Response};
use axum_extra::extract::cookie::Cookie;
use axum_extra::extract::CookieJar;
use rand::Rng;
use serde::Deserialize;

use crate::error::AppError;
use crate::AppState;

use super::oauth::{self, OAuthProvider};
use super::session;

#[derive(Deserialize)]
pub struct CallbackQuery {
    code: String,
    state: String,
}

/// GET /api/auth/login/:provider — redirect to OAuth consent screen
pub async fn login_redirect(
    State(state): State<AppState>,
    Path(provider_str): Path<String>,
    jar: CookieJar,
) -> Result<(CookieJar, Redirect), AppError> {
    let provider = OAuthProvider::from_str(&provider_str)
        .ok_or_else(|| AppError::BadRequest(format!("unknown provider: {provider_str}")))?;

    // Generate CSRF state token
    let mut csrf_bytes = [0u8; 32];
    rand::thread_rng().fill(&mut csrf_bytes);
    let csrf_state = hex::encode(csrf_bytes);

    let url = oauth::authorization_url(provider, &state.config, &csrf_state);

    // Set state in httpOnly cookie (10-min TTL, scoped to callback path)
    let cookie = Cookie::build(("oauth_state", csrf_state))
        .http_only(true)
        .secure(true)
        .same_site(axum_extra::extract::cookie::SameSite::Lax)
        .max_age(time::Duration::seconds(600))
        .path("/api/auth/callback")
        .build();

    Ok((jar.add(cookie), Redirect::temporary(&url)))
}

/// GET /api/auth/callback/:provider — exchange code, create/link user, set session
pub async fn oauth_callback(
    State(state): State<AppState>,
    Path(provider_str): Path<String>,
    Query(query): Query<CallbackQuery>,
    jar: CookieJar,
) -> Result<(CookieJar, Redirect), AppError> {
    let provider = OAuthProvider::from_str(&provider_str)
        .ok_or_else(|| AppError::BadRequest(format!("unknown provider: {provider_str}")))?;

    // Verify CSRF state
    let stored_state = jar
        .get("oauth_state")
        .map(|c| c.value().to_string())
        .ok_or(AppError::Forbidden)?;

    if stored_state != query.state {
        return Err(AppError::Forbidden);
    }

    // Exchange code for profile
    let profile = oauth::exchange_code(provider, &state.config, &query.code).await?;

    // Resolve or create user (auto-merge by email)
    let user_id = resolve_user(&state, &provider_str, &profile).await?;

    // Create session
    let token = session::create_session(&state.pool, &user_id).await?;

    // Clear CSRF cookie, set session cookie
    let jar = jar.remove(
        Cookie::build("oauth_state")
            .path("/api/auth/callback")
            .build(),
    );
    let session_cookie = Cookie::build(("session", token))
        .http_only(true)
        .secure(true)
        .same_site(axum_extra::extract::cookie::SameSite::Lax)
        .max_age(time::Duration::seconds(2_592_000)) // 30 days
        .path("/")
        .build();

    Ok((jar.add(session_cookie), Redirect::temporary("/")))
}

/// POST /api/auth/logout — clear session
pub async fn logout(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<(CookieJar, StatusCode), AppError> {
    if let Some(cookie) = jar.get("session") {
        session::delete_session(&state.pool, cookie.value()).await?;
    }
    let jar = jar.remove(Cookie::build("session").path("/").build());
    Ok((jar, StatusCode::OK))
}

/// GET /api/auth/me — return current user or 401
pub async fn get_me(State(state): State<AppState>, jar: CookieJar) -> Result<Response, AppError> {
    let token = jar
        .get("session")
        .map(|c| c.value().to_string())
        .ok_or(AppError::Unauthorized)?;

    let user = session::lookup_session(&state.pool, &token)
        .await?
        .ok_or(AppError::Unauthorized)?;

    Ok(axum::Json(user).into_response())
}

/// Resolve an OAuth profile to a user ID, creating or linking as needed.
async fn resolve_user(
    state: &AppState,
    provider: &str,
    profile: &oauth::OAuthProfile,
) -> Result<String, AppError> {
    // 1. Check existing identity
    let existing: Option<(String,)> = sqlx::query_as(
        "SELECT user_id FROM oauth_identities WHERE provider = ? AND provider_user_id = ?",
    )
    .bind(provider)
    .bind(&profile.provider_user_id)
    .fetch_optional(&state.pool)
    .await?;

    if let Some((user_id,)) = existing {
        return Ok(user_id);
    }

    // 2. Auto-merge by email (only if email is non-null and non-empty)
    if let Some(ref email) = profile.email {
        if !email.is_empty() {
            let by_email: Option<(String,)> =
                sqlx::query_as("SELECT id FROM users WHERE email = ?")
                    .bind(email)
                    .fetch_optional(&state.pool)
                    .await?;

            if let Some((user_id,)) = by_email {
                // Link new identity to existing user
                let identity_id = uuid::Uuid::new_v4().to_string();
                sqlx::query(
                    "INSERT INTO oauth_identities (id, user_id, provider, provider_user_id) VALUES (?, ?, ?, ?)",
                )
                .bind(&identity_id)
                .bind(&user_id)
                .bind(provider)
                .bind(&profile.provider_user_id)
                .execute(&state.pool)
                .await?;

                return Ok(user_id);
            }
        }
    }

    // 3. Create new user + identity
    let user_id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO users (id, display_name, email, avatar_url) VALUES (?, ?, ?, ?)")
        .bind(&user_id)
        .bind(&profile.name)
        .bind(&profile.email)
        .bind(&profile.avatar_url)
        .execute(&state.pool)
        .await?;

    let identity_id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO oauth_identities (id, user_id, provider, provider_user_id) VALUES (?, ?, ?, ?)",
    )
    .bind(&identity_id)
    .bind(&user_id)
    .bind(provider)
    .bind(&profile.provider_user_id)
    .execute(&state.pool)
    .await?;

    Ok(user_id)
}
