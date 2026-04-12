use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use axum::body::{to_bytes, Body};
use axum::http::{header, Request, StatusCode};
use bridge_api::billing::entitlements::{tier_for, SubscriptionTier};
use bridge_api::billing::stripe_client::StripeOps;
use bridge_api::error::AppError;
use bridge_api::test_support::{session_cookie_header, TestHarness, UserSeed};
use chrono::Utc;
use hmac::{Hmac, Mac};
use serde_json::{json, Value};
use sha2::Sha256;
use stripe::CustomerId;

#[tokio::test]
async fn customer_subscription_created_marks_user_paid() {
    let harness = TestHarness::new().await;
    harness
        .insert_user(UserSeed {
            id: "u1",
            stripe_customer_id: Some("cus_test_123"),
            ..UserSeed::new("u1")
        })
        .await;

    let period_end = Utc::now().timestamp() + 86_400;
    let payload = webhook_event(
        "customer.subscription.created",
        1_500,
        subscription_object("cus_test_123", "active", period_end, "price_test"),
    );

    let response = post_webhook(&harness, &payload, &sign_payload(&payload)).await;
    let user = harness.fetch_user("u1").await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(user.subscription_status.as_deref(), Some("active"));
    assert_eq!(user.subscription_current_period_end, Some(period_end));
    assert_eq!(user.subscription_price_id.as_deref(), Some("price_test"));
    assert_eq!(user.last_stripe_event_created, Some(1_500));
    assert_eq!(
        tier_for(
            user.subscription_status.as_deref(),
            user.subscription_current_period_end,
            Utc::now().timestamp(),
        ),
        SubscriptionTier::Paid
    );
}

#[tokio::test]
async fn customer_subscription_updated_overwrites_existing_fields() {
    let harness = TestHarness::new().await;
    harness
        .insert_user(UserSeed {
            id: "u1",
            stripe_customer_id: Some("cus_test_123"),
            subscription_status: Some("active"),
            subscription_current_period_end: Some(2_000),
            subscription_price_id: Some("price_A"),
            last_stripe_event_created: Some(1_000),
            ..UserSeed::new("u1")
        })
        .await;

    let payload = webhook_event(
        "customer.subscription.updated",
        2_000,
        subscription_object("cus_test_123", "active", 4_592_000, "price_B"),
    );

    let response = post_webhook(&harness, &payload, &sign_payload(&payload)).await;
    let user = harness.fetch_user("u1").await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(user.subscription_status.as_deref(), Some("active"));
    assert_eq!(user.subscription_current_period_end, Some(4_592_000));
    assert_eq!(user.subscription_price_id.as_deref(), Some("price_B"));
    assert_eq!(user.last_stripe_event_created, Some(2_000));
}

#[tokio::test]
async fn customer_subscription_deleted_keeps_future_access_until_period_end() {
    let harness = TestHarness::new().await;
    let period_end = Utc::now().timestamp() + 86_400;
    harness
        .insert_user(UserSeed {
            id: "u1",
            stripe_customer_id: Some("cus_test_123"),
            subscription_status: Some("active"),
            subscription_current_period_end: Some(period_end),
            subscription_price_id: Some("price_A"),
            last_stripe_event_created: Some(1_000),
            ..UserSeed::new("u1")
        })
        .await;

    let payload = webhook_event(
        "customer.subscription.deleted",
        1_500,
        subscription_object("cus_test_123", "canceled", period_end, "price_A"),
    );

    let response = post_webhook(&harness, &payload, &sign_payload(&payload)).await;
    let user = harness.fetch_user("u1").await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(user.subscription_status.as_deref(), Some("canceled"));
    assert_eq!(user.subscription_current_period_end, Some(period_end));
    assert_eq!(
        tier_for(
            user.subscription_status.as_deref(),
            user.subscription_current_period_end,
            Utc::now().timestamp(),
        ),
        SubscriptionTier::Paid
    );
}

#[tokio::test]
async fn stale_subscription_event_is_ignored() {
    let harness = TestHarness::new().await;
    harness
        .insert_user(UserSeed {
            id: "u1",
            stripe_customer_id: Some("cus_test_123"),
            subscription_status: Some("active"),
            subscription_current_period_end: Some(8_000),
            subscription_price_id: Some("price_A"),
            last_stripe_event_created: Some(1_000),
            ..UserSeed::new("u1")
        })
        .await;

    let payload = webhook_event(
        "customer.subscription.updated",
        500,
        subscription_object("cus_test_123", "past_due", 9_000, "price_B"),
    );

    let response = post_webhook(&harness, &payload, &sign_payload(&payload)).await;
    let user = harness.fetch_user("u1").await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(user.subscription_status.as_deref(), Some("active"));
    assert_eq!(user.subscription_current_period_end, Some(8_000));
    assert_eq!(user.subscription_price_id.as_deref(), Some("price_A"));
    assert_eq!(user.last_stripe_event_created, Some(1_000));
}

#[tokio::test]
async fn checkout_session_completed_backfills_missing_customer_id() {
    let harness = TestHarness::new().await;
    harness.insert_user(UserSeed::new("u2")).await;

    let payload = webhook_event(
        "checkout.session.completed",
        1_100,
        checkout_session_object("u2", "cus_test_456"),
    );

    let response = post_webhook(&harness, &payload, &sign_payload(&payload)).await;
    let user = harness.fetch_user("u2").await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(user.stripe_customer_id.as_deref(), Some("cus_test_456"));
    assert_eq!(user.subscription_status, None);
}

#[tokio::test]
async fn unknown_customer_webhook_is_ignored() {
    let harness = TestHarness::new().await;
    harness
        .insert_user(UserSeed {
            id: "u1",
            stripe_customer_id: Some("cus_known_123"),
            subscription_status: Some("active"),
            subscription_current_period_end: Some(10_000),
            subscription_price_id: Some("price_A"),
            last_stripe_event_created: Some(900),
            ..UserSeed::new("u1")
        })
        .await;

    let payload = webhook_event(
        "customer.subscription.updated",
        1_200,
        subscription_object("cus_does_not_exist_999", "past_due", 12_000, "price_B"),
    );

    let response = post_webhook(&harness, &payload, &sign_payload(&payload)).await;
    let user = harness.fetch_user("u1").await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        harness
            .count_users_with_customer_id("cus_does_not_exist_999")
            .await,
        0
    );
    assert_eq!(user.stripe_customer_id.as_deref(), Some("cus_known_123"));
    assert_eq!(user.subscription_status.as_deref(), Some("active"));
    assert_eq!(user.subscription_current_period_end, Some(10_000));
    assert_eq!(user.subscription_price_id.as_deref(), Some("price_A"));
    assert_eq!(user.last_stripe_event_created, Some(900));
}

#[tokio::test]
async fn invalid_webhook_signature_returns_bad_request_without_db_changes() {
    let harness = TestHarness::new().await;
    harness
        .insert_user(UserSeed {
            id: "u1",
            stripe_customer_id: Some("cus_test_123"),
            subscription_status: Some("active"),
            subscription_current_period_end: Some(10_000),
            subscription_price_id: Some("price_A"),
            last_stripe_event_created: Some(900),
            ..UserSeed::new("u1")
        })
        .await;

    let payload = webhook_event(
        "customer.subscription.updated",
        1_200,
        subscription_object("cus_test_123", "past_due", 12_000, "price_B"),
    );

    let response = post_webhook(&harness, &payload, "t=1,v1=deadbeef").await;
    let user = harness.fetch_user("u1").await;

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    assert_eq!(user.subscription_status.as_deref(), Some("active"));
    assert_eq!(user.subscription_current_period_end, Some(10_000));
    assert_eq!(user.subscription_price_id.as_deref(), Some("price_A"));
    assert_eq!(user.last_stripe_event_created, Some(900));
}

#[tokio::test]
async fn invoice_payment_failed_does_not_change_subscription_state() {
    let harness = TestHarness::new().await;
    harness
        .insert_user(UserSeed {
            id: "u1",
            stripe_customer_id: Some("cus_test_123"),
            subscription_status: Some("active"),
            subscription_current_period_end: Some(10_000),
            subscription_price_id: Some("price_A"),
            last_stripe_event_created: Some(900),
            ..UserSeed::new("u1")
        })
        .await;

    let payload = webhook_event(
        "invoice.payment_failed",
        1_200,
        invoice_object("cus_test_123"),
    );

    let response = post_webhook(&harness, &payload, &sign_payload(&payload)).await;
    let user = harness.fetch_user("u1").await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(user.subscription_status.as_deref(), Some("active"));
    assert_eq!(user.subscription_current_period_end, Some(10_000));
    assert_eq!(user.subscription_price_id.as_deref(), Some("price_A"));
    assert_eq!(user.last_stripe_event_created, Some(900));
}

#[tokio::test]
async fn webhook_parser_tolerates_unknown_top_level_fields() {
    let harness = TestHarness::new().await;
    harness
        .insert_user(UserSeed {
            id: "u1",
            stripe_customer_id: Some("cus_test_123"),
            ..UserSeed::new("u1")
        })
        .await;

    let mut payload = serde_json::from_str::<Value>(&webhook_event(
        "customer.subscription.created",
        1_500,
        subscription_object("cus_test_123", "active", 4_592_000, "price_test"),
    ))
    .expect("payload should parse");
    insert_object_field(
        &mut payload,
        "future_top_level_field",
        json!({"beta": true}),
    );
    insert_object_field(&mut payload, "api_version", "2026-03-25.dahlia");

    let payload = payload.to_string();
    let response = post_webhook(&harness, &payload, &sign_payload(&payload)).await;
    let user = harness.fetch_user("u1").await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(user.subscription_status.as_deref(), Some("active"));
    assert_eq!(user.subscription_current_period_end, Some(4_592_000));
    assert_eq!(user.subscription_price_id.as_deref(), Some("price_test"));
}

#[tokio::test]
async fn webhook_parser_tolerates_unknown_data_object_fields() {
    let harness = TestHarness::new().await;
    harness
        .insert_user(UserSeed {
            id: "u1",
            stripe_customer_id: Some("cus_test_123"),
            ..UserSeed::new("u1")
        })
        .await;

    let mut subscription = subscription_object("cus_test_123", "active", 4_592_000, "price_test");
    insert_object_field(
        &mut subscription,
        "automatic_tax",
        json!({"enabled": false, "liability": null}),
    );
    insert_object_field(
        &mut subscription,
        "latest_invoice",
        json!({"id": "in_modern_123", "object": "invoice", "status": "paid"}),
    );
    insert_object_field(
        &mut subscription,
        "mystery_field_from_2027",
        json!({"nested": ["still", "works"]}),
    );

    let payload = webhook_event("customer.subscription.updated", 1_600, subscription);
    let response = post_webhook(&harness, &payload, &sign_payload(&payload)).await;
    let user = harness.fetch_user("u1").await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(user.subscription_status.as_deref(), Some("active"));
    assert_eq!(user.subscription_current_period_end, Some(4_592_000));
    assert_eq!(user.subscription_price_id.as_deref(), Some("price_test"));
    assert_eq!(user.last_stripe_event_created, Some(1_600));
}

#[tokio::test]
async fn webhook_parser_extracts_price_id_from_items_data_array() {
    let harness = TestHarness::new().await;
    harness
        .insert_user(UserSeed {
            id: "u1",
            stripe_customer_id: Some("cus_test_123"),
            ..UserSeed::new("u1")
        })
        .await;

    let payload = webhook_event(
        "customer.subscription.updated",
        1_700,
        json!({
            "id": "sub_test_123",
            "object": "subscription",
            "customer": "cus_test_123",
            "status": "past_due",
            "items": {
                "object": "list",
                "data": [
                    {
                        "id": "si_test_123",
                        "object": "subscription_item",
                        "current_period_end": 4_700_000,
                        "price": {
                            "id": "price_nested_array",
                            "object": "price",
                            "active": true
                        }
                    }
                ]
            }
        }),
    );

    let response = post_webhook(&harness, &payload, &sign_payload(&payload)).await;
    let user = harness.fetch_user("u1").await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(user.subscription_status.as_deref(), Some("past_due"));
    assert_eq!(user.subscription_current_period_end, Some(4_700_000));
    assert_eq!(
        user.subscription_price_id.as_deref(),
        Some("price_nested_array")
    );
}

#[tokio::test]
async fn webhook_parser_rejects_missing_required_field_with_200_not_4xx() {
    let harness = TestHarness::new().await;
    harness
        .insert_user(UserSeed {
            id: "u1",
            stripe_customer_id: Some("cus_test_123"),
            subscription_status: Some("active"),
            subscription_current_period_end: Some(10_000),
            subscription_price_id: Some("price_A"),
            last_stripe_event_created: Some(900),
            ..UserSeed::new("u1")
        })
        .await;

    let payload = webhook_event(
        "customer.subscription.updated",
        1_200,
        json!({
            "id": "sub_test_123",
            "object": "subscription",
            "customer": "cus_test_123",
            "status": "active",
            "items": {
                "object": "list",
                "data": [
                    {
                        "id": "si_test_123",
                        "object": "subscription_item",
                        "price": {
                            "id": "price_B",
                            "object": "price"
                        }
                    }
                ]
            }
        }),
    );

    let response = post_webhook(&harness, &payload, &sign_payload(&payload)).await;
    let user = harness.fetch_user("u1").await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(user.subscription_status.as_deref(), Some("active"));
    assert_eq!(user.subscription_current_period_end, Some(10_000));
    assert_eq!(user.subscription_price_id.as_deref(), Some("price_A"));
    assert_eq!(user.last_stripe_event_created, Some(900));
}

#[tokio::test]
async fn checkout_creates_customer_when_missing_and_returns_url() {
    let mock = Arc::new(MockStripe::new(
        "cus_new_001",
        "https://checkout.stripe.test/x",
        None,
    ));
    let harness = TestHarness::new_with_stripe(mock.clone()).await;
    let session = harness.insert_user_and_session(UserSeed::new("u3")).await;

    let response = harness
        .send(
            Request::builder()
                .method("POST")
                .uri("/api/billing/checkout")
                .header(header::COOKIE, session_cookie_header(&session))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(r#"{"plan":"monthly"}"#))
                .expect("request should build"),
        )
        .await;
    let user = harness.fetch_user("u3").await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response_body(response).await,
        r#"{"url":"https://checkout.stripe.test/x"}"#
    );
    assert_eq!(user.stripe_customer_id.as_deref(), Some("cus_new_001"));
    assert_eq!(
        mock.calls(),
        vec![
            StripeCall::CreateCustomer {
                user_id: "u3".to_string(),
                email: Some("test@example.com".to_string()),
            },
            StripeCall::CreateCheckoutSession {
                customer_id: "cus_new_001".to_string(),
                price_id: "price_monthly_test".to_string(),
                user_id: "u3".to_string(),
                success_url: "https://bridge.local/success".to_string(),
                cancel_url: "https://bridge.local/cancel".to_string(),
            },
        ]
    );
}

#[tokio::test]
async fn checkout_reuses_existing_customer() {
    let mock = Arc::new(MockStripe::new(
        "cus_unused_001",
        "https://checkout.stripe.test/x",
        None,
    ));
    let harness = TestHarness::new_with_stripe(mock.clone()).await;
    let session = harness
        .insert_user_and_session(UserSeed {
            id: "u4",
            stripe_customer_id: Some("cus_existing_222"),
            ..UserSeed::new("u4")
        })
        .await;

    let response = harness
        .send(
            Request::builder()
                .method("POST")
                .uri("/api/billing/checkout")
                .header(header::COOKIE, session_cookie_header(&session))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(r#"{"plan":"monthly"}"#))
                .expect("request should build"),
        )
        .await;
    let user = harness.fetch_user("u4").await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response_body(response).await,
        r#"{"url":"https://checkout.stripe.test/x"}"#
    );
    assert_eq!(user.stripe_customer_id.as_deref(), Some("cus_existing_222"));
    assert_eq!(
        mock.calls(),
        vec![StripeCall::CreateCheckoutSession {
            customer_id: "cus_existing_222".to_string(),
            price_id: "price_monthly_test".to_string(),
            user_id: "u4".to_string(),
            success_url: "https://bridge.local/success".to_string(),
            cancel_url: "https://bridge.local/cancel".to_string(),
        }]
    );
}

#[tokio::test]
async fn checkout_requires_authentication() {
    let mock = Arc::new(MockStripe::new(
        "cus_new_001",
        "https://checkout.stripe.test/x",
        None,
    ));
    let harness = TestHarness::new_with_stripe(mock.clone()).await;

    let response = harness
        .send(
            Request::builder()
                .method("POST")
                .uri("/api/billing/checkout")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(r#"{"plan":"monthly"}"#))
                .expect("request should build"),
        )
        .await;

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    assert!(mock.calls().is_empty());
}

#[tokio::test]
async fn checkout_rejects_invalid_plan_without_calling_stripe() {
    let mock = Arc::new(MockStripe::new(
        "cus_new_001",
        "https://checkout.stripe.test/x",
        None,
    ));
    let harness = TestHarness::new_with_stripe(mock.clone()).await;
    let session = harness.insert_user_and_session(UserSeed::new("u3")).await;

    let response = harness
        .send(
            Request::builder()
                .method("POST")
                .uri("/api/billing/checkout")
                .header(header::COOKIE, session_cookie_header(&session))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(r#"{"plan":"weekly"}"#))
                .expect("request should build"),
        )
        .await;

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    assert!(mock.calls().is_empty());
}

#[tokio::test]
async fn portal_requires_existing_customer_id() {
    let mock = Arc::new(MockStripe::new(
        "cus_new_001",
        "https://checkout.stripe.test/x",
        None,
    ));
    let harness = TestHarness::new_with_stripe(mock.clone()).await;
    let session = harness.insert_user_and_session(UserSeed::new("u5")).await;

    let response = harness
        .send(
            Request::builder()
                .method("POST")
                .uri("/api/billing/portal")
                .header(header::COOKIE, session_cookie_header(&session))
                .body(Body::empty())
                .expect("request should build"),
        )
        .await;

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    assert_eq!(
        response_body(response).await,
        r#"{"error":"no_subscription"}"#
    );
    assert!(mock.calls().is_empty());
}

#[tokio::test]
async fn portal_returns_url_for_existing_customer() {
    let mock = Arc::new(MockStripe::new(
        "cus_unused_001",
        "https://checkout.stripe.test/x",
        Some("https://portal.stripe.test/y"),
    ));
    let harness = TestHarness::new_with_stripe(mock.clone()).await;
    let session = harness
        .insert_user_and_session(UserSeed {
            id: "u6",
            stripe_customer_id: Some("cus_existing_333"),
            ..UserSeed::new("u6")
        })
        .await;

    let response = harness
        .send(
            Request::builder()
                .method("POST")
                .uri("/api/billing/portal")
                .header(header::COOKIE, session_cookie_header(&session))
                .body(Body::empty())
                .expect("request should build"),
        )
        .await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response_body(response).await,
        r#"{"url":"https://portal.stripe.test/y"}"#
    );
    assert_eq!(
        mock.calls(),
        vec![StripeCall::CreatePortalSession {
            customer_id: "cus_existing_333".to_string(),
            return_url: "https://bridge.local/cancel".to_string(),
        }]
    );
}

async fn post_webhook(
    harness: &TestHarness,
    payload: &str,
    signature: &str,
) -> axum::response::Response {
    harness
        .send(
            Request::builder()
                .method("POST")
                .uri("/api/billing/webhook")
                .header("Stripe-Signature", signature)
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(payload.to_string()))
                .expect("request should build"),
        )
        .await
}

async fn response_body(response: axum::response::Response) -> String {
    String::from_utf8(
        to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("response body should read")
            .to_vec(),
    )
    .expect("response body should be utf-8")
}

fn sign_payload(payload: &str) -> String {
    let timestamp = Utc::now().timestamp();
    let mut mac = Hmac::<Sha256>::new_from_slice(b"whsec_test_secret").expect("valid key");
    mac.update(format!("{timestamp}.{payload}").as_bytes());
    let signature = hex::encode(mac.finalize().into_bytes());

    format!("t={timestamp},v1={signature}")
}

fn webhook_event(event_type: &str, created: i64, object: Value) -> String {
    json!({
        "id": "evt_test_123",
        "object": "event",
        "created": created,
        "data": { "object": object },
        "livemode": false,
        "pending_webhooks": 1,
        "request": null,
        "type": event_type
    })
    .to_string()
}

fn checkout_session_object(user_id: &str, customer_id: &str) -> Value {
    json!({
        "id": "cs_test_123",
        "object": "checkout.session",
        "client_reference_id": user_id,
        "created": Utc::now().timestamp(),
        "customer": customer_id,
        "expires_at": Utc::now().timestamp() + 3_600,
        "livemode": false,
        "mode": "subscription"
    })
}

fn subscription_object(
    customer_id: &str,
    status: &str,
    current_period_end: i64,
    price_id: &str,
) -> Value {
    json!({
        "id": "sub_test_123",
        "object": "subscription",
        "billing_cycle_anchor": current_period_end - 2_592_000,
        "cancel_at_period_end": false,
        "created": current_period_end - 2_592_000,
        "current_period_end": current_period_end,
        "current_period_start": current_period_end - 2_592_000,
        "customer": customer_id,
        "items": {
            "object": "list",
            "data": [
                {
                    "id": "si_test_123",
                    "object": "subscription_item",
                    "created": Utc::now().timestamp(),
                    "quantity": 1,
                    "subscription": "sub_test_123",
                    "price": {
                        "id": price_id,
                        "object": "price",
                        "active": true,
                        "created": Utc::now().timestamp(),
                        "livemode": false
                    }
                }
            ]
        },
        "livemode": false,
        "start_date": current_period_end - 2_592_000,
        "status": status
    })
}

fn invoice_object(customer_id: &str) -> Value {
    json!({
        "id": "in_test_123",
        "object": "invoice",
        "customer": customer_id
    })
}

fn insert_object_field(value: &mut Value, key: &str, field_value: impl Into<Value>) {
    let Value::Object(map) = value else {
        panic!("expected stripe object to serialize as a JSON object");
    };
    map.insert(key.to_string(), field_value.into());
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum StripeCall {
    CreateCustomer {
        user_id: String,
        email: Option<String>,
    },
    CreateCheckoutSession {
        customer_id: String,
        price_id: String,
        user_id: String,
        success_url: String,
        cancel_url: String,
    },
    CreatePortalSession {
        customer_id: String,
        return_url: String,
    },
}

struct MockStripe {
    created_customer_id: CustomerId,
    checkout_url: String,
    portal_url: Option<String>,
    calls: Mutex<Vec<StripeCall>>,
}

impl MockStripe {
    fn new(created_customer_id: &str, checkout_url: &str, portal_url: Option<&str>) -> Self {
        Self {
            created_customer_id: created_customer_id
                .parse()
                .expect("customer id should parse"),
            checkout_url: checkout_url.to_string(),
            portal_url: portal_url.map(str::to_string),
            calls: Mutex::new(Vec::new()),
        }
    }

    fn calls(&self) -> Vec<StripeCall> {
        self.calls.lock().expect("calls mutex should lock").clone()
    }
}

#[async_trait]
impl StripeOps for MockStripe {
    async fn create_customer(
        &self,
        user_id: &str,
        email: Option<&str>,
    ) -> Result<CustomerId, AppError> {
        self.calls
            .lock()
            .expect("calls mutex should lock")
            .push(StripeCall::CreateCustomer {
                user_id: user_id.to_string(),
                email: email.map(str::to_string),
            });

        Ok(self.created_customer_id.clone())
    }

    async fn create_checkout_session(
        &self,
        customer_id: &CustomerId,
        price_id: &str,
        user_id: &str,
        success_url: &str,
        cancel_url: &str,
    ) -> Result<String, AppError> {
        self.calls.lock().expect("calls mutex should lock").push(
            StripeCall::CreateCheckoutSession {
                customer_id: customer_id.to_string(),
                price_id: price_id.to_string(),
                user_id: user_id.to_string(),
                success_url: success_url.to_string(),
                cancel_url: cancel_url.to_string(),
            },
        );

        Ok(self.checkout_url.clone())
    }

    async fn create_portal_session(
        &self,
        customer_id: &CustomerId,
        return_url: &str,
    ) -> Result<String, AppError> {
        self.calls
            .lock()
            .expect("calls mutex should lock")
            .push(StripeCall::CreatePortalSession {
                customer_id: customer_id.to_string(),
                return_url: return_url.to_string(),
            });

        Ok(self
            .portal_url
            .clone()
            .expect("portal url should be configured for test"))
    }
}
