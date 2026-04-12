use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use axum::body::Body;
use axum::http::{HeaderValue, Request};
use axum::response::Response;
use tower::util::ServiceExt;
use uuid::Uuid;

use crate::app;
use crate::auth::models::User;
use crate::billing::stripe_client::{LiveStripeOps, StripeOps};
use crate::config::Config;
use crate::{db, AppState};

pub struct TestHarness {
    pub state: AppState,
    pub fixtures_dir: PathBuf,
    _root: TempDir,
}

impl TestHarness {
    pub async fn new() -> Self {
        let stripe = Arc::new(LiveStripeOps::new("sk_test_unused"));
        Self::new_with_stripe(stripe).await
    }

    pub async fn new_with_stripe(stripe: Arc<dyn StripeOps>) -> Self {
        let root = TempDir::new();
        let fixtures_dir = root.join("fixtures");
        fs::create_dir_all(&fixtures_dir).expect("fixtures dir should be created");

        let database_url = format!("sqlite://{}", root.join("test.db").display());
        let pool = db::init_db(&database_url).await;
        let config = test_config(&fixtures_dir);
        let state = AppState::new_with_stripe(pool, config, stripe);

        Self {
            state,
            fixtures_dir,
            _root: root,
        }
    }

    pub async fn send(&self, request: Request<Body>) -> Response {
        app(self.state.clone())
            .oneshot(request)
            .await
            .expect("request should succeed")
    }

    pub fn write_fixture(&self, bundle_id: &str, contents: &[u8]) {
        fs::write(
            self.fixtures_dir.join(format!("{bundle_id}.json")),
            contents,
        )
        .expect("fixture should be written");
    }

    pub async fn insert_user(&self, user: UserSeed<'_>) {
        sqlx::query(
            "INSERT INTO users (
                id,
                display_name,
                email,
                stripe_customer_id,
                subscription_status,
                subscription_current_period_end,
                subscription_price_id,
                last_stripe_event_created
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(user.id)
        .bind(user.display_name.unwrap_or("Test User"))
        .bind(user.email.unwrap_or("test@example.com"))
        .bind(user.stripe_customer_id)
        .bind(user.subscription_status)
        .bind(user.subscription_current_period_end)
        .bind(user.subscription_price_id)
        .bind(user.last_stripe_event_created)
        .execute(&self.state.pool)
        .await
        .expect("user should insert");
    }

    pub async fn insert_session(&self, user_id: &str) -> String {
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

    pub async fn insert_user_and_session(&self, user: UserSeed<'_>) -> String {
        self.insert_user(user).await;
        self.insert_session(user.id).await
    }

    pub async fn fetch_user(&self, user_id: &str) -> User {
        sqlx::query_as::<_, User>(
            "SELECT id, display_name, email, avatar_url, stripe_customer_id, \
                    subscription_status, subscription_current_period_end, subscription_price_id, \
                    last_stripe_event_created, created_at, updated_at \
             FROM users
             WHERE id = ?",
        )
        .bind(user_id)
        .fetch_one(&self.state.pool)
        .await
        .expect("user should load")
    }

    pub async fn count_users_with_customer_id(&self, customer_id: &str) -> i64 {
        sqlx::query_scalar("SELECT COUNT(*) FROM users WHERE stripe_customer_id = ?")
            .bind(customer_id)
            .fetch_one(&self.state.pool)
            .await
            .expect("count should load")
    }
}

#[derive(Clone, Copy)]
pub struct UserSeed<'a> {
    pub id: &'a str,
    pub display_name: Option<&'a str>,
    pub email: Option<&'a str>,
    pub stripe_customer_id: Option<&'a str>,
    pub subscription_status: Option<&'a str>,
    pub subscription_current_period_end: Option<i64>,
    pub subscription_price_id: Option<&'a str>,
    pub last_stripe_event_created: Option<i64>,
}

impl<'a> UserSeed<'a> {
    pub fn new(id: &'a str) -> Self {
        Self {
            id,
            display_name: None,
            email: None,
            stripe_customer_id: None,
            subscription_status: None,
            subscription_current_period_end: None,
            subscription_price_id: None,
            last_stripe_event_created: None,
        }
    }
}

pub fn session_cookie_header(session_token: &str) -> HeaderValue {
    HeaderValue::from_str(&format!("session={session_token}")).expect("cookie header should parse")
}

pub fn test_config(fixtures_dir: &Path) -> Config {
    Config {
        database_url: "sqlite://unused".to_string(),
        base_url: "http://localhost:1420".to_string(),
        google_client_id: String::new(),
        google_client_secret: String::new(),
        github_client_id: String::new(),
        github_client_secret: String::new(),
        stripe_secret_key: "sk_test_unused".to_string(),
        stripe_webhook_secret: "whsec_test_secret".to_string(),
        stripe_price_id_monthly: "price_monthly_test".to_string(),
        stripe_price_id_annual: "price_annual_test".to_string(),
        billing_success_url: "https://bridge.local/success".to_string(),
        billing_cancel_url: "https://bridge.local/cancel".to_string(),
        conventions_fixtures_dir: fixtures_dir.to_path_buf(),
    }
}

pub struct TempDir {
    path: PathBuf,
}

impl TempDir {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!("bridge-api-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&path).expect("temp dir should be created");
        Self { path }
    }

    pub fn join(&self, child: &str) -> PathBuf {
        self.path.join(child)
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}
