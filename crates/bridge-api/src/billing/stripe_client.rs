use std::collections::HashMap;
use std::fmt;

use async_trait::async_trait;
use chrono::Utc;
use hmac::{Hmac, Mac};
use serde_json::Value;
use sha2::Sha256;
use stripe::{
    BillingPortalSession, CheckoutSession, CheckoutSessionMode, Client, CreateBillingPortalSession,
    CreateCheckoutSession, CreateCheckoutSessionLineItems, CreateCustomer, Customer, CustomerId,
    Metadata, StripeError,
};
use subtle::ConstantTimeEq;

use crate::error::AppError;

#[async_trait]
pub trait StripeOps: Send + Sync {
    async fn create_customer(
        &self,
        user_id: &str,
        email: Option<&str>,
    ) -> Result<CustomerId, AppError>;

    async fn create_checkout_session(
        &self,
        customer_id: &CustomerId,
        price_id: &str,
        user_id: &str,
        success_url: &str,
        cancel_url: &str,
    ) -> Result<String, AppError>;

    async fn create_portal_session(
        &self,
        customer_id: &CustomerId,
        return_url: &str,
    ) -> Result<String, AppError>;
}

pub struct LiveStripeOps {
    client: Client,
}

impl LiveStripeOps {
    pub fn new(secret_key: &str) -> Self {
        Self {
            client: Client::new(secret_key),
        }
    }
}

#[async_trait]
impl StripeOps for LiveStripeOps {
    async fn create_customer(
        &self,
        user_id: &str,
        email: Option<&str>,
    ) -> Result<CustomerId, AppError> {
        let customer = create_customer(&self.client, user_id, email)
            .await
            .map_err(|err| map_stripe_error("create customer", err))?;

        Ok(customer.id)
    }

    async fn create_checkout_session(
        &self,
        customer_id: &CustomerId,
        price_id: &str,
        user_id: &str,
        success_url: &str,
        cancel_url: &str,
    ) -> Result<String, AppError> {
        let session = create_checkout_session(
            &self.client,
            customer_id,
            price_id,
            user_id,
            success_url,
            cancel_url,
        )
        .await
        .map_err(|err| map_stripe_error("create checkout session", err))?;

        session
            .url
            .ok_or_else(|| AppError::Internal("stripe checkout session missing url".to_string()))
    }

    async fn create_portal_session(
        &self,
        customer_id: &CustomerId,
        return_url: &str,
    ) -> Result<String, AppError> {
        let session = create_portal_session(&self.client, customer_id, return_url)
            .await
            .map_err(|err| map_stripe_error("create billing portal session", err))?;

        Ok(session.url)
    }
}

fn map_stripe_error(action: &str, err: StripeError) -> AppError {
    AppError::Internal(format!("failed to {action}: {err}"))
}

pub async fn create_customer(
    client: &Client,
    user_id: &str,
    email: Option<&str>,
) -> Result<Customer, StripeError> {
    let mut params = CreateCustomer::new();
    let mut metadata = HashMap::new();
    metadata.insert("user_id".to_string(), user_id.to_string());
    params.email = email;
    params.metadata = Some(Metadata::from(metadata));

    Customer::create(client, params).await
}

pub async fn create_checkout_session(
    client: &Client,
    customer_id: &CustomerId,
    price_id: &str,
    user_id: &str,
    success_url: &str,
    cancel_url: &str,
) -> Result<CheckoutSession, StripeError> {
    let mut params = CreateCheckoutSession::new();
    params.mode = Some(CheckoutSessionMode::Subscription);
    params.client_reference_id = Some(user_id);
    params.customer = Some(customer_id.clone());
    params.success_url = Some(success_url);
    params.cancel_url = Some(cancel_url);
    params.line_items = Some(vec![CreateCheckoutSessionLineItems {
        price: Some(price_id.to_string()),
        quantity: Some(1),
        ..Default::default()
    }]);

    CheckoutSession::create(client, params).await
}

pub async fn create_portal_session(
    client: &Client,
    customer_id: &CustomerId,
    return_url: &str,
) -> Result<BillingPortalSession, StripeError> {
    let mut params = CreateBillingPortalSession::new(customer_id.clone());
    params.return_url = Some(return_url);

    BillingPortalSession::create(client, params).await
}

#[derive(Debug, Clone, PartialEq)]
pub struct VerifiedEvent {
    pub id: String,
    pub type_: String,
    pub created: i64,
    pub data_object: Value,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WebhookError {
    InvalidSignature,
    TimestampOutOfRange,
    MalformedPayload,
    MalformedSignatureHeader,
}

impl fmt::Display for WebhookError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidSignature => f.write_str("invalid stripe webhook signature"),
            Self::TimestampOutOfRange => {
                f.write_str("stripe webhook timestamp outside replay window")
            }
            Self::MalformedPayload => f.write_str("malformed stripe webhook payload"),
            Self::MalformedSignatureHeader => {
                f.write_str("malformed stripe webhook signature header")
            }
        }
    }
}

impl std::error::Error for WebhookError {}

pub fn verify_webhook(
    payload: &[u8],
    sig_header: &str,
    secret: &str,
) -> Result<VerifiedEvent, WebhookError> {
    let (timestamp, signatures) = parse_signature_header(sig_header)?;
    verify_signature(payload, timestamp, &signatures, secret)?;
    parse_verified_event(payload)
}

fn parse_signature_header(sig_header: &str) -> Result<(i64, Vec<Vec<u8>>), WebhookError> {
    let mut timestamp = None;
    let mut signatures = Vec::new();

    for part in sig_header.split(',') {
        let (key, value) = part
            .split_once('=')
            .ok_or(WebhookError::MalformedSignatureHeader)?;

        match key.trim() {
            "t" => {
                if timestamp.is_some() {
                    return Err(WebhookError::MalformedSignatureHeader);
                }

                timestamp = Some(
                    value
                        .trim()
                        .parse::<i64>()
                        .map_err(|_| WebhookError::MalformedSignatureHeader)?,
                );
            }
            "v1" => signatures.push(
                hex::decode(value.trim()).map_err(|_| WebhookError::MalformedSignatureHeader)?,
            ),
            _ => {}
        }
    }

    let timestamp = timestamp.ok_or(WebhookError::MalformedSignatureHeader)?;
    if signatures.is_empty() {
        return Err(WebhookError::MalformedSignatureHeader);
    }

    Ok((timestamp, signatures))
}

fn verify_signature(
    payload: &[u8],
    timestamp: i64,
    signatures: &[Vec<u8>],
    secret: &str,
) -> Result<(), WebhookError> {
    const REPLAY_WINDOW_SECONDS: u64 = 300;

    if Utc::now().timestamp().abs_diff(timestamp) > REPLAY_WINDOW_SECONDS {
        return Err(WebhookError::TimestampOutOfRange);
    }

    let mut mac =
        Hmac::<Sha256>::new_from_slice(secret.as_bytes()).expect("HMAC accepts any key length");
    mac.update(timestamp.to_string().as_bytes());
    mac.update(b".");
    mac.update(payload);
    let expected = mac.finalize().into_bytes();

    if signatures
        .iter()
        .any(|candidate| bool::from(candidate.as_slice().ct_eq(expected.as_slice())))
    {
        Ok(())
    } else {
        Err(WebhookError::InvalidSignature)
    }
}

fn parse_verified_event(payload: &[u8]) -> Result<VerifiedEvent, WebhookError> {
    let envelope: Value =
        serde_json::from_slice(payload).map_err(|_| WebhookError::MalformedPayload)?;

    Ok(VerifiedEvent {
        id: envelope
            .get("id")
            .and_then(Value::as_str)
            .ok_or(WebhookError::MalformedPayload)?
            .to_string(),
        type_: envelope
            .get("type")
            .and_then(Value::as_str)
            .ok_or(WebhookError::MalformedPayload)?
            .to_string(),
        created: envelope
            .get("created")
            .and_then(Value::as_i64)
            .ok_or(WebhookError::MalformedPayload)?,
        data_object: envelope
            .pointer("/data/object")
            .cloned()
            .ok_or(WebhookError::MalformedPayload)?,
    })
}

#[cfg(test)]
mod tests {
    use chrono::Utc;
    use hmac::{Hmac, Mac};
    use sha2::Sha256;

    use super::{verify_webhook, WebhookError};

    fn stripe_signature(payload: &str, secret: &str, timestamp: i64) -> String {
        let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).expect("valid key");
        mac.update(format!("{timestamp}.{payload}").as_bytes());
        let signature = hex::encode(mac.finalize().into_bytes());

        format!("t={timestamp},v1={signature}")
    }

    #[test]
    fn verify_webhook_accepts_valid_signature() {
        let payload = r#"{
  "id": "evt_123",
  "object": "event",
  "account": "acct_123",
  "api_version": "2017-05-25",
  "created": 1533204620,
  "data": {
    "object": {
      "id": "ii_123",
      "object": "invoiceitem",
      "amount": 1000,
      "currency": "usd",
      "customer": "cus_123",
      "date": 1533204620,
      "description": "Test Invoice Item",
      "discountable": false,
      "invoice": "in_123",
      "livemode": false,
      "metadata": {},
      "period": {
        "start": 1533204620,
        "end": 1533204620
      },
      "proration": false,
      "quantity": 3
    }
  },
  "livemode": false,
  "pending_webhooks": 1,
  "request": {
    "id": "req_123",
    "idempotency_key": "idempotency-key-123"
  },
  "type": "invoiceitem.created"
}
"#;
        let timestamp = Utc::now().timestamp();
        let secret = "webhook_secret";
        let signature = stripe_signature(payload, secret, timestamp);

        let event = verify_webhook(payload.as_bytes(), &signature, secret).expect("valid event");

        assert_eq!(event.type_, "invoiceitem.created");
        assert_eq!(event.id, "evt_123");
        assert_eq!(event.created, 1533204620);
        assert_eq!(event.data_object["customer"], "cus_123");
    }

    #[test]
    fn verify_webhook_rejects_bad_signature() {
        let payload = br#"{"id":"evt_123","object":"event","created":1533204620,"data":{"object":{"id":"ii_123","object":"invoiceitem","amount":1000,"currency":"usd","customer":"cus_123","date":1533204620,"discountable":false,"livemode":false,"metadata":{},"period":{"start":1533204620,"end":1533204620},"proration":false}},"livemode":false,"pending_webhooks":1,"request":null,"type":"invoiceitem.created"}"#;
        let signature = "t=1533204620,v1=deadbeef";

        assert_eq!(
            verify_webhook(payload, signature, "webhook_secret"),
            Err(WebhookError::TimestampOutOfRange)
        );
    }
}
