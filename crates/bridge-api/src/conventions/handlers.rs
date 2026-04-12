use std::io::ErrorKind;

use axum::extract::{Path as AxumPath, State};
use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use axum_extra::extract::CookieJar;
use chrono::Utc;
use serde::Serialize;
use sqlx::SqlitePool;

use crate::auth::models::User;
use crate::auth::session;
use crate::billing::entitlements::{tier_for, SubscriptionTier, FREE_BUNDLE_IDS};
use crate::error::AppError;
use crate::AppState;

#[derive(Serialize)]
struct ErrorResponse {
    error: &'static str,
}

pub async fn get_definition(
    State(state): State<AppState>,
    AxumPath(bundle_id): AxumPath<String>,
    jar: CookieJar,
) -> Result<Response, AppError> {
    if !is_safe_bundle_id(&bundle_id) {
        return Ok(error_response(StatusCode::BAD_REQUEST, "invalid_bundle_id"));
    }

    if !FREE_BUNDLE_IDS.contains(&bundle_id.as_str()) {
        let user = match current_user(&state.pool, &jar).await? {
            Some(user) => user,
            None => return Ok(error_response(StatusCode::UNAUTHORIZED, "auth_required")),
        };

        let tier = tier_for(
            user.subscription_status.as_deref(),
            user.subscription_current_period_end,
            Utc::now().timestamp(),
        );

        if tier != SubscriptionTier::Paid {
            return Ok(error_response(
                StatusCode::PAYMENT_REQUIRED,
                "subscription_required",
            ));
        }
    }

    let path = state
        .config
        .conventions_fixtures_dir
        .join(format!("{bundle_id}.json"));

    match tokio::fs::read(&path).await {
        Ok(bytes) => Ok(([(header::CONTENT_TYPE, "application/json")], bytes).into_response()),
        Err(error) if error.kind() == ErrorKind::NotFound => {
            Ok(error_response(StatusCode::NOT_FOUND, "bundle_not_found"))
        }
        Err(error) => Err(AppError::Internal(format!(
            "failed to read bundle fixture {}: {error}",
            path.display()
        ))),
    }
}

fn error_response(status: StatusCode, error: &'static str) -> Response {
    (status, Json(ErrorResponse { error })).into_response()
}

async fn current_user(pool: &SqlitePool, jar: &CookieJar) -> Result<Option<User>, AppError> {
    let Some(token) = jar.get("session").map(|cookie| cookie.value().to_string()) else {
        return Ok(None);
    };

    Ok(session::lookup_session(pool, &token).await?)
}

pub fn is_safe_bundle_id(bundle_id: &str) -> bool {
    !bundle_id.is_empty()
        && !bundle_id.contains("..")
        && bundle_id
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_'))
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use axum::body::{to_bytes, Body};
    use axum::http::Request;
    use std::fs;
    use tower::util::ServiceExt;

    use super::*;
    use crate::config::Config;
    use crate::db;

    #[test]
    fn safe_bundle_ids_allow_expected_names() {
        assert!(is_safe_bundle_id("nt-bundle"));
        assert!(is_safe_bundle_id("some-bundle_123"));
    }

    #[test]
    fn safe_bundle_ids_reject_unsafe_names() {
        for bundle_id in ["../etc/passwd", "a/b", "a\\b", ""] {
            assert!(
                !is_safe_bundle_id(bundle_id),
                "{bundle_id} should be rejected"
            );
        }
    }

    #[tokio::test]
    async fn free_bundle_allows_anonymous_access() {
        let harness = TestHarness::new().await;
        harness.write_fixture("nt-bundle", br#"{"test":true}"#);

        let response = harness.request("nt-bundle", None).await;

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            response
                .headers()
                .get(header::CONTENT_TYPE)
                .and_then(|value| value.to_str().ok()),
            Some("application/json")
        );
        assert_eq!(response_body(response).await, br#"{"test":true}"#);
    }

    #[tokio::test]
    async fn paid_bundle_requires_auth_for_anonymous_user() {
        let harness = TestHarness::new().await;
        harness.write_fixture("paid-bundle", br#"{"test":true}"#);

        let response = harness.request("paid-bundle", None).await;

        assert_error(
            response,
            StatusCode::UNAUTHORIZED,
            r#"{"error":"auth_required"}"#,
        )
        .await;
    }

    #[tokio::test]
    async fn paid_bundle_requires_subscription_for_free_user() {
        let harness = TestHarness::new().await;
        harness.write_fixture("paid-bundle", br#"{"test":true}"#);
        let session_token = harness
            .insert_user_and_session(None, None, "free-user")
            .await;

        let response = harness.request("paid-bundle", Some(&session_token)).await;

        assert_error(
            response,
            StatusCode::PAYMENT_REQUIRED,
            r#"{"error":"subscription_required"}"#,
        )
        .await;
    }

    #[tokio::test]
    async fn paid_bundle_allows_active_subscription() {
        let harness = TestHarness::new().await;
        harness.write_fixture("paid-bundle", br#"{"test":true}"#);
        let session_token = harness
            .insert_user_and_session(Some("active"), Some(4_102_444_800), "paid-user")
            .await;

        let response = harness.request("paid-bundle", Some(&session_token)).await;

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response_body(response).await, br#"{"test":true}"#);
    }

    #[tokio::test]
    async fn missing_bundle_returns_not_found() {
        let harness = TestHarness::new().await;
        let session_token = harness
            .insert_user_and_session(Some("active"), Some(4_102_444_800), "paid-user")
            .await;

        let response = harness
            .request("missing-bundle", Some(&session_token))
            .await;

        assert_error(
            response,
            StatusCode::NOT_FOUND,
            r#"{"error":"bundle_not_found"}"#,
        )
        .await;
    }

    #[tokio::test]
    async fn path_traversal_is_rejected() {
        let harness = TestHarness::new().await;

        let response = harness.request("..", None).await;

        assert_error(
            response,
            StatusCode::BAD_REQUEST,
            r#"{"error":"invalid_bundle_id"}"#,
        )
        .await;
    }

    async fn assert_error(response: Response, status: StatusCode, body: &str) {
        assert_eq!(response.status(), status);
        assert_eq!(response_body(response).await, body.as_bytes());
    }

    async fn response_body(response: Response) -> Vec<u8> {
        to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("response body should read")
            .to_vec()
    }

    struct TestHarness {
        state: AppState,
        fixtures_dir: std::path::PathBuf,
        _root: TempDir,
    }

    impl TestHarness {
        async fn new() -> Self {
            let root = TempDir::new();
            let fixtures_dir = root.join("fixtures");
            fs::create_dir_all(&fixtures_dir).expect("fixtures dir should be created");

            let database_url = format!("sqlite://{}", root.join("test.db").display());
            let pool = db::init_db(&database_url).await;
            let config = test_config(&fixtures_dir);
            let state = AppState::new(pool, config);

            Self {
                state,
                fixtures_dir,
                _root: root,
            }
        }

        fn write_fixture(&self, bundle_id: &str, contents: &[u8]) {
            fs::write(
                self.fixtures_dir.join(format!("{bundle_id}.json")),
                contents,
            )
            .expect("fixture should be written");
        }

        async fn insert_user_and_session(
            &self,
            subscription_status: Option<&str>,
            subscription_current_period_end: Option<i64>,
            user_id: &str,
        ) -> String {
            sqlx::query(
                "INSERT INTO users (
                    id,
                    display_name,
                    email,
                    subscription_status,
                    subscription_current_period_end
                ) VALUES (?, ?, ?, ?, ?)",
            )
            .bind(user_id)
            .bind(format!("User {user_id}"))
            .bind(format!("{user_id}@example.com"))
            .bind(subscription_status)
            .bind(subscription_current_period_end)
            .execute(&self.state.pool)
            .await
            .expect("user should insert");

            let token = format!("session-{user_id}");
            sqlx::query("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
                .bind(&token)
                .bind(user_id)
                .bind("2999-01-01 00:00:00")
                .execute(&self.state.pool)
                .await
                .expect("session should insert");

            token
        }

        async fn request(&self, bundle_id: &str, session_token: Option<&str>) -> Response {
            let mut request = Request::builder()
                .uri(format!("/api/conventions/{bundle_id}/definition"))
                .body(Body::empty())
                .expect("request should build");

            if let Some(session_token) = session_token {
                request.headers_mut().insert(
                    header::COOKIE,
                    format!("session={session_token}")
                        .parse()
                        .expect("cookie header should parse"),
                );
            }

            crate::conventions::conventions_routes()
                .with_state(self.state.clone())
                .oneshot(request)
                .await
                .expect("request should succeed")
        }
    }

    fn test_config(fixtures_dir: &Path) -> Config {
        Config {
            database_url: "sqlite://unused".to_string(),
            base_url: "http://localhost:1420".to_string(),
            google_client_id: String::new(),
            google_client_secret: String::new(),
            stripe_secret_key: String::new(),
            stripe_webhook_secret: String::new(),
            stripe_price_id_monthly: String::new(),
            stripe_price_id_annual: String::new(),
            billing_success_url: String::new(),
            billing_cancel_url: String::new(),
            conventions_fixtures_dir: fixtures_dir.to_path_buf(),
        }
    }

    struct TempDir {
        path: std::path::PathBuf,
    }

    impl TempDir {
        fn new() -> Self {
            let path =
                std::env::temp_dir().join(format!("bridge-api-test-{}", uuid::Uuid::new_v4()));
            fs::create_dir_all(&path).expect("temp dir should be created");
            Self { path }
        }
        fn join(&self, child: &str) -> std::path::PathBuf {
            self.path.join(child)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }
}
