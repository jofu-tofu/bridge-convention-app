use serde::Serialize;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct User {
    pub id: String,
    pub display_name: String,
    pub email: Option<String>,
    pub avatar_url: Option<String>,
    pub stripe_customer_id: Option<String>,
    pub subscription_status: Option<String>,
    pub subscription_current_period_end: Option<i64>,
    pub subscription_price_id: Option<String>,
    pub last_stripe_event_created: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}
