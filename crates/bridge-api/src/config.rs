use std::env;
use std::path::PathBuf;

#[derive(Clone)]
pub struct Config {
    pub database_url: String,
    pub base_url: String,
    pub google_client_id: String,
    pub google_client_secret: String,
    pub stripe_secret_key: String,
    pub stripe_webhook_secret: String,
    pub stripe_price_id_monthly: String,
    pub stripe_price_id_annual: String,
    pub billing_success_url: String,
    pub billing_cancel_url: String,
    pub conventions_fixtures_dir: PathBuf,
    /// Origins permitted by the CORS layer. Defaults to `[base_url]` when
    /// `CORS_ALLOWED_ORIGINS` is unset. Use a comma-separated list to allow
    /// multiple. Never ship wildcard CORS for a cookie-authenticated API.
    pub cors_allowed_origins: Vec<String>,
}

impl Config {
    pub fn from_env() -> Self {
        let base_url = env::var("BASE_URL").unwrap_or_else(|_| "http://localhost:1420".to_string());
        let cors_allowed_origins = env::var("CORS_ALLOWED_ORIGINS")
            .ok()
            .map(|raw| {
                raw.split(',')
                    .map(|origin| origin.trim().to_string())
                    .filter(|origin| !origin.is_empty())
                    .collect::<Vec<_>>()
            })
            .filter(|origins| !origins.is_empty())
            .unwrap_or_else(|| vec![base_url.clone()]);

        Self {
            database_url: env::var("DATABASE_URL")
                .unwrap_or_else(|_| "sqlite:///data/bridge.db".to_string()),
            base_url,
            google_client_id: env::var("GOOGLE_CLIENT_ID").unwrap_or_default(),
            google_client_secret: env::var("GOOGLE_CLIENT_SECRET").unwrap_or_default(),
            stripe_secret_key: env::var("STRIPE_SECRET_KEY").unwrap_or_default(),
            stripe_webhook_secret: env::var("STRIPE_WEBHOOK_SECRET").unwrap_or_default(),
            stripe_price_id_monthly: env::var("STRIPE_PRICE_ID_MONTHLY").unwrap_or_default(),
            stripe_price_id_annual: env::var("STRIPE_PRICE_ID_ANNUAL").unwrap_or_default(),
            billing_success_url: env::var("BILLING_SUCCESS_URL").unwrap_or_default(),
            billing_cancel_url: env::var("BILLING_CANCEL_URL").unwrap_or_default(),
            conventions_fixtures_dir: env::var_os("CONVENTIONS_FIXTURES_DIR")
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from("crates/bridge-conventions/fixtures")),
            cors_allowed_origins,
        }
    }
}
