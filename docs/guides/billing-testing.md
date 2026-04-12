# Billing Testing Runbook

Manual verification guide for Stripe checkout, webhook handling, and paid-access
state changes.

## Prerequisites

- Stripe CLI installed
- `stripe login` already completed
- Repo root `.env` filled with Stripe sandbox values

## Local API + Webhook Loop

Start the API:

```bash
cargo run -p bridge-api
```

Start the Stripe webhook forwarder in a second terminal:

```bash
stripe listen --forward-to localhost:3001/api/billing/webhook
```

Copy the printed `whsec_...` secret into `STRIPE_WEBHOOK_SECRET` in `.env` if it
changed.

Prefer Stripe CLI-triggered events over hand-authored JSON when validating webhook
handling. Real Stripe payloads can carry newer fields than older client libraries,
so CLI smoke tests are the regression check for parser compatibility.

## Trigger Individual Events

Use the Stripe CLI to exercise each webhook path:

```bash
stripe trigger customer.subscription.created
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
stripe trigger invoice.payment_failed
```

Expected behavior:

- `customer.subscription.created` marks the matching user as paid
- `customer.subscription.updated` overwrites status / period-end / price ID when newer
- `customer.subscription.deleted` keeps paid access through `current_period_end`
- `invoice.payment_failed` does not immediately downgrade the user
- If the event references a Stripe customer that is not in the local database, the
  webhook should still return `200` and log that no matching user was found

## Manual End-To-End Checkout

1. Start the frontend with the normal local dev flow.
2. Log in with a test account.
3. Open a locked paid bundle.
4. In the paywall, click `Subscribe`.
5. Complete Stripe Checkout with card `4242 4242 4242 4242`.
6. Confirm the app redirects to `/billing/success`.
7. Verify the database row now has Stripe customer/subscription fields and the UI unlocks paid practice.

## Useful Test Cards

- Success: `4242 4242 4242 4242`
- 3DS authentication required: `4000 0025 0000 3155`
- Declined card: `4000 0000 0000 9995`

Stripe keeps the full catalog here:
`https://stripe.com/docs/testing`

## Simulate Tier Expiration Without Waiting

To verify `Expired` handling, move the stored period end into the past:

```sql
UPDATE users
SET subscription_current_period_end = strftime('%s', 'now') - 60
WHERE email = '<user-email>';
```

Refresh the session or log in again and confirm paid access collapses back to
free-tier behavior.
