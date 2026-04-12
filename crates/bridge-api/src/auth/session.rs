use rand::Rng;
use sqlx::SqlitePool;

use super::models::User;

/// Generate a random 256-bit hex token.
fn generate_token() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill(&mut bytes);
    hex::encode(bytes)
}

pub async fn create_session(pool: &SqlitePool, user_id: &str) -> Result<String, sqlx::Error> {
    let token = generate_token();
    // 30-day expiry
    sqlx::query(
        "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))",
    )
    .bind(&token)
    .bind(user_id)
    .execute(pool)
    .await?;
    Ok(token)
}

pub async fn lookup_session(pool: &SqlitePool, token: &str) -> Result<Option<User>, sqlx::Error> {
    let user = sqlx::query_as::<_, User>(
        "SELECT u.id, u.display_name, u.email, u.avatar_url, u.stripe_customer_id, \
                u.subscription_status, u.subscription_current_period_end, u.subscription_price_id, \
                u.last_stripe_event_created, u.created_at, u.updated_at \
         FROM sessions s JOIN users u ON s.user_id = u.id \
         WHERE s.token = ? AND s.expires_at > datetime('now')",
    )
    .bind(token)
    .fetch_optional(pool)
    .await?;
    Ok(user)
}

pub async fn delete_session(pool: &SqlitePool, token: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM sessions WHERE token = ?")
        .bind(token)
        .execute(pool)
        .await?;
    Ok(())
}
