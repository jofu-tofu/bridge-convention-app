// Mirror of TS const FREE_PRACTICE_BUNDLE in src/stores/entitlements.ts — keep in sync.
#[allow(dead_code)]
pub const FREE_BUNDLE_IDS: &[&str] = &["nt-bundle"];

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum SubscriptionTier {
    Free,
    Paid,
    Expired,
}

pub fn tier_for(
    subscription_status: Option<&str>,
    current_period_end: Option<i64>,
    now_unix: i64,
) -> SubscriptionTier {
    match subscription_status {
        None => SubscriptionTier::Free,
        Some(status) => {
            let end = current_period_end.unwrap_or(0);
            let active_statuses = matches!(status, "active" | "trialing" | "past_due" | "canceled");
            if active_statuses && now_unix < end {
                SubscriptionTier::Paid
            } else {
                SubscriptionTier::Expired
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{tier_for, SubscriptionTier};

    #[test]
    fn none_status_is_free() {
        assert_eq!(tier_for(None, None, 100), SubscriptionTier::Free);
    }

    #[test]
    fn active_is_paid_before_period_end() {
        assert_eq!(
            tier_for(Some("active"), Some(200), 100),
            SubscriptionTier::Paid
        );
    }

    #[test]
    fn active_is_expired_at_or_after_period_end() {
        assert_eq!(
            tier_for(Some("active"), Some(100), 100),
            SubscriptionTier::Expired
        );
        assert_eq!(
            tier_for(Some("active"), Some(100), 101),
            SubscriptionTier::Expired
        );
    }

    #[test]
    fn trialing_past_due_and_canceled_share_active_window_behavior() {
        for status in ["trialing", "past_due", "canceled"] {
            assert_eq!(
                tier_for(Some(status), Some(200), 100),
                SubscriptionTier::Paid
            );
            assert_eq!(
                tier_for(Some(status), Some(100), 100),
                SubscriptionTier::Expired
            );
        }
    }

    #[test]
    fn incomplete_statuses_are_always_expired() {
        for status in ["incomplete", "unpaid", "incomplete_expired"] {
            assert_eq!(
                tier_for(Some(status), Some(200), 100),
                SubscriptionTier::Expired
            );
            assert_eq!(tier_for(Some(status), None, 100), SubscriptionTier::Expired);
        }
    }

    #[test]
    fn unknown_status_is_expired() {
        assert_eq!(
            tier_for(Some("unexpected"), Some(200), 100),
            SubscriptionTier::Expired
        );
    }
}
