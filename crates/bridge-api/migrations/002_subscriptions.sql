ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN subscription_status TEXT;
ALTER TABLE users ADD COLUMN subscription_current_period_end INTEGER;
ALTER TABLE users ADD COLUMN subscription_price_id TEXT;
ALTER TABLE users ADD COLUMN last_stripe_event_created INTEGER;

CREATE UNIQUE INDEX idx_users_stripe_customer
    ON users(stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;
